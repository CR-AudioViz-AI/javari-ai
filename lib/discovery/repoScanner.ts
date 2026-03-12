// lib/discovery/repoScanner.ts
// Purpose: Repo scanner — fetches complete file tree from a GitHub repo or
//          local filesystem (via Node fs). Returns path list + key file contents.
// Date: 2026-03-07
import { getSecret } from "@/lib/platform-secrets/getSecret";
// ── Types ──────────────────────────────────────────────────────────────────
export interface ScanTarget {
export interface ScanResult {
// Key files to fetch full content for (stack detection uses these)
// Directories to skip (reduce noise)
// ── GitHub scanner ─────────────────────────────────────────────────────────
  // Resolve GitHub token
  // Fetch complete recursive tree
  // Fetch content of key files in parallel (max 8 concurrent)
// ── Local filesystem scanner ───────────────────────────────────────────────
  // Dynamic import of fs/path — safe in Node.js serverless
// ── URL scanner (public website / SaaS — header sniffing) ─────────────────
  // Common files to probe on the URL
// ── Public API ─────────────────────────────────────────────────────────────
export default {}
