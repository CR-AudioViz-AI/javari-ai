/**
 * HENDERSON OVERRIDE PROTOCOL + KILL COMMAND ENFORCEMENT MIDDLEWARE
 * 
 * @version 2.1.0 - Fixed Supabase client for Edge runtime
 * @date December 31, 2025 - 7:58 PM EST
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Edge-compatible Supabase client (no cookies dependency)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kteobfyferrukqeolofj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0ZW9iZnlmZXJydWtxZW9sb2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTcyNjYsImV4cCI6MjA3NzU1NzI2Nn0.uy-jlF_z6qVb8qogsNyGDLHqT4HhmdRhLrW7zPv3qhY';

const ROY_EMAIL = 'royhenderson@craudiovizai.com';
const ROY_USER_ID = process.env.ROY_USER_ID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// Routes that should be blocked when kill switch is active
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

// Routes that should ALWAYS work
const ADMIN_ROUTES = [
  '/api/admin/kill-switch',
  '/api/admin/kill-command',
  '/api/admin/security'
];

/**
 * Check Henderson Override Protocol status
 */
async function isHendersonProtocolActive(): Promise<boolean> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
      .from('javari_settings')
      .select('kill_switch_active')
      .single();
    
    return data?.kill_switch_active === true;
  } catch (error) {
    console.error('Kill switch check failed:', error);
    return false; // Fail open
  }
}

/**
 * Middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow admin routes
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route should be protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Check kill switch
  const isActive = await isHendersonProtocolActive();
  
  if (!isActive) {
    return NextResponse.next();
  }

  // Kill switch IS active - block non-Roy access
  // Note: In middleware we can't easily verify Roy without cookies
  // So for protected routes during lockdown, return 503
  return NextResponse.json(
    {
      error: 'SYSTEM_LOCKED',
      message: 'Platform is currently in protected mode.',
      code: 'HENDERSON_OVERRIDE_PROTOCOL',
      timestamp: new Date().toISOString()
    },
    { 
      status: 503,
      headers: {
        'X-System-Status': 'LOCKED',
        'Retry-After': '3600'
      }
    }
  );
}

export const config = {
  matcher: [
    // Only match protected API routes, not all routes
    '/api/javari/:path*',
    '/api/developer/:path*',
    '/api/auto-fix/:path*',
    '/api/suggestions/:path*',
    '/api/review/:path*',
    '/api/admin/:path*'
  ],
};
