// app/api/javari/conversations/[id]/route.ts
// Javari AI Single Conversation API - Get/Update specific conversation
// Version: 1.0.0
// Timestamp: 2025-12-13 9:00 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/javari/conversations/[id]
 * Get a single conversation with all messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId);
    
    // If userId provided, verify ownership
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.single();
    
    if (error) {
      console.error('Error fetching conversation:', error);
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      conversation: {
        id: data.id,
        title: data.title,
        messages: data.messages || [],
        messageCount: data.message_count || 0,
        starred: data.starred || false,
        model: data.model,
        projectId: data.project_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/javari/conversations/[id]
 * Update a specific conversation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    const body = await request.json();
    const { userId, title, starred, messages, addMessage } = body;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // If adding a single message, fetch existing and append
    if (addMessage) {
      const { data: existing } = await supabase
        .from('conversations')
        .select('messages')
        .eq('id', conversationId)
        .single();
      
      const currentMessages = existing?.messages || [];
      const updatedMessages = [...currentMessages, addMessage];
      
      const { data, error } = await supabase
        .from('conversations')
        .update({
          messages: updatedMessages,
          message_count: updatedMessages.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .select()
        .single();
      
      if (error) throw error;
      
      return NextResponse.json({
        conversation: {
          id: data.id,
          messageCount: data.message_count,
          updatedAt: data.updated_at,
        },
      });
    }
    
    // Regular update
    const updates: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (title !== undefined) updates.title = title;
    if (starred !== undefined) updates.starred = starred;
    if (messages !== undefined) {
      updates.messages = messages;
      updates.message_count = messages.length;
    }
    
    let query = supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.select().single();
    
    if (error) {
      console.error('Error updating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      conversation: {
        id: data.id,
        title: data.title,
        messageCount: data.message_count,
        starred: data.starred,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/javari/conversations/[id]
 * Delete a specific conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('conversations')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', conversationId);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('Error deleting conversation:', error);
      return NextResponse.json(
        { error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
