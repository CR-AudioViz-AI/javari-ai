/**
 * Javari AI - Conversations API
 * Manage chat sessions: save, list, resume, archive
 * 
 * @route /api/javari/conversations
 * @version 1.0.0
 * @date October 27, 2025 - 2:38 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  numeric_id: number;
  user_id: string;
  project_id?: string;
  parent_id?: string;
  title: string;
  summary?: string;
  messages: Message[];
  status: 'active' | 'inactive' | 'archived';
  starred: boolean;
  continuation_depth: number;
  message_count: number;
  model: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/javari/conversations
 * List all conversations for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') || 'active';
    const starred = searchParams.get('starred');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (starred === 'true') {
      query = query.eq('starred', true);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      logError('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversations: data,
      total: count,
      limit,
      offset,
    });
  } catch (error: unknown) {
    logError('Conversations GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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
    const {
      userId,
      projectId,
      parentId,
      title,
      summary,
      messages = [],
      model = 'gpt-4',
    } = body;

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'userId and title are required' },
        { status: 400 }
      );
    }

    // Calculate continuation depth if has parent
    let continuationDepth = 0;
    if (parentId) {
      const { data: parent } = await supabase
        .from('conversations')
        .select('continuation_depth')
        .eq('id', parentId)
        .single();

      if (parent) {
        continuationDepth = parent.continuation_depth + 1;
      }
    }

    // Insert new conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        project_id: projectId,
        parent_id: parentId,
        title,
        summary,
        messages,
        message_count: messages.length,
        continuation_depth: continuationDepth,
        model,
        status: 'active',
        starred: false,
      })
      .select()
      .single();

    if (error) {
      logError('Error creating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversation: data });
  } catch (error: unknown) {
    logError('Conversations POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/javari/conversations/:id
 * Update a conversation (add messages, change status, star, etc)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('id');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { messages, title, summary, status, starred } = body;

    const updates: any = { updated_at: new Date().toISOString() };

    if (messages) {
      updates.messages = messages;
      updates.message_count = messages.length;
    }

    if (title) updates.title = title;
    if (summary) updates.summary = summary;
    if (status) updates.status = status;
    if (starred !== undefined) updates.starred = starred;

    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      logError('Error updating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversation: data });
  } catch (error: unknown) {
    logError('Conversations PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/javari/conversations/:id
 * Delete or archive a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('id');
    const archive = searchParams.get('archive') === 'true';

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    if (archive) {
      // Archive instead of delete
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) {
        logError('Error archiving conversation:', error);
        return NextResponse.json(
          { error: 'Failed to archive conversation' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, archived: true });
    } else {
      // Permanent delete
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) {
        logError('Error deleting conversation:', error);
        return NextResponse.json(
          { error: 'Failed to delete conversation' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, deleted: true });
    }
  } catch (error: unknown) {
    logError('Conversations DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
