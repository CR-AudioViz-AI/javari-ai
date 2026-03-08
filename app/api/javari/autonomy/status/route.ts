// app/api/javari/autonomy/status/route.ts
// Purpose: Autonomy status endpoint — returns current platform state including
//          active targets, last cycle, task counts, and recent cycle history.
// Date: 2026-03-07
//
// GET /api/javari/autonomy/status

import { NextResponse }    from "next/server";
import { createClient }    from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

export async function GET(): Promise<NextResponse> {
  try {
    // Fetch in parallel
    const [targetsResult, taskCountResult, cyclesResult] = await Promise.all([
      // Active targets
      db().from("javari_targets")
        .select("id, name, type, location, last_scan, status, scan_interval")
        .eq("status", "active")
        .order("created_at"),

      // Task counts by source + status
      db().from("roadmap_tasks")
        .select("status, source")
        .in("source", ["scheduler", "intelligence", "discovery"]),

      // Last 5 engineering cycles
      db().from("javari_engineering_cycles")
        .select("cycle_id, started_at, completed_at, targets_processed, total_issues, total_repair_tasks, gate_results, duration_ms")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

    // Process task counts
    const taskRows   = taskCountResult.data ?? [];
    const taskCounts = {
      pending    : taskRows.filter(r => r.status === "pending").length,
      in_progress: taskRows.filter(r => r.status === "in_progress").length,
      completed  : taskRows.filter(r => r.status === "completed").length,
      failed     : taskRows.filter(r => r.status === "failed").length,
    };

    const cycles    = cyclesResult.data ?? [];
    const lastCycle = cycles[0] ?? null;

    // Active targets — flag which are due for scan
    const now           = Date.now();
    const activeTargets = (targetsResult.data ?? []).map((t: Record<string, unknown>) => {
      const lastScan    = t.last_scan ? new Date(String(t.last_scan)).getTime() : 0;
      const interval    = Number(t.scan_interval ?? 720) * 60 * 1000; // ms
      const dueInMs     = lastScan ? Math.max(0, (lastScan + interval) - now) : 0;
      return {
        id          : t.id,
        name        : t.name,
        type        : t.type,
        location    : t.location,
        lastScan    : t.last_scan ?? null,
        status      : t.status,
        scanInterval: t.scan_interval,
        dueForScan  : dueInMs === 0,
        dueInMinutes: Math.round(dueInMs / 60_000),
      };
    });

    return NextResponse.json({
      ok             : true,
      timestamp      : new Date().toISOString(),
      activeTargets,
      lastCycle      : lastCycle ? {
        cycleId         : lastCycle.cycle_id,
        startedAt       : lastCycle.started_at,
        completedAt     : lastCycle.completed_at,
        targetsProcessed: lastCycle.targets_processed,
        totalIssues     : lastCycle.total_issues,
        totalRepairTasks: lastCycle.total_repair_tasks,
        gateResults     : lastCycle.gate_results,
        durationMs      : lastCycle.duration_ms,
      } : null,
      taskCounts,
      tasksGenerated: taskCounts.pending + taskCounts.in_progress + taskCounts.completed,
      tasksCompleted: taskCounts.completed,
      recentCycles  : cycles.map(c => ({
        cycleId    : c.cycle_id,
        startedAt  : c.started_at,
        durationMs : c.duration_ms,
        issues     : c.total_issues,
        repairs    : c.total_repair_tasks,
      })),
    });

  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
