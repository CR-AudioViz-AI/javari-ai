// lib/intelligence/codeAnalyzer.ts
// Purpose: Code Intelligence Engine — orchestrates all analysis passes (security,
//          performance, dead code, test coverage, call graph) across a repo.
//          Fetches source file contents via GitHub API and runs all scanners.
//          Produces a canonical IssueReport and injects roadmap tasks.
// Date: 2026-03-07

import { getSecret }                        from "@/lib/platform-secrets/getSecret";
import { scanForSecurity, SecurityIssue }   from "./securityScanner";
import { scanForPerformance, PerfIssue }    from "./performanceScanner";
import { detectDeadCode, DeadCodeIssue }    from "./deadCodeDetector";
import { detectTestGaps, TestGapIssue }     from "./testCoverageDetector";
import { buildCallGraph, CallGraphResult }  from "./callGraphBuilder";
import { createClient, SupabaseClient }     from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────────

export type Severity = "low" | "medium" | "high" | "critical";
export type IssueType = "security" | "performance" | "logic" | "quality" | "testing";

export interface CodeIssue {
  severity      : Severity;
  type          : IssueType;
  file          : string;
  line?         : number;
  description   : string;
  suggested_fix : string;
  rule?         : string;
}

export interface IssueReport {
  issues          : CodeIssue[];
  summary         : {
    total    : number;
    critical : number;
    high     : number;
    medium   : number;
    low      : number;
    byType   : Record<IssueType, number>;
    filesAnalyzed: number;
  };
  callGraph       : CallGraphResult;
  tasksCreated    : number;
  taskIds         : string[];
  analysisMs      : number;
  repo            : string;
  analyzedAt      : string;
}

export interface AnalyzeInput {
  repo         : string;           // "owner/repo"
  branch?      : string;           // default "main"
  maxFiles?    : number;           // default 150
  injectTasks? : boolean;          // default true
  userId?      : string;
  fileFilter?  : string;           // glob-like prefix filter, e.g. "lib/" or "app/"
}

// ── Source file extensions to analyze ─────────────────────────────────────

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".java", ".php", ".rs",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".vercel", "dist", "build",
  "out", "coverage", ".nyc_output", "__pycache__", ".cache",
  ".turbo", ".swc", "vendor", "target",
]);

// ── GitHub file fetcher ────────────────────────────────────────────────────

async function resolveToken(): Promise<string> {
  try { const t = await getSecret("GITHUB_TOKEN"); if (t) return t; } catch {}
  return process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? "";
}

async function fetchFileTree(repo: string, branch: string): Promise<string[]> {
  const token = await resolveToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "javari-intelligence/1.0",
  };
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );
  if (!res.ok) throw new Error(`GitHub tree API ${res.status} for ${repo}`);

  const data = await res.json() as { tree: Array<{ path: string; type: string }> };
  return (data.tree ?? [])
    .filter(f => f.type === "blob")
    .map(f => f.path)
    .filter(p => {
      const parts = p.split("/");
      if (parts.some(seg => SKIP_DIRS.has(seg))) return false;
      const ext = "." + p.split(".").pop();
      return SOURCE_EXTENSIONS.has(ext);
    });
}

