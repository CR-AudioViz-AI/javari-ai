// app/api/monitor/route.ts
// Javari Autonomous Monitoring System
// Monitors all CR AudioViz AI apps, deployments, and triggers self-healing
// Timestamp: 2025-11-29 18:30 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = 'team_Z0yef7NlFu1coCJWz8UmUdI5';

// Critical apps that need monitoring
const CRITICAL_APPS = [
  { name: 'crav-javari', url: 'https://javariai.com', healthEndpoint: '/api/javari/health' },
  { name: 'crav-website', url: 'https://craudiovizai.com', healthEndpoint: null },
  { name: 'crav-admin', url: 'https://craudiovizai-admin-dashboard.vercel.app', healthEndpoint: null },
  { name: 'crav-market-oracle', url: 'https://crav-market-oracle.vercel.app', healthEndpoint: null },
  { name: 'cr-realtor-platform', url: 'https://cr-realtor-platform.vercel.app', healthEndpoint: null },
];

interface MonitorResult {
  app: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime: number;
  httpStatus: number | null;
  lastDeployment: string | null;
  deploymentStatus: string | null;
  errors: string[];
  checkedAt: string;
}

interface OverallStatus {
  status: 'all_healthy' | 'some_issues' | 'critical';
  totalApps: number;
  healthy: number;
  degraded: number;
  down: number;
  results: MonitorResult[];
  checkedAt: string;
}

// Check a single app's health
async function checkAppHealth(app: typeof CRITICAL_APPS[0]): Promise<MonitorResult> {
  const result: MonitorResult = {
    app: app.name,
    status: 'unknown',
    responseTime: 0,
    httpStatus: null,
    lastDeployment: null,
    deploymentStatus: null,
    errors: [],
    checkedAt: new Date().toISOString(),
  };

  const startTime = Date.now();

  try {
    // Check main URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(app.url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Javari-Monitor/1.0' },
    });

    clearTimeout(timeout);
    result.responseTime = Date.now() - startTime;
    result.httpStatus = response.status;

    if (response.status >= 200 && response.status < 400) {
      result.status = 'healthy';
    } else if (response.status >= 400 && response.status < 500) {
      result.status = 'degraded';
      result.errors.push(`HTTP ${response.status}`);
    } else {
      result.status = 'down';
      result.errors.push(`HTTP ${response.status}`);
    }

    // Check health endpoint if available
    if (app.healthEndpoint && result.status === 'healthy') {
      try {
        const healthResponse = await fetch(`${app.url}${app.healthEndpoint}`, {
          headers: { 'User-Agent': 'Javari-Monitor/1.0' },
        });
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (!healthData.healthy) {
            result.status = 'degraded';
            result.errors.push('Health check reports issues');
          }
        }
      } catch {
        // Health endpoint failed but main URL works
        result.errors.push('Health endpoint unreachable');
      }
    }

  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.status = 'down';
    result.errors.push(error instanceof Error ? error.message : 'Connection failed');
  }

  // Get latest deployment status from Vercel
  try {
    const projectsResponse = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${VERCEL_TEAM_ID}&search=${app.name}`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    
    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      const project = projectsData.projects?.find((p: any) => p.name === app.name);
      
      if (project) {
        const deploymentsResponse = await fetch(
          `https://api.vercel.com/v6/deployments?teamId=${VERCEL_TEAM_ID}&projectId=${project.id}&limit=1`,
          { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
        );
        
        if (deploymentsResponse.ok) {
          const deploymentsData = await deploymentsResponse.json();
          const latestDeployment = deploymentsData.deployments?.[0];
          if (latestDeployment) {
            result.lastDeployment = latestDeployment.uid;
            result.deploymentStatus = latestDeployment.state;
            
            if (latestDeployment.state === 'ERROR') {
              result.status = 'down';
              result.errors.push('Latest deployment failed');
            }
          }
        }
      }
    }
  } catch {
    // Vercel API check failed, but app might still be working
  }

  return result;
}

// Run full monitoring sweep
async function runMonitoringSweep(): Promise<OverallStatus> {
  const results = await Promise.all(CRITICAL_APPS.map(checkAppHealth));

  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const down = results.filter(r => r.status === 'down').length;

  let status: OverallStatus['status'] = 'all_healthy';
  if (down > 0) status = 'critical';
  else if (degraded > 0) status = 'some_issues';

  const overallStatus: OverallStatus = {
    status,
    totalApps: results.length,
    healthy,
    degraded,
    down,
    results,
    checkedAt: new Date().toISOString(),
  };

  // Save to database for history
  try {
    await supabase.from('monitor_logs').insert({
      status: overallStatus.status,
      total_apps: overallStatus.totalApps,
      healthy_count: healthy,
      degraded_count: degraded,
      down_count: down,
      results: overallStatus.results,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Log storage failed, continue anyway
  }

  // Learn from any issues
  if (down > 0 || degraded > 0) {
    const issueApps = results.filter(r => r.status !== 'healthy');
    for (const app of issueApps) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/api/learn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_knowledge',
            topic: 'Monitoring',
            subtopic: 'Incidents',
            concept: `${app.app} ${app.status} - ${new Date().toISOString().split('T')[0]}`,
            explanation: `Monitoring detected ${app.app} is ${app.status}. Errors: ${app.errors.join(', ')}. Response time: ${app.responseTime}ms. HTTP status: ${app.httpStatus}. Deployment status: ${app.deploymentStatus}.`,
            verified: true,
            tags: ['monitoring', 'incident', app.status],
          }),
        });
      } catch {
        // Learning failed, continue
      }
    }
  }

  return overallStatus;
}

// Attempt to self-heal an app
async function attemptSelfHeal(appName: string): Promise<{ success: boolean; action: string; message: string }> {
  try {
    // Find project
    const projectsResponse = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${VERCEL_TEAM_ID}&search=${appName}`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    
    if (!projectsResponse.ok) {
      return { success: false, action: 'none', message: 'Could not find project' };
    }

    const projectsData = await projectsResponse.json();
    const project = projectsData.projects?.find((p: any) => p.name === appName);

    if (!project) {
      return { success: false, action: 'none', message: 'Project not found' };
    }

    // Trigger a new deployment (redeploy)
    const redeployResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: appName,
        project: project.id,
        target: 'preview', // Safe - only preview deployment
        gitSource: project.link ? {
          type: project.link.type,
          repoId: project.link.repoId,
          ref: 'main',
        } : undefined,
      }),
    });

    if (redeployResponse.ok) {
      const deployData = await redeployResponse.json();
      return {
        success: true,
        action: 'redeploy',
        message: `Triggered redeployment: ${deployData.id}`,
      };
    }

    return { success: false, action: 'redeploy_failed', message: 'Redeployment request failed' };

  } catch (error) {
    return {
      success: false,
      action: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// GET - Run monitoring check
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'status') {
    // Quick status check
    const results = await runMonitoringSweep();
    return NextResponse.json(results);
  }

  if (action === 'history') {
    // Get monitoring history
    const { data, error } = await supabase
      .from('monitor_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      success: !error,
      history: data || [],
      error: error?.message,
    });
  }

  // Default: full monitoring sweep
  const results = await runMonitoringSweep();
  return NextResponse.json(results);
}

// POST - Trigger self-healing
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, appName } = body;

    if (action === 'heal' && appName) {
      const result = await attemptSelfHeal(appName);
      return NextResponse.json(result);
    }

    if (action === 'sweep') {
      const results = await runMonitoringSweep();
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      error: 'Request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
