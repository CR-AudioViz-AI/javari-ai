// app/api/javari/conversations/route.ts
// Javari AI Conversations API - Load, Save, Delete conversations
// Version: 1.0.0
// Timestamp: 2025-12-13 8:55 AM EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Conversation {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  message_count: number;
  starred: boolean;
  model?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/javari/conversations
 * Get all conversations for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const starred = searchParams.get('starred') === 'true';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let query = supabase
      .from('conversations')
      .select('id, user_id, title, message_count, starred, model, status, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    if (starred) {
      query = query.eq('starred', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }
    
    // Transform to frontend format
    const conversations = (data || []).map((c: any) => ({
      id: c.id,
      title: c.title || 'Untitled',
      messageCount: c.message_count || 0,
      starred: c.starred || false,
      model: c.model,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
    
    return NextResponse.json({
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/javari/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, projectId, title, messages = [] } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        project_id: projectId,
        title: title || 'New Conversation',
        messages,
        message_count: messages.length,
        status: 'active',
        starred: false,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      conversation: {
        id: data.id,
        title: data.title,
        messageCount: data.message_count,
        starred: data.starred,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/javari/conversations
 * Update a conversation (star, rename, add messages)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, userId, title, starred, messages } = body;
    
    if (!conversationId || !userId) {
      return NextResponse.json(
        { error: 'conversationId and userId are required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const updates: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (title !== undefined) updates.title = title;
    if (starred !== undefined) updates.starred = starred;
    if (messages !== undefined) {
      updates.messages = messages;
      updates.message_count = messages.length;
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();
    
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
 * DELETE /api/javari/conversations
 * Delete (soft) a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    
    if (!conversationId || !userId) {
      return NextResponse.json(
        { error: 'conversationId and userId are required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Soft delete - set status to 'deleted'
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId);
    
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