async function fetchFileContent(
  repo: string,
  path: string,
  branch: string,
  token: string
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "javari-intelligence/1.0",
  };
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
    { headers, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return "";
  const d = await res.json() as { content?: string };
  if (!d.content) return "";
  return Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

async function fetchFiles(
  repo: string,
  paths: string[],
  branch: string
): Promise<Record<string, string>> {
  const token = await resolveToken();
  const results: Record<string, string> = {};
  // Fetch in chunks of 10 to avoid rate limits
  for (let i = 0; i < paths.length; i += 10) {
    const chunk = paths.slice(i, i + 10);
    await Promise.all(chunk.map(async (path) => {
      try {
        const content = await fetchFileContent(repo, path, branch, token);
        if (content) results[path] = content;
      } catch { /* skip unreadable */ }
    }));
  }
  return results;
}

// ── Supabase client ────────────────────────────────────────────────────────

async function getSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? await getSecret("NEXT_PUBLIC_SUPABASE_URL").catch(() => "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? await getSecret("SUPABASE_SERVICE_ROLE_KEY").catch(() => "");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Task injection ─────────────────────────────────────────────────────────

interface TaskRow {
  id         : string;
  phase_id   : string;
  title      : string;
  description: string;
  depends_on : string[];
  status     : string;
  source     : string;
  updated_at : number;
}

function issueToTask(issue: CodeIssue, index: number): TaskRow {
  const ts      = Date.now();
  const slug    = issue.file.replace(/[^a-z0-9]/gi, "-").slice(0, 30).toLowerCase();
  const id      = `intel-${issue.type}-${slug}-${ts}-${index}`.slice(0, 80);
  const phase   = issue.type === "security" ? "security"
                : issue.type === "performance" ? "performance"
                : issue.type === "testing" ? "quality"
                : "maintenance";

  return {
    id,
    phase_id   : phase,
    title      : `[${issue.severity.toUpperCase()}] ${issue.description.slice(0, 70)}`,
    description: `[type:ai_task] Code intelligence finding in ${issue.file}.\n\nIssue: ${issue.description}\n\nSeverity: ${issue.severity}\nType: ${issue.type}${issue.line ? `\nLine: ${issue.line}` : ""}\n\nSuggested fix: ${issue.suggested_fix}\n\nExecutor: repair_code`,
    depends_on : [],
    status     : "pending",
    source     : "intelligence",
    updated_at : ts,
  };
}

async function injectTasks(issues: CodeIssue[]): Promise<{ created: number; ids: string[] }> {
  // Only inject high+ severity to avoid flooding the queue
  const actionable = issues.filter(i => i.severity === "critical" || i.severity === "high");
  if (actionable.length === 0) return { created: 0, ids: [] };

  const sb  = await getSupabase();
  const rows = actionable.map((issue, i) => issueToTask(issue, i));

  // Deduplicate by ID
  const { data: existing } = await sb
    .from("roadmap_tasks")
    .select("id")
    .in("id", rows.map(r => r.id));
  const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const newRows = rows.filter(r => !existingIds.has(r.id));
  if (newRows.length === 0) return { created: 0, ids: [] };

  const { error } = await sb.from("roadmap_tasks").insert(newRows);
  if (error) {
    console.error("[codeAnalyzer] Task insert failed:", error.message);
    return { created: 0, ids: [] };
  }
  return { created: newRows.length, ids: newRows.map(r => r.id) };
}

// ── Main analyzer ──────────────────────────────────────────────────────────

export async function analyzeRepo(input: AnalyzeInput): Promise<IssueReport> {
  const t0     = Date.now();
  const branch = input.branch ?? "main";
  const max    = input.maxFiles ?? 150;

  console.log(`[codeAnalyzer] ▶ Analyzing ${input.repo} @ ${branch} (max ${max} files)`);

  // Phase 1: Fetch file list
  let allPaths = await fetchFileTree(input.repo, branch);
  if (input.fileFilter) {
    allPaths = allPaths.filter(p => p.startsWith(input.fileFilter!));
  }
  // Prioritize source files, skip test files for main analysis
  const sourcePaths = allPaths
    .filter(p => !p.includes(".test.") && !p.includes(".spec.") && !p.includes("__tests__"))
    .slice(0, max);

  console.log(`[codeAnalyzer] Fetching ${sourcePaths.length} source files...`);

  // Phase 2: Fetch file contents
  const files = await fetchFiles(input.repo, sourcePaths, branch);
  const filesAnalyzed = Object.keys(files).length;
  console.log(`[codeAnalyzer] Fetched ${filesAnalyzed} files`);

  // Phase 3: Run all analysis passes in parallel
  const [secIssues, perfIssues, deadIssues, testIssues, callGraph] = await Promise.all([
    Promise.resolve(scanForSecurity(files)),
    Promise.resolve(scanForPerformance(files)),
    Promise.resolve(detectDeadCode(files, allPaths)),
    Promise.resolve(detectTestGaps(files, allPaths)),
    Promise.resolve(buildCallGraph(files)),
  ]);

  // Phase 4: Merge and deduplicate issues
  const allIssues: CodeIssue[] = [
    ...secIssues,
    ...perfIssues,
    ...deadIssues,
    ...testIssues,
  ];

  // Sort: critical → high → medium → low
  const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Phase 5: Build summary
  const byType: Record<IssueType, number> = {
    security: 0, performance: 0, logic: 0, quality: 0, testing: 0,
  };
  for (const issue of allIssues) {
    byType[issue.type] = (byType[issue.type] ?? 0) + 1;
  }

  const summary = {
    total    : allIssues.length,
    critical : allIssues.filter(i => i.severity === "critical").length,
    high     : allIssues.filter(i => i.severity === "high").length,
    medium   : allIssues.filter(i => i.severity === "medium").length,
    low      : allIssues.filter(i => i.severity === "low").length,
    byType,
    filesAnalyzed,
  };

  console.log(`[codeAnalyzer] Found ${allIssues.length} issues: ${summary.critical} critical, ${summary.high} high`);

  // Phase 6: Inject tasks
  let tasksCreated = 0;
  let taskIds: string[] = [];
  if (input.injectTasks !== false) {
    const result = await injectTasks(allIssues);
    tasksCreated = result.created;
    taskIds      = result.ids;
    console.log(`[codeAnalyzer] Injected ${tasksCreated} repair tasks`);
  }

  return {
    issues      : allIssues,
    summary,
    callGraph,
    tasksCreated,
    taskIds,
    analysisMs  : Date.now() - t0,
    repo        : input.repo,
    analyzedAt  : new Date().toISOString(),
  };
}
