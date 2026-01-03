/**
 * APPS API - Returns list of available applications
 * Fixed with proper error handling per ChatGPT audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Configuration error',
        message: 'Database credentials not configured'
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('apps')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true })
      .limit(Math.min(limit, 100));

    if (category) {
      query = query.eq('category', category);
    }

    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    const { data: apps, error } = await query;

    if (error) {
      console.error('Apps query error:', error);
      return NextResponse.json({ 
        error: 'Database error',
        message: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: apps?.length || 0,
      apps: apps || []
    });

  } catch (err: unknown) {
    console.error('Apps API error:', err);
    return NextResponse.json({ 
      error: 'Server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
