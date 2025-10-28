/**
 * JAVARI AI - STAR CONVERSATION API
 * Toggle starred status for quick access
 * 
 * Endpoint:
 * - POST /api/conversations/[id]/star - Toggle starred status
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:54 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * POST /api/conversations/[id]/star
 * Toggle starred status
 * 
 * Body (optional):
 * {
 *   starred?: boolean (if not provided, will toggle)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    
    let body: { starred?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // No body provided, we'll toggle
    }

    // Get current starred status
    const { data: current, error: fetchError } = await supabase
      .from('conversations')
      .select('starred')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching conversation:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch conversation', details: fetchError.message },
        { status: 500 }
      );
    }

    // Determine new starred status
    const newStarred = body.starred !== undefined ? body.starred : !current.starred;

    // Update starred status
    const { data, error: updateError } = await supabase
      .from('conversations')
      .update({
        starred: newStarred,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating starred status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update starred status', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: newStarred ? 'Conversation starred' : 'Conversation unstarred',
    });
  } catch (error: any) {
    console.error('Star API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
