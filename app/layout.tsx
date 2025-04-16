import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { NarrationProvider } from "@/context/narration-context"
import { cn } from "@/lib/utils"
import "./globals.css"

// Load Inter font from Google Fonts
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "MonoCloud - Visual Monorepo Explorer",
  description: "Explore and understand large monorepos with an interactive, node-based graph visualization",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="monocloud-theme"
        >
          <NarrationProvider>{children}</NarrationProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'