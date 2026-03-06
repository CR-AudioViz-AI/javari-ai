// app/api/javari/queue/route.ts
// Purpose: Execution queue API — processes pending roadmap tasks via cron or manual trigger
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";
import { processQueue, getQueueStats } from "@/lib/execution/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/javari/queue
 * Process the execution queue.
 *
 * Called by:
 *   - Vercel cron (no body) → defaults to system tier
 *   - Manual trigger       → body may override userId and maxTasks
 */
export async function POST(req: NextRequest) {
  try {
    // Cron jobs send POST with no body — req.json() throws on empty body.
    // Safe-parse: fall back to empty object if body is missing or unparseable.
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or malformed — treat as cron call, use defaults
    }

    // Default userId to "system" so cron calls get the $10 system tier,
    // not the $1 free tier which causes silent skips on expensive tasks.
    const maxTasks = typeof body.maxTasks === "number" ? body.maxTasks : 5;
    const userId   = typeof body.userId   === "string"  ? body.userId   : "system";

    console.log(`[queue-api] POST — userId: ${userId}, maxTasks: ${maxTasks}`);

    const result = await processQueue(maxTasks, userId);

    return NextResponse.json({
      ok: true,
      ...result,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] Error:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/queue
 * Return current queue statistics without executing anything.
 */
export async function GET(_req: NextRequest) {
  try {
    const stats = await getQueueStats();

    return NextResponse.json({
      ok: true,
      stats,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] Error:", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
