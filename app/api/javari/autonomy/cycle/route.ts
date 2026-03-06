// app/api/javari/autonomy/cycle/route.ts
// Purpose: Autonomous cycle scheduler — triggers planner when queue drains to zero pending tasks
// Date: 2026-03-06

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_GOAL =
  "Improve Javari AI system performance, cost efficiency, and reliability. " +
  "Identify and address the highest-impact bottlenecks in the current platform.";

async function runCycle() {
  const { count, error: countError } = await supabase
    .from("roadmap_tasks")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (countError) throw new Error(`Failed to query pending tasks: ${countError.message}`);

  const pending = count ?? 0;

  if (pending > 0) {
    console.log(`[autonomy/cycle] ${pending} tasks still pending — skipping planner`);
    return { action: "skipped", reason: "tasks still pending", pending };
  }

  console.log("[autonomy/cycle] Queue is empty — starting new autonomy cycle");

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const plannerUrl = `${baseUrl}/api/javari/planner`;

  const plannerResponse = await fetch(plannerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal: DEFAULT_GOAL }),
  });

  if (!plannerResponse.ok) {
    const errText = await plannerResponse.text();
    throw new Error(`Planner returned HTTP ${plannerResponse.status}: ${errText.slice(0, 200)}`);
  }

  const plannerResult = await plannerResponse.json();
  if (!plannerResult.success) throw new Error(`Planner failed: ${plannerResult.error ?? "unknown error"}`);

  console.log(`[autonomy/cycle] ✅ New cycle started — ${plannerResult.created} tasks created`);

  return {
    action: "cycle_started",
    goal: DEFAULT_GOAL,
    tasksCreated: plannerResult.created,
    model: plannerResult.model,
    tasks: plannerResult.tasks,
  };
}

/**
 * GET /api/javari/autonomy/cycle
 * Vercel cron calls this with GET + x-vercel-cron: 1.
 * When called by cron → run cycle logic.
 * When called manually without cron header → return status only.
 */
export async function GET(req: NextRequest) {
  try {
    const isCron = req.headers.get("x-vercel-cron") === "1";

    console.log("CRON INVOCATION [cycle]", {
      timestamp: new Date().toISOString(),
      method: isCron ? "GET (vercel-cron)" : "GET (status check)",
      isCron,
    });

    if (isCron) {
      const result = await runCycle();
      return NextResponse.json({ ok: true, isCron: true, ...result });
    }

    // Manual status check — no side effects
    const { data: tasks, error } = await supabase.from("roadmap_tasks").select("status");
    if (error) throw new Error(error.message);

    const counts = (tasks ?? []).reduce((acc: Record<string, number>, t: { status: string }) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      cycleReady: (counts["pending"] ?? 0) === 0,
      pending:   counts["pending"]   ?? 0,
      completed: counts["completed"] ?? 0,
      failed:    counts["failed"]    ?? 0,
      total:     tasks?.length ?? 0,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[autonomy/cycle] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/javari/autonomy/cycle
 * Manual trigger — always runs cycle regardless of cron header.
 */
export async function POST() {
  try {
    const result = await runCycle();
    return NextResponse.json({ ok: true, isCron: false, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[autonomy/cycle] POST Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
