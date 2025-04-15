import { NextResponse } from "next/server"
import { redisCache } from "@/lib/redis-cache"

export async function POST(req: Request) {
  try {
    const { authorization } = Object.fromEntries(req.headers)

    // Verify basic authorization (use a more secure method in production)
    if (authorization !== `Bearer ${process.env.ADMIN_API_KEY}`) {
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
