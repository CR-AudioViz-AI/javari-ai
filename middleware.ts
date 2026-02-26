/**
 * Next.js Middleware - Route Detection for Javari OS
 * 
 * Sets custom header 'x-is-javari' for all /javari/* routes.
 * Root layout reads this header to conditionally render navigation.
 * 
 * @version 1.1.0 - FIXED: Corrected /api exclusion pattern
 * @timestamp Thursday, February 26, 2026 at 3:45 AM EST
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
     * - /api/* (all API routes - MUST start with /api/)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     * - /*.{svg,png,jpg,jpeg,gif,webp} (public image files)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
