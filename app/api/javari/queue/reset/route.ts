// app/api/javari/queue/reset/route.ts
// Purpose: Reset failed OR blocked roadmap tasks back to pending for retry.
// Date: 2026-03-07 — updated: also resets blocked tasks

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { data: tasks, error: fetchError } = await supabase
      .from("roadmap_tasks")
      .select("id, title, status")
      .in("status", ["failed", "blocked", "retry"]);

    if (fetchError) throw fetchError;
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ success: true, resetCount: 0, message: "No failed/blocked/retry tasks found", tasks: [] });
    }

    const ids = tasks.map((t: { id: string }) => t.id);
    const { error: updateError } = await supabase
      .from("roadmap_tasks")
      .update({ status: "pending", updated_at: Math.floor(Date.now() / 1000) })
      .in("id", ids);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      resetCount: tasks.length,
      message: `Reset ${tasks.length} task(s) to pending`,
      tasks: tasks.map((t: { id: string; title: string; status: string }) => ({ id: t.id, title: t.title, was: t.status })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("roadmap_tasks")
      .select("id, title, status")
      .in("status", ["failed", "blocked", "retry"]);
    if (error) throw error;
    return NextResponse.json({ success: true, count: data?.length || 0, tasks: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
