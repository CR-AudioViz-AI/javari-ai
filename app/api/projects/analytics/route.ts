import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { ApiResponse } from '@/types/javari';

interface ProjectAnalytics {
  project_id: string;
  project_name: string;
  total_files: number;
  total_lines_of_code: number;
  files_created: number;
  files_modified: number;
  files_deleted: number;
  lines_added: number;
  lines_deleted: number;
  total_apis: number;
  apis_created: number;
  api_endpoints: string[];
  total_tests: number;
  tests_written: number;
  test_coverage: number;
  total_builds: number;
  successful_builds: number;
  failed_builds: number;
  build_success_rate: number;
  avg_build_time: number;
  total_cost_usd: number;
  openai_cost: number;
  anthropic_cost: number;
  vercel_cost: number;
  cost_saved: number;
  total_time_spent_hours: number;
  avg_session_duration: number;
  issues_identified: number;
  issues_resolved: number;
  bugs_fixed: number;
  deployment_frequency: number;
  lead_time_hours: number;
  change_failure_rate: number;
  activity_trend: Array<{ date: string; files: number; lines: number }>;
  cost_trend: Array<{ date: string; cost: number }>;
  build_trend: Array<{ date: string; success: number; failed: number }>;
}

export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');
    const time_range = searchParams.get('time_range') || '30days';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (time_range) {
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

    // Initialize analytics object
    const analytics: ProjectAnalytics = {
      project_id: project_id || 'all',
      project_name: 'All Projects',
      total_files: 0,
      total_lines_of_code: 0,
      files_created: 0,
      files_modified: 0,
      files_deleted: 0,
      lines_added: 0,
      lines_deleted: 0,
      total_apis: 0,
      apis_created: 0,
      api_endpoints: [],
      total_tests: 0,
      tests_written: 0,
      test_coverage: 0,
      total_builds: 0,
      successful_builds: 0,
      failed_builds: 0,
      build_success_rate: 100,
      avg_build_time: 0,
      total_cost_usd: 0,
      openai_cost: 0,
      anthropic_cost: 0,
      vercel_cost: 0,
      cost_saved: 0,
      total_time_spent_hours: 0,
      avg_session_duration: 0,
      issues_identified: 0,
      issues_resolved: 0,
      bugs_fixed: 0,
      deployment_frequency: 0,
      lead_time_hours: 0,
      change_failure_rate: 0,
      activity_trend: [],
      cost_trend: [],
      build_trend: [],
    };

    // Get project name if specific project
    if (project_id && project_id !== 'all') {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', project_id)
        .single();
      
      if (project) {
        analytics.project_name = project.name;
      }
    }

    // Query work logs for code metrics
    let workLogsQuery = supabase
      .from('javari_chat_work_logs')
      .select('*')
      .gte('created_at', startDate.toISOString());

    // For project-specific analytics, we'd need to join with conversations
    // For now, we'll aggregate all logs
    const { data: workLogs, error: workLogsError } = await workLogsQuery;

    if (!workLogsError && workLogs) {
      const apiEndpoints = new Set<string>();
      
      workLogs.forEach((log: any) => {
        // Code metrics
        if (log.action_type === 'file_created') analytics.files_created++;
        if (log.action_type === 'file_modified') analytics.files_modified++;
        if (log.action_type === 'file_deleted') analytics.files_deleted++;
        if (log.action_type === 'api_created') {
          analytics.apis_created++;
          if (log.details?.api_endpoint) {
            apiEndpoints.add(log.details.api_endpoint);
          }
        }
        if (log.action_type === 'test_written') analytics.tests_written++;
        if (log.action_type === 'bug_fixed') analytics.bugs_fixed++;

        // Lines of code
        analytics.lines_added += log.lines_added || 0;
        analytics.lines_deleted += log.lines_deleted || 0;

        // Cost tracking
        if (log.cost_incurred) {
          analytics.total_cost_usd += log.cost_incurred;
          // Estimate breakdown (would need more detailed tracking)
          if (log.details?.model?.includes('gpt')) {
            analytics.openai_cost += log.cost_incurred;
          } else if (log.details?.model?.includes('claude')) {
            analytics.anthropic_cost += log.cost_incurred;
          }
        }
        
        if (log.cost_saved) {
          analytics.cost_saved += log.cost_saved;
        }
      });

      analytics.total_files = analytics.files_created + analytics.files_modified;
      analytics.total_lines_of_code = analytics.lines_added - analytics.lines_deleted;
      analytics.total_apis = apiEndpoints.size;
      analytics.api_endpoints = Array.from(apiEndpoints);
      analytics.total_tests = analytics.tests_written;
    }

    // Query build health for build metrics
    let buildHealthQuery = supabase
      .from('javari_build_health_tracking')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (project_id && project_id !== 'all') {
      buildHealthQuery = buildHealthQuery.eq('project_id', project_id);
    }

    const { data: builds, error: buildsError } = await buildHealthQuery;

    if (!buildsError && builds) {
      analytics.total_builds = builds.length;
      
      builds.forEach((build: any) => {
        if (build.build_status === 'success') {
          analytics.successful_builds++;
        } else if (build.build_status === 'failed') {
          analytics.failed_builds++;
        }

        if (build.build_duration_seconds) {
          analytics.avg_build_time += build.build_duration_seconds;
        }
      });

      if (analytics.total_builds > 0) {
        analytics.build_success_rate = Math.round(
          (analytics.successful_builds / analytics.total_builds) * 100
        );
        analytics.avg_build_time = Math.round(
          analytics.avg_build_time / analytics.total_builds
        );
      }

      analytics.change_failure_rate = analytics.total_builds > 0
        ? Math.round((analytics.failed_builds / analytics.total_builds) * 100)
        : 0;
    }

    // Query conversations for time metrics
    let conversationsQuery = supabase
      .from('conversations')
      .select('created_at, updated_at, total_tokens, cost_usd')
      .gte('created_at', startDate.toISOString());

    if (project_id && project_id !== 'all') {
      conversationsQuery = conversationsQuery.eq('project_id', project_id);
    }

    const { data: conversations, error: conversationsError } = await conversationsQuery;

    if (!conversationsError && conversations) {
      conversations.forEach((conv: any) => {
        const duration = new Date(conv.updated_at).getTime() - new Date(conv.created_at).getTime();
        analytics.total_time_spent_hours += duration / (1000 * 60 * 60);
        
        if (conv.cost_usd) {
          analytics.total_cost_usd += parseFloat(conv.cost_usd);
        }
      });

      if (conversations.length > 0) {
        analytics.avg_session_duration = analytics.total_time_spent_hours / conversations.length;
      }
    }

    // Calculate test coverage (estimated based on files and tests)
    if (analytics.total_files > 0) {
      analytics.test_coverage = Math.min(
        Math.round((analytics.total_tests / analytics.total_files) * 100),
        100
      );
    }

    // Generate activity trend (last 7 days)
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayLogs = workLogs?.filter((log: any) => 
        log.created_at.startsWith(dateStr)
      ) || [];
      
      const dayBuilds = builds?.filter((build: any) => 
        build.created_at.startsWith(dateStr)
      ) || [];

      const dayConversations = conversations?.filter((conv: any) => 
        conv.created_at.startsWith(dateStr)
      ) || [];

      analytics.activity_trend.push({
        date: dateStr,
        files: dayLogs.filter((log: any) => 
          ['file_created', 'file_modified'].includes(log.action_type)
        ).length,
        lines: dayLogs.reduce((sum: number, log: any) => 
          sum + (log.lines_added || 0), 0
        ),
      });

      analytics.build_trend.push({
        date: dateStr,
        success: dayBuilds.filter((b: any) => b.build_status === 'success').length,
        failed: dayBuilds.filter((b: any) => b.build_status === 'failed').length,
      });

      analytics.cost_trend.push({
        date: dateStr,
        cost: dayConversations.reduce((sum: number, conv: any) => 
          sum + (parseFloat(conv.cost_usd) || 0), 0
        ),
      });
    }

    // Calculate deployment frequency (deployments per day)
    const deployments = builds?.filter((b: any) => b.deployed === true) || [];
    const daysInRange = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    analytics.deployment_frequency = daysInRange > 0 
      ? Math.round((deployments.length / daysInRange) * 10) / 10 
      : 0;

    // Estimate lead time (average time from code to deployment)
    analytics.lead_time_hours = analytics.avg_session_duration * 2; // Rough estimate

    return NextResponse.json<ApiResponse<ProjectAnalytics>>(
      { success: true, data: analytics },
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
