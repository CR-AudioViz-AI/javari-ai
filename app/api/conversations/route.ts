// app/api/conversations/route.ts
// Javari AI Conversations API - Manage chat history
// Timestamp: 2025-11-29 17:00 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - List conversations or get single conversation
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('id');
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    if (conversationId) {
      // Get single conversation with messages
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 404 });
      }

      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      return NextResponse.json({
        success: true,
        conversation,
        messages: messages || []
      });
    }

    // List conversations
    let query = supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: conversations, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
      total: count || 0,
      limit,
      offset
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch conversations', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Create new conversation or add message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, conversationId, title, userId, message, role, provider, model } = body;

    if (action === 'create') {
      // Create new conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          title: title || 'New Conversation',
          user_id: userId || null,
          provider: provider || 'openai',
          model: model || 'gpt-4',
          message_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        conversation
      });
    }

    if (action === 'add_message') {
      if (!conversationId || !message || !role) {
        return NextResponse.json(
          { error: 'Missing required fields: conversationId, message, role' },
          { status: 400 }
        );
      }

      // Add message to conversation
      const { data: newMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: role,
          content: message,
          provider: provider || null,
          model: model || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (msgError) {
        return NextResponse.json({ error: msgError.message }, { status: 500 });
      }

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 100)
        })
        .eq('id', conversationId);

      // Increment message count
      await supabase.rpc('increment_message_count', { conv_id: conversationId });

      return NextResponse.json({
        success: true,
        message: newMessage
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: create, add_message' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Update conversation (title, rating, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, title, rating, isArchived } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (rating !== undefined) updates.rating = rating;
    if (isArchived !== undefined) updates.is_archived = isArchived;

    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      conversation: data
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update conversation', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete conversation
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversation id' }, { status: 400 });
    }

    // Delete messages first
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    // Delete conversation
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted'
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete conversation', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
