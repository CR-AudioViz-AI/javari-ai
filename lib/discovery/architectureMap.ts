// lib/discovery/architectureMap.ts
// Purpose: Architecture map builder — assembles the complete system architecture
//          report from scan results, stack detection, and dependency graphs.
//          Produces the canonical DiscoveryReport output.
// Date: 2026-03-07
import type { ScanResult } from "./repoScanner";
import type { DetectedStack } from "./stackDetector";
import type { DependencyGraphMap } from "./dependencyGraph";
// ── Output types ───────────────────────────────────────────────────────────
export interface ServiceEndpoint {
export interface InfraResource {
export interface SecurityFinding {
export interface DiscoveryReport {
  // Core canonical fields (as specified)
  // Extended analysis
export interface SuggestedTask {
// ── API route detection ────────────────────────────────────────────────────
    // Next.js App Router: app/api/*/route.ts
    // Next.js Pages Router: pages/api/*.ts
    // Express/Fastify: routes/ directory patterns
// ── Infrastructure resource detection ─────────────────────────────────────
  // Vercel
  // Supabase (detect from package.json deps or usage patterns)
  // AWS SDK
  // Docker
  // Docker Compose
  // Kubernetes
  // Cloudflare
  // Fly.io
  // GitHub Actions
  // Stripe
  // OpenAI
  // Anthropic
// ── Security analysis ──────────────────────────────────────────────────────
  // Check for .env files committed (should never be)
  // Missing .env.example
  // Missing tests
  // Wildcard deps
  // Missing security headers (Next.js / Vercel)
// ── Suggested tasks generator ──────────────────────────────────────────────
  // No tests
  // Missing env example
  // Unpinned deps
  // Critical security findings
  // Missing Dockerfile for backend services
// ── Main builder ───────────────────────────────────────────────────────────
  // Flatten all deps to canonical format
export default {}
