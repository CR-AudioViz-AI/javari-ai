// app/api/javari/roadmap/update-status/route.ts
// POST /api/javari/roadmap/update-status — update task status directly in javari_tasks
// 2026-02-19 — TASK-P0-006 (fixed to use javari_tasks table directly)

import { NextRequest, NextResponse } from 'next/server';

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

    const validStatuses = ['pending', 'running', 'complete', 'failed', 'skipped', 'blocked'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 });
    }

    const { url, headers } = supabaseHeaders();

    const updateBody: Record<string, unknown> = { status };
    if (note) updateBody.result = note;
    if (status === 'running') updateBody.started_at = new Date().toISOString();
    if (status === 'complete' || status === 'failed') {
      updateBody.completed_at = new Date().toISOString();
    }
    updateBody.updated_at = new Date().toISOString();

    // Update the task
    const res = await fetch(
      `${url}/rest/v1/javari_tasks?id=eq.${taskId}&roadmap_id=eq.javari-os-v2`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(updateBody),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ success: false, error: `DB error: ${errText.slice(0, 150)}` }, { status: 500 });
    }

    const updated = await res.json() as Record<string, unknown>[];
    if (!updated || updated.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Task ${taskId} not found in roadmap javari-os-v2`,
      }, { status: 404 });
    }

    // Get updated counts
    const countRes = await fetch(
      `${url}/rest/v1/javari_tasks?roadmap_id=eq.javari-os-v2&select=id,status`,
      { headers }
    );
    const allTasks = countRes.ok ? await countRes.json() as Record<string, unknown>[] : [];
    const completedCount = allTasks.filter((t) => t.status === 'complete').length;
    const progress = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

    // Update roadmap progress
    await fetch(
      `${url}/rest/v1/javari_roadmaps?id=eq.javari-os-v2`,
      {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ completed_count: completedCount, progress, updated_at: new Date().toISOString() }),
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
