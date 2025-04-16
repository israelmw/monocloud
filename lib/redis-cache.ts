import { Redis } from "@upstash/redis"

// Get environment variables with fallbacks
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || ""
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ""

// Initialize Redis client with better error handling
const getRedisClient = () => {
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.warn("[RedisCache] Missing Redis credentials, falling back to memory-only cache")
    return null
  }

  return new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
    automaticDeserialization: false, // We'll handle JSON manually
    enableAutoPipelining: false
  })
}

const redis = getRedisClient()

// In-memory cache as fallback
const memoryCache = new Map()

export class RedisCache {
  private prefix: string
  private defaultTTL: number
  private redisAvailable: boolean

  constructor(prefix = "monocloud:", defaultTTL = 60 * 60 * 24) {
    this.prefix = prefix
    this.defaultTTL = defaultTTL
    this.redisAvailable = redis !== null
    
    if (!this.redisAvailable) {
      console.log("[RedisCache] Operating in memory-only mode")
    }
  }

  private getFullKey(key: string): string {
    return `${this.prefix}${key}`
  }

  private safeJSONParse(data: any): any {
    try {
      return typeof data === 'string' ? JSON.parse(data) : data
    } catch (error) {
      console.warn(`[RedisCache] Failed to parse JSON:`, error)
      return data
    }
  }

  private safeJSONStringify(data: any): string {
    try {
      return typeof data === 'string' ? data : JSON.stringify(data)
    } catch (error) {
      console.warn(`[RedisCache] Failed to stringify data:`, error)
      return String(data)
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // First try to get from memory cache
    if (memoryCache.has(key)) {
      console.log(`[RedisCache] Using memory cache for key: ${key}`)
      return this.safeJSONParse(memoryCache.get(key)) as T
    }

    // If Redis is not available, return null
    if (!this.redisAvailable || !redis) {
      return null
    }

    try {
      const fullKey = this.getFullKey(key)
      console.log(`[RedisCache] Fetching from Redis: ${fullKey}`)

      const data = await redis.get(fullKey)

      if (data) {
        console.log(`[RedisCache] Redis cache hit for key: ${key}`)
        // Parse the data and store in memory cache
        const parsedData = this.safeJSONParse(data)
        if (parsedData !== null) {
          memoryCache.set(key, data)
          return parsedData as T
        }
      }

      console.log(`[RedisCache] Redis cache miss for key: ${key}`)
      return null
    } catch (error) {
      console.error(`[RedisCache] Error reading from Redis for key ${key}:`, error)
      return null
    }
  }

  async set<T>(key: string, data: T, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      // Stringify the data before storing
      const stringifiedData = this.safeJSONStringify(data)
      
      // Store in memory cache
      memoryCache.set(key, stringifiedData)
      console.log(`[RedisCache] Set in memory cache for key: ${key}`)

      // If Redis is not available, return true since we stored in memory
      if (!this.redisAvailable || !redis) {
        return true
      }

      const fullKey = this.getFullKey(key)
      console.log(`[RedisCache] Setting in Redis: ${fullKey}, expires in ${ttl} seconds`)

      await redis.set(fullKey, stringifiedData, { ex: ttl })
      return true
    } catch (error) {
      console.error(`[RedisCache] Error writing to Redis for key ${key}:`, error)
      // Still return true if we at least cached in memory
      return memoryCache.has(key)
    }
  }

  async has(key: string): Promise<boolean> {
    // First check memory cache
    if (memoryCache.has(key)) {
      return true
    }

    if (!this.redisAvailable || !redis) {
      return false
    }

    try {
      const fullKey = this.getFullKey(key)
      return (await redis.exists(fullKey)) === 1
    } catch (error) {
      console.error(`[RedisCache] Error checking Redis for key ${key}:`, error)
      return false
    }
  }

  async delete(key: string): Promise<boolean> {
    // Always remove from memory cache
    memoryCache.delete(key)
    console.log(`[RedisCache] Deleted from memory cache: ${key}`)

    if (!this.redisAvailable || !redis) {
      return true
    }

    try {
      const fullKey = this.getFullKey(key)
      await redis.del(fullKey)
      console.log(`[RedisCache] Deleted from Redis: ${fullKey}`)
      return true
    } catch (error) {
      console.error(`[RedisCache] Error deleting from Redis for key ${key}:`, error)
      return false
    }
  }

  async clear(pattern?: string): Promise<boolean> {
    // Clear memory cache
    memoryCache.clear()
    console.log(`[RedisCache] Cleared memory cache`)

    if (!this.redisAvailable || !redis) {
      return true
    }

    try {
      const fullPattern = pattern ? this.getFullKey(pattern) : this.prefix + "*"
      console.log(`[RedisCache] Clearing Redis with pattern: ${fullPattern}`)

      const keys = await redis.keys(fullPattern)
      console.log(`[RedisCache] Found ${keys.length} keys to clear`)

      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`[RedisCache] Cleared ${keys.length} keys from Redis`)
      }

      return true
    } catch (error) {
      console.error(`[RedisCache] Error clearing Redis:`, error)
      return false
    }
  }

  async getStatus() {
    if (!this.redisAvailable || !redis) {
      return {
        available: false,
        readOnly: false,
        keysCount: 0,
        memoryKeysCount: memoryCache.size,
        keysCommandAllowed: false,
        getCommandAllowed: true,
        memoryOnly: true
      }
    }

    try {
      const keys = await redis.keys(this.prefix + "*")
      return {
        available: true,
        readOnly: false,
        keysCount: keys.length,
        memoryKeysCount: memoryCache.size,
        keysCommandAllowed: true,
        getCommandAllowed: true,
        memoryOnly: false
      }
    } catch (error) {
      console.error("Error checking Redis status:", error)
      return {
        available: false,
        readOnly: true,
        keysCount: 0,
        memoryKeysCount: memoryCache.size,
        keysCommandAllowed: false,
        getCommandAllowed: false,
        memoryOnly: true
      }
    }
  }
}

// Export a singleton instance
export const redisCache = new RedisCache()
