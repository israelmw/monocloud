import { NextResponse } from "next/server"
import { redisCache } from "@/lib/redis-cache"
import { Redis } from "@upstash/redis"

export async function GET() {
  try {
    // Get Redis status from our enhanced cache implementation
    const status = await redisCache.getStatus()

    // If Redis is available and KEYS command is allowed, try to get keys
    let keys = []
    if (status.available && status.keysCommandAllowed && status.getCommandAllowed) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
          token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
        })

        // Get all keys with our prefix
        const allKeys = await redis.keys("monocloud:*")

        // Format keys for display (remove prefix)
        keys = allKeys.map((key) => key.replace("monocloud:", ""))
      } catch (error) {
        console.error("Error fetching Redis keys:", error)
      }
    }

    return NextResponse.json({
      ...status,
      keys,
    })
  } catch (error) {
    console.error("Error checking Redis status:", error)
    return NextResponse.json(
      {
        available: false,
        readOnly: true,
        keysCount: 0,
        memoryKeysCount: 0,
        keysCommandAllowed: false,
        getCommandAllowed: false,
        error: "Failed to check Redis status",
        message: "Could not determine Redis status, assuming unavailable",
      },
      { status: 500 },
    )
  }
}
