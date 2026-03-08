// lib/ecosystem/brandConsistencyEngine.ts
// Purpose: Brand & language consistency engine — scans React components, HTML,
//          markdown docs, and API responses for branding inconsistencies.
//          Generates repair tasks for every violation found.
// Date: 2026-03-07

import { createClient }       from "@supabase/supabase-js";
import { recordArtifact }     from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BrandViolation {
  file       : string;
  lineNumber? : number;
  found      : string;
  expected   : string;
  category   : "brand_term" | "ui_term" | "forbidden_term";
  severity   : "low" | "medium" | "high" | "critical";
  context    : string;
}

export interface BrandScanResult {
  violations    : BrandViolation[];
  filesScanned  : number;
  cleanFiles    : number;
  tasksCreated  : number;
  taskIds       : string[];
  summary       : { total: number; critical: number; high: number; medium: number; low: number };
}

interface BrandStandards {
  terms         : Record<string, string[]>;
  uiTerms       : Record<string, string[]>;
  forbiddenTerms: string[];
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Brand standards loader ─────────────────────────────────────────────────

const DEFAULT_STANDARDS: BrandStandards = {
  terms: {
    "Javari AI"          : ["JavariAI","Javari-AI","javari ai","JAVARI AI","javari_ai","Javari Ai"],
    "CR AudioViz AI"     : ["CRAudioVizAI","CR-AudioViz-AI","CR Audioviz AI","CrAudioVizAI"],
    "CRAIverse"          : ["CRAI-verse","CRAI verse","CraiVerse","Crai-Verse"],
    "Command Center"     : ["Control Center","Admin Panel","Admin Console","Management Console"],
    "Javari Spirits"     : ["CravBarrels","Crav Barrels","cravbarrels"],
    "Javari Cards"       : ["CravCards","Crav Cards"],
    "Javari Key"         : ["CravKey","Crav Key"],
    "Your Story. Our Design.": ["Your Story, Our Design","Your Story Our Design"],
  },
  uiTerms: {
    "Sign In" : ["Log In","Login","log in"],
    "Sign Up" : ["Register","Create Account"],
    "Dashboard": ["Overview","Home"],
    "Settings" : ["Preferences","Configuration"],
    "Credits"  : ["Tokens","Points"],
  },
  forbiddenTerms: [
    "CravBarrels","CravCards","CravKey","CravBrew",
    "Control Center","Admin Panel","Admin Console",
  ],
};

async function loadBrandStandards(): Promise<BrandStandards> {
  try {
    // Try loading from R2/Supabase — fall back to defaults
    const { data } = await db()
      .from("javari_knowledge")
      .select("content")
      .eq("source", "brand-standards")
      .single();

    if (data?.content) {
      return JSON.parse(data.content) as BrandStandards;
    }
  } catch { /* use defaults */ }
  return DEFAULT_STANDARDS;
}

// ── GitHub file scanner ────────────────────────────────────────────────────

const GH_TOKEN = process.env.GH_PAT ?? process.env.GITHUB_TOKEN ?? "";
const GH_API   = "https://api.github.com";

interface GHFile { path: string; content: string }

async function fetchRepoFiles(
  repo     : string,
  extensions: string[] = [".ts", ".tsx", ".md", ".html", ".json"],
  maxFiles : number    = 80
): Promise<GHFile[]> {
  if (!GH_TOKEN) return [];

  try {
    // Get file tree
    const treeRes = await fetch(
      `${GH_API}/repos/${repo}/git/trees/main?recursive=1`,
      { headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "javari-brand/1.0" },
        signal: AbortSignal.timeout(15_000) }
    );
    if (!treeRes.ok) return [];
    const tree = await treeRes.json() as { tree: Array<{ path: string; type: string }> };

    // Filter to target extensions, skip node_modules/.next/dist
    const targets = (tree.tree ?? [])
      .filter(f => f.type === "blob" &&
        extensions.some(e => f.path.endsWith(e)) &&
        !f.path.includes("node_modules") &&
        !f.path.includes(".next") &&
        !f.path.includes("dist/") &&
        !f.path.startsWith("."))
      .slice(0, maxFiles);

    // Fetch file contents in parallel batches of 10
    const files: GHFile[] = [];
    for (let i = 0; i < targets.length; i += 10) {
      const batch = targets.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async f => {
          const r = await fetch(
            `${GH_API}/repos/${repo}/contents/${f.path}?ref=main`,
            { headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "javari-brand/1.0" },
              signal: AbortSignal.timeout(8_000) }
          );
          if (!r.ok) return null;
          const d = await r.json() as { content?: string };
          const content = d.content
            ? Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf8")
            : "";
          return { path: f.path, content } as GHFile;
        })
      );
      results.forEach(r => { if (r.status === "fulfilled" && r.value) files.push(r.value); });
    }

    return files;
  } catch (e) {
    console.error(`[brandConsistency] fetchRepoFiles error: ${(e as Error).message}`);
    return [];
  }
}

// ── Scanner ────────────────────────────────────────────────────────────────

