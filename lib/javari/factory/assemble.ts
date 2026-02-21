// lib/javari/factory/assemble.ts
// Javari Module Factory — Module Assembler
// 2026-02-20 — STEP 4 implementation
//
// Collects outputs from all generators, resolves conflicts,
// normalizes formatting, and packages a ready-to-commit module bundle.

import type { ModuleBlueprint } from "./blueprint";
import type { FileNode, ModuleFileTree } from "./file-tree";
import { updateFileNode } from "./file-tree";
import type { GeneratorResult } from "./generators/index";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleBundle {
  moduleId:      string;
  moduleName:    string;
  blueprint:     ModuleBlueprint;
  files:         BundleFile[];
  totalFiles:    number;
  successFiles:  number;
  failedFiles:   number;
  warnings:      string[];
  durationMs:    number;
  createdAt:     string;
  readyToCommit: boolean;
}

export interface BundleFile {
  path:     string;
  content:  string;
  category: string;
  agentRole: string;
  validationScore?: number;
  lineCount: number;
  charCount: number;
}

export interface AssemblerConflict {
  path:    string;
  sources: Array<{ agentRole: string; content: string; score?: number }>;
  resolution: string;
  winner:  string;
}

// ── Normalizers ───────────────────────────────────────────────────────────────

/**
 * normalizeTypeScript — lightweight post-processing without Prettier dependency.
 * Ensures consistent indentation, removes double blank lines, trims trailing spaces.
 */
function normalizeTypeScript(content: string): string {
  if (!content?.trim()) return content ?? "";

  return content
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    // Remove trailing whitespace per line
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    // Collapse 3+ consecutive blank lines to 2
    .replace(/\n{3,}/g, "\n\n")
    // Ensure file ends with single newline
    .trimEnd() + "\n";
}

/**
 * normalizeSQL — clean SQL formatting.
 */
function normalizeSQL(content: string): string {
  if (!content?.trim()) return content ?? "";
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

function normalize(content: string, path: string): string {
  if (path.endsWith(".sql")) return normalizeSQL(content);
  return normalizeTypeScript(content);
}

// ── Conflict resolution ───────────────────────────────────────────────────────

function resolveConflict(conflict: AssemblerConflict): string {
  // Pick highest-scored source; ties → last source wins (most recent agent)
  const best = conflict.sources.reduce((a, b) =>
    (b.score ?? 70) >= (a.score ?? 70) ? b : a
  );
  conflict.resolution = `Picked ${best.agentRole} (score=${best.score ?? "??"})`;
  conflict.winner = best.agentRole;
  return best.content;
}

// ── Main assembler ────────────────────────────────────────────────────────────

/**
 * assembleModule — collect generator results into a ready-to-commit bundle.
 * Handles duplicate paths (conflict resolution), normalizes formatting,
 * tracks warnings, and produces final metadata.
 */
export function assembleModule(
  blueprint: ModuleBlueprint,
  results:   GeneratorResult[],
  tree:      ModuleFileTree,
  startMs:   number
): ModuleBundle {
  const warnings: string[] = [];
  const conflicts: AssemblerConflict[] = [];

  // Group by path to detect conflicts
  const byPath = new Map<string, GeneratorResult[]>();
  for (const r of results) {
    if (!r.success || !r.content?.trim()) continue;
    const existing = byPath.get(r.path) ?? [];
    byPath.set(r.path, [...existing, r]);
  }

  // Resolve and normalize
  const bundleFiles: BundleFile[] = [];

  for (const [path, sources] of byPath.entries()) {
    let content: string;
    let agentRole: string;
    let validationScore: number | undefined;

    if (sources.length === 1) {
      content         = sources[0].content;
      agentRole       = sources[0].agentRole;
      validationScore = sources[0].validationScore;
    } else {
      // Multiple agents generated same file — conflict
      const conflict: AssemblerConflict = {
        path,
        sources: sources.map((s) => ({
          agentRole: s.agentRole,
          content:   s.content,
          score:     s.validationScore,
        })),
        resolution: "",
        winner:     "",
      };
      content   = resolveConflict(conflict);
      agentRole = conflict.winner;
      conflicts.push(conflict);
      warnings.push(`Conflict resolved for ${path}: ${conflict.resolution}`);
    }

    // Normalize formatting
    const normalized = normalize(content, path);

    // Category heuristic
    const category =
      path.includes("/api/")           ? "api_route"  :
      path.includes("/page.")          ? "page"        :
      path.includes("/layout.")        ? "layout"      :
      path.includes("/components/")    ? "component"   :
      path.includes("/types/")         ? "type"        :
      path.includes("/utils/")         ? "util"        :
      path.endsWith(".sql")            ? "schema"      :
      path.includes("/__tests__/")     ? "test"        :
      "index";

    bundleFiles.push({
      path,
      content:    normalized,
      category,
      agentRole,
      validationScore,
      lineCount:  normalized.split("\n").length,
      charCount:  normalized.length,
    });
  }

  // Track failed files
  const failedPaths = results
    .filter((r) => !r.success)
    .map((r) => r.path);

  if (failedPaths.length) {
    warnings.push(`${failedPaths.length} file(s) failed generation: ${failedPaths.slice(0, 5).join(", ")}`);
  }

  // Validate: check all expected paths were generated
  const expectedPaths = new Set<string>();
  for (const route of blueprint.routes) {
    expectedPaths.add(`app${route.path}/page.tsx`);
  }
  for (const api of blueprint.apis) {
    expectedPaths.add(`app${api.path}/route.ts`);
  }
  for (const comp of blueprint.components) {
    expectedPaths.add(comp.path);
  }
  for (const path of expectedPaths) {
    if (!byPath.has(path)) {
      warnings.push(`Expected file not generated: ${path}`);
    }
  }

  const successFiles  = bundleFiles.length;
  const failedFiles   = failedPaths.length;
  const readyToCommit = failedFiles === 0 && successFiles > 0 && warnings.length === 0;

  return {
    moduleId:      blueprint.moduleId,
    moduleName:    blueprint.moduleName,
    blueprint,
    files:         bundleFiles,
    totalFiles:    successFiles + failedFiles,
    successFiles,
    failedFiles,
    warnings,
    durationMs:    Date.now() - startMs,
    createdAt:     new Date().toISOString(),
    readyToCommit,
  };
}

/**
 * bundleToFileMap — convert ModuleBundle to a simple path→content map
 * for use by GitHub API commit or direct download.
 */
export function bundleToFileMap(bundle: ModuleBundle): Record<string, string> {
  return Object.fromEntries(bundle.files.map((f) => [f.path, f.content]));
}

/**
 * bundleSummary — concise text summary for SSE events / logging.
 */
export function bundleSummary(bundle: ModuleBundle): string {
  return [
    `Module: ${bundle.moduleName}`,
    `Files: ${bundle.successFiles}/${bundle.totalFiles} generated`,
    `Lines: ${bundle.files.reduce((s, f) => s + f.lineCount, 0)} total`,
    bundle.warnings.length ? `Warnings: ${bundle.warnings.length}` : null,
    `Ready: ${bundle.readyToCommit ? "✅" : "⚠️"}`,
    `Duration: ${(bundle.durationMs / 1000).toFixed(1)}s`,
  ].filter(Boolean).join(" | ");
}
