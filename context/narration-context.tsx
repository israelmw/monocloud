"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface NarrationContextType {
  narrationEnabled: boolean;
  toggleNarration: () => void;
  setNarrationEnabled: (enabled: boolean) => void;
  resetTTSErrors: () => void;
  narrationError: string | null;
  setNarrationError: (error: string | null) => void;
}

const NarrationContext = createContext<NarrationContextType | undefined>(undefined)

// Función para obtener una cookie
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null

  const cookies = document.cookie.split(";")
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim()
    if (cookie.startsWith(name + "=")) {
      return cookie.substring(name.length + 1)
    }
  }
  return null
}

// Función para establecer una cookie
function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return

  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = "; expires=" + date.toUTCString()
  document.cookie = name + "=" + value + expires + "; path=/"
}

export function NarrationProvider({ children }: { children: ReactNode }) {
  // Inicializar con el valor de la cookie o false por defecto
  const [narrationEnabled, setNarrationEnabled] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [narrationError, setNarrationError] = useState<string | null>(null)

  // Cargar la preferencia de la cookie al montar el componente
  useEffect(() => {
    const savedPreference = getCookie("narrationEnabled")
    console.log("Loaded narration preference from cookie:", savedPreference)

    if (savedPreference === "true") {
      setNarrationEnabled(true)
    }

    setIsInitialized(true)
  }, [])

  // Guardar la preferencia en una cookie cuando cambia
  useEffect(() => {
    if (isInitialized) {
      console.log("Saving narration preference to cookie:", narrationEnabled)
      setCookie("narrationEnabled", narrationEnabled ? "true" : "false")
      
      // Clear any error state when narration is disabled
      if (!narrationEnabled && narrationError) {
        setNarrationError(null)
      }
    }
  }, [narrationEnabled, isInitialized, narrationError])

  const toggleNarration = () => {
    setNarrationEnabled((prev) => !prev)
  }
  
  const resetTTSErrors = () => {
    setNarrationError(null)
  }

  return (
    <NarrationContext.Provider value={{ 
      narrationEnabled, 
      toggleNarration, 
      setNarrationEnabled,
      resetTTSErrors,
      narrationError,
      setNarrationError
    }}>
      {children}
    </NarrationContext.Provider>
  )
}

export function useNarration() {
  const context = useContext(NarrationContext)
  if (context === undefined) {
    throw new Error("useNarration must be used within a NarrationProvider")
  }
  return context
}
