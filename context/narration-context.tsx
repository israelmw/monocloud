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

// Function to get a cookie
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

// Function to set a cookie
function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return

  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = "; expires=" + date.toUTCString()
  document.cookie = name + "=" + value + expires + "; path=/"
}

export function NarrationProvider({ children }: { children: ReactNode }) {
  // Initialize with cookie value or false by default
  const [narrationEnabled, setNarrationEnabled] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [narrationError, setNarrationError] = useState<string | null>(null)

  // Load preference from cookie when mounting component
  useEffect(() => {
    const savedPreference = getCookie("narrationEnabled")
    console.log("Loaded narration preference from cookie:", savedPreference)

    if (savedPreference === "true") {
      setNarrationEnabled(true)
    }

    setIsInitialized(true)
  }, [])

  // Save preference in cookie when it changes
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
