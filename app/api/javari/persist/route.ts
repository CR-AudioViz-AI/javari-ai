// app/api/javari/persist/route.ts
// Purpose: Persistence layer API — stats, stall recovery, checkpoint inspection
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import {
  recoverStalledTasks,
  getPersistenceStats,
  readCheckpoint,
  PERSISTENCE_VERSION,
} from "@/lib/execution/persistence";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("task_id");

  if (taskId) {
    // Return checkpoint for specific task
    const checkpoint = await readCheckpoint(taskId);
    return NextResponse.json({
      ok: true,
      task_id: taskId,
      checkpoint,
      has_checkpoint: checkpoint !== null,
    });
  }

  // Return overall persistence stats
  const stats = await getPersistenceStats();

  // Also count tasks by status
  const { data: tasks } = await supabase
    .from("roadmap_tasks")
    .select("status");

  const statusCounts: Record<string, number> = {};
  for (const t of (tasks ?? []) as { status: string }[]) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    persistence_version: PERSISTENCE_VERSION,
    checkpoints: stats,
    queue: statusCounts,
  });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "recover") {
    const result = await recoverStalledTasks();
    return NextResponse.json({
      ok: true,
      action: "recover",
      result,
      message:
        result.recovered.length > 0
          ? `Recovered ${result.recovered.length} stalled task(s)`
          : "No stalled tasks found",
    });
  }

  return NextResponse.json({ ok: false, error: "Unknown action. Use ?action=recover" }, { status: 400 });
}
