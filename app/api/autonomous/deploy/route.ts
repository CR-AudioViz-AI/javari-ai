// app/api/autonomous/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import JavariOrchestrator from '@/lib/javari-orchestrator';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { appName, files } = body;

    if (!appName || !files || !Array.isArray(files)) {
      return NextResponse.json(
        { error: 'Missing required fields: appName, files' },
        { status: 400 }
      );
    }

    // Create workflow execution record
    const { data: workflowRecord, error: dbError } = await supabase
      .from('workflow_executions')
      .insert({
        user_id: user.id,
        workflow_type: 'app-build',
        status: 'running',
        steps: [],
      })
      .select()
      .single();

    if (dbError || !workflowRecord) {
      return NextResponse.json(
        { error: 'Failed to create workflow record' },
        { status: 500 }
      );
    }

    // Execute deployment asynchronously
    const orchestrator = new JavariOrchestrator();
    
    // Don't await - run in background
    orchestrator.deployApplication({
      appName,
      files,
      userId: user.id,
    }).then(async (workflow) => {
      // Update workflow record with results
      await supabase
        .from('workflow_executions')
        .update({
          status: workflow.status,
          steps: workflow.steps,
          artifacts: workflow.artifacts,
          error: workflow.error,
          completed_at: workflow.completedAt,
          duration_ms: workflow.completedAt 
            ? new Date(workflow.completedAt).getTime() - new Date(workflow.startedAt).getTime()
            : null,
        })
        .eq('id', workflowRecord.id);

      // Create deployment record
      if (workflow.artifacts.deploymentUrl) {
        await supabase
          .from('deployments')
          .insert({
            workflow_execution_id: workflowRecord.id,
            repo_name: appName,
            deployment_url: workflow.artifacts.deploymentUrl,
            status: workflow.status,
          });
      }
    }).catch(async (error) => {
      // Update workflow record with error
      await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          error: {
            step: 'unknown',
            message: error.message,
          },
          completed_at: new Date().toISOString(),
        })
        .eq('id', workflowRecord.id);
    });

    return NextResponse.json({
      success: true,
      workflowId: workflowRecord.id,
      message: 'Deployment started - check status endpoint for progress',
    });

  } catch (error) {
    console.error('Autonomous deploy error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
