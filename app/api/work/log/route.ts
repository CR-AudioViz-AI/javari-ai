import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { JavariChatWorkLog, CreateWorkLogRequest, ApiResponse } from '@/types/javari';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

// GET /api/work/log - Get work logs
// GET /api/work/log?chat_session_id=xxx - Get logs for specific chat session
export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const chat_session_id = searchParams.get('chat_session_id');
    const action_type = searchParams.get('action_type');
    const limit = searchParams.get('limit') || '50';

    let query = supabase.from('javari_chat_work_logs').select('*');

    if (chat_session_id) {
      query = query.eq('chat_session_id', chat_session_id);
    }

    if (action_type) {
      query = query.eq('action_type', action_type);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    const { data, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariChatWorkLog[]>>(
      { success: true, data },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST /api/work/log - Create work log entry
export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const body: CreateWorkLogRequest = await request.json();

    const {
      chat_session_id,
      action_type,
      action_category,
      description,
      impact_level = 'moderate',
      files_affected = [],
      lines_added = 0,
      lines_deleted = 0,
      complexity_added = 0,
      tests_added = false,
      breaking_change = false,
      cost_saved = 0,
      cost_incurred = 0,
      needs_review = false,
      commit_sha,
      deploy_url,
    } = body;

    if (!chat_session_id || !action_type || !action_category || !description) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Required fields: chat_session_id, action_type, action_category, description' },
        { status: 400 }
      );
    }

    const logData = {
      chat_session_id,
      action_type,
      action_category,
      description,
      impact_level,
      files_affected,
      lines_added,
      lines_deleted,
      complexity_added,
      tests_added,
      breaking_change,
      cost_saved,
      cost_incurred,
      needs_review,
      review_completed: false,
      commit_sha,
      deploy_url,
    };

    const { data, error } = await supabase
      .from('javari_chat_work_logs')
      .insert(logData)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariChatWorkLog>>(
      { success: true, data, message: 'Work log created successfully' },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
