"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Github, Volume2, VolumeX, Waypoints } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useNarration } from "@/context/narration-context"

// Navbar component with defined types
export function Navbar() {
  const { theme } = useTheme()
  const { narrationEnabled, toggleNarration } = useNarration()
  const router = useRouter()
  const isDark: boolean = theme === "dark"


  return (
    <header
      className={`sticky top-0 z-50 w-full border-b ${isDark ? "bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60" : "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"}`}
    >
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/?currentView=landing" className="mr-6 flex items-center space-x-2">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500 opacity-20 rounded-full blur-sm"></div>
              <Waypoints className="h-6 w-6 relative z-10" />
            </div>
            <span
              className={`hidden font-bold sm:inline-block bg-gradient-to-r ${isDark ? "from-blue-400 to-cyan-400" : "from-blue-600 to-cyan-600"} bg-clip-text text-transparent`}
            >
              MonoCloud
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {/* Narration switch */}
            <div className="flex items-center mr-2">
              <button
                onClick={toggleNarration}
                className={`flex items-center justify-center h-9 w-9 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${narrationEnabled ? "bg-accent/50" : ""}`}
                title={narrationEnabled ? "Disable voice narration" : "Enable voice narration"}
              >
                {narrationEnabled ? (
                  <Volume2 className="h-[1.2rem] w-[1.2rem] text-primary" />
                ) : (
                  <VolumeX className="h-[1.2rem] w-[1.2rem] text-muted-foreground" />
                )}
                <span className="sr-only">{narrationEnabled ? "Disable" : "Enable"} voice narration</span>
              </button>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <Link href="https://github.com/israelmw/monocloud" target="_blank" rel="noreferrer">
                <Github className="h-4 w-4" />
                <span className="sr-only">GitHub</span>
              </Link>
            </Button>
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
