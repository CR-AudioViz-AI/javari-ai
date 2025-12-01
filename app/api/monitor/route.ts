// app/api/monitor/route.ts
// Javari Full Platform Monitor - ALL apps, ALL bots
// Timestamp: 2025-11-30 21:15 EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = 'team_Z0yef7NlFu1coCJWz8UmUdI5';

// ALL APPS organized by category
const ALL_APPS = [
  // CRITICAL - Core Platform
  { name: 'crav-javari', url: 'https://javariai.com', priority: 'critical' },
  { name: 'crav-website', url: 'https://craudiovizai-website.vercel.app', priority: 'critical' },
  { name: 'crav-admin', url: 'https://craudiovizai-admin-dashboard.vercel.app', priority: 'critical' },
  
  // HIGH - Revenue Apps
  { name: 'crav-market-oracle', url: 'https://crav-market-oracle.vercel.app', priority: 'high' },
  { name: 'crav-logo-studio', url: 'https://crav-logo-studio-app.vercel.app', priority: 'high' },
  { name: 'crav-pdf-builder', url: 'https://crav-pdf-builder.vercel.app', priority: 'high' },
  { name: 'crav-legalease', url: 'https://crav-legalease.vercel.app', priority: 'high' },
  { name: 'crav-verifyforge', url: 'https://crav-verifyforge.vercel.app', priority: 'high' },
  { name: 'crav-invoice-generator', url: 'https://crav-invoice-generator.vercel.app', priority: 'high' },
  
  // MEDIUM - Customer Apps
  { name: 'cr-realtor-platform', url: 'https://cr-realtor-platform.vercel.app', priority: 'medium' },
  { name: 'crav-partner-portal', url: 'https://crav-partner-portal.vercel.app', priority: 'medium' },
  { name: 'crav-ebook-creator', url: 'https://crav-ebook-creator-app.vercel.app', priority: 'medium' },
  { name: 'crav-social-graphics', url: 'https://crav-social-graphics.vercel.app', priority: 'medium' },
  { name: 'crav-games', url: 'https://crav-micro-games-app.vercel.app', priority: 'medium' },
  { name: 'crav-dashboard', url: 'https://crav-dashboard-app.vercel.app', priority: 'medium' },
  
  // STANDARD - Tools & Trackers
  { name: 'crav-disney-deal-tracker', url: 'https://crav-disney-tracker.vercel.app', priority: 'standard' },
  { name: 'crav-competitive-intelligence', url: 'https://crav-competitive-intelligence.vercel.app', priority: 'standard' },
  { name: 'barrelverse', url: 'https://barrelverse.vercel.app', priority: 'standard' },
  { name: 'mortgage-rate-monitor', url: 'https://mortgage-rate-monitor.vercel.app', priority: 'standard' },
  { name: 'crav-analytics-dashboard', url: 'https://crav-analytics-dashboard.vercel.app', priority: 'standard' },
  
  // AGENTOS
  { name: 'agentos-platform', url: 'https://agentos-platform.vercel.app', priority: 'medium' },
  { name: 'agentos-premiere-plus', url: 'https://agentos-premiere-plus.vercel.app', priority: 'medium' },
  
  // SCRAPERS/BOTS
  { name: 'javari-devdocs-scraper', url: 'https://javari-devdocs-scraper.vercel.app', priority: 'low' },
  { name: 'javari-mdn-scraper', url: 'https://javari-mdn-scraper.vercel.app', priority: 'low' },
  { name: 'javari-fcc-scraper', url: 'https://javari-fcc-scraper.vercel.app', priority: 'low' },
];

interface MonitorResult {
  app: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  httpStatus: number | null;
  priority: string;
  error?: string;
}

async function checkApp(app: typeof ALL_APPS[0]): Promise<MonitorResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000);
    
    const resp = await fetch(app.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Javari-Monitor/2.0' }
    });
    
    const time = Date.now() - start;
    const status = resp.status;
    
    return {
      app: app.name,
      url: app.url,
      status: status < 400 || status === 401 || status === 403 ? 'healthy' : status < 500 ? 'degraded' : 'down',
      responseTime: time,
      httpStatus: status,
      priority: app.priority
    };
  } catch (e) {
    return {
      app: app.name,
      url: app.url,
      status: 'down',
      responseTime: Date.now() - start,
      httpStatus: null,
      priority: app.priority,
      error: e instanceof Error ? e.message : 'Failed'
    };
  }
}

async function runFullSweep() {
  const results = await Promise.all(ALL_APPS.map(checkApp));
  
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const down = results.filter(r => r.status === 'down').length;
  const criticalDown = results.filter(r => r.status === 'down' && r.priority === 'critical').length;

  // Log issues to knowledge
  const issues = results.filter(r => r.status !== 'healthy');
  for (const issue of issues.slice(0, 5)) {
    try {
      await supabase.from('javari_knowledge').upsert({
        topic: 'Monitoring',
        subtopic: 'Incidents',
        concept: `${issue.app} ${issue.status} - ${new Date().toISOString().split('T')[0]}`,
        explanation: `App ${issue.app} is ${issue.status}. HTTP: ${issue.httpStatus}. Error: ${issue.error || 'None'}`,
        verified: true,
        verified_by: 'monitor-bot',
        tags: ['monitoring', issue.status]
      }, { onConflict: 'concept' });
    } catch {}
  }

  return {
    status: criticalDown > 0 ? 'critical' : down > 0 || degraded > 0 ? 'some_issues' : 'all_healthy',
    totalApps: results.length,
    healthy,
    degraded,
    down,
    criticalDown,
    byPriority: {
      critical: results.filter(r => r.priority === 'critical'),
      high: results.filter(r => r.priority === 'high'),
      medium: results.filter(r => r.priority === 'medium'),
      standard: results.filter(r => r.priority === 'standard'),
      low: results.filter(r => r.priority === 'low')
    },
    results,
    checkedAt: new Date().toISOString()
  };
}

async function healApp(appName: string) {
  try {
    const resp = await fetch(
      `https://api.vercel.com/v9/projects?teamId=${VERCEL_TEAM_ID}&search=${appName}`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    const data = await resp.json();
    const project = data.projects?.find((p: any) => p.name === appName);
    
    if (!project?.link?.repoId) return { success: false, message: 'No repo linked' };
    
    const deploy = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: appName,
        project: project.id,
        target: 'production',
        gitSource: { type: 'github', repoId: project.link.repoId, ref: 'main' }
      })
    });
    
    if (deploy.ok) {
      const d = await deploy.json();
      return { success: true, deploymentId: d.id };
    }
    return { success: false, message: 'Deploy failed' };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Error' };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  
  if (action === 'apps') {
    return NextResponse.json({ total: ALL_APPS.length, apps: ALL_APPS });
  }
  
  return NextResponse.json(await runFullSweep());
}

export async function POST(req: NextRequest) {
  const { action, appName } = await req.json();
  
  if (action === 'heal' && appName) {
    return NextResponse.json(await healApp(appName));
  }
  
  if (action === 'heal_all') {
    const status = await runFullSweep();
    const downApps = status.results.filter(r => r.status === 'down');
    const heals = await Promise.all(downApps.map(a => healApp(a.app)));
    return NextResponse.json({ healed: heals.length, results: heals });
  }
  
  return NextResponse.json(await runFullSweep());
}
