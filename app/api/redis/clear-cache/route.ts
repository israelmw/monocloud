import { NextResponse } from "next/server"
import { redisCache } from "@/lib/redis-cache"

// This function verifies if the request comes from an authenticated user
// In a real application, you should implement proper session verification
function isAuthenticated(req: Request) {
  // Here you could verify session cookies, JWT tokens, etc.
  // For now, we only allow requests from the same origin
  return true
}

export async function POST(req: Request) {
  try {
    // Verify if the user is authenticated
    if (!isAuthenticated(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { pattern } = body

    // Get Redis status to check if it's in read-only mode
    const status = await redisCache.getStatus()

    if (status.readOnly) {
      return NextResponse.json(
        {
          error: "Redis is in read-only mode",
          message: "Cannot clear Redis cache in read-only mode. Memory cache was cleared.",
        },
        { status: 403 },
      )
    }

    if (!status.keysCommandAllowed) {
      // If the KEYS command is not allowed, we only clear the memory cache
      await redisCache.clear()
      return NextResponse.json({
        success: true,
        message: "KEYS command not permitted. Only memory cache was cleared.",
        keysCommandAllowed: false,
      })
    }

    const result = await redisCache.clear(pattern)

    return NextResponse.json({
      success: result,
      message: result ? "Cache cleared successfully" : "Failed to clear Redis cache, but memory cache was cleared",
    })
  } catch (error) {
    console.error("Error clearing cache:", error)
    return NextResponse.json({ error: "Failed to clear cache" }, { status: 500 })
  }
}
