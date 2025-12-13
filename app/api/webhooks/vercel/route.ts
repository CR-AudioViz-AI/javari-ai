// app/api/webhooks/vercel/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// JAVARI AI - VERCEL WEBHOOK LISTENER
// ═══════════════════════════════════════════════════════════════════════════════
// Timestamp: Friday, December 12, 2025 - 12:25 PM EST
// Version: 1.0 - INSTANT RESPONSE TO VERCEL EVENTS
//
// Supported Events:
// - deployment.created: Track new deployments
// - deployment.succeeded: Log success metrics
// - deployment.failed: Trigger self-healing
// - deployment.canceled: Log cancellations
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK SIGNATURE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true;
  
  const hmac = crypto.createHmac('sha1', secret);
  const digest = hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDeploymentCreated(payload: any): Promise<{ action: string; details: any }> {
  const { deployment, project } = payload;
  
  // Log deployment
  await supabase.from('vercel_events').insert({
    event_type: 'deployment.created',
    deployment_id: deployment?.id,
    project_name: project?.name || deployment?.name,
    deployment_url: deployment?.url,
    status: 'building',
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  console.log(`[Vercel Webhook] Deployment created: ${deployment?.url}`);
  
  return {
    action: 'deployment_tracked',
    details: {
      deploymentId: deployment?.id,
      project: project?.name || deployment?.name,
      url: deployment?.url
    }
  };
}

async function handleDeploymentSucceeded(payload: any): Promise<{ action: string; details: any }> {
  const { deployment, project } = payload;
  
  // Log success
  await supabase.from('vercel_events').insert({
    event_type: 'deployment.succeeded',
    deployment_id: deployment?.id,
    project_name: project?.name || deployment?.name,
    deployment_url: deployment?.url,
    status: 'ready',
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  // Update app registry if exists
  await supabase
    .from('app_registry')
    .update({
      health_status: 'healthy',
      last_deployment: new Date().toISOString(),
      production_url: `https://${deployment?.url}`
    })
    .eq('app_name', project?.name || deployment?.name)
    .catch(() => {});
  
  console.log(`[Vercel Webhook] Deployment succeeded: ${deployment?.url}`);
  
  return {
    action: 'deployment_succeeded',
    details: {
      deploymentId: deployment?.id,
      project: project?.name || deployment?.name,
      url: deployment?.url
    }
  };
}

async function handleDeploymentFailed(payload: any): Promise<{ action: string; details: any }> {
  const { deployment, project } = payload;
  
  // Log failure
  await supabase.from('vercel_events').insert({
    event_type: 'deployment.failed',
    deployment_id: deployment?.id,
    project_name: project?.name || deployment?.name,
    deployment_url: deployment?.url,
    status: 'error',
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  // Create high-priority suggestion
  await supabase.from('proactive_suggestions').insert({
    suggestion_id: `vercel_fail_${Date.now()}`,
    type: 'warning',
    priority: 'critical',
    title: `Deployment Failed: ${project?.name || deployment?.name}`,
    description: `Vercel deployment failed. Auto-healing may be triggered.`,
    metadata: {
      deploymentId: deployment?.id,
      project: project?.name || deployment?.name,
      url: deployment?.url
    },
    created_at: new Date().toISOString()
  });
  
  // Auto-trigger self-healing
  console.log(`[Vercel Webhook] Deployment failed, triggering self-healing...`);
  
  try {
    const healResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/autonomous/heal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId: deployment?.id,
          projectName: project?.name || deployment?.name
        })
      }
    );
    
    const healResult = await healResponse.json();
    console.log(`[Vercel Webhook] Self-healing result:`, healResult.success ? 'Success' : 'Failed');
    
    return {
      action: 'deployment_failed_healing_triggered',
      details: {
        deploymentId: deployment?.id,
        project: project?.name || deployment?.name,
        healingTriggered: true,
        healingResult: healResult.success ? 'initiated' : 'failed'
      }
    };
  } catch (error) {
    console.error(`[Vercel Webhook] Self-healing trigger failed:`, error);
    
    return {
      action: 'deployment_failed',
      details: {
        deploymentId: deployment?.id,
        project: project?.name || deployment?.name,
        healingTriggered: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

async function handleDeploymentCanceled(payload: any): Promise<{ action: string; details: any }> {
  const { deployment, project } = payload;
  
  // Log cancellation
  await supabase.from('vercel_events').insert({
    event_type: 'deployment.canceled',
    deployment_id: deployment?.id,
    project_name: project?.name || deployment?.name,
    deployment_url: deployment?.url,
    status: 'canceled',
    payload_preview: JSON.stringify(payload).slice(0, 1000),
    created_at: new Date().toISOString()
  }).catch(() => {});
  
  console.log(`[Vercel Webhook] Deployment canceled: ${project?.name || deployment?.name}`);
  
  return {
    action: 'deployment_canceled',
    details: {
      deploymentId: deployment?.id,
      project: project?.name || deployment?.name
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get raw body
    const rawBody = await request.text();
    
    // Verify signature
    const signature = request.headers.get('x-vercel-signature') || '';
    const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET;
    
    if (webhookSecret && !verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    // Parse payload
    const payload = JSON.parse(rawBody);
    const eventType = payload.type;
    
    console.log(`[Vercel Webhook] Received ${eventType} event`);
    
    let result: { action: string; details: any };
    
    switch (eventType) {
      case 'deployment.created':
        result = await handleDeploymentCreated(payload);
        break;
      case 'deployment.succeeded':
        result = await handleDeploymentSucceeded(payload);
        break;
      case 'deployment.error':
      case 'deployment.failed':
        result = await handleDeploymentFailed(payload);
        break;
      case 'deployment.canceled':
        result = await handleDeploymentCanceled(payload);
        break;
      default:
        result = { action: 'unhandled_event', details: { eventType } };
    }
    
    return NextResponse.json({
      success: true,
      event: eventType,
      ...result,
      duration: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('[Vercel Webhook] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  // Get recent webhook events
  const { data: recentEvents } = await supabase
    .from('vercel_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  // Get deployment stats
  const { data: stats } = await supabase
    .from('vercel_events')
    .select('status')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const summary = {
    last24Hours: {
      total: stats?.length || 0,
      succeeded: stats?.filter(s => s.status === 'ready').length || 0,
      failed: stats?.filter(s => s.status === 'error').length || 0,
      canceled: stats?.filter(s => s.status === 'canceled').length || 0
    }
  };
  
  return NextResponse.json({
    status: 'ok',
    name: 'Javari Vercel Webhook',
    version: '1.0',
    supportedEvents: [
      'deployment.created',
      'deployment.succeeded',
      'deployment.error',
      'deployment.failed',
      'deployment.canceled'
    ],
    summary,
    recentEvents: recentEvents || [],
    setup: {
      webhookUrl: 'https://javariai.com/api/webhooks/vercel',
      events: ['Deployment Created', 'Deployment Succeeded', 'Deployment Failed'],
      secret: 'Set VERCEL_WEBHOOK_SECRET env var (optional)',
      note: 'Configure in Vercel Dashboard > Project Settings > Git > Deploy Hooks'
    },
    autoHealing: {
      enabled: true,
      description: 'Failed deployments automatically trigger self-healing analysis'
    },
    timestamp: new Date().toISOString()
  });
}
