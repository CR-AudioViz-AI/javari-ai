import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { type, name, content, metadata } = await req.json();
    
    // Get user session (implement your auth)
    const userId = 'system'; // Replace with actual user ID from session
    
    // Store in Javari context database
    const { data, error } = await supabase
      .from('javari_context')
      .insert({
        user_id: userId,
        type,
        name,
        content,
        metadata,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Also add to vector store for semantic search
    await fetch('/api/javari/knowledge/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: data.id,
        content,
        metadata: {
          type,
          name,
          ...metadata
        }
      })
    });

    return NextResponse.json({ 
      success: true,
      contextId: data.id
    });

  } catch (error) {
    console.error('Context error:', error);
    return NextResponse.json(
      { error: 'Failed to add context', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
