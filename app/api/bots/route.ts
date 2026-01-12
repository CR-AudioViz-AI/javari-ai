// app/api/bots/route.ts
// Javari Bot Management - Register, monitor, control all bots
// Timestamp: 2025-11-30 21:20 EST

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Registered bots
const BOTS = [
  {
    id: 'monitor-bot',
    name: 'Platform Monitor',
    type: 'monitoring',
    endpoint: '/api/monitor',
    schedule: '*/5 * * * *', // Every 5 min
    status: 'active',
    description: 'Monitors all 25 apps, triggers self-healing'
  },
  {
    id: 'learning-bot',
    name: 'Knowledge Crawler',
    type: 'learning',
    endpoint: '/api/cron/learn',
    schedule: '0 */4 * * *', // Every 4 hours
    status: 'active',
    description: 'Crawls docs, learns new knowledge'
  },
  {
    id: 'devdocs-scraper',
    name: 'DevDocs Scraper',
    type: 'scraper',
    endpoint: 'https://javari-devdocs-scraper.vercel.app/api/scrape',
    schedule: '0 0 * * 0', // Weekly
    status: 'active',
    description: 'Scrapes DevDocs for dev knowledge'
  },
  {
    id: 'mdn-scraper',
    name: 'MDN Scraper',
    type: 'scraper', 
    endpoint: 'https://javari-mdn-scraper.vercel.app/api/scrape',
    schedule: '0 0 * * 0', // Weekly
    status: 'active',
    description: 'Scrapes MDN Web Docs'
  },
  {
    id: 'fcc-scraper',
    name: 'FreeCodeCamp Scraper',
    type: 'scraper',
    endpoint: 'https://javari-fcc-scraper.vercel.app/api/scrape',
    schedule: '0 0 * * 0', // Weekly
    status: 'active',
    description: 'Scrapes FreeCodeCamp curriculum'
  },
  {
    id: 'deploy-bot',
    name: 'Auto Deploy',
    type: 'deployment',
    endpoint: '/api/autonomous/deploy',
    schedule: 'on-demand',
    status: 'active',
    description: 'Handles preview and production deploys'
  },
  {
    id: 'error-bot',
    name: 'Error Handler',
    type: 'error-handling',
    endpoint: '/api/autonomous/fix',
    schedule: 'on-error',
    status: 'active',
    description: 'Detects and fixes common errors'
  },
  {
    id: 'analytics-bot',
    name: 'Analytics Collector',
    type: 'analytics',
    endpoint: '/api/analytics/collect',
    schedule: '0 * * * *', // Hourly
    status: 'active',
    description: 'Collects usage and performance data'
  },
  {
    id: 'backup-bot',
    name: 'Data Backup',
    type: 'backup',
    endpoint: '/api/autonomous/backup',
    schedule: '0 3 * * *', // Daily 3am
    status: 'active',
    description: 'Backs up critical data'
  }
];

interface BotRun {
  botId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'success' | 'failed';
  result?: any;
  error?: string;
}

// Track recent runs in memory (would be in DB for production)
const recentRuns: BotRun[] = [];

async function runBot(botId: string): Promise<BotRun> {
  const bot = BOTS.find(b => b.id === botId);
  if (!bot) throw new Error('Bot not found');

  const run: BotRun = {
    botId,
    startedAt: new Date().toISOString(),
    status: 'running'
  };

  try {
    const url = bot.endpoint.startsWith('http') 
      ? bot.endpoint 
      : `https://javariai.com${bot.endpoint}`;
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggered_by: 'bot-api' })
    });

    run.completedAt = new Date().toISOString();
    
    if (resp.ok) {
      run.status = 'success';
      run.result = await resp.json();
    } else {
      run.status = 'failed';
      run.error = `HTTP ${resp.status}`;
    }
  } catch (e) {
    run.completedAt = new Date().toISOString();
    run.status = 'failed';
    run.error = e instanceof Error ? e.message : 'Unknown error';
  }

  recentRuns.unshift(run);
  if (recentRuns.length > 100) recentRuns.pop();

  // Log to knowledge
  await supabase.from('javari_knowledge').insert({
    topic: 'Bots',
    subtopic: 'Runs',
    concept: `${bot.name} run - ${new Date().toISOString().split('T')[0]}`,
    explanation: `Bot ${bot.name} (${botId}) ran. Status: ${run.status}. ${run.error || ''}`,
    verified: true,
    verified_by: 'bot-manager',
    tags: ['bots', run.status]
  });

  return run;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'list') {
    return NextResponse.json({
      total: BOTS.length,
      active: BOTS.filter(b => b.status === 'active').length,
      bots: BOTS
    });
  }

  if (action === 'runs') {
    return NextResponse.json({ runs: recentRuns.slice(0, 20) });
  }

  if (action === 'status') {
    return NextResponse.json({
      bots: BOTS.map(b => ({
        id: b.id,
        name: b.name,
        status: b.status,
        lastRun: recentRuns.find(r => r.botId === b.id)
      }))
    });
  }

  // Default: full info
  return NextResponse.json({
    total: BOTS.length,
    active: BOTS.filter(b => b.status === 'active').length,
    bots: BOTS,
    recentRuns: recentRuns.slice(0, 10)
  });
}

export async function POST(req: NextRequest) {
  const { action, botId } = await req.json();

  if (action === 'run' && botId) {
    const run = await runBot(botId);
    return NextResponse.json(run);
  }

  if (action === 'run_all') {
    const runs = await Promise.all(
      BOTS.filter(b => b.status === 'active' && b.schedule !== 'on-demand' && b.schedule !== 'on-error')
        .map(b => runBot(b.id))
    );
    return NextResponse.json({ ran: runs.length, runs });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
