// lib/discovery/systemCrawler.ts
// Purpose: Universal System Discovery Engine — orchestrates the full discovery
//          pipeline for any software platform (local, GitHub repo, or URL).
//          Stack-agnostic. Produces a complete architecture report and
//          auto-generates roadmap tasks from findings.
// Date: 2026-03-07

import { scanRepo, scanURL_target, ScanTarget, ScanResult } from "./repoScanner";
import { detectStack, DetectedStack }                       from "./stackDetector";
import { buildDependencyGraph, DependencyGraphMap }         from "./dependencyGraph";
import { buildArchitectureMap, DiscoveryReport, SuggestedTask } from "./architectureMap";
import { createClient, SupabaseClient }                     from "@supabase/supabase-js";
import { getSecret }                                        from "@/lib/platform-secrets/getSecret";

// ── Types ──────────────────────────────────────────────────────────────────

export type DiscoveryTargetType = "local" | "repo" | "url";

export interface CrawlerInput {
  target          : DiscoveryTargetType;
  repo?           : string;   // "owner/repo" for GitHub
  branch?         : string;
  url?            : string;   // for url target
  localRoot?      : string;   // for local target
  injectTasks?    : boolean;  // default true — write discovered tasks to roadmap_tasks
  userId?         : string;
}

export interface CrawlerOutput {
  ok        : boolean;
  report    : DiscoveryReport | null;
  tasksCreated: number;
  taskIds   : string[];
  error?    : string;
  durationMs: number;
}

// ── Supabase client ────────────────────────────────────────────────────────

async function getSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? await getSecret("NEXT_PUBLIC_SUPABASE_URL").catch(() => "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? await getSecret("SUPABASE_SERVICE_ROLE_KEY").catch(() => "");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Task injection into roadmap_tasks ─────────────────────────────────────

async function injectRoadmapTasks(tasks: SuggestedTask[]): Promise<{ created: number; ids: string[] }> {
  if (tasks.length === 0) return { created: 0, ids: [] };

  const sb  = await getSupabase();
  const now = Date.now();

  // Check existing IDs to avoid duplicates
  const { data: existing } = await sb
    .from("roadmap_tasks")
    .select("id")
    .in("id", tasks.map(t => t.id));

  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const newTasks    = tasks.filter(t => !existingIds.has(t.id));

  if (newTasks.length === 0) return { created: 0, ids: [] };

  const rows = newTasks.map(task => ({
    id         : task.id,
    phase_id   : task.phase_id,
    title      : task.title,
    description: task.description,
    depends_on : task.depends_on,
    status     : "pending",
    source     : "discovery",   // distinct from "roadmap" — auto-generated
    updated_at : now,
  }));

  const { error } = await sb.from("roadmap_tasks").insert(rows);
  if (error) {
    console.error("[systemCrawler] Task injection failed:", error.message);
    return { created: 0, ids: [] };
  }

  console.log(`[systemCrawler] Injected ${rows.length} discovery tasks into roadmap_tasks`);
  return { created: rows.length, ids: rows.map(r => r.id) };
}

// ── Main crawler ───────────────────────────────────────────────────────────

export async function crawlSystem(input: CrawlerInput): Promise<CrawlerOutput> {
  const t0 = Date.now();

  try {
    // ── Phase 1: Scan ──────────────────────────────────────────────────────
    let scan: ScanResult;

    if (input.target === "url" && input.url) {
      console.log(`[systemCrawler] Phase 1: URL scan → ${input.url}`);
      scan = await scanURL_target(input.url);

    } else if (input.target === "repo" && input.repo) {
      console.log(`[systemCrawler] Phase 1: GitHub scan → ${input.repo}`);
      scan = await scanRepo({ type: "github", repo: input.repo, branch: input.branch ?? "main" });

    } else {
      console.log(`[systemCrawler] Phase 1: Local scan → ${input.localRoot ?? process.cwd()}`);
      const target: ScanTarget = { type: "local", localRoot: input.localRoot };
      scan = await scanRepo(target);
    }

    if (scan.error) {
      return { ok: false, report: null, tasksCreated: 0, taskIds: [], error: scan.error, durationMs: Date.now() - t0 };
    }

    console.log(`[systemCrawler] Phase 1 complete: ${scan.fileCount} files in ${scan.scanMs}ms`);

    // ── Phase 2: Stack detection ───────────────────────────────────────────
    console.log(`[systemCrawler] Phase 2: Stack detection`);
    const stack: DetectedStack = detectStack(scan.filePaths);
    console.log(`[systemCrawler] Detected: ${stack.languages.slice(0,3).join(", ")} | ${stack.frameworks.slice(0,3).join(", ")}`);

    // ── Phase 3: Dependency graph ──────────────────────────────────────────
    console.log(`[systemCrawler] Phase 3: Dependency graph`);
    const depGraph: DependencyGraphMap = buildDependencyGraph(scan.keyFiles);
    const totalDeps = Object.values(depGraph).reduce((sum, g) => sum + g.totalDeps, 0);
    console.log(`[systemCrawler] Mapped ${totalDeps} total dependencies`);

    // ── Phase 4: Architecture map ──────────────────────────────────────────
    console.log(`[systemCrawler] Phase 4: Architecture map`);
    const report: DiscoveryReport = buildArchitectureMap(scan, stack, depGraph);
    console.log(`[systemCrawler] Report: ${report.apiRoutes.length} routes, ${report.securityFindings.length} findings, ${report.suggestedTasks.length} tasks`);

    // ── Phase 5: Task injection ────────────────────────────────────────────
    let tasksCreated = 0;
    let taskIds: string[] = [];

    if (input.injectTasks !== false && report.suggestedTasks.length > 0) {
      console.log(`[systemCrawler] Phase 5: Injecting ${report.suggestedTasks.length} tasks`);
      const result = await injectRoadmapTasks(report.suggestedTasks);
      tasksCreated = result.created;
      taskIds      = result.ids;
    }

    return {
      ok         : true,
      report,
      tasksCreated,
      taskIds,
      durationMs : Date.now() - t0,
    };

  } catch (err) {
    return {
      ok: false, report: null, tasksCreated: 0, taskIds: [],
      error: String(err), durationMs: Date.now() - t0,
    };
  }
}
