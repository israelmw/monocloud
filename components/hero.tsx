"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Search, AlertTriangle, Database, Waypoints } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { analyzeRepository } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useTheme } from "next-themes"
import { AnalysisData, HeroProps } from "@/types"

const EXAMPLE_REPOS = ["vercel/next.js", "facebook/react", "microsoft/vscode", "angular/angular"]

export function Hero({ onAnalysisComplete }: HeroProps) {
  const [repoUrl, setRepoUrl] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!repoUrl) {
      setError("Please enter a GitHub repository URL")
      return
    }

    setIsLoading(true)

    try {
      const result = await analyzeRepository(repoUrl)

      if (result.success) {
        onAnalysisComplete(result.data)

        if (result.fromCache) {
          toast.success("Analysis Complete (Cached)", {
            description: `Using cached analysis for ${result.data.owner}/${result.data.repo}`,
            icon: <Database className="h-4 w-4" />,
          })
        } else {
          toast.success("Analysis Complete", {
            description: `Successfully analyzed ${result.data.owner}/${result.data.repo}`,
          })
        }
      } else {
        setError(result.error)
        toast.error("Analysis Failed", {
          description: result.error,
        })
      }
    } catch (error: unknown) {
      console.error("Error in handleSubmit:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze repository"
      setError(errorMessage)
      toast.error("Error", {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExampleClick = async (repo: string) => {
    setRepoUrl(`https://github.com/${repo}`)
    setError(null)
    setIsLoading(true)

    try {
      const result = await analyzeRepository(`https://github.com/${repo}`)

      if (result.success) {
        onAnalysisComplete(result.data)

        if (result.fromCache) {
          toast.success("Analysis Complete (Cached)", {
            description: `Using cached analysis for ${result.data.owner}/${result.data.repo}`,
            icon: <Database className="h-4 w-4" />,
          })
        } else {
          toast.success("Analysis Complete", {
            description: `Successfully analyzed ${result.data.owner}/${result.data.repo}`,
          })
        }
      } else {
        setError(result.error)
        toast.error("Analysis Failed", {
          description: result.error,
        })
      }
    } catch (error: unknown) {
      console.error("Error in handleExampleClick:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze repository"
      setError(errorMessage)
      toast.error("Error", {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section
      className={`flex items-center justify-center min-h-[calc(100vh-3.5rem)] w-full ${isDark ? "bg-black" : "bg-gray-50"}`}
    >
      <div className="container px-4 md:px-6 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-2 text-center max-w-3xl mx-auto"
        >
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl"></div>
            <div className="relative z-10 bg-gradient-to-r from-blue-500 to-cyan-400 p-1 rounded-full">
              <div className={`${isDark ? "bg-black" : "bg-white"} rounded-full p-3`}>
                <motion.div
                  animate={{
                    rotate: [0, 10, 0, -10, 0],
                    scale: [1, 1.05, 1, 1.05, 1],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Number.POSITIVE_INFINITY,
                    repeatType: "loop",
                  }}
                >
                  <Waypoints className={`h-12 w-12 ${isDark ? "text-white" : "text-gray-900"}`} />
                </motion.div>
              </div>
            </div>
          </div>

          <h1
            className={`text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl/none bg-gradient-to-r ${
              isDark ? "from-white to-gray-300" : "from-gray-900 to-gray-600"
            } bg-clip-text text-transparent`}
          >
            Visualize Your Monorepo
          </h1>
          <p className={`mx-auto max-w-[700px] ${isDark ? "text-gray-400" : "text-gray-600"} md:text-xl`}>
            Explore and understand large monorepos with an interactive, node-based graph visualization.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md space-y-4 mt-8"
        >
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Paste GitHub repo URL"
                className={`pl-8 ${
                  isDark ? "bg-gray-950 border-gray-800" : "bg-white border-gray-300"
                } focus:border-blue-500`}
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
            >
              {isLoading ? "Analyzing..." : "Analyze"}
            </Button>
          </form>

          <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
            <span>Try:</span>
            {EXAMPLE_REPOS.map((repo) => (
              <button
                key={repo}
                onClick={() => handleExampleClick(repo)}
                className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 underline underline-offset-4"
                disabled={isLoading}
              >
                {repo}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
