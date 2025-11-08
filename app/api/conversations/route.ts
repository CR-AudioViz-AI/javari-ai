import { getErrorMessage, logError } from '@/lib/utils/error-utils';
import { safeAsync, handleError } from '@/lib/error-handler';
import { isDefined, toString, toNumber, toBoolean, safeGet, isArray } from '@/lib/typescript-helpers';

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

interface ConversationCreateBody {
  userId?: string;
  title?: string;
  projectId?: string;
  subprojectId?: string;
  parentId?: string;
  model?: string;
  messages?: any[];
  metadata?: Record<string, any>;
}

// GET /api/conversations - List conversations
export async function GET(request: NextRequest) {
  return await safeAsync(
    async () => {
      const { searchParams } = new URL(request.url);
      
      // Get query parameters with type safety
      const userId = toString(searchParams.get('userId'), 'default-user');
      const search = searchParams.get('search');
      const starred = searchParams.get('starred');
      const projectId = searchParams.get('projectId');
      const status = toString(searchParams.get('status'), 'active');
      const limit = toNumber(searchParams.get('limit'), 50);
      const offset = toNumber(searchParams.get('offset'), 0);
      const sortBy = toString(searchParams.get('sortBy'), 'updated_at');
      const sortOrder = toString(searchParams.get('sortOrder'), 'desc');

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

      if (isDefined(projectId)) {
        query = query.eq('project_id', projectId);
      }

      if (isDefined(search)) {
        query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        handleError(error, { file: 'conversations/route.ts', function: 'GET' });
        throw error;
      }

      return NextResponse.json({
        success: true,
        conversations: data || [],
        total: count || 0,
        limit,
        offset,
      });
    },
    { file: 'conversations/route.ts', function: 'GET' },
    NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { success: false, error: 'Unexpected error' },
    { status: 500 }
  );
}

// POST /api/conversations - Create new conversation
export async function POST(request: NextRequest) {
  return await safeAsync(
    async () => {
      const body = await request.json() as ConversationCreateBody;
      
      const userId = toString(body.userId, 'default-user');
      const title = body.title;
      const projectId = body.projectId;
      const subprojectId = body.subprojectId;
      const parentId = body.parentId;
      const model = toString(body.model, 'gpt-4');
      const messages = isArray(body.messages) ? body.messages : [];
      const metadata = body.metadata || {};

      if (!isDefined(title) || title.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'Title is required' },
          { status: 400 }
        );
      }

      // Calculate continuation depth if parent exists
      let continuationDepth = 0;
      if (isDefined(parentId)) {
        const { data: parent, error: parentError } = await supabase
          .from('conversations')
          .select('continuation_depth')
          .eq('id', parentId)
          .single();
        
        if (!parentError && isDefined(parent)) {
          const parentDepth = safeGet(parent, 'continuation_depth', 0);
          continuationDepth = toNumber(parentDepth, 0) + 1;
        }
      }

      // Create conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: title.trim(),
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

      if (error) {
        handleError(error, { file: 'conversations/route.ts', function: 'POST' });
        throw error;
      }

      return NextResponse.json({
        success: true,
        conversation: data,
      });
    },
    { file: 'conversations/route.ts', function: 'POST' },
    NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    )
  ) || NextResponse.json(
    { success: false, error: 'Unexpected error' },
    { status: 500 }
  );
}
