// lib/ecosystem/deduplicationEngine.ts
// Purpose: Cross-app deduplication engine — detects duplicated utility functions,
//          database queries, API clients, and shared components across repos.
//          Uses function signature similarity, import graph overlap, and hash
//          comparison to find consolidation opportunities.
// Date: 2026-03-07

import { createClient }   from "@supabase/supabase-js";
import { recordArtifact } from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export type DuplicateType =
  | "utility_function" | "db_query" | "api_client"
  | "component" | "hook" | "type_definition" | "config";

export interface DuplicateEntry {
  fileA      : string;
  fileB      : string;
  repoA      : string;
  repoB      : string;
  similarity : number;            // 0.0 – 1.0
  type       : DuplicateType;
  symbolA?   : string;            // function/class name in fileA
  symbolB?   : string;            // function/class name in fileB
  linesA     : number;
  linesB     : number;
  recommendation: "extract_shared_module" | "merge" | "delete_duplicate" | "review";
  rationale  : string;
}

export interface DeduplicationResult {
  duplicates   : DuplicateEntry[];
  filesAnalyzed: number;
  tasksCreated : number;
  taskIds      : string[];
  summary      : { total: number; highSimilarity: number; byType: Record<string, number> };
}

interface FileSnapshot {
  repo    : string;
  path    : string;
  content : string;
  hash    : string;
  symbols : string[];    // extracted function/class/const names
  imports : string[];    // import statements
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Hashing ────────────────────────────────────────────────────────────────

function simpleHash(s: string): string {
  // djb2 hash — fast, good distribution for similarity bucketing
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16);
}

function normalizeContent(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")    // strip block comments
    .replace(/\/\/.*/g, "")              // strip line comments
    .replace(/import[^;]+;/g, "")        // strip imports
    .replace(/export\s+default/g, "")    // strip export keywords
    .replace(/\s+/g, " ")                // normalize whitespace
    .replace(/["'`]/g, '"')              // normalize quotes
    .trim();
}

// ── Similarity scoring ─────────────────────────────────────────────────────

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function contentSimilarity(a: string, b: string): number {
  // Normalize then compare ngrams (trigrams of words)
  const normA = normalizeContent(a);
  const normB = normalizeContent(b);

  if (normA === normB) return 1.0;

  const wordsA = normA.split(" ").filter(Boolean);
  const wordsB = normB.split(" ").filter(Boolean);

  // Use 3-gram window
  const ngrams = (words: string[], n: number) => {
    const result: string[] = [];
    for (let i = 0; i <= words.length - n; i++) {
      result.push(words.slice(i, i + n).join(" "));
    }
    return result;
  };

  const triA = ngrams(wordsA, 3);
  const triB = ngrams(wordsB, 3);

  if (triA.length === 0 && triB.length === 0) return 0.5;
  return jaccardSimilarity(triA, triB);
}

// ── Symbol extractor ───────────────────────────────────────────────────────

function extractSymbols(content: string): string[] {
  const symbols: string[] = [];
  // Function declarations
  const fnPat = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = fnPat.exec(content)) !== null) symbols.push(m[1]);
  // Arrow functions assigned to const
  const arrowPat = /export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  while ((m = arrowPat.exec(content)) !== null) symbols.push(m[1]);
  // Class declarations
  const classPat = /(?:export\s+)?class\s+(\w+)/g;
  while ((m = classPat.exec(content)) !== null) symbols.push(m[1]);
  return [...new Set(symbols)];
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importPat = /from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importPat.exec(content)) !== null) imports.push(m[1]);
  return [...new Set(imports)];
}

