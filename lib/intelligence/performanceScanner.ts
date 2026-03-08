// lib/intelligence/performanceScanner.ts
// Purpose: Performance scanner — detects N+1 database queries, oversized bundle
//          imports, blocking synchronous I/O, and unoptimized loop patterns.
// Date: 2026-03-07

import type { CodeIssue } from "./codeAnalyzer";

export type PerfIssue = CodeIssue;

interface PerfRule {
  id         : string;
  severity   : CodeIssue["severity"];
  pattern    : RegExp;
  description: string;
  fix        : string;
  exclude?   : RegExp;
}

const RULES: PerfRule[] = [
  // ── N+1 database queries ───────────────────────────────────────────────
  {
    id      : "N_PLUS_1_AWAIT_IN_LOOP",
    severity: "high",
    // await inside a for/while loop body → classic N+1
    pattern : /for\s*(?:await\s*)?\s*\([^)]+\)\s*\{[^}]*\bawait\b[^}]*(?:\.from|fetch|find|query|select|get)\b/gs,
    description: "N+1 query pattern: await database/fetch call inside a loop",
    fix     : "Batch the queries outside the loop using Promise.all(), .in() filters, or a single JOIN query.",
  },
  {
    id      : "N_PLUS_1_FOREACH_AWAIT",
    severity: "high",
    pattern : /\.forEach\s*\([^)]*(?:async)?\s*(?:\([^)]*\)|[A-Za-z_$]\w*)\s*=>\s*\{[^}]*\bawait\b[^}]*(?:\.from|fetch|find|query|select|get)\b/gs,
    description: "N+1 query pattern: await call inside .forEach() — forEach does not await",
    fix     : "Replace with for...of loop or Promise.all(items.map(async item => ...)) for parallel execution.",
  },
  {
    id      : "MAP_THEN_FILTER",
    severity: "low",
    pattern : /\.map\([^)]+\)\.filter\(/g,
    description: "Chained .map().filter() — iterates array twice",
    fix     : "Combine into a single .reduce() or .filter().map() (filter first to reduce work).",
  },

  // ── Large / barrel imports ─────────────────────────────────────────────
  {
    id      : "BARREL_IMPORT_LODASH",
    severity: "medium",
    pattern : /import\s+_\s+from\s+["']lodash["']/g,
    description: "Full lodash barrel import — adds ~70KB to bundle",
    fix     : "Import specific functions: import debounce from 'lodash/debounce'",
  },
  {
    id      : "BARREL_IMPORT_MOMENT",
    severity: "high",
    pattern : /import\s+moment\s+from\s+["']moment["']/g,
    description: "moment.js import — adds ~230KB. Deprecated.",
    fix     : "Replace with date-fns (tree-shakeable) or native Intl API.",
  },
  {
    id      : "STAR_IMPORT",
    severity: "low",
    pattern : /import\s+\*\s+as\s+\w+\s+from\s+["'][^"']+["']/g,
    description: "Wildcard import (import * as X) — prevents tree-shaking",
    fix     : "Use named imports: import { specific, exports } from 'module'",
    exclude : /from\s+["']react["']|from\s+["']next/i,
  },

  // ── Blocking synchronous I/O ───────────────────────────────────────────
  {
    id      : "SYNC_FS_READ",
    severity: "high",
    pattern : /\bfs\.readFileSync\s*\(/g,
    description: "Synchronous fs.readFileSync() blocks the event loop",
    fix     : "Replace with async fs.promises.readFile() or import { promises as fs } from 'fs'",
  },
  {
    id      : "SYNC_FS_WRITE",
    severity: "high",
    pattern : /\bfs\.writeFileSync\s*\(/g,
    description: "Synchronous fs.writeFileSync() blocks the event loop",
    fix     : "Replace with async fs.promises.writeFile()",
  },
  {
    id      : "SYNC_EXEC",
    severity: "high",
    pattern : /\bexecSync\s*\(|spawnSync\s*\(/g,
    description: "Synchronous child_process.execSync/spawnSync blocks the event loop",
    fix     : "Replace with async exec/spawn from child_process or execa.",
  },
  {
    id      : "SLEEP_AWAIT",
    severity: "low",
    pattern : /await\s+new\s+Promise\s*\(\s*(?:resolve)\s*=>\s*setTimeout\s*\(\s*resolve/g,
    description: "Manual sleep pattern — consider if polling/delay is necessary",
    fix     : "If retrying, use exponential backoff. If waiting for events, use event-driven patterns.",
  },

  // ── Unoptimized loops ─────────────────────────────────────────────────
  {
    id      : "NESTED_LOOPS_O2",
    severity: "medium",
    // Two consecutive for loops deeply nested
    pattern : /for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)/gs,
    description: "Triple-nested loop detected — O(n³) complexity",
    fix     : "Refactor using Maps/Sets for O(1) lookup, or restructure the algorithm.",
  },
  {
    id      : "ARRAY_INDEXOF_IN_LOOP",
    severity: "low",
    pattern : /for\s*\([^)]+\)\s*\{[^}]*\.indexOf\s*\(/gs,
    description: "Array.indexOf() inside loop — O(n²) lookup",
    fix     : "Convert the lookup array to a Set for O(1) includes() check.",
  },

  // ── React-specific ─────────────────────────────────────────────────────
  {
    id      : "MISSING_DEPENDENCY_ARRAY",
    severity: "medium",
    pattern : /useEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g,
    description: "useEffect with no dependency array — runs on every render",
    fix     : "Add a dependency array as the second argument to useEffect: useEffect(() => { ... }, [deps])",
  },
  {
    id      : "INLINE_OBJECT_PROP",
    severity: "low",
    // Passing {} or [] as prop inline — creates new reference each render
    pattern : /\w+\s*=\s*\{\s*\{(?:[^}]*)\}\s*\}/g,
    description: "Inline object literal passed as JSX prop — creates new reference each render",
    fix     : "Move the object outside the component or wrap in useMemo.",
    exclude : /style\s*=|className|dangerouslySet/i,
  },

  // ── API / network ──────────────────────────────────────────────────────
  {
    id      : "MISSING_REQUEST_TIMEOUT",
    severity: "medium",
    pattern : /\bfetch\s*\([^)]+\)(?!\s*\.then)(?!.*signal)/g,
    description: "fetch() call without AbortSignal timeout — can hang indefinitely",
    fix     : "Add signal: AbortSignal.timeout(10_000) to all fetch() calls.",
  },
  {
    id      : "UNHANDLED_PROMISE",
    severity: "medium",
    pattern : /(?:^|\s)(?!await\s|return\s|const\s|let\s|var\s)[A-Za-z_$]\w*\s*\([^)]*\)\.then\s*\(/gm,
    description: "Promise chain without .catch() — unhandled rejection",
    fix     : "Add .catch(err => console.error(err)) or use try/await/catch pattern.",
    exclude : /\.catch\s*\(|\bawait\b/i,
  },
];

// ── Scanner ────────────────────────────────────────────────────────────────

export function scanForPerformance(files: Record<string, string>): PerfIssue[] {
  const issues: PerfIssue[] = [];

  for (const [file, content] of Object.entries(files)) {
    const lines = content.split("\n");

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      const m = rule.pattern.exec(content);
      if (!m) continue;
      if (rule.exclude && rule.exclude.test(m[0])) continue;

      const lineNum  = content.slice(0, m.index).split("\n").length;
      const lineText = lines[lineNum - 1] ?? "";
      if (lineText.trimStart().startsWith("//")) continue;

      issues.push({
        severity     : rule.severity,
        type         : "performance",
        file,
        line         : lineNum,
        description  : rule.description,
        suggested_fix: rule.fix,
        rule         : rule.id,
      });
    }
  }

  return issues;
}
