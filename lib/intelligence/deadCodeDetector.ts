// lib/intelligence/deadCodeDetector.ts
// Purpose: Dead code detector — finds unused exports, orphaned React components,
//          dead API routes, and unused import statements across the codebase.
// Date: 2026-03-07

import type { CodeIssue } from "./codeAnalyzer";

export type DeadCodeIssue = CodeIssue;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract all named exports from a file */
function extractExports(content: string, file: string): string[] {
  const exports: string[] = [];

  // export const/let/var/function/class Foo
  const namedRe = /export\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(content)) !== null) {
    exports.push(m[1]);
  }

  // export { Foo, Bar as Baz }
  const bracketRe = /export\s*\{([^}]+)\}/g;
  while ((m = bracketRe.exec(content)) !== null) {
    const names = m[1].split(",").map(s => s.trim().split(/\s+as\s+/)[1]?.trim() ?? s.trim().split(/\s+as\s+/)[0].trim());
    exports.push(...names.filter(n => n && n !== "default"));
  }

  return [...new Set(exports)];
}

/** Extract all import statements from a file */
function extractImports(content: string): Array<{ names: string[]; from: string; line: number }> {
  const imports: Array<{ names: string[]; from: string; line: number }> = [];
  const lines = content.split("\n");

  // import { A, B } from 'module'
  // import A from 'module'
  // import * as A from 'module'
  const importRe = /^import\s+(?:\*\s+as\s+(\w+)|\{([^}]+)\}|([A-Za-z_$]\w*))(?:\s*,\s*\{([^}]+)\})?\s+from\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;

  while ((m = importRe.exec(content)) !== null) {
    const lineNum = content.slice(0, m.index).split("\n").length;
    const names: string[] = [];

    if (m[1]) names.push(m[1]);  // * as X
    if (m[2]) names.push(...m[2].split(",").map(s => s.trim().split(/\s+as\s+/)[1]?.trim() ?? s.trim()));
    if (m[3]) names.push(m[3]);  // default import
    if (m[4]) names.push(...m[4].split(",").map(s => s.trim().split(/\s+as\s+/)[1]?.trim() ?? s.trim()));

    imports.push({ names: names.filter(Boolean), from: m[5], line: lineNum });
  }

  return imports;
}

/** Count occurrences of an identifier in content (excluding its definition) */
function countUsages(identifier: string, content: string, definitionLine?: number): number {
  // Match identifier as a standalone word
  const re = new RegExp(`\\b${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
  let count = 0;
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    if (definitionLine !== undefined && i + 1 === definitionLine) return; // skip def line
    const matches = line.match(re);
    if (matches) count += matches.length;
  });

  return count;
}

// ── Dead code detectors ────────────────────────────────────────────────────

/** Find unused imports within a single file */
function findUnusedImports(content: string, file: string): DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];
  const imports = extractImports(content);

  for (const imp of imports) {
    for (const name of imp.names) {
      if (!name || name.length < 2) continue;
      // Count usages OUTSIDE import lines
      const contentWithoutImports = content.replace(/^import\s[^\n]+\n/gm, "");
      const usages = countUsages(name, contentWithoutImports);

      if (usages === 0) {
        issues.push({
          severity     : "low",
          type         : "quality",
          file,
          line         : imp.line,
          description  : `Unused import: '${name}' from '${imp.from}'`,
          suggested_fix: `Remove the unused import '${name}' from '${imp.from}'.`,
          rule         : "UNUSED_IMPORT",
        });
      }
    }
  }

  return issues;
}

/** Find exported functions/components never imported anywhere else */
function findUnusedExports(
  files: Record<string, string>,
  allPaths: string[]
): DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  // Build a global index of all identifiers referenced across all files
  const allContent = Object.values(files).join("\n");

  for (const [file, content] of Object.entries(files)) {
    const exports = extractExports(content, file);

    for (const exportName of exports) {
      // Skip common patterns: default, React components in page files, type exports
      if (exportName === "default") continue;
      if (file.match(/\/(pages?|app)\//i) && exportName.match(/^[A-Z]/)) continue; // Next.js pages
      if (file.match(/route\.(ts|js)$/i)) continue;  // API routes are used by Next.js router
      if (exportName.length < 3) continue;

      // Count cross-file usages (subtract in-file definition)
      const globalUsages = countUsages(exportName, allContent);
      const inFileUsages = countUsages(exportName, content);
      const crossFileUsages = globalUsages - inFileUsages;

      if (crossFileUsages === 0) {
        issues.push({
          severity     : "low",
          type         : "quality",
          file,
          description  : `Potentially unused export: '${exportName}' has no cross-file references`,
          suggested_fix: `Verify if '${exportName}' is used via dynamic import or external consumers. If unused, remove or mark as @internal.`,
          rule         : "UNUSED_EXPORT",
        });
      }
    }
  }

  // Cap to avoid noise
  return issues.slice(0, 30);
}

/** Find dead API routes — route files that are never called from client code */
function findDeadRoutes(
  files: Record<string, string>,
  allPaths: string[]
): DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  // Collect all API route paths
  const routeFiles = allPaths.filter(p =>
    p.match(/^app\/api\/.*\/route\.(ts|js)$/) ||
    p.match(/^pages\/api\/.*\.(ts|js)$/)
  );

  // Collect all fetch() / axios / useSWR calls across client/component files
  const clientContent = Object.entries(files)
    .filter(([p]) => p.match(/\/(components?|hooks?|pages?|app)\//i) && !p.includes("/api/"))
    .map(([, c]) => c)
    .join("\n");

  for (const routeFile of routeFiles) {
    // Extract the route path from file path
    let routePath = routeFile
      .replace(/^app/, "")
      .replace(/^pages/, "")
      .replace(/\/route\.(ts|js)$/, "")
      .replace(/\.(ts|js)$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1"); // [id] → :id

    // Check if this path is referenced in client code
    const pathParts = routePath.split("/").filter(Boolean);
    const leafSegment = pathParts[pathParts.length - 1];

    if (!leafSegment || leafSegment.startsWith(":")) continue;

    const referenced = clientContent.includes(`"${routePath}"`) ||
                       clientContent.includes(`'${routePath}'`) ||
                       clientContent.includes(`\`${routePath}\``) ||
                       clientContent.includes(`/${leafSegment}`);

    if (!referenced) {
      issues.push({
        severity     : "low",
        type         : "quality",
        file         : routeFile,
        description  : `Potentially dead API route: ${routePath} — no client references found`,
        suggested_fix: `Verify ${routePath} is used via external callers, cron jobs, or webhooks before removing.`,
        rule         : "DEAD_ROUTE",
      });
    }
  }

  return issues.slice(0, 20);
}

// ── Main detector ──────────────────────────────────────────────────────────

export function detectDeadCode(
  files   : Record<string, string>,
  allPaths: string[]
): DeadCodeIssue[] {
  const issues: DeadCodeIssue[] = [];

  // Unused imports per file (run on source files only)
  for (const [file, content] of Object.entries(files)) {
    if (!file.match(/\.(ts|tsx|js|jsx)$/)) continue;
    issues.push(...findUnusedImports(content, file));
  }

  // Unused exports across files
  issues.push(...findUnusedExports(files, allPaths));

  // Dead routes
  issues.push(...findDeadRoutes(files, allPaths));

  return issues;
}
