// app/api/javari/dashboard/route.ts
// Purpose: Unified Mission Control data aggregation API.
//          Returns: progress, execution, velocity, artifacts, categories,
//          workers, roadmapPhases, planner, systemHealth, recentActivity.
//          Read-only. Safe to call at 5s polling frequency.
// Date: 2026-03-10

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

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
  execution_id:   string;
  task_id:        string;
  model_used:     string | null;
  cost:           number | null;
  execution_time: number | null;
  status:         string | null;
  timestamp:      string | null;
}

interface WorkerLogRow {
  id:           string;
  cycle_id:     string | null;
  tasks_run:    number | null;
  cost_usd:     number | null;
  duration_ms:  number | null;
  status:       string | null;
  created_at:   string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toEpochMs(val: number | string | null): number {
  if (!val) return 0;
  if (typeof val === "number") return val > 1e12 ? val : val * 1000;
  return new Date(val).getTime();
}

function relativeTime(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Phase groupings for ROW 3 — Platform Build Progress
const PHASE_GROUPS: Array<{ id: string; label: string; matchPrefixes: string[] }> = [
  { id: "javari_core",       label: "Javari Core",              matchPrefixes: ["javari", "ai_", "autonomous", "planner", "intelligence"] },
  { id: "creator_tools",     label: "Creator Tools",            matchPrefixes: ["creator", "brand", "ux_", "media", "audio"] },
  { id: "craiverse",         label: "CRAIverse",                matchPrefixes: ["craiverse", "community", "social", "virtual"] },
  { id: "enterprise",        label: "Enterprise Integrations",  matchPrefixes: ["enterprise", "integration", "white_label", "saas"] },
  { id: "security",          label: "Security Infrastructure",  matchPrefixes: ["security", "auth", "rbac", "compliance"] },
  { id: "marketplace",       label: "Marketplace Ecosystem",    matchPrefixes: ["marketplace", "payment", "global_payment", "commerce"] },
  { id: "developer_platform",label: "Developer Platform",       matchPrefixes: ["developer", "api_", "sdk", "webhook", "tools"] },
];

const CATEGORY_LABELS: Record<string, string> = {
  ai_marketplace:          "AI Marketplace",
  creator_monetization:    "Creator Monetization",
  multi_ai_team_mode:      "Multi-AI Team Mode",
  craiverse_modules:       "CRAIverse Modules",
  enterprise_integrations: "Enterprise Integrations",
  community_systems:       "Community Systems",
  autonomous_deployment:   "Autonomous Deployment",
  platform_scaling:        "Platform Scaling",
  security_infrastructure: "Security Infrastructure",
  global_payments:         "Global Payments",
};

// ── GET /api/javari/dashboard ─────────────────────────────────────────────────

export async function GET() {
  const t0     = Date.now();
  const client = db();

  try {
    // ── 1. All roadmap tasks ─────────────────────────────────────────────────
    const { data: tasks, error: tasksErr } = await client
      .from("roadmap_tasks")
      .select("id, title, phase_id, status, source, updated_at");

    if (tasksErr) throw new Error(`tasks: ${tasksErr.message}`);
    const allTasks = (tasks ?? []) as TaskRow[];

    // ── 2. Global progress counts ────────────────────────────────────────────
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
    const remaining  = total - completed;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

    // ── 3. Velocity — tasks/hour and tasks/day ───────────────────────────────
    const now        = Date.now();
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo  = now - 86_400_000;
    let tasksLastHour = 0;
    let tasksLastDay  = 0;
    for (const t of allTasks) {
      if (t.status !== "completed") continue;
      const ms = toEpochMs(t.updated_at);
      if (ms > oneHourAgo) tasksLastHour++;
      if (ms > oneDayAgo)  tasksLastDay++;
    }

    // ETA
    let etaMinutes: number | null = null;
    if (tasksLastHour > 0 && remaining > 0) {
      etaMinutes = Math.round((remaining / tasksLastHour) * 60);
    }

    // 24h velocity buckets (one count per hour)
    const velocityBuckets = Array.from({ length: 24 }, (_, i) => {
      const start = oneDayAgo + i * 3_600_000;
      const end   = start + 3_600_000;
      return allTasks.filter(t => {
        if (t.status !== "completed") return false;
        const ms = toEpochMs(t.updated_at);
        return ms >= start && ms < end;
      }).length;
    });

    // Peak hour
    const peakHour = Math.max(...velocityBuckets, 0);

    // ── 4. Category breakdown ────────────────────────────────────────────────
    const catMap: Record<string, { total: number; completed: number; label: string }> = {};
    for (const t of allTasks) {
      const phase = t.phase_id ?? "unknown";
      if (!catMap[phase]) {
        catMap[phase] = {
          total: 0, completed: 0,
          label: CATEGORY_LABELS[phase] ?? phase.replace(/_/g, " "),
        };
      }
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
      .sort((a, b) => b.total - a.total);

    // ── 5. Roadmap phases (aggregated into 7 platform pillars) ───────────────
    const phaseGroup: Record<string, { total: number; completed: number }> = {};
    for (const g of PHASE_GROUPS) {
      phaseGroup[g.id] = { total: 0, completed: 0 };
    }
    phaseGroup["other"] = { total: 0, completed: 0 };

    for (const t of allTasks) {
      const phaseId = (t.phase_id ?? "").toLowerCase();
      let matched = false;
      for (const g of PHASE_GROUPS) {
        if (g.matchPrefixes.some(p => phaseId.startsWith(p) || phaseId.includes(p))) {
          phaseGroup[g.id].total++;
          if (t.status === "completed") phaseGroup[g.id].completed++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        phaseGroup["other"].total++;
        if (t.status === "completed") phaseGroup["other"].completed++;
      }
    }

    const roadmapPhases = PHASE_GROUPS.map(g => ({
      id:        g.id,
      label:     g.label,
      total:     phaseGroup[g.id].total,
      completed: phaseGroup[g.id].completed,
      pct:       phaseGroup[g.id].total > 0
        ? Math.round((phaseGroup[g.id].completed / phaseGroup[g.id].total) * 100)
        : 0,
    }));

    // ── 6. Planner stats ─────────────────────────────────────────────────────
    const sourceMap: Record<string, number> = {};
    for (const t of allTasks) {
      const src = t.source ?? "unknown";
      sourceMap[src] = (sourceMap[src] ?? 0) + 1;
    }
    const plannerGenerated = sourceMap["planner"] ?? 0;
    const roadmapIngested  = (sourceMap["roadmap"] ?? 0) +
      (sourceMap["master_roadmap_v4"] ?? 0) +
      (sourceMap["roadmap_v4"] ?? 0) +
      (sourceMap["master_roadmap_v1"] ?? 0) +
      (sourceMap["r2_ingest"] ?? 0);
    const discoveryTasks = (sourceMap["discovery"] ?? 0) +
      (sourceMap["intelligence"] ?? 0) +
      (sourceMap["ux_analyzer"] ?? 0) +
      (sourceMap["brand_engine"] ?? 0) +
      (sourceMap["scheduler"] ?? 0);

    const planner = {
      tasksGenerated: plannerGenerated,
      roadmapIngested,
      discoveryTasks,
      totalSources:   Object.keys(sourceMap).length,
      sourceBreakdown: Object.entries(sourceMap)
        .sort((a, b) => b[1] - a[1])
        .map(([src, count]) => ({ source: src, count })),
    };

    // ── 7. Artifacts ─────────────────────────────────────────────────────────
    let artifactsByType: Record<string, number> = {};
    let artifactTotal = 0;

    const { data: artRows } = await client
      .from("roadmap_task_artifacts")
      .select("artifact_type");

    if (artRows && artRows.length > 0) {
      for (const a of artRows as ArtifactRow[]) {
        artifactsByType[a.artifact_type] = (artifactsByType[a.artifact_type] ?? 0) + 1;
        artifactTotal++;
      }
    } else {
      const { data: artRows2 } = await client
        .from("task_artifacts")
        .select("artifact_type");
      if (artRows2) {
        for (const a of artRows2 as ArtifactRow[]) {
          artifactsByType[a.artifact_type] = (artifactsByType[a.artifact_type] ?? 0) + 1;
          artifactTotal++;
        }
      }
    }

    // ── 8. Worker cycles — try javari_execution_logs ─────────────────────────
    const { data: execLogs } = await client
      .from("javari_execution_logs")
      .select("execution_id, task_id, model_used, cost, execution_time, status, timestamp")
      .order("timestamp", { ascending: false })
      .limit(20);

    // Also try worker_cycles table if it exists
    const { data: workerRows } = await client
      .from("worker_cycles")
      .select("id, cycle_id, tasks_run, cost_usd, duration_ms, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    let workers: Array<{
      cycleId:    string;
      executedAt: string;
      executed:   number;
      cost:       string;
      durationMs: number;
      status:     string;
      lastActive: string;
    }> = [];

    if (workerRows && workerRows.length > 0) {
      workers = (workerRows as WorkerLogRow[]).slice(0, 8).map(r => ({
        cycleId:    r.cycle_id ?? r.id,
        executedAt: r.created_at ?? "",
        executed:   r.tasks_run ?? 0,
        cost:       `$${((r.cost_usd ?? 0)).toFixed(4)}`,
        durationMs: r.duration_ms ?? 0,
        status:     r.status ?? "unknown",
        lastActive: r.created_at ? relativeTime(new Date(r.created_at).getTime()) : "unknown",
      }));
    } else {
      // Fall back to execution logs
      const cycleRows = ((execLogs ?? []) as ExecLogRow[])
        .filter(r => r.task_id?.startsWith("cycle:") || r.execution_id?.startsWith("wc-"))
        .slice(0, 8);

      if (cycleRows.length > 0) {
        workers = cycleRows.map(r => ({
          cycleId:    r.execution_id ?? r.task_id,
          executedAt: r.timestamp ?? "",
          executed:   0,
          cost:       `$${((r.cost ?? 0)).toFixed(4)}`,
          durationMs: r.execution_time ?? 0,
          status:     r.status ?? "unknown",
          lastActive: r.timestamp ? relativeTime(new Date(r.timestamp).getTime()) : "unknown",
        }));
      }
    }

    // Total worker cycles run
    const totalWorkerCycles = workers.length;
    const totalCost = workers.reduce((sum, w) => sum + parseFloat(w.cost.replace("$", "")), 0);

    // ── 9. Recent activity ────────────────────────────────────────────────────
    const recentActivity = allTasks
      .filter(t => t.status === "completed")
      .map(t => ({ ...t, ms: toEpochMs(t.updated_at) }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 12)
      .map(t => ({
        id:      t.id,
        title:   t.title,
        phase:   t.phase_id ?? "unknown",
        source:  t.source ?? "roadmap",
        elapsed: relativeTime(t.ms),
      }));

    // ── 10. System health ─────────────────────────────────────────────────────
    const artifactCoverage = completed > 0
      ? Math.round((artifactTotal / completed) * 100)
      : 0;

    const systemHealth = {
      queueHealthy:          blocked === 0,
      verificationGateActive: true,
      tasksVerified:          completed,
      tasksBlocked:           blocked,
      tasksRetrying:          retry,
      artifactCoverage:       `${artifactCoverage}%`,
      plannerActive:          plannerGenerated > 0,
      cronSchedule:           "60s",
      maxTasksPerCycle:       20,
      plannerTriggerAt:       10,
    };

    // ── Assemble ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      ok:          true,
      generatedAt: new Date().toISOString(),
      queryMs:     Date.now() - t0,

      progress: {
        total, completed, pending, running, verifying, blocked, retry,
        remaining, pct,
        queueHealthy: blocked === 0,
      },

      velocity: {
        tasksLastHour,
        tasksLastDay,
        peakHour,
        etaMinutes,
        velocityBuckets,
      },

      // Keep backward-compat alias
      execution: {
        tasksLastHour,
        tasksLastDay,
        etaMinutes,
        velocityBuckets,
      },

      categories,
      roadmapPhases,

      artifacts: {
        total:      artifactTotal,
        byType:     artifactsByType,
        aiOutputs:  artifactsByType.ai_output            ?? 0,
        commits:    artifactsByType.commit                ?? 0,
        migrations: artifactsByType.sql_migration         ?? 0,
        deploys:    artifactsByType.deploy_proof          ?? 0,
        patches:    artifactsByType.repair_patch          ?? 0,
        reports:    (artifactsByType.verification_report  ?? 0) +
                    (artifactsByType.ecosystem_report     ?? 0),
      },

      planner,
      sources: sourceMap,

      workers: {
        cycles:      workers,
        totalCycles: totalWorkerCycles,
        totalCostUsd: totalCost,
        cronSchedule: "*/1 * * * *",
      },

      systemHealth,
      recentActivity,

      // backward compat
      activity: recentActivity,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dashboard] error: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, queryMs: Date.now() - t0 },
      { status: 500 }
    );
  }
}