function classifyFile(path: string, content: string): DuplicateType {
  if (/\.(tsx|jsx)/.test(path) && /return\s*\(/.test(content)) return "component";
  if (path.includes("/hooks/") || /^use[A-Z]/.test(path.split("/").pop() ?? "")) return "hook";
  if (path.includes("/types/") || path.endsWith(".d.ts")) return "type_definition";
  if (path.includes("/config/") || path.endsWith(".config.ts")) return "config";
  if (/supabase|prisma|query|select\s*\(/.test(content)) return "db_query";
  if (/fetch\(|axios\.|createClient/.test(content)) return "api_client";
  return "utility_function";
}

// ── GitHub file fetcher ────────────────────────────────────────────────────

const GH_TOKEN = process.env.GH_PAT ?? process.env.GITHUB_TOKEN ?? "";

async function fetchSnapshots(
  repos   : string[],
  maxFiles: number = 50
): Promise<FileSnapshot[]> {
  if (!GH_TOKEN) return [];

  const snapshots: FileSnapshot[] = [];

  for (const repo of repos) {
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/main?recursive=1`,
        { headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "javari-dedup/1.0" },
          signal: AbortSignal.timeout(15_000) }
      );
      if (!treeRes.ok) continue;
      const tree = await treeRes.json() as { tree: Array<{ path: string; type: string }> };

      const utilFiles = (tree.tree ?? [])
        .filter(f => f.type === "blob" &&
          (f.path.endsWith(".ts") || f.path.endsWith(".tsx")) &&
          !f.path.includes("node_modules") && !f.path.includes(".next") &&
          !f.path.includes("__tests__") && !f.path.endsWith(".test.ts"))
        .slice(0, maxFiles);

      for (let i = 0; i < utilFiles.length; i += 8) {
        const batch = utilFiles.slice(i, i + 8);
        const results = await Promise.allSettled(
          batch.map(async f => {
            const r = await fetch(
              `https://api.github.com/repos/${repo}/contents/${f.path}?ref=main`,
              { headers: { Authorization: `token ${GH_TOKEN}`, "User-Agent": "javari-dedup/1.0" },
                signal: AbortSignal.timeout(8_000) }
            );
            if (!r.ok) return null;
            const d = await r.json() as { content?: string };
            const content = d.content
              ? Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf8")
              : "";
            return {
              repo, path: f.path, content,
              hash   : simpleHash(normalizeContent(content)),
              symbols: extractSymbols(content),
              imports: extractImports(content),
            } as FileSnapshot;
          })
        );
        results.forEach(r => { if (r.status === "fulfilled" && r.value) snapshots.push(r.value); });
      }
    } catch (e) {
      console.error(`[dedup] fetchSnapshots ${repo}: ${(e as Error).message}`);
    }
  }

  return snapshots;
}

// ── Comparison engine ──────────────────────────────────────────────────────

function compareSnapshots(snapshots: FileSnapshot[]): DuplicateEntry[] {
  const duplicates: DuplicateEntry[] = [];
  const SIMILARITY_THRESHOLD = 0.65;

  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const a = snapshots[i];
      const b = snapshots[j];

      // Skip same-repo same-file
      if (a.repo === b.repo && a.path === b.path) continue;
      // Skip tiny files (< 5 meaningful lines)
      if (a.content.split("\n").length < 5 || b.content.split("\n").length < 5) continue;

      // Fast check: exact hash match
      const exactMatch = a.hash === b.hash && a.hash !== simpleHash("");

      let similarity = 0;
      if (exactMatch) {
        similarity = 1.0;
      } else {
        // Symbol overlap (fast)
        const symbolSim = jaccardSimilarity(a.symbols, b.symbols);
        if (symbolSim < 0.3) continue; // Early exit — too different

        // Import overlap
        const importSim = jaccardSimilarity(a.imports, b.imports);

        // Content similarity (slower — only run if symbol/import sim is promising)
        const combined = (symbolSim * 0.4 + importSim * 0.3);
        if (combined < 0.35) continue;

        const contentSim = contentSimilarity(a.content, b.content);
        similarity = symbolSim * 0.35 + importSim * 0.25 + contentSim * 0.40;
      }

      if (similarity < SIMILARITY_THRESHOLD) continue;

      const type = classifyFile(a.path, a.content);
      const recommendation: DuplicateEntry["recommendation"] =
        similarity >= 0.95 ? "delete_duplicate"
        : similarity >= 0.80 ? "extract_shared_module"
        : similarity >= 0.65 ? "merge"
        : "review";

      const rationale = exactMatch
        ? "Files are byte-for-byte identical after normalization"
        : `${Math.round(similarity * 100)}% similar — ${
            type === "utility_function" ? "shared utility logic detected" :
            type === "api_client" ? "duplicate API client pattern" :
            type === "db_query" ? "overlapping database query logic" :
            "overlapping implementation"
          }`;

      // Find common symbols
      const commonSymbols = a.symbols.filter(s => b.symbols.includes(s));

      duplicates.push({
        fileA: a.path, fileB: b.path,
        repoA: a.repo, repoB: b.repo,
        similarity: Math.round(similarity * 100) / 100,
        type,
        symbolA: commonSymbols[0],
        symbolB: commonSymbols[0],
        linesA: a.content.split("\n").length,
        linesB: b.content.split("\n").length,
        recommendation,
        rationale,
      });
    }
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

