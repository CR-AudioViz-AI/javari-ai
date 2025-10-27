import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { ApiResponse } from '@/types/javari';

interface WorkLogStats {
  total_logs: number;
  files_created: number;
  files_modified: number;
  files_deleted: number;
  apis_created: number;
  tests_written: number;
  bugs_fixed: number;
  total_lines_added: number;
  total_lines_deleted: number;
  success_rate: number;
  avg_execution_time: number;
  by_category: { [key: string]: number };
  by_impact: { [key: string]: number };
  recent_activity: { date: string; count: number }[];
}

export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');
    const date_filter = searchParams.get('date_filter') || '30days';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (date_filter) {
      case '24hours':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Build base query
    let query = supabase
      .from('javari_chat_work_logs')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (project_id) {
      // Would need to join with conversations to filter by project
      // For now, skip project filtering in stats
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const stats: WorkLogStats = {
      total_logs: logs.length,
      files_created: 0,
      files_modified: 0,
      files_deleted: 0,
      apis_created: 0,
      tests_written: 0,
      bugs_fixed: 0,
      total_lines_added: 0,
      total_lines_deleted: 0,
      success_rate: 0,
      avg_execution_time: 0,
      by_category: {},
      by_impact: {},
      recent_activity: [],
    };

    let successCount = 0;
    let totalExecutionTime = 0;
    let executionTimeCount = 0;

    logs.forEach((log: any) => {
      // Count by action type
      if (log.action_type === 'file_created') stats.files_created++;
      if (log.action_type === 'file_modified') stats.files_modified++;
      if (log.action_type === 'file_deleted') stats.files_deleted++;
      if (log.action_type === 'api_created') stats.apis_created++;
      if (log.action_type === 'test_written') stats.tests_written++;
      if (log.action_type === 'bug_fixed') stats.bugs_fixed++;

      // Lines of code
      stats.total_lines_added += log.lines_added || 0;
      stats.total_lines_deleted += log.lines_deleted || 0;

      // Success rate (assuming we add a success field)
      if (log.success !== false) successCount++;

      // Execution time (if we track it)
      if (log.execution_time_ms) {
        totalExecutionTime += log.execution_time_ms;
        executionTimeCount++;
      }

      // By category
      const category = log.action_category || 'other';
      stats.by_category[category] = (stats.by_category[category] || 0) + 1;

      // By impact
      const impact = log.impact_level || 'moderate';
      stats.by_impact[impact] = (stats.by_impact[impact] || 0) + 1;
    });

    // Calculate averages
    stats.success_rate = logs.length > 0 
      ? Math.round((successCount / logs.length) * 100) 
      : 100;
    
    stats.avg_execution_time = executionTimeCount > 0
      ? Math.round(totalExecutionTime / executionTimeCount)
      : 0;

    // Recent activity (last 7 days)
    const activityMap: { [key: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      activityMap[dateStr] = 0;
    }

    logs.forEach((log: any) => {
      const dateStr = log.created_at.split('T')[0];
      if (activityMap.hasOwnProperty(dateStr)) {
        activityMap[dateStr]++;
      }
    });

    stats.recent_activity = Object.entries(activityMap).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json<ApiResponse<WorkLogStats>>(
      { success: true, data: stats },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
