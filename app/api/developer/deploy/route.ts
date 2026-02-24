import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_zxjzE2qvMWFWqV0AspGvago6aPV5';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || 'team_Z0yef7NlFu1coCJWz8UmUdI5';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    if (!VERCEL_TOKEN) {
      throw new Error('VERCEL_TOKEN not configured');
    }

    // Trigger a new deployment
    // Note: With GitHub integration, Vercel automatically deploys on push
    // This endpoint can be used to force a redeploy if needed

    const deployResponse = await fetch(
      `https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'javari-ai',
          project: VERCEL_PROJECT_ID,
          target: 'preview', // Deploy to preview first
          gitSource: {
            type: 'github',
            repo: 'CR-AudioViz-AI/javari-ai',
            ref: 'main',
          },
        }),
      }
    );

    if (!deployResponse.ok) {
      const errorData = await deployResponse.json();
      console.error('Vercel API error:', errorData);
      throw new Error(`Vercel deployment failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    const deployData = await deployResponse.json();

    // Store deployment in database
    await supabase.from('developer_deployments').insert({
      deployment_id: deployData.id,
      url: deployData.url,
      status: 'deploying',
      environment: 'preview',
      project_id: VERCEL_PROJECT_ID,
    });

    // Poll deployment status (simplified - in production, use webhooks)
    let deploymentStatus = 'deploying';
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max wait

    while (deploymentStatus === 'deploying' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(
        `https://api.vercel.com/v13/deployments/${deployData.id}?teamId=${VERCEL_TEAM_ID}`,
        {
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        deploymentStatus = statusData.readyState;

        if (deploymentStatus === 'READY') {
          // Update database with final status
          await supabase
            .from('developer_deployments')
            .update({
              status: 'ready',
              ready_at: new Date().toISOString(),
            })
            .eq('deployment_id', deployData.id);

          break;
        } else if (deploymentStatus === 'ERROR') {
          throw new Error('Deployment failed');
        }
      }

      attempts++;
    }

    // Log successful deployment
    await supabase.from('developer_learning_log').insert({
      event_type: 'deployment_success',
      description: `Successfully deployed to ${deployData.url}`,
      metadata: { deploymentId: deployData.id, url: deployData.url },
      success: true,
    });

    return NextResponse.json({
      success: true,
      deploymentId: deployData.id,
      deploymentUrl: `https://${deployData.url}`,
      status: deploymentStatus,
    });
  } catch (error: unknown) {
    logError('Deployment error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    await supabase.from('developer_learning_log').insert({
      event_type: 'deployment_error',
      description: `Deployment failed: ${errorMessage}`,
      success: false,
    });

    return NextResponse.json(
      {
        error: 'Deployment failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check deployment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('id');

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Deployment ID required' },
        { status: 400 }
      );
    }

    if (!VERCEL_TOKEN) {
      throw new Error('VERCEL_TOKEN not configured');
    }

    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${VERCEL_TEAM_ID}`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch deployment status');
    }

    const data = await response.json();

    return NextResponse.json({
      id: data.id,
      url: data.url,
      status: data.readyState,
      createdAt: data.createdAt,
    });
  } catch (error: unknown) {
    logError('Status check error:', error);

    return NextResponse.json(
      {
        error: 'Failed to check deployment status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
