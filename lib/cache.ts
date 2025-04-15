// Caché simple en memoria para el servidor
// En producción, podrías usar Redis, Upstash o una base de datos

type CacheEntry<T> = {
  data: T
  timestamp: number
  expiresAt: number
}

class ServerCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number = 1000 * 60 * 60 // 1 hora por defecto

  // Obtener un valor de la caché
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    // Si no hay entrada o ha expirado, devolver null
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) {
        // Limpiar entradas expiradas
        this.cache.delete(key)
      }
      return null
    }

    return entry.data as T
  }

  // Guardar un valor en la caché
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    })
  }

  // Comprobar si una clave existe y no ha expirado
  has(key: string): boolean {
    const entry = this.cache.get(key)
    return !!entry && Date.now() <= entry.expiresAt
  }

  // Eliminar una clave
  delete(key: string): void {
    this.cache.delete(key)
  }

  // Limpiar toda la caché
  clear(): void {
    this.cache.clear()
  }

  // Limpiar entradas expiradas
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Exportar una instancia singleton
export const serverCache = new ServerCache()
