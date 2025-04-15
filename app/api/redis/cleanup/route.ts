import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { pattern } = body

    if (!pattern) {
      return NextResponse.json({ error: "Pattern parameter is required" }, { status: 400 })
    }

    // Find keys matching the pattern
    const keys = await redis.keys(`monocloud:${pattern}*`)
    console.log(`Found ${keys.length} keys matching pattern: ${pattern}`)

    // Delete each key
    let deletedCount = 0
    for (const key of keys) {
      try {
        await redis.del(key)
        deletedCount++
      } catch (error) {
        console.error(`Error deleting key ${key}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} of ${keys.length} keys matching pattern: ${pattern}`,
      keys: keys,
    })
  } catch (error) {
    console.error("Error cleaning up Redis keys:", error)
    return NextResponse.json({ error: "Failed to clean up Redis keys" }, { status: 500 })
  }
}
