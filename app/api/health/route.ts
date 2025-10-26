import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { JavariBuildHealth, HealthCheckResponse, ApiResponse } from '@/types/javari';

// GET /api/health?project_id=xxx - Get health status for a project
export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Get latest builds
    const { data: builds, error: buildsError } = await supabase
      .from('javari_build_health_tracking')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (buildsError) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: buildsError.message },
        { status: 500 }
      );
    }

    const latestBuilds = builds || [];
    const failedBuilds = latestBuilds.filter(b => b.build_status === 'failed');
    const autoFixableBuilds = failedBuilds.filter(b => b.auto_fixable);

    // Determine overall health
    const recentBuildStatuses = latestBuilds.slice(0, 5).map(b => b.build_status);
    const failureRate = recentBuildStatuses.filter(s => s === 'failed').length / Math.max(recentBuildStatuses.length, 1);
    const healthy = failureRate < 0.4; // Less than 40% failure rate

    // Generate recommendations
    const recommendations: string[] = [];
    if (failedBuilds.length > 0) {
      recommendations.push(`${failedBuilds.length} failed build(s) detected`);
    }
    if (autoFixableBuilds.length > 0) {
      recommendations.push(`${autoFixableBuilds.length} build(s) can be auto-fixed`);
    }
    if (failureRate >= 0.4) {
      recommendations.push('High failure rate detected - immediate attention required');
    }
    if (healthy && latestBuilds.length > 0) {
      recommendations.push('All systems operational');
    }

    const response: HealthCheckResponse = {
      healthy,
      project_id,
      latest_builds: latestBuilds,
      failed_builds_count: failedBuilds.length,
      auto_fixable_count: autoFixableBuilds.length,
      recommendations,
    };

    return NextResponse.json<ApiResponse<HealthCheckResponse>>(
      { success: true, data: response },
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

// POST /api/health - Log build health status
export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const body = await request.json();

    const {
      project_id,
      chat_session_id,
      build_id,
      build_status,
      error_type,
      error_message,
      error_stack,
      auto_fixable = false,
      fix_suggestion,
      fix_confidence,
      build_duration_seconds,
      files_affected = [],
    } = body;

    if (!project_id || !build_status) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'project_id and build_status are required' },
        { status: 400 }
      );
    }

    const healthData = {
      project_id,
      chat_session_id,
      build_id,
      build_status,
      error_type,
      error_message,
      error_stack,
      auto_fixable,
      fix_suggestion,
      fix_confidence,
      fix_applied: false,
      build_duration_seconds,
      files_affected,
      build_started_at: new Date().toISOString(),
      build_completed_at: build_status !== 'pending' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('javari_build_health_tracking')
      .insert(healthData)
      .select()
      .single();

    if (error) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<JavariBuildHealth>>(
      { success: true, data, message: 'Health status logged successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
