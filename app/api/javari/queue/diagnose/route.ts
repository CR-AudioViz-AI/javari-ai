// app/api/javari/queue/diagnose/route.ts
// Purpose: One-shot diagnostic — show pending task + dependency resolution status
// Date: 2026-03-06

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Step 1: Get all pending tasks with their depends_on arrays
    const { data: pendingTasks, error: pendingError } = await supabase
      .from("roadmap_tasks")
      .select("id, title, status, depends_on")
      .eq("status", "pending");

    if (pendingError) throw pendingError;

    if (!pendingTasks || pendingTasks.length === 0) {
      return NextResponse.json({ pendingCount: 0, tasks: [] });
    }

    // Step 2: For each pending task, resolve its dependency statuses
    const results = [];

    for (const task of pendingTasks) {
      const depIds: string[] = task.depends_on ?? [];

      let dependencies: { id: string; status: string; exists: boolean }[] = [];

      if (depIds.length > 0) {
        const { data: depTasks, error: depError } = await supabase
          .from("roadmap_tasks")
          .select("id, status")
          .in("id", depIds);

        if (depError) throw depError;

        const foundIds = new Set((depTasks || []).map((t: { id: string }) => t.id));

        dependencies = depIds.map((depId) => {
          const found = (depTasks || []).find((t: { id: string; status: string }) => t.id === depId);
          return {
            id: depId,
            status: found?.status ?? null,
            exists: foundIds.has(depId),
          };
        });
      }

      const blockedBy = dependencies.filter(
        (d) => d.status !== "completed" || !d.exists
      );

      results.push({
        id: task.id,
        title: task.title,
        status: task.status,
        dependencyCount: depIds.length,
        dependencies,
        blockedBy,
        executable: blockedBy.length === 0,
      });
    }

    // Step 3: Full table summary for context
    const { data: allTasks, error: allError } = await supabase
      .from("roadmap_tasks")
      .select("id, status");

    if (allError) throw allError;

    const summary = (allTasks || []).reduce(
      (acc: Record<string, number>, t: { status: string }) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      pendingCount: pendingTasks.length,
      tasks: results,
      tableSummary: summary,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[queue/diagnose] ❌", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