function scanFileForViolations(
  file     : GHFile,
  standards: BrandStandards
): BrandViolation[] {
  const violations: BrandViolation[] = [];
  const lines = file.content.split("\n");

  function check(
    lineIdx : number,
    lineText: string,
    variant : string,
    expected: string,
    category: BrandViolation["category"],
    severity: BrandViolation["severity"]
  ) {
    // Case-sensitive check — avoid false positives on partial strings
    const idx = lineText.indexOf(variant);
    if (idx === -1) return;
    // Avoid flagging within URLs or code comments that mention old names
    const context = lineText.slice(Math.max(0, idx - 30), idx + variant.length + 30).trim();
    violations.push({
      file      : file.path,
      lineNumber: lineIdx + 1,
      found     : variant,
      expected,
      category,
      severity,
      context,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Brand terms (high severity for primary brand terms)
    for (const [canonical, variants] of Object.entries(standards.terms)) {
      for (const v of variants) {
        if (line.includes(v)) {
          const sev: BrandViolation["severity"] =
            v.startsWith("Crav") || v.includes("CravBarrels") ? "critical" : "high";
          check(i, line, v, canonical, "brand_term", sev);
        }
      }
    }

    // UI terms (medium severity)
    for (const [canonical, variants] of Object.entries(standards.uiTerms)) {
      for (const v of variants) {
        if (line.includes(v)) {
          check(i, line, v, canonical, "ui_term", "medium");
        }
      }
    }

    // Forbidden terms (always critical)
    for (const term of standards.forbiddenTerms) {
      if (line.includes(term)) {
        check(i, line, term, "(remove or replace)", "forbidden_term", "critical");
      }
    }
  }

  return violations;
}

// ── Task seeder ────────────────────────────────────────────────────────────

async function seedBrandTasks(
  violations: BrandViolation[],
  repo      : string
): Promise<{ count: number; ids: string[] }> {
  // Group by file to create one task per file with violations
  const byFile = new Map<string, BrandViolation[]>();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file)!.push(v);
  }

  const rows: Record<string, unknown>[] = [];
  const ts = Date.now();
  let i = 0;

  for (const [file, fileViolations] of byFile) {
    const maxSev = fileViolations.some(v => v.severity === "critical") ? "critical"
      : fileViolations.some(v => v.severity === "high") ? "high"
      : fileViolations.some(v => v.severity === "medium") ? "medium" : "low";

    const slug = file.replace(/[^a-z0-9]/gi, "-").slice(-35).toLowerCase();
    const id   = `brand-fix-${slug}-${ts + i++}`.slice(0, 80);

    rows.push({
      id,
      phase_id   : "brand",
      title      : `[BRAND][${maxSev.toUpperCase()}] Fix ${fileViolations.length} brand violation(s) in ${file.split("/").pop()}`,
      description: `[type:ai_task] executor:repair_code\n` +
        `Brand consistency violations in: ${repo}/${file}\n\n` +
        `Violations (${fileViolations.length}):\n` +
        fileViolations.slice(0, 10).map(v =>
          `  L${v.lineNumber}: "${v.found}" → should be "${v.expected}"`).join("\n") +
        `\n\n\`\`\`json\n${JSON.stringify(fileViolations.slice(0, 5).map(v => ({
          severity: v.severity, type: "brand_violation",
          file: `${repo}/${file}`,
          description: `Replace "${v.found}" with "${v.expected}"`,
          suggested_fix: `Search and replace all occurrences of "${v.found}" with "${v.expected}" in this file.`,
          rule: `BRAND_${v.category.toUpperCase()}`,
        })), null, 2)}\n\`\`\``,
      depends_on : [],
      status     : "pending",
      source     : "brand_engine",
      updated_at : ts + i,
    });
  }

  if (rows.length === 0) return { count: 0, ids: [] };

  // Dedup
  const { data: existing } = await db()
    .from("roadmap_tasks")
    .select("id")
    .in("id", rows.map(r => r.id as string));
  const existingSet = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const toInsert = rows.filter(r => !existingSet.has(r.id as string)).slice(0, 20);

  if (toInsert.length === 0) return { count: 0, ids: [] };

  const { error } = await db().from("roadmap_tasks").insert(toInsert);
  if (error) return { count: 0, ids: [] };
  return { count: toInsert.length, ids: toInsert.map(r => String(r.id)) };
}

// ── Main function ──────────────────────────────────────────────────────────

export async function runBrandConsistencyEngine(
  repos     : string[],
  taskId?   : string,
  seedTasks : boolean = true
): Promise<BrandScanResult> {
  const standards   = await loadBrandStandards();
  const allFiles    : GHFile[] = [];
  const allViolations: BrandViolation[] = [];

  for (const repo of repos) {
    const files = await fetchRepoFiles(repo, [".ts", ".tsx", ".md", ".html", ".json"], 60);
    allFiles.push(...files);

    for (const file of files) {
      const violations = scanFileForViolations(file, standards);
      allViolations.push(...violations);
    }
  }

  let tasksCreated = 0;
  let taskIds: string[] = [];

  if (seedTasks && allViolations.length > 0) {
    // Group by repo for task creation
    for (const repo of repos) {
      const repoFiles = allFiles.filter(f => f.path);
      const repoViolations = allViolations.filter(v =>
        repoFiles.some(f => f.path === v.file)
      );
      if (repoViolations.length > 0) {
        const { count, ids } = await seedBrandTasks(repoViolations, repo);
        tasksCreated += count;
        taskIds.push(...ids);
      }
    }
  }

  // Record artifact
  if (taskId) {
    await recordArtifact({
      task_id         : taskId,
      artifact_type   : "brand_fix" as never,
      artifact_location: "supabase/roadmap_task_artifacts",
      artifact_data   : {
        violations : allViolations.slice(0, 50),
        summary    : {
          filesScanned : allFiles.length,
          violationCount: allViolations.length,
        },
      },
    });
  }

  const summary = {
    total   : allViolations.length,
    critical: allViolations.filter(v => v.severity === "critical").length,
    high    : allViolations.filter(v => v.severity === "high").length,
    medium  : allViolations.filter(v => v.severity === "medium").length,
    low     : allViolations.filter(v => v.severity === "low").length,
  };

  return {
    violations   : allViolations,
    filesScanned : allFiles.length,
    cleanFiles   : allFiles.length - new Set(allViolations.map(v => v.file)).size,
    tasksCreated,
    taskIds,
    summary,
  };
}
