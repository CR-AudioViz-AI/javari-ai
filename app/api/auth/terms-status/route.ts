// =============================================================================
// TERMS STATUS API - CHECK IF USER ACCEPTED TERMS
// =============================================================================
// Tuesday, December 16, 2025 - 11:52 PM EST
// Fixed: January 3, 2026 - Added dynamic export for cookies() usage
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Force dynamic rendering since we use cookies()
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const CURRENT_TERMS_VERSION = '2.0.0';

// =============================================================================
// GET - Check Terms Status
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get the user's session
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || accessToken;

    if (!token) {
      return NextResponse.json({
        accepted: false,
        currentVersion: CURRENT_TERMS_VERSION,
        message: 'Not logged in - terms acceptance required'
      });
    }

    // Get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({
        accepted: false,
        currentVersion: CURRENT_TERMS_VERSION,
        message: 'User not found'
      });
    }

    // Check if user has accepted current terms
    const { data: acceptance } = await supabase
      .from('terms_acceptance')
      .select('version, accepted_at')
      .eq('user_id', user.id)
      .eq('version', CURRENT_TERMS_VERSION)
      .single();

    if (acceptance) {
      return NextResponse.json({
        accepted: true,
        currentVersion: CURRENT_TERMS_VERSION,
        acceptedAt: acceptance.accepted_at,
        userId: user.id
      });
    }

    return NextResponse.json({
      accepted: false,
      currentVersion: CURRENT_TERMS_VERSION,
      message: 'Terms not yet accepted',
      userId: user.id
    });

  } catch (error) {
    console.error('[Terms Status] Error:', error);
    return NextResponse.json({
      accepted: false,
      currentVersion: CURRENT_TERMS_VERSION,
      error: 'Failed to check terms status'
    }, { status: 500 });
  }
}
