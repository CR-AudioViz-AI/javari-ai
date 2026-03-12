// lib/crawler/apiMapper.ts
// Purpose: API mapper — scans JS bundles and HTML for API endpoint usage.
//          Detects fetch(), axios, GraphQL, and REST calls. Maps endpoints
//          to usage files and infers HTTP methods.
// Date: 2026-03-07
// ── Types ──────────────────────────────────────────────────────────────────
export interface ApiEndpoint {
export interface ApiMapResult {
// ── Endpoint extractors ────────────────────────────────────────────────────
  // fetch("URL") or fetch('URL') or fetch(`URL`)
    // Try to find method in surrounding context
  // axios({ method: "POST", url: "/api/..." })
  // GraphQL endpoint detection
  // Generic /graphql path
  // Bare string paths like "/api/users" or "/v1/payments"
// ── Helpers ────────────────────────────────────────────────────────────────
  // Heuristic: creation/update/delete endpoints → not GET
// ── Main mapper ────────────────────────────────────────────────────────────
  // Process JS files
  // Process HTML (inline scripts)
    // Extract inline scripts
export default {}
