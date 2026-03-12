// lib/intelligence/codeAnalyzer.ts
// Purpose: Code Intelligence Engine — orchestrates all analysis passes (security,
//          performance, dead code, test coverage, call graph) across a repo.
//          Fetches source file contents via GitHub API and runs all scanners.
//          Produces a canonical IssueReport and injects roadmap tasks.
// Date: 2026-03-07
import { getSecret }                        from "@/lib/platform-secrets/getSecret";
import { scanForSecurity, SecurityIssue }   from "./securityScanner";
import { scanForPerformance, PerfIssue }    from "./performanceScanner";
import { detectDeadCode, DeadCodeIssue }    from "./deadCodeDetector";
import { detectTestGaps, TestGapIssue }     from "./testCoverageDetector";
import { buildCallGraph, CallGraphResult }  from "./callGraphBuilder";
// [javari-repair] removed unused import: import { createClient, SupabaseClient }     from "@supabase/supabase-js";
// ── Types ──────────────────────────────────────────────────────────────────
export type Severity = "low" | "medium" | "high" | "critical";
export type IssueType = "security" | "performance" | "logic" | "quality" | "testing";
export interface CodeIssue {
export interface IssueReport {
export interface AnalyzeInput {
// ── Source file extensions to analyze ─────────────────────────────────────
// ── GitHub file fetcher ────────────────────────────────────────────────────
  // Fetch in chunks of 10 to avoid rate limits
// ── Supabase client ────────────────────────────────────────────────────────
// ── Task injection ─────────────────────────────────────────────────────────
  // Only inject high+ severity to avoid flooding the queue
  // Deduplicate by ID
// ── Main analyzer ──────────────────────────────────────────────────────────
  // Phase 1: Fetch file list
  // Prioritize source files, skip test files for main analysis
  // Phase 2: Fetch file contents
  // Phase 3: Run all analysis passes in parallel
  // Phase 4: Merge and deduplicate issues
  // Sort: critical → high → medium → low
  // Phase 5: Build summary
  // Phase 6: Inject tasks
export default {}
