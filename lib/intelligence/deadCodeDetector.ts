// lib/intelligence/deadCodeDetector.ts
// Purpose: Dead code detector — finds unused exports, orphaned React components,
//          dead API routes, and unused import statements across the codebase.
// Date: 2026-03-07
import type { CodeIssue } from "./codeAnalyzer";
export type DeadCodeIssue = CodeIssue;
// ── Helpers ────────────────────────────────────────────────────────────────
  // export const/let/var/function/class Foo
  // export { Foo, Bar as Baz }
  // import { A, B } from 'module'
  // import A from 'module'
  // import * as A from 'module'
  // Match identifier as a standalone word
// ── Dead code detectors ────────────────────────────────────────────────────
      // Count usages OUTSIDE import lines
  // Build a global index of all identifiers referenced across all files
      // Skip common patterns: default, React components in page files, type exports
      // Count cross-file usages (subtract in-file definition)
  // Cap to avoid noise
  // Collect all API route paths
  // Collect all fetch() / axios / useSWR calls across client/component files
    // Extract the route path from file path
    // Check if this path is referenced in client code
// ── Main detector ──────────────────────────────────────────────────────────
  // Unused imports per file (run on source files only)
  // Unused exports across files
  // Dead routes
export default {}
