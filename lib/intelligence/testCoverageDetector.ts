// lib/intelligence/testCoverageDetector.ts
// Purpose: Test coverage gap detector — identifies source files that have no
//          corresponding test file and API routes / utility functions with
//          zero test coverage indicators.
// Date: 2026-03-07
import type { CodeIssue } from "./codeAnalyzer";
export type TestGapIssue = CodeIssue;
// ── Helpers ────────────────────────────────────────────────────────────────
    // Same directory
    // __tests__ subdirectory
    // Top-level tests/ directory
    // Vitest convention
  // Skip test files themselves
  // Skip type-only files
  // Skip empty or tiny files
  // Skip config files
// ── Detectors ──────────────────────────────────────────────────────────────
  // Focus on high-value directories
      // Check content — only flag if route has real logic (not just pass-through)
      // Max 3 TODO issues per file to reduce noise
// ── Main detector ──────────────────────────────────────────────────────────
export default {}
