/**
 * Next.js Middleware - Route Detection for Javari OS
 * 
 * Sets custom header 'x-is-javari' for all /javari/* routes.
 * Root layout reads this header to conditionally render navigation.
 * 
 * This is the CORRECT way to do server-side pathname detection in Next.js.
 * headers().get('x-invoke-path') does NOT exist - we create our own header.
 * 
 * @version 1.0.0
 * @timestamp Monday, February 24, 2026 at 1:25 AM EST
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Create response
  const response = NextResponse.next()
  
  // Set custom header for Javari routes
  if (pathname.startsWith('/javari')) {
    response.headers.set('x-is-javari', 'true')
  } else {
    response.headers.set('x-is-javari', 'false')
  }
  
  return response
}

// Match only non-API routes (we need to detect /javari vs non-javari)
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api (API routes - must be excluded)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
