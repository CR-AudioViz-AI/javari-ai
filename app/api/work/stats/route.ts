import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

/**
 * GET /api/work/stats - Get comprehensive work log statistics
 * Query params:
 *   - chat_session_id: Filter stats by session
 *   - start_date: Start date for time range filter
 *   - end_date: End date for time range filter
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const chatSessionId = searchParams.get('chat_session_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    
    // Build query
    let query = supabase
      .from('javari_chat_work_logs')
      .select('*');
    
    if (chatSessionId) {
      query = query.eq('chat_session_id', chatSessionId);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data: workLogs, error } = await query;
    
    if (error) {
      logError('Error fetching work logs for stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch work log statistics', details: error.message },
        { status: 500 }
      );
    }
    
    if (!workLogs || workLogs.length === 0) {
      return NextResponse.json({
        total_logs: 0,
        by_action_type: {},
        by_category: {},
        by_impact: {},
        total_lines_added: 0,
        total_lines_deleted: 0,
        total_complexity_added: 0,
        total_cost_saved: 0,
        total_cost_incurred: 0,
        files_affected_count: 0,
        breaking_changes_count: 0,
        tests_added_count: 0,
        needs_review_count: 0,
        review_completed_count: 0,
      });
    }
    
    // Calculate statistics
    const stats = {
      total_logs: workLogs.length,
      by_action_type: {} as Record<string, number>,
      by_category: {} as Record<string, number>,
      by_impact: {} as Record<string, number>,
      total_lines_added: 0,
      total_lines_deleted: 0,
      total_complexity_added: 0,
      total_cost_saved: 0,
      total_cost_incurred: 0,
      files_affected_count: 0,
      unique_files_affected: new Set<string>(),
      breaking_changes_count: 0,
      tests_added_count: 0,
      needs_review_count: 0,
      review_completed_count: 0,
      commits_tracked: new Set<string>(),
      deployments_tracked: new Set<string>(),
    };
    
    workLogs.forEach((log) => {
      // Count by action type
      stats.by_action_type[log.action_type] = (stats.by_action_type[log.action_type] || 0) + 1;
      
      // Count by category
      stats.by_category[log.action_category] = (stats.by_category[log.action_category] || 0) + 1;
      
      // Count by impact level
      stats.by_impact[log.impact_level] = (stats.by_impact[log.impact_level] || 0) + 1;
      
      // Sum metrics
      stats.total_lines_added += log.lines_added || 0;
      stats.total_lines_deleted += log.lines_deleted || 0;
      stats.total_complexity_added += log.complexity_added || 0;
      stats.total_cost_saved += parseFloat(log.cost_saved || '0');
      stats.total_cost_incurred += parseFloat(log.cost_incurred || '0');
      
      // Count files
      if (log.files_affected && Array.isArray(log.files_affected)) {
        stats.files_affected_count += log.files_affected.length;
        log.files_affected.forEach((file: string) => stats.unique_files_affected.add(file));
      }
      
      // Boolean flags
      if (log.breaking_change) stats.breaking_changes_count += 1;
      if (log.tests_added) stats.tests_added_count += 1;
      if (log.needs_review) stats.needs_review_count += 1;
      if (log.review_completed) stats.review_completed_count += 1;
      
      // Track unique commits and deployments
      if (log.commit_sha) stats.commits_tracked.add(log.commit_sha);
      if (log.deploy_url) stats.deployments_tracked.add(log.deploy_url);
    });
    
    // Calculate net code change
    const net_code_change = stats.total_lines_added - stats.total_lines_deleted;
    
    // Calculate net cost impact
    const net_cost_impact = stats.total_cost_saved - stats.total_cost_incurred;
    
    // Calculate percentages
    const review_completion_rate = stats.needs_review_count > 0
      ? (stats.review_completed_count / stats.needs_review_count) * 100
      : 100;
    
    return NextResponse.json({
      total_logs: stats.total_logs,
      by_action_type: stats.by_action_type,
      by_category: stats.by_category,
      by_impact: stats.by_impact,
      
      code_metrics: {
        total_lines_added: stats.total_lines_added,
        total_lines_deleted: stats.total_lines_deleted,
        net_code_change,
        total_complexity_added: stats.total_complexity_added,
      },
      
      cost_metrics: {
        total_cost_saved: parseFloat(stats.total_cost_saved.toFixed(2)),
        total_cost_incurred: parseFloat(stats.total_cost_incurred.toFixed(2)),
        net_cost_impact: parseFloat(net_cost_impact.toFixed(2)),
      },
      
      file_metrics: {
        files_affected_count: stats.files_affected_count,
        unique_files_count: stats.unique_files_affected.size,
        unique_files: Array.from(stats.unique_files_affected),
      },
      
      quality_metrics: {
        breaking_changes_count: stats.breaking_changes_count,
        tests_added_count: stats.tests_added_count,
        breaking_change_percentage: (stats.breaking_changes_count / stats.total_logs) * 100,
        test_coverage_percentage: (stats.tests_added_count / stats.total_logs) * 100,
      },
      
      review_metrics: {
        needs_review_count: stats.needs_review_count,
        review_completed_count: stats.review_completed_count,
        review_pending_count: stats.needs_review_count - stats.review_completed_count,
        review_completion_rate: parseFloat(review_completion_rate.toFixed(2)),
      },
      
      tracking_metrics: {
        unique_commits_count: stats.commits_tracked.size,
        unique_deployments_count: stats.deployments_tracked.size,
      },
    });
    
  } catch (error: unknown) {
    logError('Unexpected error calculating work log stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
