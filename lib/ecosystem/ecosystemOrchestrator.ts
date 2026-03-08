// lib/ecosystem/ecosystemOrchestrator.ts
// Purpose: Ecosystem Governance Layer orchestrator — coordinates all governance
//          engines: architecture registry, brand consistency, deduplication,
//          UX flow analysis. Generates tasks and triggers the repair engine.
// Date: 2026-03-07

import { createClient }             from "@supabase/supabase-js";
import { recordArtifact }           from "@/lib/roadmap/artifactRecorder";
import {
  getSystemMap,
  buildDependencyGraph,
  seedCanonicalSystems,
  type EcosystemSystem,
} from "./architectureRegistry";
import { runBrandConsistencyEngine, type BrandScanResult }  from "./brandConsistencyEngine";
import { runDeduplicationEngine,    type DeduplicationResult } from "./deduplicationEngine";
import { runUxFlowAnalyzer,         type UxAnalysisResult } from "./uxFlowAnalyzer";

// ── Types ──────────────────────────────────────────────────────────────────

export interface EcosystemAnalysisInput {
  target?    : string;    // e.g. "craudiovizai"
  repos?     : string[];  // override repo list
  urls?      : string[];  // override URL list
  seedTasks? : boolean;
  skipBrand? : boolean;
  skipDedup? : boolean;
  skipUx?    : boolean;
}

export interface EcosystemAnalysisResult {
  reportId       : string;
  target         : string;
  completedAt    : string;
  durationMs     : number;
  architectureMap: {
    systems          : EcosystemSystem[];
    dependencyGraph  : Awaited<ReturnType<typeof buildDependencyGraph>>;
    systemCount      : number;
    activeCount      : number;
    seeded           : number;
  };
  brandingIssues : BrandScanResult;
  duplicateModules: DeduplicationResult;
  uxIssues       : UxAnalysisResult;
  totalTasksCreated: number;
  taskIds        : string[];
  summary        : {
    criticalIssues: number;
    highIssues    : number;
    mediumIssues  : number;
    lowIssues     : number;
    topPriority   : string;
  };
}

// ── Target config ──────────────────────────────────────────────────────────

const TARGET_CONFIGS: Record<string, { repos: string[]; urls: string[] }> = {
  craudiovizai: {
    repos: ["CR-AudioViz-AI/javari-ai"],
    urls : ["https://craudiovizai.com", "https://javariai.com"],
  },
  javari: {
    repos: ["CR-AudioViz-AI/javari-ai"],
    urls : ["https://javariai.com"],
  },
};

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────

