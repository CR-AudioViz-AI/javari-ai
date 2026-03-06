// app/api/javari/queue/route.ts
// Purpose: Execution queue API — processes pending roadmap tasks via cron (GET) or manual trigger (POST)
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";
import { processQueue, getQueueStats } from "@/lib/execution/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shared execution logic — used by both GET (cron) and POST (manual).
 */
async function executeQueue(maxTasks: number, userId: string, isCron: boolean) {
  console.log("CRON INVOCATION", {
    timestamp: new Date().toISOString(),
    method: isCron ? "GET (vercel-cron)" : "POST (manual)",
    userId,
    maxTasks,
    isCron,
  });
  return processQueue(maxTasks, userId);
}

/**
 * GET /api/javari/queue
 * Vercel cron calls this path with GET + x-vercel-cron: 1 header.
 * When called by cron → execute queue (system tier).
 * When called manually without cron header → return stats only.
 */
export async function GET(req: NextRequest) {
  try {
    const isCron = req.headers.get("x-vercel-cron") === "1";

    if (isCron) {
      // Cron invocation — execute the queue as system
      const result = await executeQueue(5, "system", true);
      return NextResponse.json({ ok: true, isCron: true, ...result });
    }

    // Manual GET — return stats only (no side effects)
    const stats = await getQueueStats();
    return NextResponse.json({ ok: true, isCron: false, stats });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] GET Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/javari/queue
 * Manual trigger — body may specify userId and maxTasks.
 */
export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) body = JSON.parse(text);
    } catch {
      // No body or malformed — treat as cron-style call
    }

    const maxTasks = typeof body.maxTasks === "number" ? body.maxTasks : 5;
    const userId   = typeof body.userId   === "string"  ? body.userId   : "system";

    const result = await executeQueue(maxTasks, userId, false);
    return NextResponse.json({ ok: true, isCron: false, ...result });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] POST Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
