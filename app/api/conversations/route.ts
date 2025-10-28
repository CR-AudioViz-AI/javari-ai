/**
 * Conversations API - List and Create
 * GET: List conversations with search, filter, sort
 * POST: Create new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/conversations - List conversations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const userId = searchParams.get('userId') || 'default-user';
    const search = searchParams.get('search');
    const starred = searchParams.get('starred');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'updated_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    let query = supabase
      .from('conversations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', status)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    // Add optional filters
    if (starred === 'true') {
      query = query.eq('starred', true);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversations: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'default-user',
      title,
      projectId,
      subprojectId,
      parentId,
      model = 'gpt-4',
      messages = [],
      metadata = {},
    } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    // Calculate continuation depth if parent exists
    let continuationDepth = 0;
    if (parentId) {
      const { data: parent } = await supabase
        .from('conversations')
        .select('continuation_depth')
        .eq('id', parentId)
        .single();
      
      if (parent) {
        continuationDepth = (parent.continuation_depth || 0) + 1;
      }
    }

    // Create conversation
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title,
        project_id: projectId || null,
        subproject_id: subprojectId || null,
        parent_id: parentId || null,
        model,
        messages: JSON.stringify(messages),
        message_count: messages.length,
        continuation_depth: continuationDepth,
        metadata: JSON.stringify(metadata),
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conversation: data,
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
