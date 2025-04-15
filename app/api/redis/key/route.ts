import { NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "",
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json({ error: "Key parameter is required" }, { status: 400 })
    }

    // Add prefix if not already present
    const fullKey = key.startsWith("monocloud:") ? key : `monocloud:${key}`

    // Get value from Redis
    const value = await redis.get(fullKey)

    return NextResponse.json({ key, value })
  } catch (error) {
    console.error("Error getting Redis key:", error)
    return NextResponse.json({ error: "Failed to get Redis key value" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { key } = body

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 })
    }

    // Add prefix if not already present
    const fullKey = key.startsWith("monocloud:") ? key : `monocloud:${key}`

    // Delete key from Redis
    await redis.del(fullKey)

    return NextResponse.json({ success: true, message: `Key ${key} deleted successfully` })
  } catch (error) {
    console.error("Error deleting Redis key:", error)
    return NextResponse.json({ error: "Failed to delete Redis key" }, { status: 500 })
  }
}
