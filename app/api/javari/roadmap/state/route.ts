// app/api/javari/roadmap/state/route.ts
// GET /api/javari/roadmap/state — load live roadmap state from Supabase
// Loads roadmap metadata + tasks from separate javari_tasks table, joins into phases
// POST /api/javari/roadmap/state — webhook handler for automated progress updates
// 2026-02-19 — TASK-P0-006 Roadmap Dashboard UI

import { NextRequest, NextResponse } from 'next/server';
import { JAVARI_CANONICAL_ROADMAP } from '@/lib/javari/roadmap/canonical-roadmap';

export const dynamic = 'force-dynamic';

function supabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return { url, headers: {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }};
}

export async function GET() {
  const t0 = Date.now();

  try {
    const { url, headers } = supabaseHeaders();
    const canonical = JAVARI_CANONICAL_ROADMAP;

    // ── 1. Load roadmap row ─────────────────────────────────────────────────
    const roadmapRes = await fetch(
      `${url}/rest/v1/javari_roadmaps?id=eq.javari-os-v2&select=id,title,status,phase_count,task_count,completed_count,failed_count,progress,started_at,updated_at&limit=1`,
      { headers }
    );

    const roadmapRows = roadmapRes.ok ? await roadmapRes.json() as Record<string, unknown>[] : [];
    const roadmapRow = roadmapRows[0];

    // ── 2. Load all tasks ───────────────────────────────────────────────────
    const tasksRes = await fetch(
      `${url}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&select=id,title,description,status,priority,phase_id,phase_order,task_order,estimated_hours,dependencies,tags,result,started_at,completed_at&order=phase_order.asc,task_order.asc&limit=100`,
      { headers }
    );

    const dbTasks = tasksRes.ok ? await tasksRes.json() as Record<string, unknown>[] : [];

    // ── 3. Build task map keyed by id ───────────────────────────────────────
    const taskMap = new Map(dbTasks.map((t) => [t.id as string, t]));

    // ── 4. Merge canonical phase structure with live task statuses ──────────
    const enrichedPhases = canonical.phases.map((cp) => {
      const canonicalPhaseStatus = (): string => {
        const phaseTasks = cp.tasks.map((ct) => taskMap.get(ct.id));
        const allComplete = phaseTasks.every((t) => t?.status === 'complete');
        const anyRunning = phaseTasks.some((t) => t?.status === 'running' || t?.status === 'in-progress');
        const anyFailed = phaseTasks.some((t) => t?.status === 'failed');
        const anyActive = phaseTasks.some((t) => t?.status !== 'pending' && t?.status !== 'complete');

        if (allComplete) return 'complete';
        if (anyFailed) return 'failed';
        if (anyRunning || anyActive) return 'active';
        return 'idle';
      };

      return {
        id: cp.id,
        name: cp.name,
        status: canonicalPhaseStatus(),
        order: cp.order,
        description: cp.description || '',
        exitCriteria: cp.exitCriteria || [],
        tasks: cp.tasks.map((ct) => {
          const dbTask = taskMap.get(ct.id);
          return {
            id: ct.id,
            title: ct.title,
            description: ct.description,
            // Live status from DB, fall back to canonical
            status: (dbTask?.status as string) || ct.status,
            priority: ct.priority,
            estimatedHours: ct.estimatedHours,
            dependencies: ct.dependencies || [],
            tags: ct.tags || [],
            result: dbTask?.result as string | undefined,
            started_at: dbTask?.started_at as string | undefined,
            completed_at: dbTask?.completed_at as string | undefined,
          };
        }),
      };
    });

    // ── 5. Compute live counts from DB tasks ────────────────────────────────
    const completedCount = dbTasks.filter((t) => t.status === 'complete').length;
    const failedCount = dbTasks.filter((t) => t.status === 'failed').length;
    const totalCount = dbTasks.length || canonical.phases.flatMap((p) => p.tasks).length;
    const liveProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return NextResponse.json({
      success: true,
      source: roadmapRow ? 'supabase' : 'canonical-fallback',
      loadMs: Date.now() - t0,
      roadmap: {
        id: 'javari-os-v2',
        title: canonical.name,
        version: canonical.version,
        status: (roadmapRow?.status as string) || canonical.status,
        progress: liveProgress,
        totalTasks: totalCount,
        completedTasks: completedCount,
        failedTasks: failedCount,
        phases: enrichedPhases,
        milestones: canonical.milestones,
        startedAt: roadmapRow?.started_at as string | null || null,
        updatedAt: roadmapRow?.updated_at as string || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[RoadmapState] GET error:', err);

    // Graceful fallback to canonical roadmap
    try {
      const canonical = JAVARI_CANONICAL_ROADMAP;
      const allTasks = canonical.phases.flatMap((p) => p.tasks);
      return NextResponse.json({
        success: true,
        source: 'canonical-fallback',
        loadMs: Date.now() - t0,
        error: err instanceof Error ? err.message : String(err),
        roadmap: {
          id: 'javari-os-v2',
          title: canonical.name,
          version: canonical.version,
          status: canonical.status,
          progress: 0,
          totalTasks: allTasks.length,
          completedTasks: 0,
          failedTasks: 0,
          phases: canonical.phases.map((p) => ({
            id: p.id, name: p.name, status: p.status, order: p.order,
            exitCriteria: p.exitCriteria || [], tasks: p.tasks,
          })),
          milestones: canonical.milestones,
          startedAt: null,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Complete state load failure' },
        { status: 500 }
      );
    }
  }
}

// Webhook handler — automated progress updates
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
    const updateBody: Record<string, unknown> = { status };
    if (result) updateBody.result = result;
    if (taskError) updateBody.error = taskError;
    if (status === 'running') updateBody.started_at = new Date().toISOString();
    if (status === 'complete' || status === 'failed') updateBody.completed_at = new Date().toISOString();

    const res = await fetch(
      `${url}/rest/v1/javari_tasks?id=eq.${taskId}`,
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
