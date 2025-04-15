"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import dynamic from "next/dynamic"
import { AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTheme } from "next-themes"
import { GraphVisualizationProps, AnalysisData, Dimensions } from "@/types"

// Create a fallback visualization component
function FallbackVisualization() {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className={`flex h-full w-full items-center justify-center ${isDark ? "bg-black" : "bg-gray-100"}`}>
      <div className="max-w-md p-6 text-center">
        <div className="mb-4 text-4xl">📊</div>
        <h3 className={`mb-2 text-lg font-medium ${isDark ? "text-white" : "text-gray-900"}`}>Static Visualization</h3>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          3D visualization could not be loaded. Enter a GitHub repository URL to analyze its structure.
        </p>
      </div>
    </div>
  )
}

// Loading component that respects theme
function LoadingVisualization() {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className={`flex h-full w-full items-center justify-center ${isDark ? "bg-black" : "bg-white"}`}>
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>Loading 3D visualization...</p>
      </div>
    </div>
  )
}

// Use memo to prevent unnecessary re-renders of the visualization component
const ThreeVisualization = dynamic(() => import("./three-visualization"), {
  ssr: false,
  loading: () => <LoadingVisualization />,
})

export function GraphVisualization({
  analysisData = null,
  onSelectNode,
  isDetailView = false,
  selectedModule = null, // Recibir explícitamente el módulo seleccionado
}: GraphVisualizationProps) {
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 })
  const { theme } = useTheme()
  const isDark = theme === "dark"

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth || window.innerWidth;
        const height = containerRef.current.clientHeight || window.innerHeight;
        console.log("Container dimensions updated:", { width, height });
        setDimensions({ width, height });
      }
    }

    // Set initial dimensions after a short delay to ensure container is rendered
    setTimeout(updateDimensions, 100);
    
    // Also update dimensions when window is resized
    window.addEventListener("resize", updateDimensions);

    // Clean up
    return () => {
      window.removeEventListener("resize", updateDimensions);
    }
  }, []);


  // Detect WebGL context lost globally and set error only if 3D was rendered and not already in error
  useEffect(() => {
    function handleContextLost(e: Event) {
      console.log("WebGL context lost:", e);
      e.preventDefault(); // Prevent default behavior
        setError("WebGL context lost. Visualization cannot be rendered. Try refreshing the page or closing other tabs that use 3D graphics.");
    }
    window.addEventListener("webglcontextlost", handleContextLost, true);
    return () => {
      window.removeEventListener("webglcontextlost", handleContextLost, true);
    };
  }, [error]);

  // Remove errorRef and always use error state for error display
  const threeVisKey = useMemo(() => {
    // Always use analysisData as key, never block remount by error
    if (!analysisData) return "three-visualization";
    const base =
      (analysisData.owner || "") +
      (analysisData.repo || "") +
      (analysisData.graph?.nodes?.length || 0) +
      (analysisData.graph?.edges?.length || 0);
    return "three-visualization-" + base;
  }, [
    analysisData?.owner,
    analysisData?.repo,
    analysisData?.graph?.nodes?.length,
    analysisData?.graph?.edges?.length,
  ]);

  // Add a retry button to allow user to re-render after context loss
  const visualizationComponent = useMemo(() => {
    if (error) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="max-w-md p-4 text-center">
            <Alert variant="destructive" className={isDark ? "border-red-900 bg-red-950" : "border-red-300 bg-red-50"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Visualization Error</AlertTitle>
              <AlertDescription>
                {error}
                <br />
                <button
                  className="mt-4 px-4 py-2 rounded bg-blue-600 text-white text-xs"
                  onClick={() => setError(null)}
                >
                  Retry Visualization
                </button>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )
    }

    // console.log({analysisData})

    return (
      <div className="h-full w-full">
        <ThreeVisualization
          key={threeVisKey + (error ? "-retry" : "")}
          analysisData={analysisData}
          onSelectNode={onSelectNode}
          isDetailView={isDetailView}
          selectedModule={selectedModule}
          dimensions={dimensions}
          theme={theme}
        />
      </div>
    )
  }, [
    error,
    theme,
    dimensions,
    onSelectNode,
    isDetailView,
    selectedModule,
    threeVisKey,
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 flex items-center justify-center ${isDark ? "bg-black" : "bg-gray-100"}`}
      style={{ minHeight: "500px" }} // Ensure minimum height
    >
      {visualizationComponent}
    </div>
  )
}
