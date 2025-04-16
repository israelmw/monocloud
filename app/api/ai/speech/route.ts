import { NextRequest, NextResponse } from "next/server";
import { experimental_generateSpeech as speech } from "ai";
import { openai } from "@ai-sdk/openai";
import { redisCache } from "@/lib/redis-cache"

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { text, voice, instructions } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }
    
    // Validate that the text is not empty or only whitespace
    if (!text || text.trim() === "") {
      return NextResponse.json(
        { error: "Text cannot be empty or whitespace" },
        { status: 400 }
      );
    }
    
    // Create a cache key based on the request parameters
    const cacheKey = `speech:${text}:${voice || "alloy"}:${instructions || "Speak naturally and professionally"}`;
    
    try {
      // Check if we have a cached response
      const cachedAudio = await redisCache.get<{ audio: string, contentType: string }>(cacheKey);
      
      if (cachedAudio) {
        console.log("[TTS API] Using cached audio response");
        return new NextResponse(JSON.stringify(cachedAudio), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
    } catch (cacheError) {
      console.warn("[TTS API] Cache error:", cacheError);
    }
    
    console.log("[TTS API] Cache miss, generating new audio");
    const audioResponse = await speech({
      model: openai.speech("gpt-4o-mini-tts"),
      text: text,
      instructions: instructions || "Speak naturally and professionally",
      voice: voice || "alloy"
    });
    
    if (!audioResponse?.audio?.uint8Array) {
      throw new Error('Invalid audio response from OpenAI');
    }
    
    const responseData = { 
      audio: Buffer.from(audioResponse.audio.uint8Array).toString('base64'),
      contentType: "audio/mpeg"
    };
    
    try {
      // Cache the response (4 day TTL)
      await redisCache.set(cacheKey, responseData, 48 * 60 * 60);
    } catch (cacheError) {
      console.warn("[TTS API] Cache set error:", cacheError);
    }
    
    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error: any) {
    console.error("[TTS API] Error:", error);
    return new NextResponse(
      JSON.stringify({ error: error.message || "Failed to generate speech" }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}