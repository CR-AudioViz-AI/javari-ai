// app/api/monitor/route.ts
// Javari Autonomous Monitoring System - EXPANDED
// Monitors ALL CR AudioViz AI apps with self-healing
// Timestamp: 2025-11-29 19:15 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = 'team_Z0yef7NlFu1coCJWz8UmUdI5';

// ALL apps to monitor - organized by priority
const MONITORED_APPS = [
  // CRITICAL - Core Platform
  { name: 'crav-javari', url: 'https://javariai.com', healthEndpoint: '/api/javari/health', priority: 'critical' },
  { name: 'crav-website', url: 'https://craudiovizai-website.vercel.app', healthEndpoint: null, priority: 'critical' },
  { name: 'crav-admin', url: 'https://craudiovizai-admin-dashboard.vercel.app', healthEndpoint: null, priority: 'critical' },
  
  // HIGH - Revenue Generating
  { name: 'crav-market-oracle', url: 'https://crav-market-oracle.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-logo-studio', url: 'https://crav-logo-studio.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-pdf-builder', url: 'https://crav-pdf-builder.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-legalease', url: 'https://crav-legalease.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-verifyforge', url: 'https://crav-verifyforge.vercel.app', healthEndpoint: null, priority: 'high' },
  
  // MEDIUM - Customer Tools
  { name: 'cr-realtor-platform', url: 'https://cr-realtor-platform.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-partner-portal', url: 'https://crav-partner-portal.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-ebook-creator', url: 'https://crav-ebook-creator.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-invoice-generator', url: 'https://crav-invoice-generator.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-social-graphics', url: 'https://crav-social-graphics.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-games', url: 'https://crav-games.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-dashboard', url: 'https://crav-dashboard.vercel.app', healthEndpoint: null, priority: 'medium' },
  
  // STANDARD - Additional Tools
  { name: 'crav-analytics-dashboard', url: 'https://crav-analytics-dashboard.vercel.app', healthEndpoint: null, priority: 'standard' },
  { name: 'crav-news', url: 'https://crav-news.vercel.app', healthEndpoint: null, priority: 'standard' },
  { name: 'crav-builder', url: 'https://crav-builder.vercel.app', healthEndpoint: null, priority: 'standard' },
];

interface MonitorResult {
  app: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime: number;
  httpStatus: number | null;
  priority: string;
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
  criticalDown: number;
  results: MonitorResult[];
  checkedAt: string;
}

// Check a single app's health
async function checkAppHealth(app: typeof MONITORED_APPS[0]): Promise<MonitorResult> {
  const result: MonitorResult = {
    app: app.name,
    status: 'unknown',
    responseTime: 0,
    httpStatus: null,
    priority: app.priority,
    lastDeployment: null,
    deploymentStatus: null,
    errors: [],
    checkedAt: new Date().toISOString(),
  };

  const startTime = Date.now();

  try {
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
    } else if (response.status === 401 || response.status === 403) {
      // Auth-protected pages are still "healthy"
      result.status = 'healthy';
      result.errors.push('Auth protected');
    } else if (response.status >= 400 && response.status < 500) {
      result.status = 'degraded';
      result.errors.push(`HTTP ${response.status}`);
    } else {
      result.status = 'down';
      result.errors.push(`HTTP ${response.status}`);
    }

    // Check health endpoint if available and main URL is healthy
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
        result.errors.push('Health endpoint unreachable');
      }
    }

  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.status = 'down';
    result.errors.push(error instanceof Error ? error.message : 'Connection failed');
  }

  return result;
}

// Run full monitoring sweep
async function runMonitoringSweep(): Promise<OverallStatus> {
  const results = await Promise.all(MONITORED_APPS.map(checkAppHealth));

  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const down = results.filter(r => r.status === 'down').length;
  const criticalDown = results.filter(r => r.status === 'down' && r.priority === 'critical').length;

  let status: OverallStatus['status'] = 'all_healthy';
  if (criticalDown > 0) status = 'critical';
  else if (down > 0 || degraded > 0) status = 'some_issues';

  const overallStatus: OverallStatus = {
    status,
    totalApps: results.length,
    healthy,
    degraded,
    down,
    criticalDown,
    results,
    checkedAt: new Date().toISOString(),
  };

  // Save to database
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
    // Continue even if logging fails
  }

  // Auto-learn from any issues
  if (down > 0 || degraded > 0) {
    const issueApps = results.filter(r => r.status !== 'healthy');
    for (const app of issueApps) {
      try {
        await fetch('https://javariai.com/api/learn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_knowledge',
            topic: 'Monitoring',
            subtopic: 'Incidents',
            concept: `${app.app} ${app.status} - ${new Date().toISOString().split('T')[0]}`,
            explanation: `Monitoring detected ${app.app} (priority: ${app.priority}) is ${app.status}. Errors: ${app.errors.join(', ')}. Response time: ${app.responseTime}ms.`,
            verified: true,
            tags: ['monitoring', 'incident', app.status, app.priority],
          }),
        });
      } catch {
        // Continue
      }
    }
  }

  return overallStatus;
}

// Attempt self-healing
async function attemptSelfHeal(appName: string): Promise<{ success: boolean; action: string; message: string }> {
  try {
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

    // Trigger redeploy
    const redeployResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: appName,
        project: project.id,
        target: 'preview',
        gitSource: project.link ? {
          type: project.link.type,
          repoId: project.link.repoId,
          ref: 'main',
        } : undefined,
      }),
    });

    if (redeployResponse.ok) {
      const deployData = await redeployResponse.json();
      
      // Log healing action
      try {
        await supabase.from('monitor_logs').insert({
          status: 'healing',
          total_apps: 1,
          healthy_count: 0,
          degraded_count: 0,
          down_count: 1,
          results: [{ app: appName, action: 'redeploy', deploymentId: deployData.id }],
          created_at: new Date().toISOString(),
        });
      } catch {}
      
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'status') {
    const results = await runMonitoringSweep();
    return NextResponse.json(results);
  }

  if (action === 'history') {
    const { data, error } = await supabase
      .from('monitor_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({ success: !error, history: data || [] });
  }

  if (action === 'apps') {
    return NextResponse.json({ apps: MONITORED_APPS });
  }

  const results = await runMonitoringSweep();
  return NextResponse.json(results);
}

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

    if (action === 'heal_all_down') {
      const status = await runMonitoringSweep();
      const downApps = status.results.filter(r => r.status === 'down');
      const healResults = await Promise.all(downApps.map(a => attemptSelfHeal(a.app)));
      return NextResponse.json({ healed: healResults });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      error: 'Request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
