/**
 * HEARTBEAT API - Proof of continuous monitoring
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const hours = parseInt(request.nextUrl.searchParams.get('hours') || '24');
  
  try {
    const since = new Date(Date.now() - hours * 3600000).toISOString();
    
    const { data: heartbeats, count } = await supabase
      .from('autonomous_heartbeats')
      .select('*', { count: 'exact' })
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(100);
    
    const { data: runs } = await supabase
      .from('autonomous_runs')
      .select('run_id, job_name, status, started_at, duration_ms')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(20);
    
    const { data: jobs } = await supabase
      .from('autonomous_jobs')
      .select('name, enabled, last_run_at, schedule')
      .eq('enabled', true);
    
    // Calculate gaps
    const gaps = calculateGaps(heartbeats || []);
    const expectedBeats = hours * 60;
    const uptime = Math.min(100, Math.round(((count || 0) / expectedBeats) * 100 * 10) / 10);
    
    return NextResponse.json({
      status: gaps.length === 0 ? 'healthy' : 'degraded',
      period_hours: hours,
      stats: {
        total_heartbeats: count || 0,
        expected: expectedBeats,
        uptime_percent: uptime,
        gaps_count: gaps.length,
        longest_gap_min: gaps[0]?.duration_minutes || 0
      },
      gaps: gaps.slice(0, 10),
      recent_runs: runs,
      jobs: jobs,
      latest: heartbeats?.[0] || null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { data, error } = await supabase
      .from('autonomous_heartbeats')
      .insert({
        region: process.env.VERCEL_REGION || 'manual',
        status: 'alive',
        metrics: { triggered: 'manual' }
      })
      .select()
      .single();
    
    if (error) throw error;
    return NextResponse.json({ status: 'success', heartbeat: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function calculateGaps(beats: any[]) {
  if (beats.length < 2) return [];
  const gaps: any[] = [];
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
        duration_minutes: Math.round(diff * 10) / 10
      });
    }
  }
  return gaps.sort((a, b) => b.duration_minutes - a.duration_minutes);
}
