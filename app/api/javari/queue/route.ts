// app/api/javari/queue/route.ts
// Purpose: Execution queue API — delegates all task execution to the orchestrator.
//          No local worker. No local batch size. Orchestrator owns execution.
// Date: 2026-03-09

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Base URL resolution ──────────────────────────────────────────────────────
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL)   return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_JAVARI_API) return process.env.NEXT_PUBLIC_JAVARI_API.replace(/\/api$/, "");
  if (process.env.VERCEL_URL)             return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// ─── Delegate to orchestrator ─────────────────────────────────────────────────
// Single execution path for both GET (cron) and POST (manual).
// Orchestrator owns batch size (currently 20) and task lifecycle.
async function delegateToOrchestrator(): Promise<{
  status      : string;
  delegated_to: string;
  orchestrator: unknown;
}> {
  const baseUrl = getBaseUrl();
  const orchUrl = `${baseUrl}/api/javari/orchestrator/run`;

  const res = await fetch(orchUrl, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ mode: "roadmap_execution" }),
    signal : AbortSignal.timeout(270_000), // 4.5 min — stays inside Vercel 5-min limit
  });

  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));

  return {
    status      : "worker dispatched",
    delegated_to: "orchestrator",
    orchestrator: data,
  };
}

// ─── Autonomy trigger ─────────────────────────────────────────────────────────
// After every execution cycle: if queue is empty, fire the planner to refill it.
// Fire-and-forget — never blocks the response.
async function maybeTriggerCycle(): Promise<void> {
  try {
    const { count, error } = await supabase
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"]);

    if (error || (count ?? 0) > 0) return;

    const baseUrl = getBaseUrl();
    console.log("[queue-api] Queue drained — triggering autonomy cycle");
    await fetch(`${baseUrl}/api/javari/autonomy/cycle`, {
      method : "POST",
      headers: { "Content-Type": "application/json", "x-internal-autonomy": "true" },
    }).catch((e: unknown) => console.error("[queue-api] Cycle trigger failed:", e));
  } catch (err: unknown) {
    console.error("[queue-api] maybeTriggerCycle error:", err instanceof Error ? err.message : String(err));
  }
}

// ─── GET — Vercel cron entry point ────────────────────────────────────────────
// Cron fires every minute. Delegates to orchestrator — no local execution.
export async function GET(req: NextRequest) {
  const isCron = req.headers.get("x-vercel-cron") === "1";

  if (!isCron) {
    // Non-cron GET returns queue status only — no side effects
    try {
      const { data } = await supabase
        .from("roadmap_tasks")
        .select("status");
      const counts = (data ?? []).reduce((acc: Record<string, number>, r: { status: string }) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      return NextResponse.json({ ok: true, isCron: false, queue: counts });
    } catch (err: unknown) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  // Cron path — delegate, then optionally trigger cycle (fire-and-forget)
  try {
    const result = await delegateToOrchestrator();
    void maybeTriggerCycle();
    return NextResponse.json({ ok: true, isCron: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[queue-api] GET cron error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ─── POST — Manual trigger ────────────────────────────────────────────────────
export async function POST() {
  try {
    const result = await delegateToOrchestrator();
    await maybeTriggerCycle();
    return NextResponse.json({ ok: true, isCron: false, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[queue-api] POST error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
