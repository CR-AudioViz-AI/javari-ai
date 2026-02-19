// app/api/javari/roadmap/state/route.ts
// GET /api/javari/roadmap/state — load live roadmap state from Supabase
// Loads roadmap + tasks from javari_tasks table, joins into canonical phases
// POST /api/javari/roadmap/state — webhook handler for automated progress updates
//
// KEY FIX: supaHeaders() now uses SAME key for both apikey + Authorization
// (matches roadmap-state.ts pattern — avoids RLS downgrade to anon)
//
// 2026-02-19 — TASK-P0-006 v3

import { NextRequest, NextResponse } from 'next/server';
import { JAVARI_CANONICAL_ROADMAP } from '@/lib/javari/roadmap/canonical-roadmap';

export const dynamic = 'force-dynamic';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function supaHeaders() {
  return {
    apikey: SUPA_KEY,              // ← same key both places (critical for RLS bypass)
    Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export async function GET() {
  const t0 = Date.now();
  const canonical = JAVARI_CANONICAL_ROADMAP;

  try {
    if (!SUPA_URL || !SUPA_KEY) throw new Error('Supabase env vars not set');

    // ── 1. Load roadmap metadata row ─────────────────────────────────────────
    const roadmapRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_roadmaps?id=eq.javari-os-v2&select=id,title,status,task_count,completed_count,failed_count,progress,started_at,updated_at&limit=1`,
      { headers: supaHeaders() }
    );

    const roadmapRows = roadmapRes.ok
      ? (await roadmapRes.json() as Record<string, unknown>[])
      : [];
    const roadmapRow = roadmapRows[0] || null;

    // ── 2. Load all tasks for this roadmap ───────────────────────────────────
    const tasksRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2` +
      `&select=id,title,description,status,priority,phase_id,phase_order,task_order,estimated_hours,dependencies,tags,result,started_at,completed_at` +
      `&order=phase_order.asc,task_order.asc&limit=200`,
      { headers: supaHeaders() }
    );

    const dbTasks = tasksRes.ok
      ? (await tasksRes.json() as Record<string, unknown>[])
      : [];

    // ── 3. Index tasks by id for fast lookup ─────────────────────────────────
    const taskMap = new Map<string, Record<string, unknown>>();
    for (const t of dbTasks) taskMap.set(t.id as string, t);

    // DB status → UI status normalization
    const normalizeStatus = (s: unknown): string => {
      if (s === 'in-progress') return 'running';
      if (s === 'not-started') return 'pending';
      return String(s || 'pending');
    };

    // ── 4. Build enriched phases: canonical structure + live DB statuses ─────
    const enrichedPhases = canonical.phases.map((cp) => {
      const enrichedTasks = cp.tasks.map((ct) => {
        const db = taskMap.get(ct.id);
        return {
          id: ct.id,
          title: ct.title,
          description: ct.description || '',
          status: db ? normalizeStatus(db.status) : normalizeStatus(ct.status),
          priority: ct.priority,
          estimatedHours: (db?.estimated_hours as number | undefined) ?? ct.estimatedHours,
          dependencies: (db?.dependencies as string[]) ?? ct.dependencies ?? [],
          tags: (db?.tags as string[]) ?? ct.tags ?? [],
          result: db?.result as string | undefined,
          started_at: db?.started_at as string | undefined,
          completed_at: db?.completed_at as string | undefined,
        };
      });

      // Derive phase status from live task statuses
      const allComplete = enrichedTasks.every((t) => t.status === 'complete');
      const anyRunning = enrichedTasks.some((t) => t.status === 'running');
      const anyFailed = enrichedTasks.some((t) => t.status === 'failed');
      const anyBlocked = enrichedTasks.some((t) => t.status === 'blocked');
      const anyNonPending = enrichedTasks.some((t) => t.status !== 'pending');

      const phaseStatus = allComplete ? 'complete'
        : anyRunning ? 'active'
        : anyFailed ? 'failed'
        : anyNonPending ? 'active'
        : 'idle';

      return {
        id: cp.id,
        name: cp.name,
        status: phaseStatus,
        order: cp.order,
        description: cp.description || '',
        exitCriteria: cp.exitCriteria || [],
        tasks: enrichedTasks,
      };
    });

    // ── 5. Compute live aggregate stats ──────────────────────────────────────
    const allEnrichedTasks = enrichedPhases.flatMap((p) => p.tasks);
    const completedCount = allEnrichedTasks.filter((t) => t.status === 'complete').length;
    const failedCount = allEnrichedTasks.filter((t) => t.status === 'failed').length;
    const totalCount = allEnrichedTasks.length;
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return NextResponse.json({
      success: true,
      source: dbTasks.length > 0 ? 'supabase' : 'canonical-fallback',
      loadMs: Date.now() - t0,
      roadmap: {
        id: 'javari-os-v2',
        title: canonical.name,
        version: canonical.version,
        status: (roadmapRow?.status as string) || canonical.status,
        progress,
        totalTasks: totalCount,
        completedTasks: completedCount,
        failedTasks: failedCount,
        phases: enrichedPhases,
        milestones: canonical.milestones || [],
        startedAt: roadmapRow?.started_at as string | null ?? null,
        updatedAt: roadmapRow?.updated_at as string ?? new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[RoadmapState/GET] Error — returning canonical fallback:', err);

    // Safe fallback: canonical structure, all pending
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
          id: p.id,
          name: p.name,
          status: p.status,
          order: p.order,
          exitCriteria: p.exitCriteria || [],
          tasks: p.tasks,
        })),
        milestones: canonical.milestones || [],
        startedAt: null,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

// ── Webhook: automated progress updates ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { taskId, status, result, error: taskError } = await req.json() as {
      taskId?: string;
      status?: string;
      result?: string;
      error?: string;
    };

    if (!taskId || !status) {
      return NextResponse.json({ success: false, error: 'taskId + status required' }, { status: 400 });
    }

    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (result) update.result = result;
    if (taskError) update.error = taskError;
    if (status === 'running' || status === 'in-progress') update.started_at = new Date().toISOString();
    if (status === 'complete' || status === 'failed') update.completed_at = new Date().toISOString();

    const res = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?id=eq.${encodeURIComponent(taskId)}&roadmap_id=eq.javari-os-v2`,
      { method: 'PATCH', headers: { ...supaHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify(update) }
    );

    if (!res.ok) {
      return NextResponse.json({ success: false, error: await res.text() }, { status: 500 });
    }

    return NextResponse.json({ success: true, taskId, newStatus: status });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
