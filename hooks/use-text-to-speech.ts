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
  
  // Add a new state to track the progress of the audio playback
  const [progress, setProgress] = useState<number>(0);
  
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
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setProgress(0);
  }, []);
  
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
      setProgress(0);
      setIsPlaying(false);
    }
  }, []);
  
  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  // Generate audio from text using server API
  const generateAudio = useCallback(
    async (text: string) => {
      setIsLoading(true);
      setError(null);
      
      if (!text || text.trim() === "") {
        console.error("Cannot generate audio: text is empty");
        setError(new Error("Text cannot be empty"));
        setIsLoading(false);
        return null;
      }

      try {
        const cacheKey = `${text}-${voice}`;
        if (audioCache.current.has(cacheKey)) {
          console.log("Using cached audio");
          const cachedUrl = audioCache.current.get(cacheKey)!;
          setAudioUrl(cachedUrl);
          setIsLoading(false);
          return cachedUrl;
        }
        
        let instructions = "Speak naturally and professionally";
        if (repoName) {
          instructions += `, mentioning the repository ${repoName}`;
        }
        
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
        
        if (!data.audio || typeof data.audio !== 'string') {
          throw new Error('Invalid audio data received from server');
        }

        try {
          // Convert base64 to blob directly
          const byteCharacters = atob(data.audio);
          const byteNumbers = new Array(byteCharacters.length);
          
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: data.contentType });
          
          // Validate blob size
          if (blob.size === 0) {
            throw new Error('Generated audio blob is empty');
          }
          
          // Create URL directly from the blob
          const url = URL.createObjectURL(blob);
          
          // Save to cache
          audioCache.current.set(cacheKey, url);
          
          // Update state
          setAudioUrl(url);
          setIsLoading(false);
          return url;
          
        } catch (e) {
          console.error("Audio processing error:", e);
          throw new Error(`Failed to process audio: ${e instanceof Error ? e.message : String(e)}`);
        }
      } catch (err) {
        console.error("Error generating speech:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
        return null;
      }
    },
    [voice, repoName, onError]
  );

  // Initialize audio element
  const initAudioElement = useCallback((url: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    if (audioRef.current.src !== url) {
      audioRef.current.src = url;
    }
    
    audioRef.current.onplay = () => {
      console.log('Audio playback started');
      setIsPlaying(true);
      if (onStart) onStart();
    };
    
    audioRef.current.onpause = () => {
      console.log('Audio playback paused');
      setIsPlaying(false);
    };
    
    audioRef.current.onended = () => {
      console.log('Audio playback ended');
      setIsPlaying(false);
      setProgress(0);
      if (onEnd) onEnd();
    };
    
    audioRef.current.onerror = (e) => {
      console.error('Audio error:', e);
      setError(new Error('Error playing audio'));
      setIsPlaying(false);
      if (onError) onError(new Error('Error playing audio'));
    };

    // Handle progress
    audioRef.current.ontimeupdate = () => {
      if (audioRef.current && audioRef.current.duration) {
        const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(currentProgress);
      }
    };

    return audioRef.current;
  }, [onStart, onEnd, onError]);

  // Play audio with improved error handling and state management
  const play = useCallback(
    async (text?: string) => {
      if (!enabled) return;

      try {
        if (text) {
          // If the text is different or audio has ended, clear current audio
          if (textToNarrateRef.current !== text || (audioRef.current && audioRef.current.ended)) {
            cleanup();
            setAudioUrl(null); // Reset audioUrl to force regeneration
          }
          textToNarrateRef.current = text;
        }

        if (!textToNarrateRef.current) {
          console.warn('No text to play');
          return;
        }

        // If we have an existing paused audio that hasn't ended, just resume it
        if (audioRef.current && audioRef.current.paused && !audioRef.current.ended) {
          await audioRef.current.play();
          return;
        }

        // Generate or retrieve audio URL
        let url = audioUrl;
        if (!url || (audioRef.current && audioRef.current.ended)) {
          url = await generateAudio(textToNarrateRef.current);
          if (!url) {
            throw new Error('Failed to generate audio URL');
          }
        }

        // Initialize or update audio element
        const audio = initAudioElement(url);
        
        // Play
        await audio.play();
        
        // Update state
        lastProcessedTextRef.current = textToNarrateRef.current;
        lastProcessedTimeRef.current = Date.now();

      } catch (err) {
        console.error('Playback error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        if (onError) onError(err instanceof Error ? err : new Error(String(err)));
        cleanup();
        setIsPlaying(false);
      }
    },
    [enabled, audioUrl, generateAudio, cleanup, initAudioElement, onError]
  );

  // Force regeneration (ignoring cache)
  const forceRegenerate = useCallback(() => {
    if (textToNarrateRef.current) {
      const cacheKey = `${textToNarrateRef.current}-${voice}`;
      
      // Clear audio from cache
      if (audioCache.current.has(cacheKey)) {
        const oldUrl = audioCache.current.get(cacheKey);
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        audioCache.current.delete(cacheKey);
      }
      
      // Clear current audio
      cleanup();
      
      // Generate new audio
      generateAudio(textToNarrateRef.current);
    }
  }, [generateAudio, voice, cleanup]);

  // Update progress during playback
  useEffect(() => {
    if (audioRef.current) {
      const updateProgress = () => {
        if (audioRef.current && audioRef.current.duration) {
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      };

      audioRef.current.addEventListener("timeupdate", updateProgress);

      return () => {
        audioRef.current?.removeEventListener("timeupdate", updateProgress);
      };
    }
  }, [audioRef]);
  
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
    forceRegenerate,
    progress
  };
};

export default useTextToSpeech;
