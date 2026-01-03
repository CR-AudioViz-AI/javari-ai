/**
 * SELF-HEALING PROOF REPORT
 * Generates evidence that autonomous monitoring is working 24x7
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
  const since = new Date(Date.now() - days * 24 * 3600000).toISOString();

  try {
    // Gather all proof data
    const [heartbeats, runs, actions, alerts, jobs] = await Promise.all([
      supabase.from('autonomous_heartbeats').select('*', { count: 'exact' })
        .gte('timestamp', since).order('timestamp', { ascending: false }).limit(1000),
      supabase.from('autonomous_runs').select('*')
        .gte('started_at', since).order('started_at', { ascending: false }),
      supabase.from('autonomous_actions').select('*')
        .gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('autonomous_alerts').select('*')
        .gte('created_at', since).order('created_at', { ascending: false }),
      supabase.from('autonomous_jobs').select('*').eq('enabled', true)
    ]);

    // Calculate stats
    const runsByStatus = (runs.data || []).reduce((acc: Record<string, number>, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const gaps = calculateGaps(heartbeats.data || []);
    const expectedBeats = days * 24 * 60;
    const uptime = Math.min(100, Math.round(((heartbeats.count || 0) / expectedBeats) * 100 * 10) / 10);

    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        period_days: days,
        period_start: since
      },
      summary: {
        status: gaps.length === 0 && !runsByStatus.failed ? 'HEALTHY' : 'NEEDS_ATTENTION',
        uptime_percent: uptime,
        total_runs: runs.data?.length || 0,
        total_actions: actions.data?.length || 0,
        total_alerts: alerts.data?.length || 0,
        issues_detected: (runs.data || []).reduce((s, r) => s + (r.issues_detected_count || 0), 0),
        fixes_applied: (runs.data || []).reduce((s, r) => s + (r.fixes_applied_count || 0), 0)
      },
      heartbeat_proof: {
        total: heartbeats.count || 0,
        expected: expectedBeats,
        gaps_count: gaps.length,
        gaps: gaps.slice(0, 10),
        latest: heartbeats.data?.[0]?.timestamp
      },
      runs_by_status: runsByStatus,
      recent_runs: (runs.data || []).slice(0, 20).map(r => ({
        job: r.job_name,
        status: r.status,
        time: r.started_at,
        duration_ms: r.duration_ms,
        issues: r.issues_detected_count
      })),
      recent_actions: (actions.data || []).slice(0, 10).map(a => ({
        type: a.action_type,
        target: a.target,
        status: a.status,
        time: a.created_at
      })),
      active_jobs: (jobs.data || []).map(j => ({
        name: j.name,
        schedule: j.schedule,
        last_run: j.last_run_at
      })),
      verification: {
        heartbeat_continuous: gaps.length === 0,
        runs_successful: !runsByStatus.failed,
        system_healthy: gaps.length === 0 && !runsByStatus.failed
      }
    };

    return NextResponse.json(report);
  } catch (err: unknown) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 });
  }
}

function calculateGaps(beats: Array<{ timestamp: string }>): Array<{ start: string; end: string; minutes: number }> {
  if (beats.length < 2) return [];
  
  const gaps: Array<{ start: string; end: string; minutes: number }> = [];
  const sorted = [...beats].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = (new Date(sorted[i].timestamp).getTime() - 
                  new Date(sorted[i + 1].timestamp).getTime()) / 60000;
    if (diff > 2) {
      gaps.push({
        start: sorted[i + 1].timestamp,
        end: sorted[i].timestamp,
        minutes: Math.round(diff * 10) / 10
      });
    }
  }
  
  return gaps.sort((a, b) => b.minutes - a.minutes);
}
