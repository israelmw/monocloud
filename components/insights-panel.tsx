"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Lightbulb,
  Zap,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Database,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import { redisCache } from "@/lib/redis-cache"
import { useTheme } from "next-themes"
import { useTextToSpeech } from "@/hooks/use-text-to-speech"
import { useNarration } from "@/context/narration-context"
import { 
  InsightsPanelProps, 
  Graph, 
  InsightItem, 
  StatsData, 
} from "@/types"
import { AudioPlayerButton } from "@/components/ui/audio-player-button"

// Add export keyword to the beginning of the function declaration
export function InsightsPanel({
  analysisData = null,
  selectedModule = null,
  setSelectedModule = () => {}, // Explicitly receive this prop
  isDetailView = false,
  onBackToVisualization = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {},
}: InsightsPanelProps) {
  // Define all hooks at the beginning to avoid "Rendered fewer hooks than expected" errors
  const [insights, setInsights] = useState<InsightItem[]>([])
  const [stats, setStats] = useState<StatsData>({
    packages: 0,
    dependencies: 0,
    circularDeps: 0,
    avgDepth: 0,
    mostConnected: [],
  })
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [isAnalyzingModule, setIsAnalyzingModule] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<"ai" | "stats" | "modules">("ai")
  const [circularDeps, setCircularDeps] = useState<Array<string[]>>([])
  const [importCounts, setImportCounts] = useState<Record<string, number>>({})
  const [isModuleAnalysisEnabled, setIsModuleAnalysisEnabled] = useState<boolean>(false)
  const [repoDescription, setRepoDescription] = useState<string>("")
  const [isGeneratingDescription, setIsGeneratingDescription] = useState<boolean>(false)
  const { narrationEnabled, resetTTSErrors, setNarrationError } = useNarration()

  // Add a new state to track if TTS has been initialized
  const [ttsInitialized, setTtsInitialized] = useState<boolean>(false)

  const initialRenderRef = useRef<boolean>(true)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const isMountedRef = useRef<boolean>(true)
  const analysisInProgressRef = useRef<boolean>(false)
  const validatePanelHeightRef = useRef<() => void>(() => {})

  const { theme } = useTheme()
  const isDark: boolean = theme === "dark"

  // Simplified error handler
  const onError = (error: Error): void => {
    console.error("Narration error:", error)
    
    // Update global narration error state if available
    if (setNarrationError) {
      setNarrationError(error.message);
    }

    // Show a toast with the error to inform the user
    if (error.message.includes("quota_exceeded") || error.message.includes("quota exceeded")) {
      toast.error("Text-to-speech quota exceeded", {
        description: "Narration is temporarily unavailable. Please try again later.",
      });
    } else {
      toast.error("Narration error", {
        description: "There was an error in the narration system. Please try again.",
      });
    }
  }

  // Simplified TTS configuration for better clarity
  // console.log({narrationEnabled})
  const tts = useTextToSpeech(repoDescription, {
    // Only enable TTS if narration is enabled in settings, we're on the AI tab,
    // we have a description, and initialization is complete
    enabled: narrationEnabled && activeTab === "ai" && Boolean(repoDescription) && ttsInitialized,
    
    // Control autoPlay separately to avoid loops
    autoPlay: narrationEnabled && Boolean(repoDescription) && ttsInitialized,
    
    onStart: () => console.log("Narration started"),
    onEnd: () => console.log("Narration ended"),
    onError: onError,
    repoName: analysisData ? `${analysisData.owner}/${analysisData.repo}` : undefined,
  })

  // Add a new effect to properly initialize TTS
  useEffect(() => {
    // After component loads, allow TTS initialization
    const timer = setTimeout(() => {
      if (!ttsInitialized) {
        console.log("Initializing TTS system")
        setTtsInitialized(true)
      }
    }, 500) // Small delay to ensure other states are set up

    return () => clearTimeout(timer)
  }, [ttsInitialized])

  // Effect to pause audio when selected module changes
  useEffect(() => {
    if (selectedModule !== null && tts.isPlaying) {
      tts.pause();
    }
  }, [selectedModule, tts]);

  // Function to validate panel height
  validatePanelHeightRef.current = () => {
    if (contentRef.current) {
      const windowHeight = window.innerHeight
      const navbarHeight = 56 // Height of the navbar
      const maxHeight = windowHeight - navbarHeight

      // Set max height on the content container
      contentRef.current.style.maxHeight = `${maxHeight}px`
    }
  }

  // Ensure panel height fits the screen - IMPORTANT: This useEffect should be before any conditional return
  useEffect(() => {
    validatePanelHeightRef.current()

    // Add resize listener
    window.addEventListener("resize", validatePanelHeightRef.current)

    // Clean up
    return () => {
      window.removeEventListener("resize", validatePanelHeightRef.current)
    }
  }, [])

  // Set up mounted ref for cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Completely rewritten for better clarity and robustness
  const handleBackClick = useCallback(() => {
    console.log("Back button clicked")

    // First clear all local states
    setAiAnalysis("")
    setActiveModule(null)
    setError(null)
    setFromCache(false)
    setIsAnalyzingModule(false)
    analysisInProgressRef.current = false

    // Then call the navigation function
    if (typeof onBackToVisualization === "function") {
      console.log("Calling onBackToVisualization")
      onBackToVisualization()
    } else {
      console.warn("onBackToVisualization is not a function", onBackToVisualization)
    }
  }, [onBackToVisualization])

  // Toggle collapsed state - Completely rewritten for better clarity
  const toggleCollapse = useCallback(() => {
    console.log("Toggle collapse called, current state:", isCollapsed)
    if (typeof onToggleCollapse === "function") {
      onToggleCollapse(!isCollapsed)
    } else {
      console.warn("onToggleCollapse is not a function", onToggleCollapse)
    }
  }, [isCollapsed, onToggleCollapse])

  // Update the isModuleAnalysisEnabled state based on analysisData
  useEffect(() => {
    if (isMountedRef.current) {
      setIsModuleAnalysisEnabled(
        Boolean(analysisData && analysisData.graph && analysisData.graph.nodes && analysisData.graph.nodes.length > 0)
      )
    }
  }, [analysisData])

  // Update active tab when isDetailView changes
  useEffect(() => {
    if (!initialRenderRef.current && isMountedRef.current) {
      setActiveTab("ai")
    }
    initialRenderRef.current = false
  }, [isDetailView])

  // Update activeModule when selectedModule changes
  useEffect(() => {
    console.log("selectedModule changed:", selectedModule)
    if (selectedModule !== activeModule) {
      setActiveModule(selectedModule)
    }
  }, [selectedModule, activeModule])


  // Memoize the analyzeModuleWithAI function to prevent unnecessary re-renders
  const analyzeModuleWithAI = useCallback(
    async (module: string, forceRefresh = false) => {
      if (!module || !analysisData) {
        console.log("Missing module or analysisData - cannot analyze")
        return
      }

      // Prevent multiple simultaneous analysis requests
      if (analysisInProgressRef.current) {
        console.log("Analysis already in progress, skipping")
        return
      }

      try {
        analysisInProgressRef.current = true
        setIsAnalyzingModule(true)
        setError(null)

        // Don't clear previous analysis immediately to prevent UI flicker
        // Only clear if we're analyzing a different module
        if (activeModule !== module) {
          setAiAnalysis("")
        }

        setActiveModule(module)
        setFromCache(false)

        // Find the module node in the graph
        const moduleNode = analysisData.graph.nodes.find((node) => node.id === module)
        if (!moduleNode) {
          throw new Error(`Module "${module}" not found in the analysis data`)
        }

        // Get dependencies
        const dependencies = analysisData.graph.edges
          .filter((edge) => edge.source === module)
          .map((edge) => edge.target)

        // Try client cache first if not forcing refresh
        if (!forceRefresh) {
          try {
            const repoKey = `${analysisData.owner}/${analysisData.repo}`
            const cacheKey = `ai-analysis:${repoKey}:${module}`

            console.log(`Checking client cache for key: ${cacheKey}`)
            const cachedAnalysis = await redisCache.get(cacheKey)

            if (cachedAnalysis) {
              console.log(`Using client cached AI analysis for ${module}:`, cachedAnalysis)
              setAiAnalysis(cachedAnalysis as string)
              setFromCache(true)
              setIsAnalyzingModule(false)
              analysisInProgressRef.current = false
              return
            } else {
              console.log(`No cached analysis found for ${module}`)
            }
          } catch (cacheError) {
            console.error("Error accessing client cache:", cacheError)
            // Continue with API request if cache fails
          }
        } else {
          console.log(`Forced refresh for ${module}, skipping cache`)
        }

        // Prepare package JSON data
        let packageJsonData = "{}"
        try {
          if (moduleNode.data?.packageJson) {
            packageJsonData = moduleNode.data.packageJson
          } else if (moduleNode.data?.pkg) {
            packageJsonData = JSON.stringify(moduleNode.data.pkg)
          }
        } catch (jsonError) {
          console.error("Error preparing package JSON data:", jsonError)
          // Continue with empty package JSON
        }

        console.log(`Making API request for module ${module}`)
        // Make API request with proper error handling
        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            moduleName: module,
            packageJson: packageJsonData,
            dependencies: dependencies || [],
          }),
        })

        // Check if component is still mounted
        if (!isMountedRef.current) {
          console.log("Component unmounted during API request, aborting")
          analysisInProgressRef.current = false
          return
        }

        // Handle non-OK responses
        if (!response.ok) {
          let errorMessage = `API request failed with status ${response.status}`
          try {
            const errorData = await response.json()
            if (errorData.error) {
              errorMessage = errorData.error
            }
          } catch (e) {
            // If JSON parsing fails, use the default error message
          }
          throw new Error(errorMessage)
        }

        // Parse response data with error handling
        let data
        try {
          data = await response.json()
          console.log(`Received API response for ${module}:`, data)
        } catch (jsonError) {
          throw new Error("Failed to parse API response")
        }

        // Check if component is still mounted
        if (!isMountedRef.current) {
          console.log("Component unmounted after API response, aborting")
          analysisInProgressRef.current = false
          return
        }

        // Validate response data
        if (!data || (typeof data.result !== "string" && !data.error)) {
          throw new Error("Invalid response format from API")
        }

        // If there's an error in the response but we still got a result
        if (data.error && data.result) {
          console.warn("API returned an error but provided a fallback result:", data.error)
          setAiAnalysis(data.result)
          // Don't set error state since we have a fallback result
        } else if (data.error) {
          throw new Error(data.error)
        } else {
          // Save to client cache if not from server cache and no errors
          if (!data.fromCache) {
            try {
              const repoKey = `${analysisData.owner}/${analysisData.repo}`
              const cacheKey = `ai-analysis:${repoKey}:${module}`

              console.log(`Saving to client cache: ${cacheKey}`, data.result)
              const saved = await redisCache.set(cacheKey, data.result, 1000 * 60 * 60 * 12) // 12 hours
              console.log(`Cache save result: ${saved ? "success" : "failed"}`)

              // Verify that it was saved correctly
              const verifyCache = await redisCache.get(cacheKey)
              console.log(`Verify cache save: ${verifyCache ? "found in cache" : "not found in cache"}`)
            } catch (cacheError) {
              console.error("Error saving to client cache:", cacheError)
              // Continue even if cache save fails
            }
          }

          // Update state with analysis result
          setAiAnalysis(data.result)
          setFromCache(data.fromCache || false)
        }

        // Switch to AI tab if we're not in detail view
        if (!isDetailView) {
          setActiveTab("ai")
        }
      } catch (error: unknown) {
        console.error("Error analyzing module:", error)
        setError(error instanceof Error ? error.message : "Failed to analyze this module. Please try again later.")
        toast.error("Analysis Error", {
          description: error instanceof Error ? error.message : "Failed to analyze this module. Please try again later.",
        })

        // Provide a fallback message in the analysis area
        setAiAnalysis("Unable to analyze this module at the moment. Please try again later.")
      } finally {
        analysisInProgressRef.current = false
        setIsAnalyzingModule(false)
      }
    },
    [analysisData, activeModule, isDetailView],
  )

  // Function to generate repository description
  const generateRepoDescription = useCallback(
    async (forceRefresh = false) => {
      if (!analysisData || !analysisData.owner || !analysisData.repo || !analysisData.graph?.nodes) return

      setIsGeneratingDescription(true)

      try {
        // Try to get from cache first
        const cacheKey = `repo-description:${analysisData.owner}/${analysisData.repo}`

        if (!forceRefresh) {
          const cachedDescription = await redisCache.get(cacheKey)
          if (cachedDescription) {
            setRepoDescription(cachedDescription as string)
            return
          }
        }

        // Prepare data for the API
        const nodeCount = analysisData.graph.nodes.length
        const edgeCount = analysisData.graph.edges.length
        const moduleNames = analysisData.graph.nodes.map((node) => node.id).join(", ")

        // Call the AI API to generate the description
        const response = await fetch("/api/ai/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            moduleName: `${analysisData.owner}/${analysisData.repo}`,
            packageJson: JSON.stringify({ name: `${analysisData.owner}/${analysisData.repo}` }),
            dependencies: [],
            isRepoDescription: true,
            repoStats: {
              nodeCount,
              edgeCount,
              moduleNames: moduleNames.substring(0, 500), // Limit length
            },
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to generate repository description")
        }

        const data = await response.json()
        const generatedDescription = data.result || "No description available."

        // Save to cache
        await redisCache.set(cacheKey, generatedDescription, 60 * 60 * 24) // 24 hours

        setRepoDescription(generatedDescription)
      } catch (error: unknown) {
        console.error("Error generating repository description:", error)
        setRepoDescription("Failed to generate repository description. Please try again later.")
      } finally {
        setIsGeneratingDescription(false)
      }
    },
    [analysisData],
  )

  // Update active module when selectedModule changes
  useEffect(() => {
    if (selectedModule && analysisData) {
      // Ensure the AI tab is active in the details view
      setActiveTab("ai")

      const analyze = async () => {
        await analyzeModuleWithAI(selectedModule, false)
      }

      analyze()
    }

    return () => {
      // Cleanup function
      analysisInProgressRef.current = false
    }
  }, [selectedModule, analysisData, analyzeModuleWithAI])

  const [isInitialDescription, setIsInitialDescription] = useState(true)

  // Generate repository description when analysisData changes
  useEffect(() => {
    if (analysisData && !isDetailView && isInitialDescription) {
      setIsInitialDescription(false)
      generateRepoDescription()
    }
  }, [analysisData, isDetailView, generateRepoDescription, isInitialDescription])

  // Generate insights and stats when analysis data changes
  useEffect(() => {
    if (!analysisData || !analysisData.graph || !analysisData.graph.nodes) {
      // Reset insights and stats if no valid data
      setInsights([])
      setStats({
        packages: 0,
        dependencies: 0,
        circularDeps: 0,
        avgDepth: 0,
        mostConnected: [],
      })
      setCircularDeps([])
      setImportCounts({})
      return
    }

    try {
      // Check for circular dependencies
      const newCircularDeps = findCircularDependencies(analysisData.graph)
      setCircularDeps(newCircularDeps)

      // Count imports
      const newImportCounts = countImports(analysisData.graph)
      setImportCounts(newImportCounts)
    } catch (error) {
      console.error("Error generating insights:", error)
      // Don't update insights or stats if there's an error
    }
  }, [analysisData])

  useEffect(() => {
    if (!analysisData || !analysisData.graph || !analysisData.graph.nodes) {
      setInsights([])
      return
    }

    const newInsights: InsightItem[] = []

    if (circularDeps.length > 0) {
      newInsights.push({
        id: 1,
        title: "Circular Dependencies",
        description: `We detected ${circularDeps.length} circular dependencies. Consider refactoring to improve build performance.`,
        type: "warning",
      })
    }

    const highlyImported = Object.entries(importCounts)
      .filter(([_, count]) => count > 2)
      .sort(([_, countA], [__, countB]) => countB - countA)

    if (highlyImported.length > 0) {
      const [topPackage, topCount] = highlyImported[0]
      const percentage = Math.round((topCount / analysisData.graph.nodes.length) * 100)

      newInsights.push({
        id: 2,
        title: `${topPackage} Package Analysis`,
        description: `The '${topPackage}' package is imported by ${percentage}% of other packages. Consider breaking it down into smaller, more focused modules.`,
        type: "suggestion",
      })
    }

    setInsights(newInsights)
  }, [circularDeps, importCounts, analysisData])

  useEffect(() => {
    if (!analysisData || !analysisData.graph || !analysisData.graph.nodes) {
      setStats({
        packages: 0,
        dependencies: 0,
        circularDeps: 0,
        avgDepth: 0,
        mostConnected: [],
      })
      return
    }

    const highlyImported = Object.entries(importCounts)
      .filter(([_, count]) => count > 2)
      .sort(([_, countA], [__, countB]) => countB - countA)

    const newStats = {
      packages: analysisData.graph.nodes.length,
      dependencies: analysisData.graph.edges.length,
      circularDeps: circularDeps.length,
      avgDepth: calculateAverageDepth(analysisData.graph),
      mostConnected: highlyImported.slice(0, 3).map(([name, count]) => ({ name, count })),
    }

    setStats(newStats)
  }, [circularDeps, importCounts, analysisData])

  // Helper function to find circular dependencies
  function findCircularDependencies(graph: Graph): Array<string[]> {
    if (!graph || !graph.nodes || !graph.edges) {
      return []
    }

    const circularDeps: Array<string[]> = []
    const visited = new Set<string>()
    const path: string[] = []

    function dfs(node: string) {
      if (path.includes(node)) {
        const cycle = path.slice(path.indexOf(node))
        circularDeps.push(cycle)
        return
      }

      if (visited.has(node)) return

      visited.add(node)
      path.push(node)

      const edges = graph.edges.filter((edge) => edge.source === node)
      for (const edge of edges) {
        dfs(edge.target)
      }

      path.pop()
    }

    for (const node of graph.nodes) {
      dfs(node.id)
    }

    return circularDeps
  }

  // Helper function to count imports
  function countImports(graph: Graph): Record<string, number> {
    if (!graph || !graph.nodes || !graph.edges) {
      return {}
    }

    const counts: Record<string, number> = {}

    for (const node of graph.nodes) {
      counts[node.id] = 0
    }

    for (const edge of graph.edges) {
      counts[edge.target] = (counts[edge.target] || 0) + 1
    }

    return counts
  }

  // Helper function to calculate average depth
  function calculateAverageDepth(graph: Graph): number {
    if (!graph || !graph.nodes || !graph.edges) {
      return 0
    }

    // Find root nodes (nodes with no incoming edges)
    const incomingEdges: Record<string, number> = {}

    for (const edge of graph.edges) {
      incomingEdges[edge.target] = (incomingEdges[edge.target] || 0) + 1
    }

    const rootNodes = graph.nodes.filter((node) => !incomingEdges[node.id]).map((node) => node.id)

    if (rootNodes.length === 0) return 0

    // Calculate max depth from each root node
    const depths: number[] = []

    for (const root of rootNodes) {
      const visited = new Set<string>()
      const queue: Array<{ node: string; depth: number }> = [{ node: root, depth: 0 }]
      let maxDepth = 0

      while (queue.length > 0) {
        const { node, depth } = queue.shift()!

        if (visited.has(node)) continue
        visited.add(node)

        maxDepth = Math.max(maxDepth, depth)

        const outgoingEdges = graph.edges.filter((edge) => edge.source === node)
        for (const edge of outgoingEdges) {
          queue.push({ node: edge.target, depth: depth + 1 })
        }
      }

      depths.push(maxDepth)
    }

    return depths.reduce((sum, depth) => sum + depth, 0) / depths.length
  }

  const isValidAnalysisData =
    analysisData && analysisData.graph && analysisData.graph.nodes && analysisData.graph.nodes.length > 0

  // Handle tab change
  const handleTabChange = (value: string) => {
    if (isMountedRef.current) {
      console.log("Tab changed to:", value, "narration enabled:", narrationEnabled)
      setActiveTab(value as "ai" | "stats" | "modules")
    }
  }

  // Render the collapsed panel (mobile and desktop version)
  if (isCollapsed) {
    return (
      <div className={`flex h-full w-full flex-col items-center justify-center ${isDark ? "bg-black" : "bg-white"}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={toggleCollapse}
          aria-label="Expand panel"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="mt-4 rotate-90 text-xs text-muted-foreground whitespace-nowrap">Insights</div>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col ${isDark ? "bg-black" : "bg-white"} text-foreground overflow-hidden`}>
      <div
        className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b border-input ${isDark ? "bg-black" : "bg-white"}`}
      >
        <h2 className="text-lg font-semibold truncate">
          {isDetailView && activeModule !== null ? `Module: ${activeModule}` : "Insights"}
        </h2>

        <div className="flex items-center gap-2">
          {isDetailView && (
            <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={handleBackClick}>
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleCollapse} aria-label="Collapse panel">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`sticky top-0 z-10 w-full ${isDark ? "bg-gray-900" : "bg-gray-100"} px-4 py-4`}>
            <TabsTrigger value="ai" className={`flex-1 data-[state=active]:${isDark ? "bg-gray-800" : "bg-white"}`}>
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="stats" className={`flex-1 data-[state=active]:${isDark ? "bg-gray-800" : "bg-white"}`}>
              Stats
            </TabsTrigger>
            {!isDetailView && (
              <TabsTrigger
                value="modules"
                className={`flex-1 data-[state=active]:${isDark ? "bg-gray-800" : "bg-white"}`}
              >
                Modules
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="ai" className="px-4 py-4 space-y-4">
            {!isValidAnalysisData ? (
              <div
                className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
              >
                <p className="text-sm text-muted-foreground">Enter a GitHub repository URL to see AI insights.</p>
              </div>
            ) : isDetailView ? (
              <div
                className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium flex items-center">
                    Module Analysis
                    {fromCache && (
                      <span className="ml-2 text-xs flex items-center text-muted-foreground">
                        <Database className="h-3 w-3 mr-1" />
                        cached
                      </span>
                    )}
                  </h3>
                  {/* <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => activeModule && analyzeModuleWithAI(activeModule, true)}
                    disabled={isAnalyzingModule || !activeModule}
                    title="Refresh analysis (ignore cache)"
                  >
                    <RefreshCw className={`h-4 w-4 ${isAnalyzingModule ? "animate-spin" : ""}`} />
                    <span className="sr-only">Refresh analysis</span>
                  </Button> */}
                </div>

                {isAnalyzingModule ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[90%]" />
                    <Skeleton className="h-4 w-[80%]" />
                  </div>
                ) : error ? (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : aiAnalysis ? (
                  <p className="text-sm text-foreground">{aiAnalysis}</p>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p>No analysis available. Click the refresh button to analyze this module.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Repository Overview */}
                <div
                  className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Repository Overview</h3>
                    <div className="flex items-center gap-2">
                       {/* Audio player button */}
                        <AudioPlayerButton
                          isPlaying={tts.isPlaying}
                          isLoading={tts.isLoading}
                          progress={tts.progress}
                          onPlayPause={() => {
                            if (tts.isPlaying) {
                              tts.pause();
                            } else {
                              tts.play(repoDescription);
                            }
                          }}
                        />
                      
                    </div>
                  </div>

                  {isGeneratingDescription ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-[95%]" />
                      <Skeleton className="h-4 w-[90%]" />
                      <Skeleton className="h-4 w-[85%]" />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {repoDescription || "No description available. Click the refresh button to generate one."}
                    </div>
                  )}

                  {tts.isLoading && (
                    <div className="mt-2 flex items-center text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Generating audio...
                    </div>
                  )}

                  {/* Only show TTS error message if narration is enabled in user settings */}
                  {narrationEnabled && tts.error && (
                    <div className="mt-2 flex items-center text-xs text-red-500">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {tts.error.message.includes("quota")
                        ? "Text-to-speech quota exceeded. Please try again later."
                        : "Error generating audio. Please try again."}

                      {/* Add a button to clean up the specific cache entry */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            // Generate the cache key
                            const repoPrefix = analysisData ? `repo:${analysisData.owner}/${analysisData.repo}:` : ""
                            const textPrefix = repoDescription.substring(0, 30).replace(/[^a-zA-Z0-9]/g, "_")
                            const cacheKey = `tts:${repoPrefix}${textPrefix}`

                            // Delete the cache entry
                            const response = await fetch("/api/redis/key", {
                              method: "DELETE",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({ key: cacheKey }),
                            })

                            if (response.ok) {
                              toast.success("Cache entry cleaned", {
                                description: "Successfully cleaned the problematic cache entry.",
                              })

                              // Reset narration state
                              tts.resetCircuitBreaker?.()
                              tts.resetRequestState?.()
                            } else {
                              throw new Error("Failed to clean cache entry")
                            }
                          } catch (error: unknown) {
                            console.error("Error cleaning cache entry:", error)
                            toast.error("Failed to clean cache entry", {
                              description: error instanceof Error ? error.message : String(error),
                            })
                          }
                        }}
                        className="ml-2 text-xs"
                      >
                        Clean Cache
                      </Button>
                    </div>
                  )}

                 
                </div>

                {/* Insights */}
                {insights.length === 0 ? (
                  <div
                    className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
                  >
                    <p className="text-sm text-muted-foreground">No insights found for this repository.</p>
                  </div>
                ) : (
                  insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
                    >
                      <div className="flex items-start gap-2">
                        {insight.type === "warning" && <Zap className="h-4 w-4 text-yellow-500" />}
                        {insight.type === "suggestion" && <Lightbulb className="h-4 w-4 text-blue-500" />}
                        {insight.type === "info" && <Info className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <h3 className="font-medium">{insight.title}</h3>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isModuleAnalysisEnabled && selectedModule && (
                  <div
                    className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium flex items-center">
                        Module: {activeModule}
                        {fromCache && (
                          <span className="ml-2 text-xs flex items-center text-muted-foreground">
                            <Database className="h-3 w-3 mr-1" />
                            cached
                          </span>
                        )}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => activeModule && analyzeModuleWithAI(activeModule, true)}
                        disabled={isAnalyzingModule || !activeModule}
                        title="Refresh analysis (ignore cache)"
                      >
                        <RefreshCw className={`h-4 w-4 ${isAnalyzingModule ? "animate-spin" : ""}`} />
                        <span className="sr-only">Refresh analysis</span>
                      </Button>
                    </div>

                    {isAnalyzingModule ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[90%]" />
                        <Skeleton className="h-4 w-[80%]" />
                      </div>
                    ) : error ? (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    ) : aiAnalysis ? (
                      <p className="text-sm text-foreground">{aiAnalysis}</p>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <p>No analysis available. Click the refresh button to analyze this module.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="stats" className="px-4 py-4">
            <div className="space-y-4">
              <div
                className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
              >
                <h3 className="font-medium">Repository Overview</h3>
                {!isValidAnalysisData ? (
                  <p className="mt-2 text-sm text-muted-foreground">No repository data available.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Packages:</span>
                      <span>{stats.packages}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Dependencies:</span>
                      <span>{stats.dependencies}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Circular deps:</span>
                      <span>{stats.circularDeps}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted-foreground">Avg. depth:</span>
                      <span>{stats.avgDepth.toFixed(1)}</span>
                    </li>
                  </ul>
                )}
              </div>

              <div
                className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
              >
                <h3 className="font-medium">Most Connected</h3>
                {!isValidAnalysisData ? (
                  <p className="mt-2 text-sm text-muted-foreground">No repository data available.</p>
                ) : stats.mostConnected.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {stats.mostConnected.map((pkg) => (
                      <li key={pkg.name} className="flex justify-between">
                        <span className="text-muted-foreground">{pkg.name}:</span>
                        <span>{pkg.count} connections</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No connections found.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="modules" className="px-4 py-4">
            <div className="space-y-2">
              {!isValidAnalysisData ? (
                <div
                  className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
                >
                  <p className="text-sm text-muted-foreground">Enter a GitHub repository URL to see modules.</p>
                </div>
              ) : analysisData.graph.nodes.length === 0 ? (
                <div
                  className={`rounded-lg border border-input ${isDark ? "bg-gray-900/50" : "bg-gray-50"} p-3 shadow-sm`}
                >
                  <p className="text-sm text-muted-foreground">No modules found in this repository.</p>
                </div>
              ) : (
                analysisData.graph.nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`rounded-lg border p-3 shadow-sm cursor-pointer transition-colors ${
                      activeModule === node.id
                        ? isDark
                          ? "bg-blue-900/20 border-blue-800"
                          : "bg-blue-50 border-blue-200"
                        : isDark
                          ? "border-gray-800 bg-gray-900/50 hover:bg-gray-800/50"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    }`}
                    onClick={() => {
                      // First change to AI tab
                      setActiveTab("ai")
                      // Then call setSelectedModule which will trigger the parent's handleSelectNode
                      setSelectedModule(node.id)
                      // Finally analyze the module after a small delay to match graph behavior
                      setTimeout(() => {
                        analyzeModuleWithAI(node.id)
                      }, 50)
                    }}
                  >
                    <h3 className="font-medium">{node.id}</h3>
                    <p className="text-xs text-muted-foreground truncate">{node.data?.path || ""}</p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
