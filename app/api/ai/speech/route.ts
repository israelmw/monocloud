import { NextRequest, NextResponse } from "next/server";
import { experimental_generateSpeech as speech } from "ai";
import { openai } from "@ai-sdk/openai";
import { serverCache } from "@/lib/cache";

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
    
    // Create a cache key based on the request parameters
    const cacheKey = `speech:${text}:${voice || "alloy"}:${instructions || "Speak naturally and professionally"}`;
    
    // Check if we have a cached response
    const cachedAudio = serverCache.get<{ audio: string, contentType: string }>(cacheKey);
    
    if (cachedAudio) {
      console.log("[TTS API] Using cached audio response");
      return NextResponse.json(cachedAudio);
    }
    
    console.log("[TTS API] Cache miss, generating new audio");
    const audioResponse = await speech({
      model: openai.speech("gpt-4o-mini-tts"),
      text: text,
      instructions: instructions || "Speak naturally and professionally",
      voice: voice || "alloy"
    });
    
    // Convert the audio to base64
    const uint8Array = audioResponse.audio.uint8Array;
    const base64Audio = Buffer.from(uint8Array).toString('base64');
    
    const responseData = { 
      audio: base64Audio,
      contentType: "audio/mpeg"
    };
    
    // Cache the response (1 day TTL = 24 hours * 60 minutes * 60 seconds * 1000ms)
    serverCache.set(cacheKey, responseData, 24 * 60 * 60 * 1000);
    
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[TTS API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate speech" },
      { status: 500 }
    );
  }
}