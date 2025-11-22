/**
 * JAVARI AI - KILL COMMAND ENFORCEMENT MIDDLEWARE
 * Blocks all operations when kill command is active
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:30 PM EST
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Routes that should be blocked when kill command is active
const PROTECTED_ROUTES = [
  '/api/javari/chat',
  '/api/javari/auto-heal',
  '/api/javari/build',
  '/api/javari/projects',
  '/api/javari/telemetry',
  '/api/developer/commit',
  '/api/developer/deploy',
  '/api/developer/generate',
  '/api/auto-fix',
  '/api/suggestions',
  '/api/review'
];

// Routes that should ALWAYS work (Roy-only admin routes)
const ADMIN_ROUTES = [
  '/api/admin/kill-command',
  '/api/admin/security'
];

/**
 * Check if kill command is currently active
 */
async function isKillCommandActive(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('javari_settings')
      .select('value')
      .eq('key', 'system_locked')
      .single();
    
    return data?.value === 'true';
  } catch (error) {
    console.error('Failed to check kill command status:', error);
    // Fail open for now to avoid blocking legitimate traffic if database is down
    return false;
  }
}

/**
 * Check if user is Roy (owner)
 */
async function isOwner(userId: string): Promise<boolean> {
  const ROY_USER_ID = process.env.ROY_USER_ID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  return userId === ROY_USER_ID;
}

/**
 * Get current user ID from request
 */
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware function to enforce kill command
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow admin routes to always pass through
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route should be protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (!isProtectedRoute) {
    // Not a protected route, allow through
    return NextResponse.next();
  }

  // Check if kill command is active
  const killCommandActive = await isKillCommandActive();
  
  if (!killCommandActive) {
    // Kill command not active, allow through
    return NextResponse.next();
  }

  // Kill command IS active - check if user is Roy
  const userId = await getCurrentUserId(request);
  
  if (userId && await isOwner(userId)) {
    // Roy can still access even when kill command is active
    return NextResponse.next();
  }

  // Block the request - kill command is active and user is not Roy
  return NextResponse.json(
    {
      error: 'SYSTEM_LOCKED',
      message: 'All Javari operations are currently frozen. System is in emergency lockdown mode.',
      code: 'KILL_COMMAND_ACTIVE',
      timestamp: new Date().toISOString()
    },
    { 
      status: 503,
      headers: {
        'X-System-Status': 'LOCKED',
        'X-Kill-Command': 'ACTIVE',
        'Retry-After': '300' // Suggest retry in 5 minutes
      }
    }
  );
}

/**
 * Configure which routes this middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
