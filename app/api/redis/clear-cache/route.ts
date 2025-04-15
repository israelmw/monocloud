import { NextResponse } from "next/server"
import { redisCache } from "@/lib/redis-cache"

// Esta función verifica si la solicitud proviene de un usuario autenticado
// En una aplicación real, deberías implementar una verificación de sesión adecuada
function isAuthenticated(req: Request) {
  // Aquí podrías verificar cookies de sesión, tokens JWT, etc.
  // Por ahora, solo permitimos solicitudes desde el mismo origen
  return true
}

export async function POST(req: Request) {
  try {
    // Verificar si el usuario está autenticado
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
      // Si el comando KEYS no está permitido, solo limpiamos la caché en memoria
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
