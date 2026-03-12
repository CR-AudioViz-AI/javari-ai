// lib/crawler/siteCrawler.ts
// Purpose: Universal web crawler — starts from a root URL, crawls internal links
//          up to a configurable depth and page count, discovers pages, scripts,
//          styles, and API endpoints. No headless browser — pure fetch + regex.
// Date: 2026-03-07
// ── Types ──────────────────────────────────────────────────────────────────
export interface CrawlInput {
export interface PageResult {
export interface CrawlOutput {
// ── Helpers ────────────────────────────────────────────────────────────────
  // fetch("/api/...") or axios.get("/api/...")
  // "method": "POST", "url": "/api/..."
// ── Main crawler ───────────────────────────────────────────────────────────
  // Fetch robots.txt
  // Check sitemap.xml
      // Extract URLs from sitemap
  // BFS crawl
      // Track non-HTML assets but don't parse links
    // Enqueue new internal links
  // Fetch a sample of JS files for endpoint extraction (first 5, capped at 100KB each)
export default {}
