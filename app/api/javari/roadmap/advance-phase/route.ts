// app/api/javari/roadmap/advance-phase/route.ts
// POST /api/javari/roadmap/advance-phase — advance to next phase when exit criteria met
// 2026-02-19 — TASK-P0-006

import { NextRequest, NextResponse } from 'next/server';
import { stateManager } from '@/lib/roadmap-engine/roadmap-state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { phaseId: string; force?: boolean };
    const { phaseId, force = false } = body;

    if (!phaseId) {
      return NextResponse.json({ success: false, error: 'phaseId required' }, { status: 400 });
    }

    const state = await stateManager.loadAsync('javari-os-v2');
    if (!state) {
      return NextResponse.json({ success: false, error: 'Roadmap not initialized' }, { status: 404 });
    }

    const phases = (state.phases || []) as Record<string, unknown>[];
    const phaseIdx = phases.findIndex((p) => p.id === phaseId);

    if (phaseIdx === -1) {
      return NextResponse.json({ success: false, error: `Phase ${phaseId} not found` }, { status: 404 });
    }

    const phase = phases[phaseIdx];
    const tasks = ((phase.tasks || []) as Record<string, unknown>[]);
    const incompleteCritical = tasks.filter(
      (t) => t.priority === 'critical' && t.status !== 'complete'
    );

    if (!force && incompleteCritical.length > 0) {
      return NextResponse.json({
        success: false,
        blocked: true,
        reason: `${incompleteCritical.length} critical task(s) incomplete`,
        incompleteCritical: incompleteCritical.map((t) => ({ id: t.id, title: t.title })),
        tip: 'Use force:true to override',
      });
    }

    // Mark current phase complete
    phase.status = 'complete';
    phase.completed_at = new Date().toISOString();

    // Activate next phase
    let nextPhase: Record<string, unknown> | null = null;
    if (phaseIdx + 1 < phases.length) {
      nextPhase = phases[phaseIdx + 1];
      nextPhase.status = 'active';
      nextPhase.started_at = new Date().toISOString();
    }

    state.phases = phases;
    state.updated_at = new Date().toISOString();

    await stateManager.saveAsync(state);

    return NextResponse.json({
      success: true,
      completedPhase: phaseId,
      nextPhase: nextPhase ? { id: nextPhase.id, name: nextPhase.name } : null,
      message: nextPhase
        ? `Phase ${phaseId} complete. Now executing: ${nextPhase.name}`
        : 'All phases complete. Roadmap finished.',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
