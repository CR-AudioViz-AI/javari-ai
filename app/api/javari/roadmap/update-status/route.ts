// app/api/javari/roadmap/update-status/route.ts
// POST /api/javari/roadmap/update-status — manually update task status from dashboard
// 2026-02-19 — TASK-P0-006

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      taskId: string;
      status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped' | 'blocked';
      note?: string;
    };

    const { taskId, status, note } = body;

    if (!taskId || !status) {
      return NextResponse.json({ success: false, error: 'taskId and status required' }, { status: 400 });
    }

    const state = await stateManager.loadAsync('javari-os-v2');
    if (!state) {
      return NextResponse.json({ success: false, error: 'Roadmap not initialized. POST /api/javari/roadmap/activate first.' }, { status: 404 });
    }

    let found = false;
    const phases = (state.phases || []) as Record<string, unknown>[];

    for (const phase of phases) {
      const tasks = ((phase.tasks || []) as Record<string, unknown>[]);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const prev = task.status;
        task.status = status;
        if (note) task.result = note;
        if (status === 'running' && !task.started_at) {
          task.started_at = new Date().toISOString();
        }
        if (status === 'complete' || status === 'failed') {
          task.completed_at = new Date().toISOString();
        }
        console.info(`[UpdateStatus] Task ${taskId}: ${prev} → ${status}`);
        found = true;
        break;
      }
    }

    if (!found) {
      return NextResponse.json({ success: false, error: `Task ${taskId} not found` }, { status: 404 });
    }

    // Recompute progress
    const allTasks = phases.flatMap((p) => ((p.tasks || []) as Record<string, unknown>[]));
    const completedCount = allTasks.filter((t) => t.status === 'complete').length;
    state.completed_count = completedCount;
    state.progress = allTasks.length > 0 ? (completedCount / allTasks.length) * 100 : 0;
    state.updated_at = new Date().toISOString();
    state.phases = phases;

    await stateManager.saveAsync(state);

    return NextResponse.json({
      success: true,
      taskId,
      status,
      progress: Math.round(state.progress as number),
      completedTasks: completedCount,
      totalTasks: allTasks.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
