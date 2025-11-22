/**
 * HENDERSON OVERRIDE PROTOCOL + KILL COMMAND ENFORCEMENT MIDDLEWARE
 * 
 * Integrated middleware that handles:
 * 1. Henderson Override Protocol (kill_switch_active in javari_settings)
 * 2. Legacy Kill Command (system_locked in javari_settings)
 * 3. Roy-only access during lockdown
 * 
 * @version 2.0.0 - Henderson Override Protocol Integration
 * @date November 22, 2025 - 3:50 PM EST
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

// Routes that should ALWAYS work (Roy-only admin routes)
const ADMIN_ROUTES = [
  '/api/admin/kill-switch',
  '/api/admin/kill-command',
  '/api/admin/security'
];

/**
 * Check Henderson Override Protocol status (primary kill switch)
 */
async function isHendersonProtocolActive(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('javari_settings')
      .select('kill_switch_active')
      .single();
    
    return data?.kill_switch_active === true;
  } catch (error) {
    console.error('Failed to check Henderson Override Protocol status:', error);
    // Fail open to avoid blocking legitimate traffic if database is down
    return false;
  }
}

/**
 * Check legacy kill command status (backward compatibility)
 */
async function isLegacyKillCommandActive(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('javari_settings')
      .select('value')
      .eq('key', 'system_locked')
      .single();
    
    return data?.value === 'true';
  } catch (error) {
    console.error('Failed to check legacy kill command status:', error);
    return false;
  }
}

/**
 * Check if user is Roy (owner) - checks both email and user ID
 */
async function isRoy(request: NextRequest): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;
    
    // Check both email (primary) and user ID (legacy support)
    return user.email === ROY_EMAIL || user.id === ROY_USER_ID;
  } catch (error) {
    console.error('Failed to check Roy status:', error);
    return false;
  }
}

/**
 * Log blocked request attempt
 */
async function logBlockedRequest(
  request: NextRequest,
  reason: string,
  userId?: string,
  userEmail?: string
) {
  try {
    const supabase = createClient();
    await supabase.from('kill_switch_log').insert({
      action: 'request_blocked',
      user_id: userId || null,
      user_email: userEmail || 'anonymous',
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      reason: reason,
      url: request.url
    });
  } catch (error) {
    console.error('Failed to log blocked request:', error);
  }
}

/**
 * Middleware function to enforce kill switches
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow admin routes (Roy needs access to control the kill switch)
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if route should be protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (!isProtectedRoute) {
    // Not a protected route, allow through
    return NextResponse.next();
  }

  // Check both kill switches
  const hendersonActive = await isHendersonProtocolActive();
  const legacyActive = await isLegacyKillCommandActive();
  
  if (!hendersonActive && !legacyActive) {
    // Neither kill switch is active, allow through
    return NextResponse.next();
  }

  // Kill switch IS active - check if user is Roy
  const userIsRoy = await isRoy(request);
  
  if (userIsRoy) {
    // Roy can still access even when kill switches are active
    return NextResponse.next();
  }

  // Get user info for logging
  let userId: string | undefined;
  let userEmail: string | undefined;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    userEmail = user?.email;
  } catch (error) {
    // Continue without user info
  }

  // Determine which protocol is active for the message
  const protocol = hendersonActive ? 'HENDERSON_OVERRIDE_PROTOCOL' : 'KILL_COMMAND';
  const message = hendersonActive 
    ? 'Platform is currently in protected mode. The Henderson Override Protocol is active.'
    : 'All Javari operations are currently frozen. System is in emergency lockdown mode.';

  // Log the blocked attempt
  await logBlockedRequest(
    request, 
    `${protocol} active - non-Roy request blocked`,
    userId,
    userEmail
  );

  // Block the request
  return NextResponse.json(
    {
      error: 'SYSTEM_LOCKED',
      message: message,
      code: protocol,
      timestamp: new Date().toISOString()
    },
    { 
      status: 503,
      headers: {
        'X-System-Status': 'LOCKED',
        'X-Protocol-Active': protocol,
        'Retry-After': '3600' // Suggest retry in 1 hour
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
