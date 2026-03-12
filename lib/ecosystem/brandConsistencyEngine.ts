// lib/ecosystem/brandConsistencyEngine.ts
// Purpose: Brand & language consistency engine — scans React components, HTML,
//          markdown docs, and API responses for branding inconsistencies.
//          Generates repair tasks for every violation found.
// Date: 2026-03-07
import { createClient }       from "@supabase/supabase-js";
import { recordArtifact }     from "@/lib/roadmap/artifactRecorder";
// ── Types ──────────────────────────────────────────────────────────────────
export interface BrandViolation {
export interface BrandScanResult {
// ── Supabase ───────────────────────────────────────────────────────────────
// ── Brand standards loader ─────────────────────────────────────────────────
    // Try loading from R2/Supabase — fall back to defaults
// ── GitHub file scanner ────────────────────────────────────────────────────
    // Get file tree
    // Filter to target extensions, skip node_modules/.next/dist
    // Fetch file contents in parallel batches of 10
// ── Scanner ────────────────────────────────────────────────────────────────
    // Case-sensitive check — avoid false positives on partial strings
    // Avoid flagging within URLs or code comments that mention old names
    // Brand terms (high severity for primary brand terms)
    // UI terms (medium severity)
    // Forbidden terms (always critical)
// ── Task seeder ────────────────────────────────────────────────────────────
  // Group by file to create one task per file with violations
  // Dedup
// ── Main function ──────────────────────────────────────────────────────────
    // Group by repo for task creation
  // Record artifact
export default {}