// ── Task seeder ────────────────────────────────────────────────────────────

async function seedDedupTasks(duplicates: DuplicateEntry[]): Promise<{ count: number; ids: string[] }> {
  const highPriority = duplicates.filter(d => d.similarity >= 0.80).slice(0, 10);
  if (highPriority.length === 0) return { count: 0, ids: [] };

  const ts   = Date.now();
  const rows = highPriority.map((d, i) => {
    const slug = `${d.fileA.split("/").pop()}-${d.fileB.split("/").pop()}`.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, "-");
    const id   = `dedup-${slug}-${ts + i}`.slice(0, 80);
    return {
      id,
      phase_id   : "maintenance",
      title      : `[DEDUP][${Math.round(d.similarity*100)}%] ${d.recommendation.replace("_"," ")} — ${d.fileA.split("/").pop()} ↔ ${d.fileB.split("/").pop()}`,
      description: `[type:ai_task] executor:repair_code\n` +
        `Duplicate detected: ${d.recommendation.replace(/_/g," ")}\n` +
        `FileA: ${d.repoA}/${d.fileA}\n` +
        `FileB: ${d.repoB}/${d.fileB}\n` +
        `Similarity: ${Math.round(d.similarity*100)}%  Type: ${d.type}\n` +
        `Rationale: ${d.rationale}\n\n` +
        `\`\`\`json\n${JSON.stringify([{
          severity: d.similarity >= 0.95 ? "high" : "medium",
          type: "duplicate_code",
          file: `${d.repoA}/${d.fileA}`,
          description: d.rationale,
          suggested_fix: `${d.recommendation}: Extract shared logic to a common library. FileB: ${d.repoB}/${d.fileB}`,
          rule: `DUPLICATE_${d.type.toUpperCase()}`,
        }], null, 2)}\n\`\`\``,
      depends_on : [],
      status     : "pending",
      source     : "dedup_engine",
      updated_at : ts + i,
    };
  });

  const { data: existing } = await db()
    .from("roadmap_tasks")
    .select("id")
    .in("id", rows.map(r => r.id));
  const existingSet = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const toInsert = rows.filter(r => !existingSet.has(r.id));

  if (toInsert.length === 0) return { count: 0, ids: [] };
  const { error } = await db().from("roadmap_tasks").insert(toInsert);
  if (error) return { count: 0, ids: [] };
  return { count: toInsert.length, ids: toInsert.map(r => r.id) };
}

// ── Main function ──────────────────────────────────────────────────────────

export async function runDeduplicationEngine(
  repos     : string[],
  taskId?   : string,
  seedTasks : boolean = true
): Promise<DeduplicationResult> {
  const snapshots  = await fetchSnapshots(repos, 40);
  const duplicates = compareSnapshots(snapshots);

  let tasksCreated = 0;
  let taskIds: string[] = [];

  if (seedTasks && duplicates.length > 0) {
    const result = await seedDedupTasks(duplicates);
    tasksCreated = result.count;
    taskIds      = result.ids;
  }

  if (taskId && duplicates.length > 0) {
    await recordArtifact({
      task_id         : taskId,
      artifact_type   : "dedupe_plan" as never,
      artifact_location: "supabase/roadmap_task_artifacts",
      artifact_data   : { duplicates: duplicates.slice(0, 20), filesAnalyzed: snapshots.length },
    });
  }

  const byType = duplicates.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    duplicates,
    filesAnalyzed: snapshots.length,
    tasksCreated,
    taskIds,
    summary: {
      total          : duplicates.length,
      highSimilarity : duplicates.filter(d => d.similarity >= 0.80).length,
      byType,
    },
  };
}
