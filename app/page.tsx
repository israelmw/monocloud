"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { GraphVisualization } from "@/components/graph-visualization"
import { InsightsPanel } from "@/components/insights-panel"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "next-themes"
import { useSearchParams, useRouter } from "next/navigation"
import { AnalysisData } from "@/types"

function MainContent() {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false)
  const [windowHeight, setWindowHeight] = useState<number>(0)
  const [currentView, setCurrentView] = useState<"landing" | "visualization" | "details">("landing")
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const searchParams = useSearchParams()
  const route = useRouter()

  // Sync state with URL parameters only when they change
  useEffect(() => {
    const view = searchParams.get("currentView") as "landing" | "visualization" | "details" | null
    if (view) {
      // Reset search params
      route.replace("/")
      setCurrentView(view)
    }
  }, [searchParams])

  // Update window height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      setWindowHeight(window.innerHeight)
    }
    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  const handleAnalysisComplete = useCallback((data: AnalysisData) => {
    setAnalysisData(data)
    setSelectedModule(null)
    setCurrentView("visualization")
  }, [])

  const handleSelectNode = useCallback((nodeId: string) => {
    console.log("Node selected:", nodeId)
    setCurrentView("details")
    setTimeout(() => {
      setSelectedModule(nodeId)
      setIsPanelCollapsed(false)
    }, 10)
  }, [])

  const handleBackToVisualization = useCallback(() => {
    console.log("handleBackToVisualization called")
    setCurrentView("visualization")
    setTimeout(() => {
      console.log("Clearing selectedModule in handleBackToVisualization")
      setSelectedModule(null)
    }, 50)
  }, [])

  const handleTogglePanel = useCallback((collapsed: boolean) => {
    console.log("Toggle panel:", collapsed)
    setIsPanelCollapsed(collapsed)
  }, [])

  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden ${isDark ? "bg-black" : "bg-gray-50"} text-foreground`}
    >
      {/* Fixed navbar at the top */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* Main content area with adjusted top padding for the fixed navbar */}
      <main className="flex flex-1 flex-col pt-14 h-full w-full">
        <AnimatePresence mode="wait">
          {currentView === "landing" && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 h-full"
            >
              <Hero onAnalysisComplete={handleAnalysisComplete} />
            </motion.div>
          )}

          {(currentView === "visualization" || currentView === "details") && (
            <div className="flex flex-1 h-[calc(100vh-3.5rem)] w-full">
              {/* Main visualization area */}
              <div
                className={`
                  relative flex-1 transition-all duration-300
                  ${
                    isPanelCollapsed
                      ? "w-full md:w-[calc(100%-3rem)]"
                      : currentView === "details"
                        ? "w-full md:w-2/3"
                        : "w-full md:w-[calc(100%-20rem)]"
                  }
                `}
                style={{ height: `${windowHeight - 56}px` }} // 56px is the navbar height
              >
                <GraphVisualization
                  analysisData={analysisData}
                  onSelectNode={handleSelectNode}
                  isDetailView={currentView === "details"}
                  selectedModule={selectedModule} // Explicitly pass the selected module
                />
              </div>

              {/* Fixed insights panel */}
              <div
                className={`
                  fixed right-0 top-14 bottom-0 border-l border-input ${isDark ? "bg-black" : "bg-white"}
                  transition-all duration-300 z-40
                  ${isPanelCollapsed ? "w-12" : currentView === "details" ? "w-full md:w-1/3" : "w-full md:w-80"}
                  ${isPanelCollapsed ? "md:translate-x-0" : ""}
                  ${currentView === "details" || !isPanelCollapsed ? "translate-x-0" : "translate-x-full md:translate-x-0"}
                `}
                style={{ height: `${windowHeight - 56}px` }} // 56px is the navbar height
              >
                <InsightsPanel
                  analysisData={analysisData}
                  selectedModule={selectedModule}
                  setSelectedModule={handleSelectNode}
                  isDetailView={currentView === "details"}
                  onBackToVisualization={handleBackToVisualization}
                  isCollapsed={isPanelCollapsed}
                  onToggleCollapse={handleTogglePanel}
                />
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <Toaster />
    </div>
  )
}

// Wrap the main content in a Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={null}>
      <MainContent />
    </Suspense>
  )
}
