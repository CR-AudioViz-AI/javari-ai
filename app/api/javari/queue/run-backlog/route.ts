// app/api/javari/queue/run-backlog/route.ts
// Purpose: Bulk backlog execution endpoint — drains the pending task queue
//          completely by looping POST /api/javari/queue until pending = 0.
//          Called from the Operations Center dashboard "RUN FULL BACKLOG" button.
//          Has a hard timeout of 270s (Vercel Pro limit) and a 500-task safety cap.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
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

async function getPending(): Promise<number> {
  const { count, error } = await db()
    .from("roadmap_tasks")
    .select("*", { count: "exact", head: true })
    .in("status", ["pending", "retry"]);
  return error ? 99 : (count ?? 0);
}

async function runBatch(baseUrl: string): Promise<{
  executed: number; succeeded: number; failed: number;
}> {
  try {
    const res = await fetch(`${baseUrl}/api/javari/queue`, {
      method : "POST",
      headers: { "Content-Type": "application/json", "x-internal-backlog": "true" },
      body   : JSON.stringify({ maxTasks: 5 }),
      signal : AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { executed: 0, succeeded: 0, failed: 1 };
    const d = await res.json() as { executed?: number; succeeded?: number; failed?: number };
    return {
      executed : d.executed  ?? 0,
      succeeded: d.succeeded ?? 0,
      failed   : d.failed    ?? 0,
    };
  } catch {
    return { executed: 0, succeeded: 0, failed: 1 };
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL  ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const startTime      = Date.now();
  const HARD_TIMEOUT   = 260_000;   // 260s — leave 40s buffer for Vercel 300s max
  const MAX_TOTAL_TASKS = 500;

  let totalExecuted  = 0;
  let totalSucceeded = 0;
  let totalFailed    = 0;
  let batches        = 0;
  let stoppedReason  = "queue_empty";

  console.log(`[run-backlog] ▶ Starting backlog drain | baseUrl=${baseUrl}`);

  const initialPending = await getPending();
  console.log(`[run-backlog] Initial pending: ${initialPending}`);

  while (true) {
    // Hard timeout check
    if (Date.now() - startTime > HARD_TIMEOUT) {
      stoppedReason = "timeout";
      console.warn(`[run-backlog] Hard timeout reached after ${batches} batches`);
      break;
    }

    // Safety cap
    if (totalExecuted >= MAX_TOTAL_TASKS) {
      stoppedReason = "task_cap";
      console.warn(`[run-backlog] Task cap ${MAX_TOTAL_TASKS} reached`);
      break;
    }

    const pending = await getPending();
    if (pending === 0) {
      stoppedReason = "queue_empty";
      console.log(`[run-backlog] ✅ Queue empty after ${batches} batches`);
      break;
    }

    const batch = await runBatch(baseUrl);
    batches++;
    totalExecuted  += batch.executed;
    totalSucceeded += batch.succeeded;
    totalFailed    += batch.failed;

    console.log(`[run-backlog] Batch ${batches}: executed=${batch.executed} succeeded=${batch.succeeded} | remaining≈${pending}`);

    // If batch returned 0 executed but there are still pending tasks, something is blocking
    if (batch.executed === 0) {
      console.warn(`[run-backlog] Batch executed 0 tasks — all remaining may be blocked`);
      stoppedReason = "no_progress";
      break;
    }

    // Small delay to avoid hammering the queue
    await new Promise(r => setTimeout(r, 500));
  }

  const finalPending = await getPending();
  const durationMs   = Date.now() - startTime;

  console.log(
    `[run-backlog] ▶ Complete | ` +
    `executed=${totalExecuted} succeeded=${totalSucceeded} failed=${totalFailed} | ` +
    `remaining=${finalPending} | ${durationMs}ms | reason=${stoppedReason}`
  );

  return NextResponse.json({
    ok: true,
    stoppedReason,
    totalExecuted,
    totalSucceeded,
    totalFailed,
    batches,
    initialPending,
    finalPending,
    durationMs,
  });
}

export async function GET(): Promise<NextResponse> {
  const pending = await getPending();
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/javari/queue/run-backlog",
    description: "Drains all pending tasks from the execution queue until empty",
    currentPending: pending,
  });
}
