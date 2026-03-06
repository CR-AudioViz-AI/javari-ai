// app/api/javari/queue/route.ts
// Purpose: Execution queue API — self-running autonomy loop with cron fallback
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processQueue, getQueueStats } from "@/lib/execution/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Recursion guard ──────────────────────────────────────────────────────────
// Prevents the queue from triggering the cycle endpoint if it is already in
// the middle of a cycle call. Module-level flag: lives for the lifetime of
// this serverless function invocation only. Safe for concurrent requests
// because each serverless invocation is isolated.
let cycleCallInFlight = false;

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Base URL resolution (same pattern used by cycle endpoint) ─────────────────
function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

// ─── Shared execution logic ───────────────────────────────────────────────────
async function executeQueue(
  maxTasks: number,
  userId: string,
  isCron: boolean
): Promise<ReturnType<typeof processQueue> extends Promise<infer T> ? T : never> {
  console.log("CRON INVOCATION", {
    timestamp: new Date().toISOString(),
    method: isCron ? "GET (vercel-cron)" : "POST (manual)",
    userId,
    maxTasks,
    isCron,
  });
  return processQueue(maxTasks, userId);
}

// ─── Autonomy trigger ─────────────────────────────────────────────────────────
// Called after every queue run. If the queue is fully drained (no pending or
// in-progress tasks), fires the cycle endpoint so Javari plans new work
// without waiting for the next cron tick. Failures are logged and swallowed —
// they must never crash the queue worker.
async function maybeTriggerCycle(): Promise<void> {
  if (cycleCallInFlight) {
    console.log("[queue-api] Cycle call already in flight — skipping trigger");
    return;
  }

  try {
    // Count tasks that are still active (pending OR in_progress)
    const { count, error } = await supabase
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]);

    if (error) {
      console.error("[queue-api] Failed to count active tasks:", error.message);
      return;
    }

    const active = count ?? 0;

    if (active > 0) {
      console.log(`[queue-api] Queue has ${active} active task(s) — cycle not triggered`);
      return;
    }

    // Queue is fully drained — trigger autonomy cycle
    cycleCallInFlight = true;
    console.log("[queue-api] Queue drained — triggering autonomy cycle");

    const baseUrl = getBaseUrl();
    const cycleUrl = `${baseUrl}/api/javari/autonomy/cycle`;

    const response = await fetch(cycleUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-autonomy": "true",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[queue-api] Cycle endpoint returned HTTP ${response.status}: ${text.slice(0, 200)}`
      );
    } else {
      const result = await response.json();
      console.log("[queue-api] Autonomy cycle triggered:", {
        action: result.action,
        tasksCreated: result.tasksCreated ?? 0,
      });
    }
  } catch (err: unknown) {
    // Never let cycle trigger errors crash the queue response
    const message = err instanceof Error ? err.message : String(err);
    console.error("[queue-api] Cycle trigger failed (non-fatal):", message);
  } finally {
    cycleCallInFlight = false;
  }
}

// ─── GET — Vercel cron entry point ────────────────────────────────────────────
// Vercel sends GET + x-vercel-cron: 1. Without the header, returns stats only.
export async function GET(req: NextRequest) {
  try {
    const isCron = req.headers.get("x-vercel-cron") === "1";

    if (isCron) {
      const result = await executeQueue(5, "system", true);
      // Fire-and-forget: trigger cycle after execution, but do not await
      // it before responding — keeps cron response time under 10s limit.
      void maybeTriggerCycle();
      return NextResponse.json({ ok: true, isCron: true, ...result });
    }

    // Plain GET — stats only, no side effects
    const stats = await getQueueStats();
    return NextResponse.json({ ok: true, isCron: false, stats });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] GET Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ─── POST — Manual trigger ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) body = JSON.parse(text);
    } catch {
      // No body — use defaults
    }

    const maxTasks = typeof body.maxTasks === "number" ? body.maxTasks : 5;
    const userId   = typeof body.userId   === "string"  ? body.userId   : "system";

    const result = await executeQueue(maxTasks, userId, false);

    // For manual POST, await the cycle trigger so callers can see whether
    // a new planning cycle was kicked off in the same response.
    await maybeTriggerCycle();

    return NextResponse.json({ ok: true, isCron: false, ...result });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] POST Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
