import { getErrorMessage, logError } from '@/lib/utils/error-utils';
/**
 * Conversation Search API
 * GET: Full-text search across conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('userId') || 'default-user';
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Search in title, summary, and messages content
    const { data, error } = await supabase
      .from('conversations')
      .select('id, numeric_id, title, summary, message_count, starred, created_at, updated_at, continuation_depth')
      .eq('user_id', userId)
      .eq('status', 'active')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // For more advanced search (including message content), we'd need to parse messages JSONB
    // This is a basic implementation focusing on title and summary

    return NextResponse.json({
      success: true,
      query,
      results: data || [],
      count: data?.length || 0,
    });
  } catch (error: unknown) {
    console.error('Error searching conversations:', error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
