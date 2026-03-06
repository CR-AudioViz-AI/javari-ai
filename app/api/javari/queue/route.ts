// app/api/javari/queue/route.ts
// Purpose: Execution queue API — self-running autonomy loop with cron fallback
// Date: 2026-03-06

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processQueue, getQueueStats } from "@/lib/execution/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Recursion guard ──────────────────────────────────────────────────────────
// Prevents the queue from triggering the cycle endpoint if a cycle call is
// already in flight for this serverless invocation.
let cycleCallInFlight = false;

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Base URL resolution ──────────────────────────────────────────────────────
// Priority order:
// 1. NEXT_PUBLIC_SITE_URL     — explicit override (set in Vercel env if needed)
// 2. NEXT_PUBLIC_JAVARI_API   — e.g. "https://javariai.com/api" → strip "/api"
// 3. VERCEL_URL               — auto-set by Vercel (deployment-specific, no https://)
// 4. localhost fallback
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.NEXT_PUBLIC_JAVARI_API) {
    // Strip trailing "/api" to get the site root
    return process.env.NEXT_PUBLIC_JAVARI_API.replace(/\/api$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

// ─── Shared execution logic ───────────────────────────────────────────────────
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

// ─── Autonomy trigger ─────────────────────────────────────────────────────────
// Called after every queue run. Fires the cycle endpoint when the queue is
// fully drained. Failures are logged and swallowed — never crash the caller.
async function maybeTriggerCycle(): Promise<void> {
  if (cycleCallInFlight) {
    console.log("[queue-api] Cycle call already in flight — skipping");
    return;
  }

  try {
    // Count tasks that are still active
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
      console.log(`[queue-api] ${active} active task(s) remain — cycle not triggered`);
      return;
    }

    cycleCallInFlight = true;
    const baseUrl = getBaseUrl();
    const cycleUrl = `${baseUrl}/api/javari/autonomy/cycle`;
    console.log(`[queue-api] Queue drained — triggering cycle at ${cycleUrl}`);

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
        `[queue-api] Cycle returned HTTP ${response.status}: ${text.slice(0, 200)}`
      );
    } else {
      const result = await response.json();
      console.log("[queue-api] ✅ Autonomy cycle triggered:", {
        action:       result.action,
        tasksCreated: result.tasksCreated ?? 0,
        baseUrl,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[queue-api] Cycle trigger failed (non-fatal):", message);
  } finally {
    cycleCallInFlight = false;
  }
}

// ─── GET — Vercel cron entry point ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const isCron = req.headers.get("x-vercel-cron") === "1";

    if (isCron) {
      const result = await executeQueue(5, "system", true);
      // Fire-and-forget for cron — must respond before 10s Vercel timeout
      void maybeTriggerCycle();
      return NextResponse.json({ ok: true, isCron: true, ...result });
    }

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

    // POST awaits the cycle trigger so callers see the full outcome
    await maybeTriggerCycle();

    return NextResponse.json({ ok: true, isCron: false, ...result });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[queue-api] POST Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
