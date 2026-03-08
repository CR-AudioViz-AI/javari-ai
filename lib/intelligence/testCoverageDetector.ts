// lib/intelligence/testCoverageDetector.ts
// Purpose: Test coverage gap detector — identifies source files that have no
//          corresponding test file and API routes / utility functions with
//          zero test coverage indicators.
// Date: 2026-03-07

import type { CodeIssue } from "./codeAnalyzer";

export type TestGapIssue = CodeIssue;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Given a source file path, return possible test file paths */
function testPaths(sourcePath: string): string[] {
  const parts     = sourcePath.split("/");
  const fileName  = parts[parts.length - 1];
  const dir       = parts.slice(0, -1).join("/");
  const base      = fileName.replace(/\.(ts|tsx|js|jsx)$/, "");

  return [
    // Same directory
    `${dir}/${base}.test.ts`,
    `${dir}/${base}.test.tsx`,
    `${dir}/${base}.test.js`,
    `${dir}/${base}.spec.ts`,
    `${dir}/${base}.spec.tsx`,
    `${dir}/${base}.spec.js`,
    // __tests__ subdirectory
    `${dir}/__tests__/${base}.test.ts`,
    `${dir}/__tests__/${base}.test.tsx`,
    `${dir}/__tests__/${base}.test.js`,
    // Top-level tests/ directory
    `tests/${sourcePath.replace(/\.(ts|tsx|js|jsx)$/, ".test.ts")}`,
    `tests/${sourcePath.replace(/\.(ts|tsx|js|jsx)$/, ".test.js")}`,
    // Vitest convention
    `${dir}/${base}.vitest.ts`,
  ];
}

/** Check if a file contains test-indicating code (describe/it/test/expect) */
function isTestFile(content: string): boolean {
  return /\b(?:describe|it|test|expect|beforeEach|afterEach|beforeAll|afterAll)\s*\(/.test(content);
}

/** Extract exported function count from source file (proxy for complexity/importance) */
function countExports(content: string): number {
  const matches = content.match(/\bexport\s+(?:const|function|class|async\s+function)/g);
  return matches?.length ?? 0;
}

/** Determine if a source file is worth testing (non-trivial, has exports) */
function isTestWorthy(content: string, path: string): boolean {
  // Skip test files themselves
  if (isTestFile(content)) return false;
  // Skip type-only files
  if (content.match(/^export\s+(?:type|interface)\s+/m) && !content.match(/\bfunction\b|\bconst\b.*=>/)) return false;
  // Skip empty or tiny files
  if (content.trim().length < 100) return false;
  // Skip config files
  if (path.match(/config\.(ts|js)$|\.d\.ts$/)) return false;
  return true;
}

// ── Detectors ──────────────────────────────────────────────────────────────

/** Files with no test at all */
function findUntestedFiles(
  files   : Record<string, string>,
  allPaths: string[]
): TestGapIssue[] {
  const issues: TestGapIssue[] = [];
  const allPathSet = new Set(allPaths);

  // Focus on high-value directories
  const HIGH_VALUE_PREFIXES = [
    "lib/",
    "app/api/",
    "src/lib/",
    "src/utils/",
    "src/services/",
    "utils/",
    "services/",
    "hooks/",
  ];

  for (const [file, content] of Object.entries(files)) {
    if (!file.match(/\.(ts|tsx|js|jsx)$/) || file.match(/\.(test|spec)\./)) continue;
    if (!HIGH_VALUE_PREFIXES.some(p => file.startsWith(p))) continue;
    if (!isTestWorthy(content, file)) continue;

    const possibleTests = testPaths(file);
    const hasTest = possibleTests.some(tp => allPathSet.has(tp));

    if (!hasTest) {
      const exportCount = countExports(content);
      const severity: CodeIssue["severity"] =
        file.startsWith("app/api/") ? "medium" :
        exportCount > 3             ? "medium" :
        "low";

      issues.push({
        severity,
        type         : "testing",
        file,
        description  : `No test file found for ${file} (${exportCount} exports)`,
        suggested_fix: `Create ${testPaths(file)[0]}. Test key exports and edge cases.`,
        rule         : "MISSING_TEST_FILE",
      });
    }
  }

  return issues;
}

/** API routes with no test whatsoever */
function findUntestedRoutes(
  files   : Record<string, string>,
  allPaths: string[]
): TestGapIssue[] {
  const issues: TestGapIssue[] = [];
  const allPathSet = new Set(allPaths);

  const routeFiles = Object.keys(files).filter(p =>
    p.match(/^app\/api\/.*\/route\.(ts|js)$/)
  );

  for (const route of routeFiles) {
    const possibleTests = testPaths(route);
    const hasTest = possibleTests.some(tp => allPathSet.has(tp));

    if (!hasTest) {
      // Check content — only flag if route has real logic (not just pass-through)
      const content = files[route] ?? "";
      const hasLogic = content.length > 200 &&
        (content.includes("supabase") || content.includes("fetch") || content.includes("await"));

      if (hasLogic) {
        issues.push({
          severity     : "medium",
          type         : "testing",
          file         : route,
          description  : `API route ${route} has no integration test`,
          suggested_fix: `Create an integration test at ${testPaths(route)[0]}. Test success response, error cases, and auth rejection.`,
          rule         : "UNTESTED_API_ROUTE",
        });
      }
    }
  }

  return issues.slice(0, 20);
}

/** Functions with TODO/FIXME comments — marked as incomplete */
function findIncompleteCode(files: Record<string, string>): TestGapIssue[] {
  const issues: TestGapIssue[] = [];

  for (const [file, content] of Object.entries(files)) {
    const TODO_RE = /\/\/\s*(TODO|FIXME|HACK|XXX|BUG|BROKEN)\s*[:.]?\s*(.{10,80})/gi;
    let m: RegExpExecArray | null;
    TODO_RE.lastIndex = 0;

    while ((m = TODO_RE.exec(content)) !== null) {
      const tag  = m[1].toUpperCase();
      const text = m[2].trim();
      const line = content.slice(0, m.index).split("\n").length;

      issues.push({
        severity     : tag === "FIXME" || tag === "BUG" || tag === "BROKEN" ? "medium" : "low",
        type         : "quality",
        file,
        line,
        description  : `${tag} comment: ${text}`,
        suggested_fix: `Address the ${tag} comment at line ${line}. Create a roadmap task if this requires significant work.`,
        rule         : `TODO_COMMENT_${tag}`,
      });

      // Max 3 TODO issues per file to reduce noise
      if ((issues.filter(i => i.file === file).length) >= 3) break;
    }
  }

  return issues;
}

// ── Main detector ──────────────────────────────────────────────────────────

export function detectTestGaps(
  files   : Record<string, string>,
  allPaths: string[]
): TestGapIssue[] {
  return [
    ...findUntestedFiles(files, allPaths),
    ...findUntestedRoutes(files, allPaths),
    ...findIncompleteCode(files),
  ];
}
