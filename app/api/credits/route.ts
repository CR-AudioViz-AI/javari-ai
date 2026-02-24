/**
 * CREDITS API - Returns user credit balance
 * Fixed with proper auth handling per ChatGPT audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Configuration error'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    const userId = request.nextUrl.searchParams.get('user_id');

    // If no auth and no user_id, return 401
    if (!authHeader && !userId) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Authentication required. Provide Authorization header or user_id parameter.'
      }, { status: 401 });
    }

    let targetUserId = userId;

    // If auth header provided, verify and get user
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return NextResponse.json({ 
          error: 'Invalid token',
          message: 'Authentication token is invalid or expired'
        }, { status: 401 });
      }
      
      targetUserId = user.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ 
        error: 'Bad request',
        message: 'User ID required'
      }, { status: 400 });
    }

    // Get credits balance
    const { data: credits, error } = await supabase
      .from('credits')
      .select('balance, lifetime_earned, last_updated')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ 
        error: 'Database error',
        message: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user_id: targetUserId,
      balance: credits?.balance || 0,
      lifetime_earned: credits?.lifetime_earned || 0,
      last_updated: credits?.last_updated || null
    });

  } catch (err: unknown) {
    return NextResponse.json({ 
      error: 'Server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
