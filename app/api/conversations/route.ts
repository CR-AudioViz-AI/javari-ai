/**
 * JAVARI AI - CONVERSATIONS API
 * Complete CRUD operations for conversation management
 * 
 * Endpoints:
 * - GET    /api/conversations - List all conversations with filters
 * - POST   /api/conversations - Create new conversation
 * 
 * @version 1.0.0
 * @date October 27, 2025 - 9:52 PM ET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mark route as dynamic
export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * List all conversations with optional filters
 * 
 * Query Parameters:
 * - status: active | inactive | archived
 * - starred: true | false
 * - project_id: UUID
 * - subproject_id: UUID
 * - parent_id: UUID (for child conversations)
 * - search: text search in title/summary
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - sort: created_at | updated_at | last_message_at (default: updated_at)
 * - order: asc | desc (default: desc)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const status = searchParams.get('status');
    const starred = searchParams.get('starred');
    const projectId = searchParams.get('project_id');
    const subprojectId = searchParams.get('subproject_id');
    const parentId = searchParams.get('parent_id');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'updated_at';
    const order = searchParams.get('order') || 'desc';

    // Build query
    let query = supabase
      .from('conversations')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (starred !== null) {
      query = query.eq('starred', starred === 'true');
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (subprojectId) {
      query = query.eq('subproject_id', subprojectId);
    }

    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else if (parentId === null) {
      // Only root conversations (no parent)
      query = query.is('parent_id', null);
    }

    // Text search in title and summary
    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Sort and paginate
    query = query
      .order(sort as any, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 * 
 * Body:
 * {
 *   user_id: string (required)
 *   title: string (required)
 *   summary?: string
 *   project_id?: UUID
 *   subproject_id?: UUID
 *   parent_id?: UUID
 *   model?: string (default: 'gpt-4')
 *   tags?: string[]
 *   metadata?: object
 *   messages?: array (initial messages)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Validate required fields
    if (!body.user_id || !body.title) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, title' },
        { status: 400 }
      );
    }

    // Calculate continuation depth if parent exists
    let continuationDepth = 0;
    if (body.parent_id) {
      const { data: parent } = await supabase
        .from('conversations')
        .select('continuation_depth')
        .eq('id', body.parent_id)
        .single();
      
      if (parent) {
        continuationDepth = (parent.continuation_depth || 0) + 1;
      }
    }

    // Prepare conversation data
    const conversationData = {
      user_id: body.user_id,
      title: body.title,
      summary: body.summary || null,
      project_id: body.project_id || null,
      subproject_id: body.subproject_id || null,
      parent_id: body.parent_id || null,
      model: body.model || 'gpt-4',
      status: 'active' as const,
      starred: false,
      continuation_depth: continuationDepth,
      messages: body.messages || [],
      message_count: Array.isArray(body.messages) ? body.messages.length : 0,
      tags: body.tags || [],
      metadata: body.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: Array.isArray(body.messages) && body.messages.length > 0 
        ? new Date().toISOString() 
        : null,
    };

    const { data, error } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return NextResponse.json(
        { error: 'Failed to create conversation', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Conversation created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
