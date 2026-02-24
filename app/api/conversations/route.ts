// app/api/conversations/route.ts
// Javari AI Conversations API - Uses chat_conversations table
// Timestamp: 2025-11-29 17:18 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role bypasses RLS
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('id');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    if (conversationId) {
      // Get single conversation with messages
      const { data: conv, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      // Get messages for this conversation
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        success: true,
        conversation: conv,
        messages: messages || []
      });
    }

    // List all conversations
    const { data, error, count } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({
        success: true,
        conversations: [],
        total: 0,
        error: error.message
      });
    }

    return NextResponse.json({
      success: true,
      conversations: data || [],
      total: count || 0
    });

  } catch (error) {
    console.error('Conversations GET error:', error);
    return NextResponse.json({
      success: false,
      conversations: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, conversationId, title, message, role } = body;

    if (action === 'create') {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          title: title || 'New Conversation'
        })
        .select()
        .single();

      if (error) {
        console.error('Create conversation error:', error);
        // Return mock if table insert fails
        return NextResponse.json({
          success: true,
          conversation: {
            id: `temp_${Date.now()}`,
            title: title || 'New Conversation',
            created_at: new Date().toISOString()
          },
          note: 'Created temporary conversation'
        });
      }

      return NextResponse.json({
        success: true,
        conversation: data
      });
    }

    if (action === 'add_message' && conversationId && message && role) {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          role: role,
          content: message
        })
        .select()
        .single();

      if (error) {
        console.error('Add message error:', error);
        return NextResponse.json({
          success: false,
          error: error.message
        });
      }

      // Update conversation timestamp
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return NextResponse.json({
        success: true,
        message: data
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Conversations POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, title, isArchived } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (isArchived !== undefined) updates.is_archived = isArchived;

    const { data, error } = await supabase
      .from('chat_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, conversation: data });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    // Delete messages first
    await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', id);

    // Delete conversation
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
