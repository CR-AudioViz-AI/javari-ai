// app/api/javari/roadmap/state/route.ts
// GET /api/javari/roadmap/state — load live roadmap state from Supabase
// POST /api/javari/roadmap/state — webhook handler for automated progress updates
//
// Architecture:
//   canonical-roadmap.ts → phases[].taskIds (string[])
//   canonical-roadmap.ts → tasks[] (flat Task array with phaseId)
//   javari_tasks (Supabase) → live statuses, results, timestamps
//
// Strategy: canonical = structure + metadata, DB = live status override
// 2026-02-19 — TASK-P0-006 Roadmap Dashboard UI (v3 — proper join)

import { NextRequest, NextResponse } from 'next/server';
import { JAVARI_CANONICAL_ROADMAP } from '@/lib/javari/roadmap/canonical-roadmap';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

function supabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return {
    url,
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  };
}

export async function GET() {
  const t0 = Date.now();
  const canonical = JAVARI_CANONICAL_ROADMAP;

  // Build canonical task map (id → Task) for fast lookup
  const canonicalTaskMap = new Map(canonical.tasks.map((t) => [t.id, t]));

  // Default response using canonical data only (DB enrichment applied below)
  let dbTaskMap = new Map<string, Record<string, unknown>>();
  let roadmapRow: Record<string, unknown> | null = null;
  let source = 'canonical-only';

  try {
    const { url, headers } = supabaseHeaders();

    // Load both in parallel for speed
    const [roadmapRes, tasksRes] = await Promise.all([
      fetch(
        `${url}/rest/v1/javari_roadmaps?id=eq.javari-os-v2&select=id,title,status,task_count,completed_count,failed_count,progress,started_at,updated_at&limit=1`,
        { headers }
      ),
      fetch(
        `${url}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&select=id,status,result,started_at,completed_at&limit=100`,
        { headers }
      ),
    ]);

    if (roadmapRes.ok) {
      const rows = await roadmapRes.json() as Record<string, unknown>[];
      roadmapRow = rows[0] || null;
    }

    if (tasksRes.ok) {
      const dbTasks = await tasksRes.json() as Record<string, unknown>[];
      dbTaskMap = new Map(dbTasks.map((t) => [t.id as string, t]));
      source = dbTasks.length > 0 ? 'supabase' : 'canonical-only';
    }
  } catch (err) {
    console.warn('[RoadmapState] DB load failed, using canonical:', err);
  }

  // ── Build enriched phases (canonical structure + DB live status) ──────────
  const enrichedPhases = canonical.phases.map((phase) => {
    // Resolve tasks for this phase using taskIds → canonical task lookup
    const phaseTasks = (phase.taskIds || [])
      .map((tid) => canonicalTaskMap.get(tid))
      .filter(Boolean)
      .map((ct) => {
        const dbTask = dbTaskMap.get(ct!.id);
        // Map DB status to UI status (DB uses 'in-progress', UI uses 'running')
        const rawStatus = (dbTask?.status as string) || ct!.status;
        const uiStatus = rawStatus === 'in-progress' ? 'running' : rawStatus;
        return {
          id: ct!.id,
          title: ct!.title,
          description: ct!.description,
          status: uiStatus,
          priority: ct!.priority,
          estimatedHours: ct!.estimatedHours,
          dependencies: ct!.dependencies || [],
          tags: ct!.tags || [],
          result: (dbTask?.result as string | undefined) || (ct!.result),
          started_at: dbTask?.started_at as string | undefined,
          completed_at: dbTask?.completed_at as string | undefined,
        };
      });

    // Compute phase status from live task statuses
    const computePhaseStatus = () => {
      if (phaseTasks.length === 0) return phase.status;
      const allDone = phaseTasks.every((t) => t.status === 'complete' || t.status === 'skipped');
      if (allDone) return 'complete' as const;
      const anyRunning = phaseTasks.some((t) => t.status === 'running' || t.status === 'in-progress');
      const anyDone = phaseTasks.some((t) => t.status === 'complete');
      const anyFailed = phaseTasks.some((t) => t.status === 'failed');
      if (anyFailed && !anyDone && !anyRunning) return 'failed' as const;
      if (anyRunning || anyDone) return 'active' as const;
      return 'pending' as const;
    };

    return {
      id: phase.id,
      name: phase.name,
      status: computePhaseStatus(),
      order: phase.order + 1, // display as 1-5 (not 0-4)
      description: phase.description,
      exitCriteria: phase.exitCriteria || [],
      estimatedDuration: phase.estimatedDuration,
      tasks: phaseTasks,
    };
  });

  // ── Compute live counts from enriched tasks ───────────────────────────────
  const allEnrichedTasks = enrichedPhases.flatMap((p) => p.tasks);
  const completedCount = allEnrichedTasks.filter((t) => t.status === 'complete').length;
  const failedCount = allEnrichedTasks.filter((t) => t.status === 'failed').length;
  const runningCount = allEnrichedTasks.filter((t) => t.status === 'running').length;
  const totalCount = allEnrichedTasks.length;
  const liveProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // ── Milestone enrichment (mark achieved based on phase completion) ────────
  const completedPhaseIds = new Set(
    enrichedPhases.filter((p) => p.status === 'complete').map((p) => p.id)
  );
  const enrichedMilestones = canonical.milestones.map((m) => ({
    ...m,
    achieved: completedPhaseIds.has(m.phaseId || ''),
  }));

  return NextResponse.json({
    success: true,
    source,
    loadMs: Date.now() - t0,
    roadmap: {
      id: 'javari-os-v2',
      title: canonical.title,
      version: canonical.version,
      status: (roadmapRow?.status as string) || canonical.status || 'executing',
      progress: liveProgress,
      totalTasks: totalCount,
      completedTasks: completedCount,
      failedTasks: failedCount,
      runningTasks: runningCount,
      phases: enrichedPhases,
      milestones: enrichedMilestones,
      startedAt: (roadmapRow?.started_at as string) || null,
      updatedAt: (roadmapRow?.updated_at as string) || new Date().toISOString(),
    },
  });
}

// ── Webhook: automated task progress update ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      taskId?: string;
      status?: string;
      result?: string;
      error?: string;
    };

    const { taskId, status, result, error: taskError } = body;
    if (!taskId || !status) {
      return NextResponse.json({ success: false, error: 'Missing taskId or status' }, { status: 400 });
    }

    const { url, headers } = supabaseHeaders();

    // Map UI status → DB status
    const dbStatus = status === 'running' ? 'in-progress' : status;

    const updateBody: Record<string, unknown> = { status: dbStatus };
    if (result) updateBody.result = result;
    if (taskError) updateBody.error = taskError;
    if (status === 'running') updateBody.started_at = new Date().toISOString();
    if (status === 'complete' || status === 'failed') {
      updateBody.completed_at = new Date().toISOString();
    }
    updateBody.updated_at = new Date().toISOString();

    const res = await fetch(
      `${url}/rest/v1/javari_tasks?id=eq.${taskId}&roadmap_id=eq.javari-os-v2`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(updateBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ success: false, error: errText.slice(0, 200) }, { status: 500 });
    }

    return NextResponse.json({ success: true, taskId, newStatus: status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
