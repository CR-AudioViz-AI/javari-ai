// app/api/monitor/route.ts
// Javari Smart Monitoring System - Auto-discovers production URLs
// Timestamp: 2025-11-29 19:30 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = 'team_Z0yef7NlFu1coCJWz8UmUdI5';

// Core monitored apps with known URLs
const KNOWN_APPS = [
  { name: 'crav-javari', url: 'https://javariai.com', healthEndpoint: '/api/javari/health', priority: 'critical' },
  { name: 'crav-website', url: 'https://craudiovizai-website.vercel.app', healthEndpoint: null, priority: 'critical' },
  { name: 'crav-admin', url: 'https://craudiovizai-admin-dashboard.vercel.app', healthEndpoint: null, priority: 'critical' },
  { name: 'crav-market-oracle', url: 'https://crav-market-oracle.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-legalease', url: 'https://crav-legalease.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-verifyforge', url: 'https://crav-verifyforge.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-pdf-builder', url: 'https://crav-pdf-builder.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'cr-realtor-platform', url: 'https://cr-realtor-platform.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-logo-studio', url: 'https://crav-logo-studio-app.vercel.app', healthEndpoint: null, priority: 'high' },
  { name: 'crav-partner-portal', url: 'https://crav-partner-portal.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-ebook-creator', url: 'https://crav-ebook-creator-app.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-invoice-generator', url: 'https://crav-invoice-generator.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-social-graphics', url: 'https://crav-social-graphics.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-games', url: 'https://crav-micro-games-app.vercel.app', healthEndpoint: null, priority: 'medium' },
  { name: 'crav-dashboard', url: 'https://crav-dashboard-app.vercel.app', healthEndpoint: null, priority: 'medium' },
];

interface MonitorResult {
  app: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime: number;
  httpStatus: number | null;
  priority: string;
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

async function checkAppHealth(app: typeof KNOWN_APPS[0]): Promise<MonitorResult> {
  const result: MonitorResult = {
    app: app.name,
    url: app.url,
    status: 'unknown',
    responseTime: 0,
    httpStatus: null,
    priority: app.priority,
    errors: [],
    checkedAt: new Date().toISOString(),
  };

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(app.url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Javari-Monitor/1.0' },
      redirect: 'follow',
    });

    clearTimeout(timeout);
    result.responseTime = Date.now() - startTime;
    result.httpStatus = response.status;

    // Determine status
    if (response.status >= 200 && response.status < 400) {
      result.status = 'healthy';
    } else if (response.status === 401 || response.status === 403) {
      result.status = 'healthy'; // Auth-protected is still healthy
      result.errors.push('Auth protected');
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
        const healthResponse = await fetch(`${app.url}${app.healthEndpoint}`);
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (!healthData.healthy) {
            result.status = 'degraded';
            result.errors.push('Health check failed');
          }
        }
      } catch {
        // Health endpoint failed but app is up
      }
    }

  } catch (error) {
    result.responseTime = Date.now() - startTime;
    result.status = 'down';
    result.errors.push(error instanceof Error ? error.message : 'Connection failed');
  }

  return result;
}

async function runMonitoringSweep(): Promise<OverallStatus> {
  const results = await Promise.all(KNOWN_APPS.map(checkAppHealth));

  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const down = results.filter(r => r.status === 'down').length;
  const criticalDown = results.filter(r => r.status === 'down' && r.priority === 'critical').length;

  let status: OverallStatus['status'] = 'all_healthy';
  if (criticalDown > 0) status = 'critical';
  else if (down > 0 || degraded > 0) status = 'some_issues';

  return {
    status,
    totalApps: results.length,
    healthy,
    degraded,
    down,
    criticalDown,
    results,
    checkedAt: new Date().toISOString(),
  };
}

async function attemptSelfHeal(appName: string): Promise<{ success: boolean; message: string }> {
  try {
    const projectsResponse = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${VERCEL_TEAM_ID}&search=${appName}`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    
    const projectsData = await projectsResponse.json();
    const project = projectsData.projects?.find((p: any) => p.name === appName);

    if (!project || !project.link?.repoId) {
      return { success: false, message: 'Project not found or not linked' };
    }

    const redeployResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: appName,
        project: project.id,
        target: 'production',
        gitSource: { type: project.link.type, repoId: project.link.repoId, ref: 'main' },
      }),
    });

    if (redeployResponse.ok) {
      const data = await redeployResponse.json();
      return { success: true, message: `Deployment triggered: ${data.id}` };
    }

    return { success: false, message: 'Deployment failed' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Error' };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'apps') {
    return NextResponse.json({ apps: KNOWN_APPS.map(a => ({ name: a.name, url: a.url, priority: a.priority })) });
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
