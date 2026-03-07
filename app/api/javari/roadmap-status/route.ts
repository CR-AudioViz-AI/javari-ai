// app/api/javari/roadmap-status/route.ts
// Purpose: Real-time roadmap execution dashboard endpoint.
//          Returns full queue health, lifecycle breakdown, recent task activity,
//          artifact proof counts, worker telemetry, and verification gate stats.
//          Read-only. Safe to call at any frequency.
// Date: 2026-03-07

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface TaskRow {
  id         : string;
  title      : string;
  description: string;
  status     : string;
  source?    : string;
  result?    : string;
  error?     : string;
  updated_at : number | string;
}

interface ArtifactRow {
  task_id      : string;
  artifact_type: string;
  created_at   : number;
}

interface ExecLogRow {
  execution_id  : string;
  task_id       : string;
  model_used    : string;
  cost          : number;
  execution_time: number;
  status        : string;
  timestamp     : string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function taskType(description: string): string {
  return description?.match(/\[type:([^\]]+)\]/)?.[1] ?? "ai_task";
}

function taskPriority(description: string): number {
  const m = description?.match(/\[priority:(\d+)\]/);
  return m ? parseInt(m[1]) : 5;
}

function retryCount(result: string | undefined): number {
  const m = result?.match(/^\[retry:(\d+)\]/);
  return m ? parseInt(m[1]) : 0;
}

