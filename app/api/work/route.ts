import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';
import type { 
  JavariWorkLog, 
  CreateWorkLogInput, 
  WorkLogFilters,
  WorkLogStats 
} from '@/lib/types/javari-types';

/**
 * GET /api/work - List work logs with optional filters
 * Query params:
 *   - chat_session_id: Filter by session
 *   - action_type: Filter by action type
 *   - action_category: Filter by category
 *   - impact_level: Filter by impact
 *   - needs_review: Filter by review status
 *   - limit: Number of results (default 50)
 *   - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    // Extract filters
    const filters: WorkLogFilters = {
      chat_session_id: searchParams.get('chat_session_id') || undefined,
      action_type: searchParams.get('action_type') || undefined,
      action_category: searchParams.get('action_category') || undefined,
      impact_level: searchParams.get('impact_level') || undefined,
      needs_review: searchParams.get('needs_review') === 'true' ? true : undefined,
    };
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build query
    let query = supabase
      .from('javari_chat_work_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (filters.chat_session_id) {
      query = query.eq('chat_session_id', filters.chat_session_id);
    }
    if (filters.action_type) {
      query = query.eq('action_type', filters.action_type);
    }
    if (filters.action_category) {
      query = query.eq('action_category', filters.action_category);
    }
    if (filters.impact_level) {
      query = query.eq('impact_level', filters.impact_level);
    }
    if (filters.needs_review !== undefined) {
      query = query.eq('needs_review', filters.needs_review);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      logError('Error fetching work logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch work logs', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      work_logs: data || [],
      total: count || 0,
      limit,
      offset,
    });
    
  } catch (error: unknown) {
    logError('Unexpected error fetching work logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work - Create a new work log entry
 * Body: CreateWorkLogInput
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json() as CreateWorkLogInput;
    
    // Validate required fields
    if (!body.chat_session_id) {
      return NextResponse.json(
        { error: 'chat_session_id is required' },
        { status: 400 }
      );
    }
    
    if (!body.action_type) {
      return NextResponse.json(
        { error: 'action_type is required' },
        { status: 400 }
      );
    }
    
    if (!body.action_category) {
      return NextResponse.json(
        { error: 'action_category is required' },
        { status: 400 }
      );
    }
    
    if (!body.description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 }
      );
    }
    
    // Verify chat session exists
    const { data: session, error: sessionError } = await supabase
      .from('javari_chat_sessions')
      .select('id')
      .eq('id', body.chat_session_id)
      .single();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }
    
    // Prepare work log data
    const workLogData: Partial<JavariWorkLog> = {
      chat_session_id: body.chat_session_id,
      action_type: body.action_type,
      action_category: body.action_category,
      description: body.description,
      impact_level: body.impact_level || 'moderate',
      files_affected: body.files_affected || [],
      lines_added: body.lines_added || 0,
      lines_deleted: body.lines_deleted || 0,
      complexity_added: body.complexity_added || 0,
      tests_added: body.tests_added || false,
      breaking_change: body.breaking_change || false,
      cost_saved: body.cost_saved || 0,
      cost_incurred: body.cost_incurred || 0,
      needs_review: body.needs_review || false,
      review_completed: body.review_completed || false,
      commit_sha: body.commit_sha,
      deploy_url: body.deploy_url,
    };
    
    // Insert work log
    const { data: workLog, error } = await supabase
      .from('javari_chat_work_logs')
      .insert(workLogData)
      .select()
      .single();
    
    if (error) {
      logError('Error creating work log:', error);
      return NextResponse.json(
        { error: 'Failed to create work log', details: error.message },
        { status: 500 }
      );
    }
    
    // Update chat session metrics
    await updateChatSessionMetrics(supabase, body.chat_session_id, workLogData);
    
    return NextResponse.json(workLog, { status: 201 });
    
  } catch (error: unknown) {
    logError('Unexpected error creating work log:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to update chat session metrics based on work log
 */
async function updateChatSessionMetrics(
  supabase: any,
  sessionId: string,
  workLog: Partial<JavariWorkLog>
) {
  try {
    // Fetch current session
    const { data: session } = await supabase
      .from('javari_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (!session) return;
    
    // Calculate updates
    const updates: any = {};
    
    if (workLog.lines_added) {
      updates.lines_of_code_added = session.lines_of_code_added + workLog.lines_added;
    }
    
    if (workLog.lines_deleted) {
      updates.lines_of_code_deleted = session.lines_of_code_deleted + workLog.lines_deleted;
    }
    
    if (workLog.action_type === 'file_created') {
      updates.files_created = session.files_created + 1;
    } else if (workLog.action_type === 'file_modified') {
      updates.files_modified = session.files_modified + 1;
    }
    
    if (workLog.action_type === 'api_created') {
      updates.apis_created = session.apis_created + 1;
    }
    
    if (workLog.action_type === 'test_written' || workLog.tests_added) {
      updates.tests_written = session.tests_written + 1;
    }
    
    if (workLog.cost_saved) {
      updates.estimated_cost_saved = session.estimated_cost_saved + workLog.cost_saved;
    }
    
    if (workLog.cost_incurred) {
      updates.actual_cost_incurred = session.actual_cost_incurred + workLog.cost_incurred;
    }
    
    // Apply updates
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('javari_chat_sessions')
        .update(updates)
        .eq('id', sessionId);
    }
    
  } catch (error: unknown) {
    logError('Error updating chat session metrics:', error);
  }
}
