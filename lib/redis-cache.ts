import { Redis } from "@upstash/redis"

// Initialize Redis client using environment variables provided by Vercel
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
})

// In-memory cache as fallback
const memoryCache = new Map()

export class RedisCache {
  private prefix: string
  private defaultTTL: number
  private isRedisAvailable = true
  private isReadOnly = false
  private keysCommandAllowed = true
  private getCommandAllowed = true
  private lastConnectionCheck = 0
  private connectionCheckInterval = 60000 // 1 minute

  constructor(prefix = "monocloud:", defaultTTL = 60 * 60 * 24) {
    this.prefix = prefix
    this.defaultTTL = defaultTTL
    this.checkRedisConnection()
  }

  private getFullKey(key: string): string {
    return `${this.prefix}${key}`
  }

  // Check if Redis is available and determine if it's read-only
  private async checkRedisConnection(): Promise<{
    available: boolean
    readOnly: boolean
    keysCommandAllowed: boolean
    getCommandAllowed: boolean
  }> {
    const now = Date.now()

    // Only check connection if it's been more than the interval since last check
    if (now - this.lastConnectionCheck < this.connectionCheckInterval) {
      return {
        available: this.isRedisAvailable,
        readOnly: this.isReadOnly,
        keysCommandAllowed: this.keysCommandAllowed,
        getCommandAllowed: this.getCommandAllowed,
      }
    }

    this.lastConnectionCheck = now

    try {
      // First try a read operation with GET
      const testReadKey = `${this.prefix}_connection_test_readonly`

      try {
        // Try to read a key (this should work even in read-only mode)
        await redis.get(testReadKey)
        this.getCommandAllowed = true
        this.isRedisAvailable = true
      } catch (getError: any) {
        if (getError.message && (getError.message.includes("NOPERM") || getError.message.includes("no permissions"))) {
          console.log("[RedisCache] GET command not permitted:", getError.message)
          this.getCommandAllowed = false
          // If we can't even GET, Redis is effectively unavailable for us
          this.isRedisAvailable = false
        } else {
          // Some other error with GET, might be that the key doesn't exist
          this.getCommandAllowed = true
          this.isRedisAvailable = true
        }
      }

      // Check if EXISTS command is allowed (as a fallback for checking availability)
      if (this.isRedisAvailable) {
        try {
          await redis.exists(testReadKey)
        } catch (existsError: any) {
          if (
            existsError.message &&
            (existsError.message.includes("NOPERM") || existsError.message.includes("no permissions"))
          ) {
            console.log("[RedisCache] EXISTS command not permitted:", existsError.message)
            // If we can't use EXISTS, but GET works, we're still available
          } else {
            // Some other error with EXISTS
            console.error("[RedisCache] Error checking EXISTS:", existsError)
          }
        }
      }

      // Check if KEYS command is allowed
      try {
        await redis.keys(`${this.prefix}_test_keys_*`)
        this.keysCommandAllowed = true
      } catch (keysError: any) {
        if (
          keysError.message &&
          (keysError.message.includes("NOPERM") || keysError.message.includes("no permissions"))
        ) {
          console.log("[RedisCache] KEYS command not permitted:", keysError.message)
          this.keysCommandAllowed = false
        } else {
          // Some other error with KEYS
          console.error("[RedisCache] Error checking KEYS:", keysError)
        }
      }

      // Now try a write operation to check if we have write permissions
      try {
        const testWriteKey = `${this.prefix}_connection_test_write`
        await redis.set(testWriteKey, "test", { ex: 10 })
        await redis.del(testWriteKey)

        // If we get here, we have write permissions
        this.isReadOnly = false
        console.log("[RedisCache] Redis connection test successful with read-write permissions")
      } catch (writeError: any) {
        // Check if this is a permission error
        if (
          writeError.message &&
          (writeError.message.includes("NOPERM") ||
            writeError.message.includes("no permissions") ||
            writeError.message.includes("readonly"))
        ) {
          // We can read but not write - Redis is in read-only mode for us
          this.isReadOnly = true
          console.log("[RedisCache] Redis is in read-only mode:", writeError.message)

          // Emit event for client-side notification
          if (typeof window !== "undefined") {
            const event = new CustomEvent("redis-error", {
              detail: { message: "Redis is in read-only mode", readOnly: true },
            })
            window.dispatchEvent(event)
            localStorage.setItem("monocloud:redis:errors", "true")
            localStorage.setItem("monocloud:redis:readonly", "true")
          }
        } else {
          // Some other write error
          console.error("[RedisCache] Redis write test failed:", writeError)
          this.isReadOnly = true
        }
      }
    } catch (error: any) {
      // Complete connection failure
      console.error("[RedisCache] Redis connection test failed:", error)
      this.isRedisAvailable = false
      this.isReadOnly = true
      this.keysCommandAllowed = false
      this.getCommandAllowed = false

      // Emit event for client-side notification
      if (typeof window !== "undefined") {
        const event = new CustomEvent("redis-error", {
          detail: { message: error.message },
        })
        window.dispatchEvent(event)
        localStorage.setItem("monocloud:redis:errors", "true")
      }
    }

    return {
      available: this.isRedisAvailable,
      readOnly: this.isReadOnly,
      keysCommandAllowed: this.keysCommandAllowed,
      getCommandAllowed: this.getCommandAllowed,
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // First try to get from memory cache
    if (memoryCache.has(key)) {
      console.log(`[RedisCache] Using memory cache for key: ${key}`)
      return memoryCache.get(key) as T
    }

    // Then try to get from Redis if available and GET command is allowed
    if (this.isRedisAvailable && this.getCommandAllowed) {
      try {
        const fullKey = this.getFullKey(key)
        console.log(`[RedisCache] Fetching from Redis: ${fullKey}`)

        const data = await redis.get(fullKey)

        if (data) {
          console.log(`[RedisCache] Redis cache hit for key: ${key}`)
          // Store in memory cache for faster subsequent access
          memoryCache.set(key, data)
          return data as T
        } else {
          console.log(`[RedisCache] Redis cache miss for key: ${key}`)
        }
      } catch (error: unknown) {
        console.error(`[RedisCache] Error reading from Redis for key ${key}:`, error)

        // Check if this is a permission error
        if (error instanceof Error && error.message && (error.message.includes("NOPERM") || error.message.includes("no permissions"))) {
          this.getCommandAllowed = false
          console.log("[RedisCache] GET command not permitted:", error.message)
        }
        // Check if this is a connection issue and update status
        else if (
          error instanceof Error && error.message &&
          (error.message.includes("connect") || error.message.includes("network") || error.message.includes("timeout"))
        ) {
          this.isRedisAvailable = false

          // Emit event for client-side notification
          if (typeof window !== "undefined") {
            const event = new CustomEvent("redis-error", {
              detail: { message: error.message },
            })
            window.dispatchEvent(event)
            localStorage.setItem("monocloud:redis:errors", "true")
          }
        }
      }
    } else if (!this.getCommandAllowed) {
      console.log(`[RedisCache] GET command not permitted, skipping Redis fetch for key: ${key}`)
    } else {
      console.log(`[RedisCache] Redis unavailable, skipping fetch for key: ${key}`)
    }

    return null
  }

  async set<T>(key: string, data: T, ttl: number = this.defaultTTL): Promise<boolean> {
    // Always store in memory cache
    memoryCache.set(key, data)
    console.log(`[RedisCache] Set in memory cache for key: ${key}`)

    // Try to store in Redis if available and not in read-only mode
    if (this.isRedisAvailable && !this.isReadOnly) {
      try {
        const fullKey = this.getFullKey(key)
        console.log(`[RedisCache] Setting in Redis: ${fullKey}, expires in ${ttl} seconds`)

        // Verify data can be serialized
        const serializedData = JSON.stringify(data)
        JSON.parse(serializedData) // Test parse to ensure it's valid

        // Set in Redis with expiration
        await redis.set(fullKey, data, { ex: ttl })

        // Verify data was stored correctly (only if GET is allowed)
        if (this.getCommandAllowed) {
          const verifyData = await redis.get(fullKey)
          if (verifyData) {
            console.log(`[RedisCache] Verified data stored in Redis for key: ${key}`)
            return true
          } else {
            console.error(`[RedisCache] Failed to verify data in Redis for key: ${key}`)
            return false
          }
        }

        return true
      } catch (error: unknown) {
        console.error(`[RedisCache] Error writing to Redis for key ${key}:`, error)

        // Check if this is a permission error
        if (
          error instanceof Error && error.message &&
          (error.message.includes("NOPERM") ||
            error.message.includes("no permissions") ||
            error.message.includes("readonly"))
        ) {
          this.isReadOnly = true
          console.log("[RedisCache] Redis is in read-only mode:", error.message)

          // Emit event for client-side notification
          if (typeof window !== "undefined") {
            const event = new CustomEvent("redis-error", {
              detail: { message: "Redis is in read-only mode", readOnly: true },
            })
            window.dispatchEvent(event)
            localStorage.setItem("monocloud:redis:errors", "true")
            localStorage.setItem("monocloud:redis:readonly", "true")
          }
        }
        // Check if this is a connection issue
        else if (
          error instanceof Error && error.message &&
          (error.message.includes("connect") || error.message.includes("network") || error.message.includes("timeout"))
        ) {
          this.isRedisAvailable = false

          // Emit event for client-side notification
          if (typeof window !== "undefined") {
            const event = new CustomEvent("redis-error", {
              detail: { message: error.message },
            })
            window.dispatchEvent(event)
            localStorage.setItem("monocloud:redis:errors", "true")
          }
        }

        return false
      }
    } else if (this.isReadOnly) {
      console.log(`[RedisCache] Redis is in read-only mode, using memory cache only for key: ${key}`)
      return true // Return true because we successfully stored in memory cache
    } else {
      console.log(`[RedisCache] Redis unavailable, using memory cache only for key: ${key}`)
      return true // Return true because we successfully stored in memory cache
    }
  }

  async has(key: string): Promise<boolean> {
    // First check memory cache
    if (memoryCache.has(key)) {
      return true
    }

    // Then check Redis if available
    if (this.isRedisAvailable) {
      try {
        const fullKey = this.getFullKey(key)
        return (await redis.exists(fullKey)) === 1
      } catch (error) {
        console.error(`[RedisCache] Error checking Redis for key ${key}:`, error)
        return false
      }
    }

    return false
  }

  async delete(key: string): Promise<boolean> {
    // Always remove from memory cache
    memoryCache.delete(key)
    console.log(`[RedisCache] Deleted from memory cache: ${key}`)

    // Try to remove from Redis if available and not in read-only mode
    if (this.isRedisAvailable && !this.isReadOnly) {
      try {
        const fullKey = this.getFullKey(key)
        await redis.del(fullKey)
        console.log(`[RedisCache] Deleted from Redis: ${fullKey}`)
        return true
      } catch (error: unknown) {
        console.error(`[RedisCache] Error deleting from Redis for key ${key}:`, error)

        // Check if this is a permission error
        if (
          error instanceof Error && error.message &&
          (error.message.includes("NOPERM") ||
            error.message.includes("no permissions") ||
            error.message.includes("readonly"))
        ) {
          this.isReadOnly = true
        }

        return false
      }
    }

    return true
  }

  async clear(pattern?: string): Promise<boolean> {
    // Clear memory cache
    memoryCache.clear()
    console.log(`[RedisCache] Cleared memory cache`)

    // Try to clear Redis if available and not in read-only mode
    if (this.isRedisAvailable && !this.isReadOnly && this.keysCommandAllowed) {
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
      } catch (error: unknown) {
        console.error(`[RedisCache] Error clearing Redis:`, error)

        // Check if this is a permission error for KEYS command
        if (error instanceof Error && error.message && error.message.includes("NOPERM") && error.message.includes("keys")) {
          this.keysCommandAllowed = false
          console.log("[RedisCache] KEYS command not permitted:", error.message)
        }
        // Check if this is a general permission error
        else if (
          error instanceof Error && error.message &&
          (error.message.includes("NOPERM") ||
            error.message.includes("no permissions") ||
            error.message.includes("readonly"))
        ) {
          this.isReadOnly = true
        }

        return false
      }
    } else if (!this.keysCommandAllowed) {
      console.log(`[RedisCache] KEYS command not permitted, only cleared memory cache`)
      return true // We successfully cleared memory cache
    }

    return true
  }

  // Get Redis status information
  async getStatus(): Promise<{
    available: boolean
    readOnly: boolean
    keysCount: number
    memoryKeysCount: number
    keysCommandAllowed: boolean
    getCommandAllowed: boolean
  }> {
    await this.checkRedisConnection()

    let keysCount = 0

    if (this.isRedisAvailable && this.keysCommandAllowed) {
      try {
        // Count keys in Redis
        const keys = await redis.keys(this.prefix + "*")
        keysCount = keys.length
      } catch (error: unknown) {
        console.error("Error checking Redis keys count:", error)

        // Check if this is a permission error for KEYS command
        if (error instanceof Error && error.message && error.message.includes("NOPERM") && error.message.includes("keys")) {
          this.keysCommandAllowed = false
          console.log("[RedisCache] KEYS command not permitted:", error.message)
        }
      }
    }

    // Count keys in memory cache
    const memoryKeysCount = memoryCache.size

    return {
      available: this.isRedisAvailable,
      readOnly: this.isReadOnly,
      keysCount,
      memoryKeysCount,
      keysCommandAllowed: this.keysCommandAllowed,
      getCommandAllowed: this.getCommandAllowed,
    }
  }
}

// Export a singleton instance
export const redisCache = new RedisCache()
