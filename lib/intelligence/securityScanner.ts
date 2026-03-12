// lib/intelligence/securityScanner.ts
// Purpose: Security scanner — detects SQL injection, dangerous eval, exposed
//          secrets/tokens, missing auth checks, and dangerous dependency patterns
//          using pattern matching on source file contents.
// Date: 2026-03-07
import type { CodeIssue } from "./codeAnalyzer";
// ── Rule types ─────────────────────────────────────────────────────────────
  // Optional: exclude pattern (false positives)
// ── Security rules ─────────────────────────────────────────────────────────
  // ── SQL Injection ──────────────────────────────────────────────────────
  // ── Dangerous eval ────────────────────────────────────────────────────
  // ── Exposed secrets ───────────────────────────────────────────────────
  // ── Missing auth checks ───────────────────────────────────────────────
    // POST/DELETE route handler with no session/auth check in first 20 lines
  // ── Dangerous dependencies / patterns ─────────────────────────────────
// ── Scanner ────────────────────────────────────────────────────────────────
export type SecurityIssue = CodeIssue & { rule: string };
        // Check exclusion pattern
        // Exclude commented lines
        // Skip lines with eslint-disable
        // One issue per rule per file to reduce noise
export default {}
