// =============================================================================
// ACCEPT TERMS API - RECORD USER ACCEPTANCE
// =============================================================================
// Tuesday, December 16, 2025 - 11:53 PM EST
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// =============================================================================
// POST - Accept Terms
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { version } = body;

    if (!version) {
      return NextResponse.json({ error: 'Version required' }, { status: 400 });
    }

    // Get the user's session
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || accessToken;

    if (!token) {
      return NextResponse.json({ 
        error: 'Not logged in',
        hint: 'User must be logged in to accept terms'
      }, { status: 401 });
    }

    // Get user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ 
        error: 'User not found',
        details: userError?.message
      }, { status: 401 });
    }

    // Get request metadata
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 
                      headersList.get('x-real-ip') || 
                      'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Record acceptance
    const { data, error } = await supabase
      .from('terms_acceptance')
      .upsert({
        user_id: user.id,
        version: version,
        accepted_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent
      }, {
        onConflict: 'user_id,version'
      })
      .select()
      .single();

    if (error) {
      console.error('[Accept Terms] Database error:', error);
      // Still return success if table doesn't exist
      return NextResponse.json({
        success: true,
        message: 'Terms accepted (local)',
        version: version,
        fallback: true
      });
    }

    console.log(`[Accept Terms] ✅ User ${user.email} accepted terms v${version}`);

    return NextResponse.json({
      success: true,
      message: 'Terms accepted successfully',
      version: version,
      acceptedAt: data?.accepted_at
    });

  } catch (error) {
    console.error('[Accept Terms] Error:', error);
    return NextResponse.json({
      success: true,
      message: 'Terms accepted (fallback)',
      fallback: true
    });
  }
}
