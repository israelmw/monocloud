import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { NextResponse } from "next/server"
import { redisCache } from "@/lib/redis-cache"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { moduleName, packageJson, dependencies, isRepoDescription, repoStats } = body

    // Input validation
    if (!moduleName) {
      return NextResponse.json({ error: "Module name is required" }, { status: 400 })
    }

    // Ensure dependencies is an array
    const deps = Array.isArray(dependencies) ? dependencies : []

    // Validate packageJson
    let packageJsonString = "{}"
    try {
      if (typeof packageJson === "string") {
        // Try to parse to validate it's valid JSON
        JSON.parse(packageJson)
        packageJsonString = packageJson
      } else if (packageJson && typeof packageJson === "object") {
        packageJsonString = JSON.stringify(packageJson)
      }
    } catch (error) {
      console.warn("[AI API] Invalid packageJson provided:", error)
      // Continue with an empty object
    }

    // Generate cache key for AI analysis
    let cacheKey
    if (isRepoDescription) {
      cacheKey = `ai-repo-description:${moduleName}`
    } else {
      const depsKey = deps.slice(0, 5).join(",")
      cacheKey = `ai-analysis:${moduleName}:${depsKey}`
    }

    console.log(`[AI API] Checking cache for key: ${cacheKey}`)

    // Check if we have a cached version (in memory or Redis)
    try {
      const cachedAnalysis = await redisCache.get<string>(cacheKey)
      if (cachedAnalysis) {
        console.log(`[AI API] Using cached AI analysis for ${moduleName}`)
        return NextResponse.json({
          result: cachedAnalysis,
          fromCache: true,
        })
      } else {
        console.log(`[AI API] No cached analysis found for ${moduleName}`)
      }
    } catch (cacheError) {
      console.error("[AI API] Error accessing cache:", cacheError)
      // Continue with analysis if there's a cache error
    }

    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log("[AI API] OpenAI API key is missing, returning mock analysis")
      return NextResponse.json(
        {
          error: "OpenAI API key is missing",
          result: `This is a mock analysis for the module "${moduleName}". The AI analysis feature requires an OpenAI API key to generate real insights.`,
        },
        { status: 200 },
      )
    }

    try {
      console.log(`[AI API] Generating analysis for ${moduleName}`)

      let prompt
      if (isRepoDescription) {
        // Prompt para descripción general del repositorio
        prompt = `You are an expert code analyst. Create a comprehensive overview of the GitHub repository "${moduleName}" based on these statistics:

Number of modules: ${repoStats?.nodeCount || "unknown"}
Number of dependencies between modules: ${repoStats?.edgeCount || "unknown"}
Module names: ${repoStats?.moduleNames || "unknown"}

Provide a clear, concise description of what this repository likely does, its architecture, and potential use cases. 
Focus on explaining the repository's purpose and structure in a way that would be helpful for someone exploring it for the first time.
Keep your response to 3-4 paragraphs maximum.`
      } else {
        // Prompt original para análisis de módulo
        prompt = `You are an expert code reviewer. Explain what the module "${moduleName}" does based on this package.json content:

${packageJsonString}

It depends on:
${deps.join(", ")}

Provide a clear, non-technical summary of its responsibility.`
      }

      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt: prompt,
        temperature: 0.4,
        maxTokens: 300,
      })

      // Validate that the result is a string
      if (typeof text !== "string") {
        throw new Error("Invalid response from AI model")
      }

      console.log(`[AI API] Successfully generated analysis for ${moduleName}`)

      // Save to cache (12 hours) - this will use memory cache if Redis fails
      try {
        console.log(`[AI API] Saving analysis to cache for key: ${cacheKey}`)
        const saved = await redisCache.set(cacheKey, text, 60 * 60 * 12)
        console.log(`[AI API] Cache save result: ${saved ? "success" : "failed"}`)

        // Verify the cache save
        const verifyCache = await redisCache.get(cacheKey)
        console.log(`[AI API] Verify cache save: ${verifyCache ? "found in cache" : "not found in cache"}`)
      } catch (cacheError) {
        console.error("[AI API] Error saving to cache:", cacheError)
        // Continue even if there's an error saving to cache
      }

      return NextResponse.json({
        result: text,
        fromCache: false,
      })
    } catch (error: unknown) {
      console.error("[AI API] AI analysis error:", error)

      // Provide a more descriptive error message
      const errorMessage = error instanceof Error ? error.message : "Failed to generate AI analysis"

      // Return a fallback result instead of an error
      return NextResponse.json({
        result: `Unable to analyze this module due to an error: ${errorMessage}. Please try again later.`,
        error: errorMessage,
        fromCache: false,
      })
    }
  } catch (error: unknown) {
    console.error("[AI API] Request processing error:", error)
    return NextResponse.json(
      {
        error: "Invalid request format",
        result: "Failed to process your request. Please check your input and try again.",
      },
      { status: 400 },
    )
  }
}
