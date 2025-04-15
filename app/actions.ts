"use server"

import { analyzeMonorepo } from "@/lib/github"
import { redisCache } from "@/lib/redis-cache"
import { AnalysisData, RepositoryAnalysisResponse } from "@/types"

export async function analyzeRepository(repoUrl: string): Promise<RepositoryAnalysisResponse> {
  try {
    // Generate a cache key based on the repository URL
    const cacheKey = `repo:${repoUrl.toLowerCase().trim()}`
    console.log(`[Action] Analyzing repository: ${repoUrl}, cache key: ${cacheKey}`)

    // Check if we have a cached version
    const cachedResult = await redisCache.get(cacheKey)
    if (cachedResult) {
      console.log(`[Action] Using cached result for ${repoUrl}`)
      return {
        success: true,
        data: cachedResult as AnalysisData,
        fromCache: true,
      }
    } else {
      console.log(`[Action] No cached result found for ${repoUrl}`)
    }

    // If no cache, perform the analysis
    console.log(`[Action] Performing analysis for repository: ${repoUrl}`)
    const result = await analyzeMonorepo(repoUrl)

    // Save to cache (24 hours)
    try {
      console.log(`[Action] Saving result to cache for ${repoUrl}`)
      const saved = await redisCache.set(cacheKey, result)
      console.log(`[Action] Cache save result: ${saved ? "success" : "failed"}`)
    } catch (cacheError) {
      console.error(`[Action] Error saving to cache:`, cacheError)
      // Continue even if cache save fails
    }

    return {
      success: true,
      data: result as AnalysisData,
      fromCache: false,
    }
  } catch (error: unknown) {
    console.error("[Action] Error in analyzeRepository:", error)

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze repository",
    }
  }
}
