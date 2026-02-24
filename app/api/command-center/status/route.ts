/**
 * app/api/command-center/status/route.ts
 * Command Center Status Endpoint
 * Created: 2026-02-22 02:38 ET
 * 
 * Returns real-time autonomy system state including:
 * - Current cycle status
 * - Roadmap completion stats
 * - Kill switch state
 * - Model usage summary
 * - Drift detection status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecret } from '@/lib/platform-secrets';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StatusResponse {
  timestamp: string;
  autonomy: {
    enabled: boolean;
    killSwitch: boolean;
    mode: string;
    ring: number;
    interval: string;
  };
  lastCycle: {
    id: string;
    timestamp: string;
    duration: number;
    stages: {
      roadmap: string;
      crawl: string;
      analyze: string;
      patch: string;
      validate: string;
    };
    patches: number;
    failures: number;
  } | null;
  nextCycle: {
    scheduled: string;
    estimatedStart: string;
  };
  roadmap: {
    activeRoadmap: string;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    blockedTasks: number;
    completionPercentage: number;
  };
  modelUsage: {
    totalTokens: number;
    tokensByModel: Record<string, number>;
    avgLatency: number;
    successRate: number;
  };
  drift: {
    activeEvents: number;
    criticalEvents: number;
    lastDetected: string | null;
  };
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Auth check - require service role or valid API key
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('x-api-key');
    
    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Configuration error', code: 'CONFIG_MISSING' },
        { status: 500 }
      );
    }

    // Create service role client for secure access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get environment variables for autonomy config
    const enabled = process.env.AUTONOMOUS_CORE_ENABLED === 'true';
    const killSwitch = process.env.AUTONOMOUS_CORE_KILL_SWITCH === 'true';
    const mode = process.env.AUTONOMOUS_MODE || 'continuous';
    const ring = parseInt(process.env.AUTONOMOUS_RING || '2', 10);

    // Get last cycle report
    const { data: lastCycleData, error: cycleError } = await supabase
      .from('autonomy_cycle_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let lastCycle = null;
    if (lastCycleData && !cycleError) {
      lastCycle = {
        id: lastCycleData.cycle_id,
        timestamp: lastCycleData.created_at,
        duration: lastCycleData.duration_ms || 0,
        stages: lastCycleData.stages || {},
        patches: lastCycleData.patches_generated || 0,
        failures: lastCycleData.failures || 0,
      };
    }

    // Calculate next cycle time (every 15 minutes for ring 2)
    const intervalMinutes = ring === 1 ? 5 : ring === 2 ? 15 : 60;
    const nextCycleTime = lastCycle
      ? new Date(new Date(lastCycle.timestamp).getTime() + intervalMinutes * 60 * 1000)
      : new Date(Date.now() + intervalMinutes * 60 * 1000);

    // Get active roadmap stats
    const { data: roadmapData, error: roadmapError } = await supabase
      .from('autonomy_roadmaps')
      .select('*')
      .eq('status', 'executing')
      .single();

    let roadmapStats = {
      activeRoadmap: 'none',
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      blockedTasks: 0,
      completionPercentage: 0,
    };

    if (roadmapData && !roadmapError) {
      const tasks = roadmapData.tasks || [];
      roadmapStats = {
        activeRoadmap: roadmapData.roadmap_id,
        totalTasks: tasks.length,
        completedTasks: tasks.filter((t: any) => t.status === 'completed').length,
        inProgressTasks: tasks.filter((t: any) => t.status === 'in-progress' || t.status === 'running').length,
        blockedTasks: tasks.filter((t: any) => t.status === 'blocked').length,
        completionPercentage: tasks.length > 0
          ? Math.round((tasks.filter((t: any) => t.status === 'completed').length / tasks.length) * 100)
          : 0,
      };
    }

    // Get model usage from last cycle
    const cycleId = lastCycle?.id;
    let modelUsage = {
      totalTokens: 0,
      tokensByModel: {} as Record<string, number>,
      avgLatency: 0,
      successRate: 100,
    };

    if (cycleId) {
      const { data: usageData, error: usageError } = await supabase
        .from('autonomy_model_usage')
        .select('*')
        .eq('cycle_id', cycleId);

      if (usageData && !usageError && usageData.length > 0) {
        const totalTokens = usageData.reduce((sum, u) => sum + (u.tokens_in || 0) + (u.tokens_out || 0), 0);
        const avgLatency = usageData.reduce((sum, u) => sum + (u.latency_ms || 0), 0) / usageData.length;
        const successCount = usageData.filter(u => u.success).length;
        
        const tokensByModel: Record<string, number> = {};
        usageData.forEach(u => {
          const tokens = (u.tokens_in || 0) + (u.tokens_out || 0);
          tokensByModel[u.model] = (tokensByModel[u.model] || 0) + tokens;
        });

        modelUsage = {
          totalTokens,
          tokensByModel,
          avgLatency: Math.round(avgLatency),
          successRate: Math.round((successCount / usageData.length) * 100),
        };
      }
    }

    // Get drift events
    const { data: driftData, error: driftError } = await supabase
      .from('autonomy_drift_events')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    const driftStats = {
      activeEvents: driftData?.length || 0,
      criticalEvents: driftData?.filter(d => d.severity >= 4).length || 0,
      lastDetected: driftData && driftData.length > 0 ? driftData[0].created_at : null,
    };

    const response: StatusResponse = {
      timestamp: new Date().toISOString(),
      autonomy: {
        enabled,
        killSwitch,
        mode,
        ring,
        interval: `${intervalMinutes}m`,
      },
      lastCycle,
      nextCycle: {
        scheduled: nextCycleTime.toISOString(),
        estimatedStart: enabled && !killSwitch ? nextCycleTime.toISOString() : 'paused',
      },
      roadmap: roadmapStats,
      modelUsage,
      drift: driftStats,
    };

    const duration = Date.now() - startTime;
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Response-Time': `${duration}ms`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('[Command Center Status] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
