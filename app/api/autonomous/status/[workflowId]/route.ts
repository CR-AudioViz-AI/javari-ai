// app/api/autonomous/status/[workflowId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const supabase = await createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { workflowId } = params;

    // Get workflow execution
    const { data: workflow, error: dbError } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', workflowId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      workflow: {
        id: workflow.id,
        status: workflow.status,
        steps: workflow.steps,
        artifacts: workflow.artifacts,
        error: workflow.error,
        startedAt: workflow.started_at,
        completedAt: workflow.completed_at,
        durationMs: workflow.duration_ms,
      },
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
