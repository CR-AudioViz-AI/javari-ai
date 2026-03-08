// lib/repair/patchGenerator.ts
// Purpose: Patch generator — fetches source file from GitHub, applies the repair
//          strategy (regex substitution, pattern replacement, AI rewrite, test
//          file generation), and returns the patched file content.
// Date: 2026-03-07

import { getSecret }        from "@/lib/platform-secrets/getSecret";
import { executeGateway }   from "@/lib/execution/gateway";
import type { RepairPlan }  from "./repairPlanner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PatchResult {
  ok            : boolean;
  plan          : RepairPlan;
  originalContent: string;
  patchedContent : string;
  patchSummary  : string;
  newFilePath?  : string;   // set for add_test_file strategy (new file, not same file)
  error?        : string;
}

// ── GitHub file fetcher ────────────────────────────────────────────────────

async function resolveGitHubToken(): Promise<string> {
  try { const t = await getSecret("GITHUB_TOKEN"); if (t) return t; } catch {}
  return process.env.GITHUB_TOKEN ?? process.env.GH_PAT ?? "";
}

async function fetchFileFromGitHub(
  repo   : string,
  path   : string,
  branch : string = "main"
): Promise<string> {
  const token = await resolveGitHubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "javari-repair/1.0",
  };
  if (token) headers.Authorization = `token ${token}`;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`,
    { headers, signal: AbortSignal.timeout(15_000) }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  const d = await res.json() as { content?: string };
  if (!d.content) throw new Error(`No content for ${path}`);
  return Buffer.from(d.content.replace(/\n/g, ""), "base64").toString("utf-8");
}

// ── Pattern-based patchers ─────────────────────────────────────────────────

function patchAddTimeout(content: string): string {
  // Add AbortSignal.timeout(10_000) to fetch() calls missing a signal
  return content.replace(
    /\bfetch\s*\(\s*([^,)]+)\s*\)/g,
    (match, url) => {
      if (match.includes("signal") || match.includes("AbortSignal")) return match;
      return `fetch(${url}, { signal: AbortSignal.timeout(10_000) })`;
    }
  ).replace(
    /\bfetch\s*\(\s*([^,)]+)\s*,\s*(\{[^}]*\})\s*\)/g,
    (match, url, opts) => {
      if (match.includes("signal") || match.includes("AbortSignal")) return match;
      const trimmed = opts.trimEnd();
      const inner = trimmed.endsWith("}") ? trimmed.slice(0, -1).trimEnd() : trimmed;
      return `fetch(${url}, ${inner}, signal: AbortSignal.timeout(10_000) })`;
    }
  );
}

function patchRemoveUnusedImport(content: string, line: number): string {
  const lines = content.split("\n");
  if (line > 0 && line <= lines.length) {
    const targetLine = lines[line - 1];
    if (targetLine.trim().startsWith("import")) {
      // Comment out rather than delete — safer, preserves line numbers
      lines[line - 1] = `// [javari-repair] removed unused import: ${targetLine.trim()}`;
    }
  }
  return lines.join("\n");
}

