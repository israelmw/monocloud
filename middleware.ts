import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Check if GitHub token is available and set a public env var for the client
  if (process.env.GITHUB_TOKEN) {
    response.headers.set("x-github-token-available", "true")
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
