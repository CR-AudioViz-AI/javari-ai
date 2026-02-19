// app/api/javari/roadmap/update-status/route.ts
// POST /api/javari/roadmap/update-status — update task status in javari_tasks
// Uses same-key pattern for Supabase headers (RLS bypass with service_role)
// 2026-02-19 — TASK-P0-006 v2

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function supaHeaders() {
  return {
    apikey: SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

const VALID_STATUSES = ['pending', 'running', 'complete', 'failed', 'skipped', 'blocked', 'in-progress'];

export async function POST(req: NextRequest) {
  try {
    const { taskId, status, note } = await req.json() as {
      taskId: string;
      status: string;
      note?: string;
    };

    if (!taskId || !status) {
      return NextResponse.json({ success: false, error: 'taskId and status required' }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    if (!SUPA_URL || !SUPA_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    // Build update payload
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (note) update.result = note;
    if (status === 'running' || status === 'in-progress') update.started_at = new Date().toISOString();
    if (status === 'complete' || status === 'failed') update.completed_at = new Date().toISOString();

    // Patch the task
    const patchRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?id=eq.${encodeURIComponent(taskId)}&roadmap_id=eq.javari-os-v2`,
      { method: 'PATCH', headers: supaHeaders(), body: JSON.stringify(update) }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return NextResponse.json({ success: false, error: `DB error (${patchRes.status}): ${errText.slice(0, 150)}` }, { status: 500 });
    }

    const updated = await patchRes.json() as Record<string, unknown>[];
    if (!updated || updated.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Task '${taskId}' not found in roadmap javari-os-v2`,
      }, { status: 404 });
    }

    // Recompute aggregate progress
    const allRes = await fetch(
      `${SUPA_URL}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&select=id,status`,
      { headers: supaHeaders() }
    );
    const allTasks = allRes.ok ? (await allRes.json() as Record<string, unknown>[]) : [];
    const completedCount = allTasks.filter((t) => t.status === 'complete').length;
    const progress = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

    // Update roadmap-level progress
    await fetch(
      `${SUPA_URL}/rest/v1/javari_roadmaps?id=eq.javari-os-v2`,
      {
        method: 'PATCH',
        headers: { ...supaHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          completed_count: completedCount,
          progress,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    return NextResponse.json({
      success: true,
      taskId,
      status,
      progress,
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
