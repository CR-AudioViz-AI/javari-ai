// app/api/javari/queue-cleanup/route.ts
// Purpose: Remove legacy discovery and null-source tasks from roadmap_tasks queue
//          leaving only source='roadmap' tasks. Idempotent.
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Count before
  const { data: before } = await supabase
    .from("roadmap_tasks")
    .select("source, status");

  const beforeCounts: Record<string, number> = {};
  for (const row of (before ?? []) as { source: string | null }[]) {
    const src = row.source ?? "null";
    beforeCounts[src] = (beforeCounts[src] ?? 0) + 1;
  }

  // Delete null source tasks
  const { count: nullDeleted, error: nullErr } = await supabase
    .from("roadmap_tasks")
    .delete({ count: "exact" })
    .is("source", null);

  if (nullErr) {
    return NextResponse.json({ ok: false, error: `null delete failed: ${nullErr.message}` }, { status: 500 });
  }

  // Delete discovery source tasks
  const { count: discoveryDeleted, error: discoveryErr } = await supabase
    .from("roadmap_tasks")
    .delete({ count: "exact" })
    .eq("source", "discovery");

  if (discoveryErr) {
    return NextResponse.json({ ok: false, error: `discovery delete failed: ${discoveryErr.message}` }, { status: 500 });
  }

  // Count after
  const { data: after } = await supabase
    .from("roadmap_tasks")
    .select("source, status");

  const afterCounts: Record<string, number> = {};
  const afterStatus: Record<string, number> = {};
  for (const row of (after ?? []) as { source: string | null; status: string }[]) {
    const src = row.source ?? "null";
    afterCounts[src] = (afterCounts[src] ?? 0) + 1;
    afterStatus[row.status] = (afterStatus[row.status] ?? 0) + 1;
  }

  console.log(`[queue-cleanup] Deleted ${nullDeleted ?? 0} null + ${discoveryDeleted ?? 0} discovery tasks`);
  console.log(`[queue-cleanup] Remaining: ${after?.length ?? 0} roadmap tasks`);

  return NextResponse.json({
    ok: true,
    deleted: {
      null_source: nullDeleted ?? 0,
      discovery: discoveryDeleted ?? 0,
      total: (nullDeleted ?? 0) + (discoveryDeleted ?? 0),
    },
    remaining: {
      total: after?.length ?? 0,
      by_source: afterCounts,
      by_status: afterStatus,
    },
    before_by_source: beforeCounts,
  });
}

export async function GET() {
  // Preview what would be deleted — no writes
  const { data: tasks } = await supabase
    .from("roadmap_tasks")
    .select("id, title, source, status");

  const legacy = (tasks ?? []).filter(
    (t: { source: string | null }) => !t.source || t.source !== "roadmap"
  );
  const roadmap = (tasks ?? []).filter(
    (t: { source: string | null }) => t.source === "roadmap"
  );

  return NextResponse.json({
    ok: true,
    preview: true,
    total: tasks?.length ?? 0,
    would_delete: legacy.length,
    would_keep: roadmap.length,
    legacy_sample: legacy.slice(0, 5).map((t: { id: string; title: string; source: string | null }) => ({
      id: t.id,
      title: t.title,
      source: t.source,
    })),
  });
}
