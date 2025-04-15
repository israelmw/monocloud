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
    const { pattern = "tts:" } = body

    // Find keys matching the pattern
    const keys = await redis.keys(`monocloud:${pattern}*`)
    console.log(`Found ${keys.length} keys matching pattern: ${pattern}`)

    const results = {
      total: keys.length,
      valid: 0,
      invalid: 0,
      cleaned: 0,
      errors: 0,
      invalidKeys: [],
    }

    // Check each key
    for (const key of keys) {
      try {
        // Get the value
        const value = await redis.get(key)

        // Basic validation - check if it's a string that looks like base64 data
        let isValid = false

        if (typeof value === "string") {
          // Check if it starts with data:audio/ or similar patterns
          if (
            value.startsWith("data:audio/") ||
            value.startsWith("data:application/octet-stream") ||
            // Check if it's a base64 string (simplified check)
            (value.length > 100 && /^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100)))
          ) {
            isValid = true
            results.valid++
          }
        }

        if (!isValid) {
          results.invalid++
          results.invalidKeys.push(key)

          // Delete invalid entry
          await redis.del(key)
          results.cleaned++
        }
      } catch (error) {
        console.error(`Error processing key ${key}:`, error)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Validated ${results.total} keys. Found ${results.invalid} invalid entries and cleaned ${results.cleaned}.`,
      results,
    })
  } catch (error) {
    console.error("Error validating Redis keys:", error)
    return NextResponse.json({ error: "Failed to validate Redis keys" }, { status: 500 })
  }
}