function patchBarrelImport(content: string, rule: string): string {
  if (rule === "BARREL_IMPORT_LODASH") {
    return content.replace(
      /import\s+_\s+from\s+["']lodash["']/g,
      `// [javari-repair] replaced lodash barrel import — use specific imports e.g. import debounce from 'lodash/debounce'`
    );
  }
  if (rule === "BARREL_IMPORT_MOMENT") {
    return content.replace(
      /import\s+moment\s+from\s+["']moment["']/g,
      `// [javari-repair] replaced moment.js — migrate to: import { format, parseISO } from 'date-fns'`
    );
  }
  return content;
}

function patchSyncFS(content: string): string {
  return content
    .replace(/\bfs\.readFileSync\s*\(/g,  "// [javari-repair] async-ify: await fs.promises.readFile(")
    .replace(/\bfs\.writeFileSync\s*\(/g, "// [javari-repair] async-ify: await fs.promises.writeFile(")
    .replace(/\bexecSync\s*\(/g,          "// [javari-repair] async-ify: await exec(")
    .replace(/\bspawnSync\s*\(/g,         "// [javari-repair] async-ify: await spawn(");
}

function patchDangerousEval(content: string): string {
  return content
    .replace(
      /(?<![A-Za-z0-9_$])eval\s*\(([^)]*)\)/g,
      "JSON.parse($1) /* [javari-repair] eval replaced — verify this is JSON */"
    )
    .replace(
      /new\s+Function\s*\(/g,
      "/* [javari-repair] new Function() removed — use static function definition */ void ("
    );
}

// ── Test file generator ────────────────────────────────────────────────────

async function generateTestFile(
  sourceContent: string,
  sourceFile   : string,
  userId       : string
): Promise<string> {
  const result = await executeGateway({
    input: `Generate a complete test file for the following TypeScript module.

SOURCE FILE: ${sourceFile}
\`\`\`typescript
${sourceContent.slice(0, 6000)}
\`\`\`

REQUIREMENTS:
1. Use Jest + TypeScript (import syntax, @jest/globals or global jest types)
2. Import each exported function/class from the source file
3. Write meaningful describe() + it() blocks for each export
4. Include at least one happy-path test and one error/edge-case test per export
5. Mock external dependencies (supabase, fetch, file system) appropriately
6. Return ONLY the complete test file content. No markdown. No explanation.
7. The test file path should be: ${sourceFile.replace(/\.(ts|tsx)$/, ".test.ts")}`,
    mode           : "auto",
    userId,
    routingPriority: "quality",
  });
  return typeof result.output === "string" ? result.output : "";
}

// ── AI-driven full rewrite ─────────────────────────────────────────────────

async function generateAIPatch(
  plan         : RepairPlan,
  fileContent  : string,
  userId       : string
): Promise<string> {
  const prompt = plan.aiPrompt.replace("{{FILE_CONTENT}}", fileContent.slice(0, 8000));
  const result = await executeGateway({
    input          : prompt,
    mode           : "auto",
    userId,
    routingPriority: "quality",
  });
  return typeof result.output === "string" ? result.output : fileContent;
}

// ── Main patch generator ───────────────────────────────────────────────────

export async function generatePatch(
  plan  : RepairPlan,
  repo  : string,
  branch: string = "main",
  userId: string = "system"
): Promise<PatchResult> {
  let originalContent = "";
  let patchedContent  = "";
  let newFilePath: string | undefined;

  try {
    // Fetch source file
    originalContent = await fetchFileFromGitHub(repo, plan.targetFile, branch);

    const rule = (plan.issue as { rule?: string }).rule ?? "";

    switch (plan.strategy) {
      case "add_timeout":
        patchedContent = patchAddTimeout(originalContent);
        break;

      case "remove_dead_code":
        patchedContent = patchRemoveUnusedImport(originalContent, plan.issue.line ?? 0);
        break;

      case "replace_pattern":
        if (rule === "BARREL_IMPORT_LODASH" || rule === "BARREL_IMPORT_MOMENT") {
          patchedContent = patchBarrelImport(originalContent, rule);
        } else if (rule === "SYNC_FS_READ" || rule === "SYNC_FS_WRITE" || rule === "SYNC_EXEC") {
          patchedContent = patchSyncFS(originalContent);
        } else if (rule === "DANGEROUS_EVAL" || rule === "DANGEROUS_FUNCTION_CONSTRUCTOR") {
          patchedContent = patchDangerousEval(originalContent);
        } else {
          // For hardcoded secrets etc — use AI
          patchedContent = await generateAIPatch(plan, originalContent, userId);
        }
        break;

      case "add_comment_only":
        // Low-risk: just add a TODO resolution comment header
        patchedContent = `// [javari-repair] Issue acknowledged: ${plan.issue.description.slice(0, 80)}\n// Suggested fix: ${plan.issue.suggested_fix.slice(0, 100)}\n// Review and address manually if needed.\n\n` + originalContent;
        break;

      case "add_test_file":
        patchedContent = await generateTestFile(originalContent, plan.targetFile, userId);
        newFilePath = plan.targetFile.replace(/\.(ts|tsx|js|jsx)$/, ".test.ts");
        break;

      case "parameterize_sql":
      case "refactor_query":
      case "insert_guard":
      case "ai_rewrite":
      default:
        patchedContent = await generateAIPatch(plan, originalContent, userId);
        break;
    }

    if (!patchedContent.trim()) {
      patchedContent = originalContent; // fallback — no changes
    }

    const changed = patchedContent !== originalContent;
    const summary = changed
      ? `Strategy: ${plan.strategy} | Changed ${Math.abs(patchedContent.length - originalContent.length)} bytes`
      : "No changes generated (content identical to original)";

    return {
      ok: true,
      plan,
      originalContent,
      patchedContent,
      patchSummary: summary,
      newFilePath,
    };

  } catch (err) {
    return {
      ok            : false,
      plan,
      originalContent,
      patchedContent: originalContent,
      patchSummary  : `Patch failed: ${String(err)}`,
      error         : String(err),
    };
  }
}
