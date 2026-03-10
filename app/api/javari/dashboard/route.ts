// app/api/javari/dashboard/route.ts
// Purpose: Mission Control data aggregation API.
//          Aggregates roadmap progress, category breakdown, execution rate,
//          artifact counts, and worker telemetry from Supabase.
//          Read-only. Safe to call at any frequency (5s polling from dashboard).
// Date: 2026-03-10

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskRow {
  id:         string;
  title:      string;
  phase_id:   string | null;
  status:     string;
  source:     string | null;
  updated_at: number | string | null;
}

interface ArtifactRow {
  artifact_type: string;
}

interface ExecLogRow {
  execution_id  : string;
  task_id       : string;
  model_used    : string | null;
  cost          : number | null;
  execution_time: number | null;
  status        : string | null;
  timestamp     : string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toEpochMs(val: number | string | null): number {
  if (!val) return 0;
  if (typeof val === "number") return val > 1e12 ? val : val * 1000;
  return new Date(val).getTime();
}

function relativeTime(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CATEGORY_LABELS: Record<string, string> = {
  ai_marketplace:         "AI Marketplace",
  creator_monetization:   "Creator Monetization",
  multi_ai_team_mode:     "Multi-AI Team Mode",
  craiverse_modules:      "CRAIverse Modules",
  enterprise_integrations:"Enterprise Integrations",
  community_systems:      "Community Systems",
  autonomous_deployment:  "Autonomous Deployment",
  platform_scaling:       "Platform Scaling",
  security_infrastructure:"Security Infrastructure",
  global_payments:        "Global Payments",
};

// ── GET /api/javari/dashboard ─────────────────────────────────────────────────

export async function GET() {
  const t0     = Date.now();
  const client = db();

  try {
    // ── 1. All tasks (phase_id, status, updated_at) ──────────────────────────
    const { data: tasks, error: tasksErr } = await client
      .from("roadmap_tasks")
      .select("id, title, phase_id, status, source, updated_at");

    if (tasksErr) throw new Error(`tasks: ${tasksErr.message}`);
    const allTasks = (tasks ?? []) as TaskRow[];

    // ── 2. Global progress ───────────────────────────────────────────────────
    const statusCounts: Record<string, number> = {};
    for (const t of allTasks) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
    }
    const total      = allTasks.length;
    const completed  = statusCounts.completed  ?? 0;
    const pending    = statusCounts.pending    ?? 0;
    const running    = (statusCounts.in_progress ?? 0) + (statusCounts.running ?? 0);
    const verifying  = statusCounts.verifying  ?? 0;
    const blocked    = statusCounts.blocked    ?? 0;
    const retry      = statusCounts.retry      ?? 0;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

    // ── 3. Category breakdown ────────────────────────────────────────────────
    const catMap: Record<string, { total: number; completed: number; label: string }> = {};
    for (const t of allTasks) {
      const phase = t.phase_id ?? "unknown";
      if (!catMap[phase]) catMap[phase] = { total: 0, completed: 0, label: CATEGORY_LABELS[phase] ?? phase };
      catMap[phase].total++;
      if (t.status === "completed") catMap[phase].completed++;
    }
    const categories = Object.entries(catMap)
      .map(([id, v]) => ({
        id,
        label:     v.label,
        total:     v.total,
        completed: v.completed,
        pct:       v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.completed - a.completed);

    // ── 4. Execution rate (tasks completed in last hour) ─────────────────────
    const oneHourAgo = Date.now() - 3600_000;
    let tasksLastHour = 0;
    let tasksLastDay  = 0;
    const dayAgo = Date.now() - 86400_000;
    for (const t of allTasks) {
      if (t.status !== "completed") continue;
      const ms = toEpochMs(t.updated_at);
      if (ms > oneHourAgo) tasksLastHour++;
      if (ms > dayAgo)     tasksLastDay++;
    }

    // ── 5. Estimated completion ──────────────────────────────────────────────
    const remaining = total - completed;
    let etaMinutes: number | null = null;
    if (tasksLastHour > 0 && remaining > 0) {
      etaMinutes = Math.round((remaining / tasksLastHour) * 60);
    }

    // ── 6. Artifacts ─────────────────────────────────────────────────────────
    const { data: artRows, error: artErr } = await client
      .from("task_artifacts")
      .select("artifact_type");

    let artifactsByType: Record<string, number> = {};
    let artifactTotal = 0;
    if (!artErr && artRows) {
      for (const a of artRows as ArtifactRow[]) {
        artifactsByType[a.artifact_type] = (artifactsByType[a.artifact_type] ?? 0) + 1;
        artifactTotal++;
      }
    }

    // ── 7. Source breakdown (roadmap vs planner) ──────────────────────────────
    const sourceMap: Record<string, number> = {};
    for (const t of allTasks) {
      const src = t.source ?? "unknown";
      sourceMap[src] = (sourceMap[src] ?? 0) + 1;
    }

    // ── 8. Worker cycles (last 10 from execution logs) ────────────────────────
    const { data: execLogs } = await client
      .from("javari_execution_logs")
      .select("execution_id, task_id, model_used, cost, execution_time, status, timestamp")
      .order("timestamp", { ascending: false })
      .limit(10);

    const workerCycles = ((execLogs ?? []) as ExecLogRow[])
      .filter(r => r.task_id?.startsWith("cycle:"))
      .slice(0, 5)
      .map(r => ({
        cycleId:     r.execution_id ?? r.task_id,
        executedAt:  r.timestamp ?? "",
        cost:        r.cost ?? 0,
        durationMs:  r.execution_time ?? 0,
        status:      r.status ?? "unknown",
        lastActive:  r.timestamp ? relativeTime(new Date(r.timestamp).getTime()) : "unknown",
      }));

    // ── 9. Recent activity (last 8 completed tasks) ───────────────────────────
    const recentCompleted = allTasks
      .filter(t => t.status === "completed")
      .map(t => ({ ...t, ms: toEpochMs(t.updated_at) }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8)
      .map(t => ({
        id:       t.id,
        title:    t.title,
        phase:    t.phase_id ?? "unknown",
        source:   t.source ?? "roadmap",
        elapsed:  relativeTime(t.ms),
      }));

    // ── 10. System velocity (tasks/hour over last 24h in buckets) ────────────
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const bucketStart = dayAgo + i * 3600_000;
      const bucketEnd   = bucketStart + 3600_000;
      const count = allTasks.filter(t => {
        if (t.status !== "completed") return false;
        const ms = toEpochMs(t.updated_at);
        return ms >= bucketStart && ms < bucketEnd;
      }).length;
      return count;
    });

    // ── Assemble response ─────────────────────────────────────────────────────
    return NextResponse.json({
      ok:          true,
      generatedAt: new Date().toISOString(),
      queryMs:     Date.now() - t0,

      progress: {
        total,
        completed,
        pending,
        running,
        verifying,
        blocked,
        retry,
        remaining,
        pct,
        queueHealthy: pending >= 0 && blocked === 0,
      },

      execution: {
        tasksLastHour,
        tasksLastDay,
        etaMinutes,
        velocityBuckets: buckets,
      },

      categories,

      artifacts: {
        total:      artifactTotal,
        byType:     artifactsByType,
        commits:    artifactsByType.commit         ?? 0,
        migrations: artifactsByType.sql_migration  ?? 0,
        deploys:    artifactsByType.deploy_proof   ?? 0,
        aiOutputs:  artifactsByType.ai_output      ?? 0,
        patches:    artifactsByType.repair_patch   ?? 0,
      },

      sources:    sourceMap,
      workers:    workerCycles,
      activity:   recentCompleted,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dashboard] error: ${message}`);
    return NextResponse.json({ ok: false, error: message, queryMs: Date.now() - t0 }, { status: 500 });
  }
}
