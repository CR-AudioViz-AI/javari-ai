// app/api/javari/start-roadmap/route.ts
// Purpose: Manual trigger for one autonomous roadmap worker cycle.
//          POST → fetch pending tasks → execute with verification gate → return telemetry.
//          Continuous operation is handled by the Vercel cron on /api/javari/queue
//          (every minute, up to 5 tasks/cycle).
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import { runRoadmapWorker }          from "@/lib/execution/roadmapWorker";
import { createClient }              from "@supabase/supabase-js";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

async function queueSnapshot(): Promise<Record<string, number>> {
  const { data } = await db().from("roadmap_tasks").select("status");
  return (data ?? []).reduce((acc: Record<string, number>, r: { status: string }) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// ── POST — run one worker cycle ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json().catch(() => ({})) as Record<string, unknown>;
    const userId   = (body.userId   as string) ?? "manual";
    const maxTasks = Math.min((body.maxTasks as number) ?? 5, 5);

    const before = await queueSnapshot();
    const result = await runRoadmapWorker(userId, maxTasks);
    const after  = await queueSnapshot();

    return NextResponse.json({
      ok    : result.ok,
      cycle : {
        id          : result.cycleId,
        executed    : result.tasksExecuted,
        completed   : result.tasksCompleted,
        retried     : result.tasksRetried,
        blocked     : result.tasksBlocked,
        stopped     : result.stoppedReason,
        durationMs  : result.durationMs,
        costUsd     : result.totalCostUsd.toFixed(4),
      },
      queue : {
        before,
        after,
        delta: {
          pending  : (after.pending   ?? 0) - (before.pending   ?? 0),
          completed: (after.completed ?? 0) - (before.completed ?? 0),
          verifying: (after.verifying ?? 0) - (before.verifying ?? 0),
          retry    : (after.retry     ?? 0) - (before.retry     ?? 0),
        },
      },
      telemetry: result.telemetry,
    });

  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── GET — queue snapshot (no side effects) ─────────────────────────────────

export async function GET() {
  const counts = await queueSnapshot();
  return NextResponse.json({
    ok      : true,
    endpoint: "/api/javari/start-roadmap",
    purpose : "Manual trigger for roadmap worker. Cron runs automatically via /api/javari/queue every minute.",
    queue   : counts,
    cron    : "*/1 * * * * → /api/javari/queue (every minute, up to 5 tasks per cycle)",
  });
}
