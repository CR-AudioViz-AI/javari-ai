// app/api/admin/reset-failed/route.ts
// Purpose: One-shot — reset all failed roadmap tasks to pending for retry.
// Date: 2026-03-09
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Read failed tasks first
  const { data: before, error: readErr } = await supabase
    .from("roadmap_tasks")
    .select("id, title, error")
    .eq("status", "failed");

  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });

  // Reset to pending
  const { error: updateErr } = await supabase
    .from("roadmap_tasks")
    .update({ status: "pending", error: null })
    .eq("status", "failed");

  if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    reset: before?.length ?? 0,
    tasks: before?.map(t => ({ id: t.id, title: t.title })) ?? [],
  });
}
