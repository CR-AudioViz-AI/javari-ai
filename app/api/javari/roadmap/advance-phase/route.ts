// app/api/javari/roadmap/advance-phase/route.ts
// POST /api/javari/roadmap/advance-phase — advance to next phase when criteria met
// 2026-02-19 — TASK-P0-006 v2

import { NextRequest, NextResponse } from 'next/server';
import { JAVARI_CANONICAL_ROADMAP } from '@/lib/javari/roadmap/canonical-roadmap';

export const dynamic = 'force-dynamic';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function supaHeaders() {
  return {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

export async function POST(req: NextRequest) {
  try {
    const { phaseId, force = false } = await req.json() as { phaseId: string; force?: boolean };

    if (!phaseId) {
      return NextResponse.json({ success: false, error: 'phaseId required' }, { status: 400 });
    }

    if (!SUPA_URL || !SUPA_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const canonical = JAVARI_CANONICAL_ROADMAP;
    const phases = canonical.phases;
    const phaseIdx = phases.findIndex((p) => p.id === phaseId);

    if (phaseIdx === -1) {
      return NextResponse.json({ success: false, error: `Phase '${phaseId}' not in canonical roadmap` }, { status: 404 });
    }

    // Load live tasks for this phase
    const tasksRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&phase_id=eq.${phaseId}&select=id,title,status,priority`,
      { headers: { ...supaHeaders(), Prefer: 'return=representation' } }
    );

    const phaseTasks = tasksRes.ok ? (await tasksRes.json() as Record<string, unknown>[]) : [];

    // Check exit criteria: all critical tasks must be complete (unless force=true)
    const incompleteCritical = phaseTasks.filter(
      (t) => t.priority === 'critical' && t.status !== 'complete'
    );

    if (!force && incompleteCritical.length > 0) {
      return NextResponse.json({
        success: false,
        blocked: true,
        reason: `${incompleteCritical.length} critical task(s) incomplete in ${phaseId}`,
        incompleteCritical: incompleteCritical.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        tip: 'Pass force:true to override (not recommended)',
      });
    }

    // Mark current phase tasks as complete if forced
    if (force && incompleteCritical.length > 0) {
      await fetch(
        `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&phase_id=eq.${phaseId}&status=not.eq.complete`,
        {
          method: 'PATCH',
          headers: supaHeaders(),
          body: JSON.stringify({ status: 'skipped', completed_at: new Date().toISOString() }),
        }
      );
    }

    // Determine next phase
    const nextPhase = phaseIdx + 1 < phases.length ? phases[phaseIdx + 1] : null;

    // Mark next phase tasks as pending (activate)
    if (nextPhase) {
      await fetch(
        `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&phase_id=eq.${nextPhase.id}`,
        {
          method: 'PATCH',
          headers: supaHeaders(),
          body: JSON.stringify({ updated_at: new Date().toISOString() }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      completedPhase: phaseId,
      phaseName: phases[phaseIdx].name,
      nextPhase: nextPhase ? { id: nextPhase.id, name: nextPhase.name } : null,
      message: nextPhase
        ? `Phase ${phaseId} complete. Now active: ${nextPhase.name}`
        : 'All phases complete. Roadmap complete! 🎉',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
