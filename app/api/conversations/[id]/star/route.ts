/**
 * Star/Unstar Conversation API
 * PATCH: Toggle starred status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get current starred status
    const { data: current, error: fetchError } = await supabase
      .from('conversations')
      .select('starred')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Toggle starred status
    const { data, error } = await supabase
      .from('conversations')
      .update({
        starred: !current?.starred,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversation: data,
      starred: data.starred,
    });
  } catch (error: any) {
    console.error('Error toggling star:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
