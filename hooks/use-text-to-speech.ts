"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TextToSpeechOptions, TextToSpeechReturnType } from "@/types";

/**
 * Hook to generate and play text to speech using the OpenAI API
 */
export const useTextToSpeech = (
  initialText: string = "", 
  {
    enabled = true,
    autoPlay = true,
    onStart,
    onEnd,
    onError,
    voice = "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
    repoName = ""
  }: TextToSpeechOptions = {}
): TextToSpeechReturnType => {
  // State to control loading and playback
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // References for audio and flow control
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const circuitBreakerRef = useRef<boolean>(false);
  const requestInProgressRef = useRef<boolean>(false);
  
  // Reference for the text to narrate
  const textToNarrateRef = useRef<string>(initialText || "");

  // Track processed text to prevent infinite loops
  const lastProcessedTextRef = useRef<string>("");
  
  // Add a debounce timer ref to prevent rapid successive calls
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a flag to track initial render
  const isFirstRenderRef = useRef<boolean>(true);
  
  // Add a play attempt counter to break out of potential loops
  const playAttemptsRef = useRef<number>(0);
  
  // Add a timestamp to track when text was last processed
  const lastProcessedTimeRef = useRef<number>(0);
  
  // Cache to avoid regenerating the same audio
  const audioCache = useRef<Map<string, string>>(new Map());
  
  // Clean up resources
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    // Clear any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [audioUrl]);
  
  // Reset request state
  const resetRequestState = useCallback(() => {
    requestInProgressRef.current = false;
    // Reset play attempts when a request completes
    playAttemptsRef.current = 0;
  }, []);
  
  // Reset the circuit breaker
  const resetCircuitBreaker = useCallback(() => {
    circuitBreakerRef.current = false;
    // Clear the last processed text to allow re-processing the same text
    lastProcessedTextRef.current = "";
    // Reset play attempts
    playAttemptsRef.current = 0;
    // Reset the last processed time
    lastProcessedTimeRef.current = 0;
  }, []);
  
  // Stop playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);
  
  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);
  
  // Generate audio from text using server API
  const generateAudio = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Check if we already have the audio in cache
        const cacheKey = `${text}-${voice}`;
        if (audioCache.current.has(cacheKey)) {
          console.log("Using cached audio");
          setAudioUrl(audioCache.current.get(cacheKey)!);
          setIsLoading(false);
          return;
        }
        
        // Determine instructions for synthesis
        let instructions = "Speak naturally and professionally";
        if (repoName) {
          instructions += `, mentioning the repository ${repoName}`;
        }
        
        // Generate the audio using the server API endpoint
        console.log("Generating speech for:", text);
        
        const response = await fetch('/api/ai/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice: voice || "alloy",
            instructions
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate speech');
        }
        
        const data = await response.json();
        
        // Convert base64 to blob
        const binaryString = atob(data.audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and URL for the audio
        const audioBlob = new Blob([bytes], { type: data.contentType });
        const url = URL.createObjectURL(audioBlob);
        
        // Save to cache
        audioCache.current.set(cacheKey, url);
        
        // Update state
        setAudioUrl(url);
        setIsLoading(false);
      } catch (err) {
        console.error("Error generating speech:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    },
    [voice, repoName, onError]
  );
  
  // Force regeneration (ignoring cache)
  const forceRegenerate = useCallback(() => {
    if (textToNarrateRef.current) {
      const cacheKey = `${textToNarrateRef.current}-${voice}`;
      if (audioCache.current.has(cacheKey)) {
        audioCache.current.delete(cacheKey);
      }
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      // Reset the last processed text to allow regeneration
      lastProcessedTextRef.current = "";
      lastProcessedTimeRef.current = 0;
      
      generateAudio(textToNarrateRef.current);
    }
  }, [generateAudio, audioUrl, voice]);
  
  // Play audio
  const play = useCallback(
    async (text?: string) => {
      if (!enabled) return;
      
      // If a request is in progress or the circuit breaker is activated, do nothing
      if (requestInProgressRef.current || circuitBreakerRef.current) {
        return;
      }
      
      // Safety check: limit the number of play attempts to prevent potential loops
      if (playAttemptsRef.current > 3) {
        console.warn("Too many play attempts detected, activating circuit breaker");
        circuitBreakerRef.current = true;
        
        // Auto-reset circuit breaker after 5 seconds
        setTimeout(() => {
          circuitBreakerRef.current = false;
          playAttemptsRef.current = 0;
        }, 5000);
        
        return;
      }
      
      // Increment play attempt counter
      playAttemptsRef.current += 1;
      
      // Update the text if provided
      if (text) {
        textToNarrateRef.current = text;
      }
      
      // If there is no text to narrate, do nothing
      if (!textToNarrateRef.current) {
        resetRequestState();
        return;
      }
      
      // Mark that a request is in progress
      requestInProgressRef.current = true;
      
      // If there is no audio URL, generate it
      if (!audioUrl) {
        await generateAudio(textToNarrateRef.current);
      }
      
      // If there is an audio URL, play it
      if (audioUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio(audioUrl);
          
          // Set up events
          audioRef.current.onplay = () => {
            setIsPlaying(true);
            if (onStart) onStart();
          };
          
          audioRef.current.onended = () => {
            setIsPlaying(false);
            if (onEnd) onEnd();
            resetRequestState();
          };
          
          audioRef.current.onerror = (err) => {
            console.error("Audio playback error:", err);
            setIsPlaying(false);
            setError(new Error("Error during audio playback"));
            resetRequestState();
            if (onError) onError(new Error("Error during audio playback"));
          };
        } else {
          audioRef.current.src = audioUrl;
        }
        
        try {
          await audioRef.current.play();
          // After successful playback start, record this text as processed
          lastProcessedTextRef.current = textToNarrateRef.current;
          lastProcessedTimeRef.current = Date.now();
        } catch (err) {
          console.error("Error playing audio:", err);
          setError(err instanceof Error ? err : new Error(String(err)));
          resetRequestState();
          if (onError) {
            onError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      } else {
        resetRequestState();
      }
    },
    [enabled, audioUrl, generateAudio, onStart, onEnd, onError, resetRequestState]
  );
  
  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      cleanup();
      
      // Clean up all cached URLs
      audioCache.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      audioCache.current.clear();
    };
  }, [cleanup]);
  
  // Auto-play effect when initialText changes and autoPlay is true
  useEffect(() => {
    // Skip effect on first render to prevent immediate playback when component mounts
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      textToNarrateRef.current = initialText; // Just store initial text
      return;
    }
    
    // Don't attempt to process empty text
    if (!initialText) {
      return;
    }

    // Enhanced protection against infinite loops with stricter conditions
    const textHasChanged = lastProcessedTextRef.current !== initialText;
    const noActiveProcesses = !isPlaying && !isLoading && !requestInProgressRef.current;
    const featureEnabled = enabled && autoPlay;
    
    // Add time-based throttling - require at least 2 seconds between auto-plays
    const currentTime = Date.now();
    const timeSinceLastPlay = currentTime - lastProcessedTimeRef.current;
    const hasMinTimePassed = timeSinceLastPlay > 2000; // 2 seconds
    
    // Add a more stringent check to prevent loop re-entry
    if (!textHasChanged || !hasMinTimePassed) {
      if (!textHasChanged && playAttemptsRef.current > 0) {
        console.log("Preventing potential loop - text already processed:", initialText.substring(0, 20) + "...");
      }
      if (!hasMinTimePassed) {
        console.log("Preventing rapid re-processing - too soon since last play:", timeSinceLastPlay + "ms");
      }
      return;
    }
    
    const shouldPlay = featureEnabled && 
                      initialText && 
                      textHasChanged &&
                      noActiveProcesses &&
                      hasMinTimePassed &&
                      !circuitBreakerRef.current;
    
    if (shouldPlay) {
      // Clear any existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Add a debounce delay to prevent rapid successive calls
      debounceTimerRef.current = setTimeout(() => {
        console.log("Auto-playing new text:", initialText.substring(0, 20) + "...");
        textToNarrateRef.current = initialText;
        
        // Store the text as processed BEFORE playing to prevent race conditions
        lastProcessedTextRef.current = initialText;
        // Pre-set the timestamp to prevent race conditions
        lastProcessedTimeRef.current = Date.now();
        
        play();
        
        debounceTimerRef.current = null;
      }, 800); // Increased debounce to 800ms for better stability
      
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      };
    }
  }, [enabled, autoPlay, initialText, play, isPlaying, isLoading]);
  
  return {
    isLoading,
    isPlaying,
    error,
    play,
    pause,
    stop,
    resetCircuitBreaker,
    resetRequestState,
    forceRegenerate
  };
};

export default useTextToSpeech;
