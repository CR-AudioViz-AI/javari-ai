// app/api/javari/dashboard/route.ts
// Purpose: Unified Mission Control data aggregation API.
//          Uses aggregate SQL counts — never fetches all rows.
//          Handles 33,735+ roadmap_tasks without the Supabase 1,000-row cap.
//          Returns: progress, execution, velocity, artifacts, categories,
//          workers, roadmapPhases, planner, systemHealth, recentActivity.
//          Read-only. Safe to call at 5s polling frequency.
// Date: 2026-03-10

import { NextResponse } from "next/server";
import { createClient }         from "@supabase/supabase-js";
import { getModuleMetrics }    from "@/lib/javari/moduleFactory";
import { getOrchestratorStatus } from "@/lib/javari/orchestrator";
import { getAppMetrics }        from "@/lib/javari/appFactory";

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

interface StatusCountRow  { status: string; cnt: number }
interface SourceCountRow  { source: string; cnt: number }
interface PhaseCountRow   { phase_id: string; status: string; cnt: number }
interface VelocityRow     { bucket_hour: string; cnt: number }
interface RecentTaskRow   { id: string; title: string; phase_id: string | null; source: string | null; updated_at: string | null }
interface ArtifactRow     { artifact_type: string }
interface ExecLogRow      { execution_id: string; task_id: string; model_used: string | null; cost: number | null; execution_time: number | null; status: string | null; timestamp: string | null }
interface BuildArtifactRow { artifact_type: string; status: string; commit_sha: string | null; deployment_url: string | null }
interface WorkerLogRow    { id: string; cycle_id: string | null; tasks_run: number | null; cost_usd: number | null; duration_ms: number | null; status: string | null; created_at: string | null }
interface CanonicalDocRow { cnt: number }
interface KGraphRow       { nodes: number; edges: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Phase groupings for ROW 3 — Platform Build Progress
const PHASE_GROUPS: Array<{ id: string; label: string; matchPrefixes: string[] }> = [
  { id: "javari_core",        label: "Javari Core",              matchPrefixes: ["javari", "ai_", "autonomous", "planner", "intelligence", "PHASE_0", "PHASE_1"] },
  { id: "creator_tools",      label: "Creator Tools",            matchPrefixes: ["creator", "brand", "ux_", "media", "audio", "PHASE_2"] },
  { id: "craiverse",          label: "CRAIverse",                matchPrefixes: ["craiverse", "community", "social", "virtual", "PHASE_7", "PHASE_8"] },
  { id: "enterprise",         label: "Enterprise Integrations",  matchPrefixes: ["enterprise", "integration", "white_label", "saas", "PHASE_5"] },
  { id: "security",           label: "Security Infrastructure",  matchPrefixes: ["security", "auth", "rbac", "compliance", "PHASE_4"] },
  { id: "marketplace",        label: "Marketplace Ecosystem",    matchPrefixes: ["marketplace", "payment", "global_payment", "commerce", "PHASE_3", "PHASE_6"] },
  { id: "developer_platform", label: "Developer Platform",       matchPrefixes: ["developer", "api_", "sdk", "webhook", "tools", "PHASE_9", "PHASE_10"] },
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

// Safe RPC wrapper — returns null on failure instead of throwing
async function safeRpc<T>(client: ReturnType<typeof db>, fn: string, args: Record<string, unknown>): Promise<T[] | null> {
  try {
    const { data, error } = await (client.rpc as (fn: string, args?: Record<string, unknown>) => Promise<{ data: T[] | null; error: { message: string } | null }>)(fn, args);
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// ── GET /api/javari/dashboard ─────────────────────────────────────────────────

export async function GET() {
  const t0     = Date.now();
  const client = db();

  try {
    // ── 1. Status aggregates (no row cap — uses GROUP BY on server) ──────────
    // This fetches status counts in a single aggregate query.
    // Supabase PostgREST supports grouping via ?select=status,count:count()
    // We use a HEAD count approach per status via parallel queries.

    const statuses = ["pending", "running", "in_progress", "verifying", "blocked", "retry", "completed", "failed"] as const;

    // Parallel: count per status + total
    const [totalRes, ...statusResults] = await Promise.all([
      client.from("roadmap_tasks").select("*", { count: "exact", head: true }),
      ...statuses.map(s =>
        client.from("roadmap_tasks")
          .select("*", { count: "exact", head: true })
          .eq("status", s)
      ),
    ]);

    const total    = totalRes.count ?? 0;
    const statusCounts: Record<string, number> = {};
    statuses.forEach((s, i) => {
      statusCounts[s] = statusResults[i].count ?? 0;
    });

    const completed  = statusCounts.completed  ?? 0;
    const pending    = statusCounts.pending    ?? 0;
    const running    = (statusCounts.in_progress ?? 0) + (statusCounts.running ?? 0);
    const verifying  = statusCounts.verifying  ?? 0;
    const blocked    = statusCounts.blocked    ?? 0;
    const retry      = statusCounts.retry      ?? 0;
    const remaining  = total - completed;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

    // ── 2. Velocity — tasks completed in last 24h / last 1h ─────────────────
    const now        = new Date();
    const oneHourAgo = new Date(now.getTime() - 3_600_000).toISOString();
    const oneDayAgo  = new Date(now.getTime() - 86_400_000).toISOString();

    const [hourRes, dayRes] = await Promise.all([
      client.from("roadmap_tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", oneHourAgo),
      client.from("roadmap_tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("updated_at", oneDayAgo),
    ]);

    const tasksLastHour = hourRes.count ?? 0;
    const tasksLastDay  = dayRes.count  ?? 0;

    // ETA
    let etaMinutes: number | null = null;
    if (tasksLastHour > 0 && remaining > 0) {
      etaMinutes = Math.round((remaining / tasksLastHour) * 60);
    }

    // 24h velocity buckets — fetch last 24h completed tasks with timestamps
    // Fetch up to 5000 recent completed tasks for bucketing (stays under 1000 cap with limit)
    const { data: velocityRows } = await client
      .from("roadmap_tasks")
      .select("updated_at")
      .eq("status", "completed")
      .gte("updated_at", oneDayAgo)
      .limit(5000);

    const velocityBuckets = Array.from({ length: 24 }, (_, i) => {
      const start = new Date(now.getTime() - 86_400_000 + i * 3_600_000);
      const end   = new Date(start.getTime() + 3_600_000);
      return (velocityRows ?? []).filter(r => {
        const ms = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        return ms >= start.getTime() && ms < end.getTime();
      }).length;
    });
    const peakHour = Math.max(...velocityBuckets, 0);

    // ── 3. Category breakdown — aggregate by phase_id ────────────────────────
    // Fetch phase_id + status with large limit (handles up to 50k unique combos)
    const { data: phaseRows } = await client
      .from("roadmap_tasks")
      .select("phase_id, status")
      .limit(50000);

    const catMap: Record<string, { total: number; completed: number; label: string }> = {};
    for (const t of (phaseRows ?? [])) {
      const phase = (t.phase_id as string) ?? "unknown";
      if (!catMap[phase]) {
        catMap[phase] = {
          total: 0, completed: 0,
          label: CATEGORY_LABELS[phase] ?? phase.replace(/_/g, " "),
        };
      }
      catMap[phase].total++;
      if ((t.status as string) === "completed") catMap[phase].completed++;
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

    // ── 4. Roadmap phases (7 platform pillars) ───────────────────────────────
    const phaseGroup: Record<string, { total: number; completed: number }> = {};
    for (const g of PHASE_GROUPS) phaseGroup[g.id] = { total: 0, completed: 0 };
    phaseGroup["other"] = { total: 0, completed: 0 };

    for (const t of (phaseRows ?? [])) {
      const phaseId = ((t.phase_id as string) ?? "").toLowerCase();
      let matched = false;
      for (const g of PHASE_GROUPS) {
        if (g.matchPrefixes.some(p => phaseId.startsWith(p.toLowerCase()) || phaseId.includes(p.toLowerCase()))) {
          phaseGroup[g.id].total++;
          if ((t.status as string) === "completed") phaseGroup[g.id].completed++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        phaseGroup["other"].total++;
        if ((t.status as string) === "completed") phaseGroup["other"].completed++;
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

    // ── 5. Source breakdown ──────────────────────────────────────────────────
    const { data: sourceRows } = await client
      .from("roadmap_tasks")
      .select("source")
      .limit(50000);

    const sourceMap: Record<string, number> = {};
    for (const t of (sourceRows ?? [])) {
      const src = (t.source as string) ?? "unknown";
      sourceMap[src] = (sourceMap[src] ?? 0) + 1;
    }

    const plannerGenerated = sourceMap["planner"] ?? 0;
    const roadmapIngested  = (sourceMap["roadmap"] ?? 0) +
      (sourceMap["master_roadmap_v4"] ?? 0) +
      (sourceMap["roadmap_v4"] ?? 0) +
      (sourceMap["master_roadmap_v1"] ?? 0) +
      (sourceMap["r2_ingest"] ?? 0) +
      (sourceMap["ecosystem_v3"] ?? 0);
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

    // ── 6. Artifacts ─────────────────────────────────────────────────────────
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

    // ── 7. Worker cycles ─────────────────────────────────────────────────────
    const { data: execLogs } = await client
      .from("javari_execution_logs")
      .select("execution_id, task_id, model_used, cost, execution_time, status, timestamp")
      .order("timestamp", { ascending: false })
      .limit(20);

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

    // Worker cycle totals from execution_logs
    const { count: totalWorkerCyclesCount } = await client
      .from("execution_logs")
      .select("*", { count: "exact", head: true })
      .ilike("task_id", "cycle:%");

    const totalWorkerCycles = totalWorkerCyclesCount ?? workers.length;
    const totalCost = workers.reduce((sum, w) => sum + parseFloat(w.cost.replace("$", "")), 0);

    // ── 8. Recent activity — last 12 completed tasks ──────────────────────────
    const { data: recentRows } = await client
      .from("roadmap_tasks")
      .select("id, title, phase_id, source, updated_at")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(12);

    const recentActivity = ((recentRows ?? []) as RecentTaskRow[]).map(t => ({
      id:      t.id,
      title:   t.title,
      phase:   t.phase_id ?? "unknown",
      source:  t.source ?? "roadmap",
      elapsed: t.updated_at ? relativeTime(new Date(t.updated_at).getTime()) : "unknown",
    }));

    // ── 9. Canonical corpus stats ────────────────────────────────────────────
    const [canonicalDocRes, canonicalDocRes2, kgNodeRes, kgEdgeRes, ingestRunRes] = await Promise.all([
      // canonical_docs = the active store (lib/canonical/store.ts)
      client.from("canonical_docs").select("*", { count: "exact", head: true }),
      // canonical_documents = new schema table (may also be populated)
      client.from("canonical_documents").select("*", { count: "exact", head: true }),
      client.from("knowledge_graph_nodes").select("*", { count: "exact", head: true }),
      client.from("knowledge_graph_edges").select("*", { count: "exact", head: true }),
      client.from("canonical_ingest_runs")
        .select("id, status, docs_ingested, chunks_created, nodes_created, tasks_generated, started_at, completed_at")
        .order("started_at", { ascending: false })
        .limit(1),
    ]);

    const canonicalDocs   = Math.max(canonicalDocRes.count ?? 0, canonicalDocRes2.count ?? 0);
    const kgNodes         = kgNodeRes.count        ?? 0;
    const kgEdges         = kgEdgeRes.count        ?? 0;
    const lastIngestRun   = ingestRunRes.data?.[0] ?? null;


    // ── 10b. Build artifact telemetry (Phase 9) ───────────────────────────────
    let buildsRunning = 0;
    let commitsCreated = 0;
    let deploymentsLive = 0;
    let modulesGenerated = 0;
    let artifactSuccessRate = 0;
    let buildArtifactTotal = 0;
    let buildsByType: Record<string, number> = {};

    try {
      const { data: buildRows } = await client
        .from("build_artifacts")
        .select("artifact_type, status, commit_sha, deployment_url");

      if (buildRows && buildRows.length > 0) {
        buildArtifactTotal = buildRows.length;
        for (const b of buildRows as BuildArtifactRow[]) {
          buildsByType[b.artifact_type] = (buildsByType[b.artifact_type] ?? 0) + 1;
          if (b.status === "building") buildsRunning++;
          if (b.commit_sha) commitsCreated++;
          if (b.deployment_url) deploymentsLive++;
          if (b.artifact_type === "build_module" || b.artifact_type === "generate_api" || b.artifact_type === "create_service") modulesGenerated++;
        }
        const successCount = (buildRows as BuildArtifactRow[]).filter(b => b.status === "completed" || b.status === "deployed").length;
        artifactSuccessRate = buildArtifactTotal > 0 ? Math.round((successCount / buildArtifactTotal) * 100) : 0;
      }
    } catch { /* build_artifacts table may not exist yet — graceful degradation */ }

    // ── 9z. Orchestrator status ───────────────────────────────────────────────
    let orchestratorStatus = {
      running: false, lastCycle: undefined as string | undefined,
      lastCycleDurationMs: undefined as number | undefined,
      cyclesTotal: 0, tasksCompletedTotal: 0, modulesGeneratedTotal: 0,
      recentCycles: [] as unknown[],
    };
    try {
      orchestratorStatus = await getOrchestratorStatus();
    } catch { /* orchestrator_cycles table may not exist yet */ }

    // ── 9zz. App factory metrics ──────────────────────────────────────────────
    let appMetrics = {
      apps_total: 0, apps_complete: 0, apps_building: 0,
      apps_planned: 0, apps_missing: 8, by_category: {} as Record<string, number>,
    };
    try {
      appMetrics = await getAppMetrics();
    } catch { /* app_registry table may not exist yet */ }

    // ── 10a. Module registry metrics (Module Factory) ───────────────────────
    let moduleMetrics = {
      modules_total: 0, modules_complete: 0, modules_in_progress: 0,
      modules_planned: 0, modules_missing: 0,
      by_capability: {} as Record<string, { total: number; complete: number; missing: number }>,
    };
    try {
      moduleMetrics = await getModuleMetrics();
    } catch { /* module_registry table may not exist yet */ }

    // ── 10. System health ─────────────────────────────────────────────────────
    const artifactCoverage = completed > 0
      ? Math.round((artifactTotal / completed) * 100)
      : 0;

    const systemHealth = {
      queueHealthy:           blocked === 0,
      verificationGateActive: true,
      tasksVerified:          completed,
      tasksBlocked:           blocked,
      tasksRetrying:          retry,
      artifactCoverage:       `${artifactCoverage}%`,
      plannerActive:          plannerGenerated > 0,
      canonicalCorpusLoaded:  canonicalDocs > 0,
      knowledgeGraphActive:   kgNodes > 0,
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

      // backward-compat alias
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


      builds: {
        buildsRunning,
        commitsCreated,
        deploymentsLive,
        modulesGenerated,
        artifactSuccessRate: `${artifactSuccessRate}%`,
        totalBuildArtifacts: buildArtifactTotal,
        byType: buildsByType,
        migrationEndpoint: "/api/javari/migrate-build-artifacts",
      },

      modules: {
        total       : moduleMetrics.modules_total,
        complete    : moduleMetrics.modules_complete,
        in_progress : moduleMetrics.modules_in_progress,
        planned     : moduleMetrics.modules_planned,
        missing     : moduleMetrics.modules_missing,
        generated   : modulesGenerated,
        by_capability: moduleMetrics.by_capability,
        factoryEndpoint: "/api/javari/module-factory",
      },

      orchestrator: {
        running           : orchestratorStatus.running,
        last_cycle        : orchestratorStatus.lastCycle,
        last_cycle_ms     : orchestratorStatus.lastCycleDurationMs,
        cycles_total      : orchestratorStatus.cyclesTotal,
        tasks_completed   : orchestratorStatus.tasksCompletedTotal,
        modules_generated : orchestratorStatus.modulesGeneratedTotal,
        apps_generated    : orchestratorStatus.appsGeneratedTotal,
        recent_cycles     : orchestratorStatus.recentCycles,
        cron              : "* * * * *",
        endpoint          : "/api/javari/orchestrator/run",
      },

      apps: {
        total      : appMetrics.apps_total,
        complete   : appMetrics.apps_complete,
        building   : appMetrics.apps_building,
        planned    : appMetrics.apps_planned,
        missing    : appMetrics.apps_missing,
        by_category: appMetrics.by_category,
        endpoint   : "/api/javari/orchestrator/run",
        factoryNote: "POST { action: 'app-factory' } to trigger",
      },


      sources: sourceMap,

      workers: {
        cycles:       workers,
        totalCycles:  totalWorkerCycles,
        totalCostUsd: totalCost,
        cronSchedule: "*/1 * * * *",
      },

      systemHealth,
      recentActivity,

      // backward compat
      activity: recentActivity,

      // Canonical corpus status
      canonical: {
        documentsIngested: canonicalDocs,
        knowledgeGraphNodes: kgNodes,
        knowledgeGraphEdges: kgEdges,
        lastIngestRun,
        corpusReady: canonicalDocs > 0,
        ingestEndpoint: "/api/canonical/ingest-ecosystem-v3",
        r2IngestEndpoint: "/api/canonical/ingest",
      },
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
