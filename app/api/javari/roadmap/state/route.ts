// app/api/javari/roadmap/state/route.ts
// GET /api/javari/roadmap/state — load live roadmap state from Supabase
// POST /api/javari/roadmap/state — webhook handler for automated progress updates
// 2026-02-19 — TASK-P0-006 Roadmap Dashboard UI

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';
import { JAVARI_CANONICAL_ROADMAP } from '@/lib/javari/roadmap/canonical-roadmap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const t0 = Date.now();

    // Load from Supabase (falls back to in-memory if cold)
    const state = await stateManager.loadAsync('javari-os-v2');

    if (!state) {
      // Return canonical roadmap structure with idle status
      const roadmap = JAVARI_CANONICAL_ROADMAP;
      const allTasks = roadmap.phases.flatMap((p) => p.tasks);
      const completedCount = allTasks.filter((t) => t.status === 'complete').length;

      return NextResponse.json({
        success: true,
        source: 'canonical-fallback',
        loadMs: Date.now() - t0,
        roadmap: {
          id: 'javari-os-v2',
          title: roadmap.name,
          version: roadmap.version,
          status: roadmap.status,
          progress: completedCount / allTasks.length * 100,
          totalTasks: allTasks.length,
          completedTasks: completedCount,
          phases: roadmap.phases.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            order: p.order,
            exitCriteria: p.exitCriteria,
            tasks: p.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              status: t.status,
              priority: t.priority,
              estimatedHours: t.estimatedHours,
              dependencies: t.dependencies,
              tags: t.tags,
            })),
          })),
          milestones: roadmap.milestones,
          startedAt: null,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Enrich with canonical roadmap data (descriptions, exit criteria)
    const canonical = JAVARI_CANONICAL_ROADMAP;
    const canonicalPhases = new Map(canonical.phases.map((p) => [p.id, p]));

    const enrichedPhases = state.phases?.map((phase: Record<string, unknown>) => {
      const cp = canonicalPhases.get(phase.id as string);
      return {
        ...phase,
        exitCriteria: cp?.exitCriteria || [],
        description: cp?.description || '',
      };
    }) || canonical.phases;

    return NextResponse.json({
      success: true,
      source: 'supabase',
      loadMs: Date.now() - t0,
      roadmap: {
        id: state.id,
        title: state.title || canonical.name,
        version: canonical.version,
        status: state.status,
        progress: state.progress || 0,
        totalTasks: state.task_count || 0,
        completedTasks: state.completed_count || 0,
        failedTasks: state.failed_count || 0,
        phases: enrichedPhases,
        milestones: canonical.milestones,
        startedAt: state.started_at,
        updatedAt: state.updated_at,
      },
    });
  } catch (err) {
    console.error('[RoadmapState] GET error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Webhook handler — automated progress updates from task executor
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, status, result, error: taskError } = body as {
      taskId?: string;
      status?: string;
      result?: string;
      error?: string;
    };

    if (!taskId || !status) {
      return NextResponse.json({ success: false, error: 'Missing taskId or status' }, { status: 400 });
    }

    const validStatuses = ['pending', 'running', 'complete', 'failed', 'skipped', 'blocked'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 });
    }

    // Load current state
    const state = await stateManager.loadAsync('javari-os-v2');
    if (!state) {
      return NextResponse.json({ success: false, error: 'Roadmap not initialized' }, { status: 404 });
    }

    // Update the task
    const phases = state.phases as Record<string, unknown>[];
    for (const phase of phases || []) {
      const tasks = (phase.tasks as Record<string, unknown>[]) || [];
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        task.status = status;
        if (result) task.result = result;
        if (taskError) task.error = taskError;
        if (status === 'running') task.started_at = new Date().toISOString();
        if (status === 'complete' || status === 'failed') task.completed_at = new Date().toISOString();
        break;
      }
    }

    // Recompute counts
    const allTasks = (phases || []).flatMap((p) => (p.tasks as Record<string, unknown>[]) || []);
    const completedCount = allTasks.filter((t) => t.status === 'complete').length;
    state.completed_count = completedCount;
    state.progress = allTasks.length > 0 ? (completedCount / allTasks.length) * 100 : 0;
    state.updated_at = new Date().toISOString();
    state.phases = phases;

    await stateManager.saveAsync(state);

    return NextResponse.json({
      success: true,
      taskId,
      newStatus: status,
      progress: state.progress,
      completedTasks: completedCount,
    });
  } catch (err) {
    console.error('[RoadmapState] POST error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