function relativeTime(epochMs: number): string {
  const diffS = Math.floor((Date.now() - epochMs) / 1000);
  if (diffS < 60)   return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`;
  return `${Math.floor(diffS / 86400)}d ago`;
}

// ── GET /api/javari/roadmap-status ─────────────────────────────────────────

export async function GET() {
  const start  = Date.now();
  const client = db();

  try {
    // ── 1. All roadmap tasks ──────────────────────────────────────────────
    const { data: tasks, error: tasksErr } = await client
      .from("roadmap_tasks")
      .select("id, title, description, status, source, result, error, updated_at")
      .order("updated_at", { ascending: false });

    if (tasksErr) throw new Error(`roadmap_tasks: ${tasksErr.message}`);
    const allTasks = (tasks ?? []) as TaskRow[];

    // ── 2. Lifecycle counts ───────────────────────────────────────────────
    const counts: Record<string, number> = {};
    for (const t of allTasks) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }

    const total      = allTasks.length;
    const pending    = counts.pending    ?? 0;
    const inProgress = counts.in_progress ?? 0;
    const verifying  = counts.verifying  ?? 0;
    const completed  = counts.completed  ?? 0;
    const retry      = counts.retry      ?? 0;
    const blocked    = counts.blocked    ?? 0;
    const failed     = counts.failed     ?? 0;

    // ── 3. Progress metrics ───────────────────────────────────────────────
    const done       = completed;
    const remaining  = total - done;
    const pct        = total > 0 ? Math.round((done / total) * 100) : 0;

    // ── 4. Task type breakdown ────────────────────────────────────────────
    const byType: Record<string, { total: number; completed: number; pending: number; retry: number }> = {};
    for (const t of allTasks) {
      const type = taskType(t.description);
      if (!byType[type]) byType[type] = { total: 0, completed: 0, pending: 0, retry: 0 };
      byType[type].total++;
      if (t.status === "completed")    byType[type].completed++;
      else if (t.status === "pending") byType[type].pending++;
      else if (t.status === "retry")   byType[type].retry++;
    }

    // ── 5. Recent activity — last 10 updated tasks ────────────────────────
    const recentActivity = allTasks.slice(0, 10).map(t => {
      const ts = typeof t.updated_at === "number"
        ? (t.updated_at > 1e12 ? t.updated_at : t.updated_at * 1000)  // handle both ms and s
        : new Date(t.updated_at).getTime();
      return {
        id        : t.id,
        title     : t.title?.slice(0, 60) ?? "",
        type      : taskType(t.description),
        status    : t.status,
        retries   : retryCount(t.result),
        failReason: t.error ? t.error.slice(0, 120) : undefined,
        updatedAt : relativeTime(ts),
      };
    });

    // ── 6. Blocked tasks detail ───────────────────────────────────────────
    const blockedTasks = allTasks
      .filter(t => t.status === "blocked")
      .map(t => ({
        id       : t.id,
        title    : t.title?.slice(0, 60) ?? "",
        type     : taskType(t.description),
        reason   : t.result?.replace(/^\[retry:\d+\]\s*/, "") ?? t.error ?? "unknown",
        retries  : retryCount(t.result),
      }));

    // ── 7. Artifact counts ─────────────────────────────────────────────────
    let artifactStats: {
      total: number;
      byType: Record<string, number>;
      tasksWithProof: number;
    } = { total: 0, byType: {}, tasksWithProof: 0 };

    try {
      const { data: arts } = await client
        .from("roadmap_task_artifacts")
        .select("task_id, artifact_type, created_at");

      if (arts) {
        const artsRows = arts as ArtifactRow[];
        const taskIdsWithArt = new Set(artsRows.map(a => a.task_id));
        const artByType: Record<string, number> = {};
        for (const a of artsRows) {
          artByType[a.artifact_type] = (artByType[a.artifact_type] ?? 0) + 1;
        }
        artifactStats = {
          total         : artsRows.length,
          byType        : artByType,
          tasksWithProof: taskIdsWithArt.size,
        };
      }
    } catch { /* artifacts table may not be accessible yet */ }

    // ── 8. Worker telemetry — last 5 cycle logs ────────────────────────────
    let workerCycles: Array<{
      cycleId: string; executedAt: string;
      executed: number; cost: string; durationMs: number; status: string;
    }> = [];

    try {
      const { data: logs } = await client
        .from("javari_execution_logs")
        .select("execution_id, task_id, model_used, cost, execution_time, status, timestamp")
        .like("task_id", "cycle:%")
        .order("timestamp", { ascending: false })
        .limit(5);

      if (logs) {
        workerCycles = (logs as ExecLogRow[]).map(l => ({
          cycleId   : l.execution_id,
          executedAt: l.timestamp,
          executed  : 0,  // stored in cycle telemetry, not in this log row
          cost      : `$${(l.cost ?? 0).toFixed(4)}`,
          durationMs: l.execution_time ?? 0,
          status    : l.status,
        }));
      }
    } catch { /* non-critical */ }

    // ── 9. Verification gate stats ─────────────────────────────────────────
    const verificationStats = {
      tasksVerified  : completed,
      tasksRetrying  : retry,
      tasksBlocked   : blocked,
      artifactsCoverage: total > 0
        ? `${Math.round((artifactStats.tasksWithProof / total) * 100)}%`
        : "0%",
      gateEnforced: true,
      falseCompletionsBlocked: retry + blocked,
    };

    // ── 10. Cron schedule ──────────────────────────────────────────────────
    const cronSchedule = [
      { path: "/api/javari/queue",         schedule: "*/1 * * * *", description: "Main executor — up to 5 tasks/cycle" },
      { path: "/api/javari/start-roadmap", schedule: "*/2 * * * *", description: "Worker trigger — verified lifecycle" },
      { path: "/api/javari/autonomy/cycle",schedule: "*/3 * * * *", description: "Planner — seeds new tasks when queue drains" },
    ];

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json({
      ok         : true,
      generatedAt: new Date().toISOString(),
      queryMs    : Date.now() - start,

      // ── Progress ─────────────────────────────────────────────────────────
      progress: {
        total,
        completed,
        remaining,
        percentComplete: `${pct}%`,
        queueHealthy   : blocked === 0 && inProgress + verifying < 10,
      },

      // ── Lifecycle counts ──────────────────────────────────────────────────
      lifecycle: {
        pending,
        in_progress: inProgress,
        verifying,
        completed,
        retry,
        blocked,
        failed,
        total,
      },

      // ── Type breakdown ────────────────────────────────────────────────────
      byType,

      // ── Verification gate ─────────────────────────────────────────────────
      verificationGate: verificationStats,

      // ── Artifacts ─────────────────────────────────────────────────────────
      artifacts: artifactStats,

      // ── Recent activity ───────────────────────────────────────────────────
      recentActivity,

      // ── Blocked tasks ─────────────────────────────────────────────────────
      blockedTasks,

      // ── Worker cycles ─────────────────────────────────────────────────────
      workerCycles,

      // ── Cron schedule ─────────────────────────────────────────────────────
      cronSchedule,
    });

  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), queryMs: Date.now() - start },
      { status: 500 }
    );
  }
}
