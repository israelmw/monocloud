"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, PauseIcon, PlayIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AudioPlayerButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  isPlaying: boolean
  isLoading: boolean
  progress: number
  onPlayPause: () => void
  className?: string
}

export function AudioPlayerButton({
  isPlaying,
  isLoading,
  progress,
  onPlayPause,
  className,
  ...props
}: AudioPlayerButtonProps) {
  return (
    <div className={cn("relative w-8 h-8", className)} {...props}>
      {/* Aura effect that only shows during playback */}
      {isPlaying  && (
        <div className="aura absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0"></div>
      )}
      
      {/* Progress circle */}
      <svg className="absolute inset-0 w-full h-full -rotate-90 z-10" viewBox="0 0 100 100">
        <circle
          className="text-gray-300 dark:text-gray-600"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
        />
        <circle
          className="text-cyan-400"
          strokeWidth="10"
          strokeDasharray={2 * Math.PI * 45}
          strokeDashoffset={2 * Math.PI * 45 * ((100 - progress) / 100)}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
        />
      </svg>
      
      {/* Centered button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onPlayPause}
        disabled={isLoading}
        title={isPlaying ? "Pause narration" : "Play narration"}
        className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-transparent z-20 w-8 h-8 focus:ring-0 focus-visible:ring-0 focus:outline-none focus-visible:ring-offset-0"
      >
        {isLoading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
        <span className="sr-only">
          {isPlaying ? "Pause narration" : "Play narration"}
        </span>
      </Button>
    </div>
  );
}