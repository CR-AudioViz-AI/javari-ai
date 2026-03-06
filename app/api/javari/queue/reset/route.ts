// app/api/javari/queue/reset/route.ts
// Purpose: Self-healing reset endpoint — moves failed roadmap tasks back to pending for retry
// Date: 2026-03-06

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
    // Fetch failed task IDs first so we can return them in the response
    const { data: failedTasks, error: fetchError } = await supabase
      .from("roadmap_tasks")
      .select("id, title")
      .eq("status", "failed");

    if (fetchError) {
      throw fetchError;
    }

    if (!failedTasks || failedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        resetCount: 0,
        message: "No failed tasks found — nothing to reset",
        tasks: [],
      });
    }

    // Reset all failed tasks to pending
    const { error: updateError } = await supabase
      .from("roadmap_tasks")
      .update({
        status: "pending",
        updated_at: Math.floor(Date.now() / 1000),
      })
      .eq("status", "failed");

    if (updateError) {
      throw updateError;
    }

    console.log(`[queue/reset] ✅ Reset ${failedTasks.length} failed tasks to pending`);
    failedTasks.forEach(t => console.log(`[queue/reset]  → ${t.id}: ${t.title}`));

    return NextResponse.json({
      success: true,
      resetCount: failedTasks.length,
      message: `Reset ${failedTasks.length} failed task(s) to pending`,
      tasks: failedTasks.map(t => ({ id: t.id, title: t.title })),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[queue/reset] ❌ Error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

// GET — status check, shows current failed task count without modifying anything
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("roadmap_tasks")
      .select("id, title, status")
      .eq("status", "failed");

    if (error) throw error;

    return NextResponse.json({
      success: true,
      failedCount: data?.length || 0,
      tasks: data || [],
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
