"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type View = "landing" | "visualization" | "details"

interface TransitionContextType {
  currentView: View
  previousView: View | null
  isTransitioning: boolean
  transitionTo: (view: View) => void
}

const TransitionContext = createContext<TransitionContextType | undefined>(undefined)

export function TransitionProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<View>("landing")
  const [previousView, setPreviousView] = useState<View | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const transitionTo = (view: View) => {
    if (view === currentView) return

    setIsTransitioning(true)
    setPreviousView(currentView)

    // Small delay to allow exit animations to complete
    setTimeout(() => {
      setCurrentView(view)

      // Allow time for enter animations
      setTimeout(() => {
        setIsTransitioning(false)
      }, 500)
    }, 300)
  }

  return (
    <TransitionContext.Provider value={{ currentView, previousView, isTransitioning, transitionTo }}>
      {children}
    </TransitionContext.Provider>
  )
}

export function useTransition() {
  const context = useContext(TransitionContext)
  if (context === undefined) {
    throw new Error("useTransition must be used within a TransitionProvider")
  }
  return context
}
