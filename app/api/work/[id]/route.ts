import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { JavariWorkLog, UpdateWorkLogInput } from '@/lib/types/javari-types';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/work/[id] - Get a single work log by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { data: workLog, error } = await supabase
      .from('javari_chat_work_logs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !workLog) {
      return NextResponse.json(
        { error: 'Work log not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(workLog);
    
  } catch (error: unknown) {
    logError('Error fetching work log:\', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/work/[id] - Update a work log
 * Body: UpdateWorkLogInput
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json() as UpdateWorkLogInput;
    
    // Check if work log exists
    const { data: existing, error: fetchError } = await supabase
      .from('javari_chat_work_logs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Work log not found' },
        { status: 404 }
      );
    }
    
    // Prepare update data - only include fields that are provided
    const updateData: Partial<JavariWorkLog> = {};
    
    if (body.description !== undefined) updateData.description = body.description;
    if (body.impact_level !== undefined) updateData.impact_level = body.impact_level;
    if (body.files_affected !== undefined) updateData.files_affected = body.files_affected;
    if (body.lines_added !== undefined) updateData.lines_added = body.lines_added;
    if (body.lines_deleted !== undefined) updateData.lines_deleted = body.lines_deleted;
    if (body.complexity_added !== undefined) updateData.complexity_added = body.complexity_added;
    if (body.tests_added !== undefined) updateData.tests_added = body.tests_added;
    if (body.breaking_change !== undefined) updateData.breaking_change = body.breaking_change;
    if (body.cost_saved !== undefined) updateData.cost_saved = body.cost_saved;
    if (body.cost_incurred !== undefined) updateData.cost_incurred = body.cost_incurred;
    if (body.needs_review !== undefined) updateData.needs_review = body.needs_review;
    if (body.review_completed !== undefined) updateData.review_completed = body.review_completed;
    if (body.commit_sha !== undefined) updateData.commit_sha = body.commit_sha;
    if (body.deploy_url !== undefined) updateData.deploy_url = body.deploy_url;
    
    // Update work log
    const { data: updated, error } = await supabase
      .from('javari_chat_work_logs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logError('Error updating work log:\', error);
      return NextResponse.json(
        { error: 'Failed to update work log', details: error.message },
        { status: 500 }
      );
    }
    
    // If metrics changed, update chat session
    if (
      body.lines_added !== undefined ||
      body.lines_deleted !== undefined ||
      body.cost_saved !== undefined ||
      body.cost_incurred !== undefined
    ) {
      await recalculateChatSessionMetrics(supabase, existing.chat_session_id);
    }
    
    return NextResponse.json(updated);
    
  } catch (error: unknown) {
    logError('Error updating work log:\', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work/[id] - Delete a work log
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Fetch work log to get session ID before deletion
    const { data: workLog, error: fetchError } = await supabase
      .from('javari_chat_work_logs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !workLog) {
      return NextResponse.json(
        { error: 'Work log not found' },
        { status: 404 }
      );
    }
    
    // Delete work log
    const { error } = await supabase
      .from('javari_chat_work_logs')
      .delete()
      .eq('id', id);
    
    if (error) {
      logError('Error deleting work log:\', error);
      return NextResponse.json(
        { error: 'Failed to delete work log', details: error.message },
        { status: 500 }
      );
    }
    
    // Recalculate chat session metrics after deletion
    await recalculateChatSessionMetrics(supabase, workLog.chat_session_id);
    
    return NextResponse.json(
      { message: 'Work log deleted successfully' },
      { status: 200 }
    );
    
  } catch (error: unknown) {
    logError('Error deleting work log:\', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to recalculate chat session metrics from work logs
 */
async function recalculateChatSessionMetrics(
  supabase: any,
  sessionId: string
) {
  try {
    // Fetch all work logs for this session
    const { data: workLogs } = await supabase
      .from('javari_chat_work_logs')
      .select('*')
      .eq('chat_session_id', sessionId);
    
    if (!workLogs) return;
    
    // Calculate totals
    const metrics = {
      lines_of_code_added: 0,
      lines_of_code_deleted: 0,
      files_created: 0,
      files_modified: 0,
      apis_created: 0,
      tests_written: 0,
      estimated_cost_saved: 0,
      actual_cost_incurred: 0,
    };
    
    workLogs.forEach((log) => {
      metrics.lines_of_code_added += log.lines_added || 0;
      metrics.lines_of_code_deleted += log.lines_deleted || 0;
      metrics.estimated_cost_saved += parseFloat(log.cost_saved || '0');
      metrics.actual_cost_incurred += parseFloat(log.cost_incurred || '0');
      
      if (log.action_type === 'file_created') metrics.files_created += 1;
      if (log.action_type === 'file_modified') metrics.files_modified += 1;
      if (log.action_type === 'api_created') metrics.apis_created += 1;
      if (log.action_type === 'test_written' || log.tests_added) metrics.tests_written += 1;
    });
    
    // Update session
    await supabase
      .from('javari_chat_sessions')
      .update(metrics)
      .eq('id', sessionId);
    
  } catch (error: unknown) {
    logError('Error recalculating metrics:\', error);
  }
}