export async function runEcosystemAnalysis(
  input: EcosystemAnalysisInput = {}
): Promise<EcosystemAnalysisResult> {
  const t0        = Date.now();
  const reportId  = `ecosystem-${Date.now()}`;
  const target    = input.target ?? "craudiovizai";
  const seedTasks = input.seedTasks ?? true;
  const config    = TARGET_CONFIGS[target] ?? TARGET_CONFIGS["craudiovizai"];

  const repos = input.repos ?? config.repos;
  const urls  = input.urls  ?? config.urls;

  console.log(`[ecosystem] ▶ Analysis started: ${target} | repos=${repos.length} urls=${urls.length}`);

  // ── Step 1: Architecture Registry ─────────────────────────────────────────
  console.log("[ecosystem] Step 1: Architecture registry...");
  const seedResult = await seedCanonicalSystems();
  const systems    = await getSystemMap();
  const depGraph   = await buildDependencyGraph();
  console.log(`[ecosystem] Registry: ${systems.length} systems, ${seedResult.seeded} seeded`);

  // Create a task ID for artifact recording
  const taskTs = Date.now();
  const orchTaskId = `ecosystem-orch-${taskTs}`;

  // ── Step 2: Brand Consistency ──────────────────────────────────────────────
  let brandResult: BrandScanResult = {
    violations: [], filesScanned: 0, cleanFiles: 0,
    tasksCreated: 0, taskIds: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  };
  if (!input.skipBrand) {
    console.log("[ecosystem] Step 2: Brand consistency scan...");
    brandResult = await runBrandConsistencyEngine(repos, orchTaskId, seedTasks);
    console.log(`[ecosystem] Brand: ${brandResult.summary.total} violations in ${brandResult.filesScanned} files`);
  }

  // ── Step 3: Deduplication ──────────────────────────────────────────────────
  let dedupResult: DeduplicationResult = {
    duplicates: [], filesAnalyzed: 0,
    tasksCreated: 0, taskIds: [],
    summary: { total: 0, highSimilarity: 0, byType: {} },
  };
  if (!input.skipDedup) {
    console.log("[ecosystem] Step 3: Deduplication scan...");
    dedupResult = await runDeduplicationEngine(repos, orchTaskId, seedTasks);
    console.log(`[ecosystem] Dedup: ${dedupResult.summary.total} duplicates, ${dedupResult.filesAnalyzed} files`);
  }

  // ── Step 4: UX Flow Analysis ───────────────────────────────────────────────
  let uxResult: UxAnalysisResult = {
    flows: [], brokenFlows: [], passedFlows: [], totalIssues: 0,
    recommendations: [], tasksCreated: 0, taskIds: [],
  };
  if (!input.skipUx) {
    console.log("[ecosystem] Step 4: UX flow analysis...");
    uxResult = await runUxFlowAnalyzer(urls, orchTaskId, seedTasks);
    console.log(`[ecosystem] UX: ${uxResult.brokenFlows.length} broken flows, ${uxResult.totalIssues} issues`);
  }

  // ── Step 5: Aggregate ──────────────────────────────────────────────────────
  const allTaskIds = [
    ...brandResult.taskIds,
    ...dedupResult.taskIds,
    ...uxResult.taskIds,
  ];
  const totalTasksCreated = brandResult.tasksCreated + dedupResult.tasksCreated + uxResult.tasksCreated;

  const criticalIssues =
    brandResult.summary.critical +
    uxResult.recommendations.filter(r => r.priority === "critical").length;
  const highIssues =
    brandResult.summary.high +
    dedupResult.summary.highSimilarity +
    uxResult.recommendations.filter(r => r.priority === "high").length;

  const topPriority =
    criticalIssues > 0 ? `${criticalIssues} critical issues require immediate attention`
    : highIssues > 0   ? `${highIssues} high-priority issues found`
    : brandResult.summary.total > 0 ? `${brandResult.summary.total} brand violations to fix`
    : dedupResult.summary.total > 0 ? `${dedupResult.summary.total} duplicate modules to consolidate`
    : "No critical issues — ecosystem is healthy";

  const durationMs = Date.now() - t0;

  // ── Step 6: Record ecosystem report artifact ───────────────────────────────
  await recordArtifact({
    task_id         : orchTaskId,
    artifact_type   : "ecosystem_report" as never,
    artifact_location: "supabase/roadmap_task_artifacts",
    artifact_data   : {
      reportId, target, durationMs,
      systemCount  : systems.length,
      brandSummary : brandResult.summary,
      dedupSummary : dedupResult.summary,
      uxSummary    : { brokenFlows: uxResult.brokenFlows.length, totalIssues: uxResult.totalIssues },
      totalTasksCreated,
      topPriority,
    },
  });

  console.log(`[ecosystem] ✅ Complete: ${durationMs}ms | ${totalTasksCreated} tasks | ${criticalIssues + highIssues} critical/high issues`);

  return {
    reportId,
    target,
    completedAt    : new Date().toISOString(),
    durationMs,
    architectureMap: {
      systems,
      dependencyGraph: depGraph,
      systemCount    : systems.length,
      activeCount    : systems.filter(s => s.status === "active").length,
      seeded         : seedResult.seeded,
    },
    brandingIssues  : brandResult,
    duplicateModules: dedupResult,
    uxIssues        : uxResult,
    totalTasksCreated,
    taskIds         : allTaskIds,
    summary         : {
      criticalIssues,
      highIssues,
      mediumIssues: brandResult.summary.medium + uxResult.recommendations.filter(r => r.priority === "medium").length,
      lowIssues   : brandResult.summary.low,
      topPriority,
    },
  };
}
