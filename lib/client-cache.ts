"use client"

// Clase para manejar la caché en el cliente usando localStorage
export class ClientCache {
  private prefix: string
  private defaultTTL: number
  private isStorageAvailable: boolean

  constructor(prefix = "monocloud:", defaultTTL: number = 1000 * 60 * 60) {
    this.prefix = prefix
    this.defaultTTL = defaultTTL
    this.isStorageAvailable = this.checkStorageAvailability()

    if (!this.isStorageAvailable) {
      console.warn("localStorage is not available. Client cache will not persist between page reloads.")
    }
  }

  // Verificar si localStorage está disponible
  private checkStorageAvailability(): boolean {
    // Comprobación inicial para saber si estamos en el navegador
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const testKey = "__storage_test__"
      localStorage?.setItem(testKey, testKey)
      localStorage?.removeItem(testKey)
      return true
    } catch (e) {
      console.error("localStorage is not available:", e)
      return false
    }
  }

  private getFullKey(key: string): string {
    return `${this.prefix}${key}`
  }

  get<T>(key: string): T | null {
    if (!this.isStorageAvailable) return null

    try {
      const fullKey = this.getFullKey(key)
      const item = localStorage.getItem(fullKey)

      if (!item) {
        console.log(`Cache miss for key: ${key}`)
        return null
      }

      let parsedItem
      try {
        parsedItem = JSON.parse(item)
      } catch (parseError) {
        console.error(`Error parsing cache item for key ${key}:`, parseError)
        localStorage.removeItem(fullKey) // Remove invalid item
        return null
      }

      const { data, expiresAt } = parsedItem

      // Comprobar si ha expirado
      if (Date.now() > expiresAt) {
        console.log(`Cache expired for key: ${key}`)
        localStorage.removeItem(fullKey)
        return null
      }

      console.log(`Cache hit for key: ${key}`)
      return data as T
    } catch (error) {
      console.error(`Error reading from cache for key ${key}:`, error)
      return null
    }
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): boolean {
    if (!this.isStorageAvailable) return false
    if (!key) {
      console.error("Cannot set cache with empty key")
      return false
    }

    try {
      const fullKey = this.getFullKey(key)
      const now = Date.now()
      const cacheItem = {
        data,
        timestamp: now,
        expiresAt: now + ttl,
      }

      const serializedItem = JSON.stringify(cacheItem)
      localStorage.setItem(fullKey, serializedItem)

      // Verificar que se guardó correctamente
      const savedItem = localStorage.getItem(fullKey)
      if (!savedItem) {
        console.error(`Failed to verify cache save for key ${key}`)
        return false
      }

      console.log(`Cache set for key: ${key}, expires in ${ttl / 1000} seconds`)
      console.log(`Cache data size: ${serializedItem.length} bytes`)
      return true
    } catch (error) {
      console.error(`Error writing to cache for key ${key}:`, error)

      // Si el error es por cuota excedida, intentar limpiar el caché
      if (
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
      ) {
        console.warn("Storage quota exceeded, cleaning up old items")
        this.cleanup()
      }

      return false
    }
  }

  has(key: string): boolean {
    if (!this.isStorageAvailable) return false

    try {
      const fullKey = this.getFullKey(key)
      const item = localStorage.getItem(fullKey)

      if (!item) return false

      try {
        const { expiresAt } = JSON.parse(item)
        return Date.now() <= expiresAt
      } catch (parseError) {
        console.error(`Error parsing cache item for key ${key}:`, parseError)
        localStorage.removeItem(fullKey) // Remove invalid item
        return false
      }
    } catch (error) {
      console.error(`Error checking cache for key ${key}:`, error)
      return false
    }
  }

  delete(key: string): boolean {
    if (!this.isStorageAvailable) return false

    try {
      const fullKey = this.getFullKey(key)
      localStorage.removeItem(fullKey)
      console.log(`Cache deleted for key: ${key}`)
      return true
    } catch (error) {
      console.error(`Error deleting from cache for key ${key}:`, error)
      return false
    }
  }

  // Limpiar todas las entradas con este prefijo
  clear(): boolean {
    if (!this.isStorageAvailable) return false

    try {
      const keysToRemove = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key)
        }
      }

      // Eliminar las claves en un segundo bucle para evitar problemas con el índice
      keysToRemove.forEach((key) => {
        localStorage.removeItem(key)
      })

      console.log(`Cleared ${keysToRemove.length} cache items`)
      return true
    } catch (error) {
      console.error("Error clearing cache:", error)
      return false
    }
  }

  // Limpiar entradas expiradas
  cleanup(): boolean {
    if (!this.isStorageAvailable) return false

    try {
      const now = Date.now()
      const keysToRemove = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.prefix)) {
          try {
            const item = localStorage.getItem(key)
            if (item) {
              const { expiresAt } = JSON.parse(item)
              if (now > expiresAt) {
                keysToRemove.push(key)
              }
            }
          } catch (parseError) {
            // Si no se puede parsear, eliminar la entrada
            keysToRemove.push(key)
          }
        }
      }

      // Eliminar las claves en un segundo bucle
      keysToRemove.forEach((key) => {
        localStorage.removeItem(key)
      })

      console.log(`Cleaned up ${keysToRemove.length} expired cache items`)
      return true
    } catch (error) {
      console.error("Error cleaning up cache:", error)
      return false
    }
  }

  // Obtener información sobre el uso del caché
  getStats(): { keys: number; totalSize: number; oldestTimestamp: number | null } {
    if (!this.isStorageAvailable) {
      return { keys: 0, totalSize: 0, oldestTimestamp: null }
    }

    try {
      let keys = 0
      let totalSize = 0
      let oldestTimestamp = Date.now()

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.prefix)) {
          keys++
          const item = localStorage.getItem(key)
          if (item) {
            totalSize += item.length * 2 // Aproximación del tamaño en bytes (2 bytes por carácter)
            try {
              const { timestamp } = JSON.parse(item)
              if (timestamp < oldestTimestamp) {
                oldestTimestamp = timestamp
              }
            } catch (e) {
              // Ignorar errores de parseo
            }
          }
        }
      }

      return {
        keys,
        totalSize,
        oldestTimestamp: keys > 0 ? oldestTimestamp : null,
      }
    } catch (error) {
      console.error("Error getting cache stats:", error)
      return { keys: 0, totalSize: 0, oldestTimestamp: null }
    }
  }
}

// Exportar una instancia singleton, pero solo si estamos en el navegador
let clientCacheInstance: ClientCache | null = null;

// Función para obtener la instancia de caché, creándola si no existe
export function getClientCache(): ClientCache {
  if (typeof window === 'undefined') {
    // Devolvemos una instancia temporal durante SSR que esencialmente no hace nada
    return new ClientCache();
  }

  if (!clientCacheInstance) {
    clientCacheInstance = new ClientCache();
  }

  return clientCacheInstance;
}

// Para mantener compatibilidad con el código existente
export const clientCache = typeof window === 'undefined' ? new ClientCache() : getClientCache();
