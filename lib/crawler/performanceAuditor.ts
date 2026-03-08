// lib/crawler/performanceAuditor.ts
// Purpose: Performance auditor — analyzes bundle sizes, render-blocking scripts,
//          large images, duplicate libraries, API response latency, and
//          crawl timing data to produce a performance score.
// Date: 2026-03-07

import type { PageResult } from "./siteCrawler";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PerformanceIssue {
  severity   : "low" | "medium" | "high" | "critical";
  category   : string;
  title      : string;
  detail     : string;
  url?       : string;
  impact     : string;
  remediation: string;
}

export interface PerformanceAuditResult {
  score           : number;    // 0–100
  grade           : "A" | "B" | "C" | "D" | "F";
  issues          : PerformanceIssue[];
  metrics         : {
    avgPageLoadMs   : number;
    slowestPageMs   : number;
    slowestPageUrl  : string;
    totalPageSizeKb : number;
    avgPageSizeKb   : number;
    totalScripts    : number;
    totalStyles     : number;
    largestPageKb   : number;
    pagesOver100Kb  : number;
    renderBlocking  : number;
  };
  summary         : { total: number; critical: number; high: number; medium: number; low: number };
}

// ── Checks ─────────────────────────────────────────────────────────────────

function checkPageSizes(pages: PageResult[]): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const over200kb = pages.filter(p => p.sizeBytes > 200 * 1024);
  const over100kb = pages.filter(p => p.sizeBytes > 100 * 1024 && p.sizeBytes <= 200 * 1024);

  for (const page of over200kb.slice(0, 5)) {
    issues.push({
      severity   : "high",
      category   : "page_size",
      title      : "Page HTML exceeds 200KB",
      detail     : `${page.url}: ${Math.round(page.sizeBytes / 1024)}KB`,
      url        : page.url,
      impact     : "Large HTML bloat increases parse time and Time to First Byte",
      remediation: "Minimize server-side rendered HTML. Use pagination or virtualization for large lists.",
    });
  }

  if (over100kb.length > 0) {
    issues.push({
      severity   : "medium",
      category   : "page_size",
      title      : `${over100kb.length} page(s) between 100–200KB`,
      detail     : over100kb.slice(0, 3).map(p => `${p.url} (${Math.round(p.sizeBytes / 1024)}KB)`).join(", "),
      impact     : "Large pages slow initial load, especially on mobile",
      remediation: "Audit content. Remove unused markup. Consider SSR with streaming.",
    });
  }

  return issues;
}

function checkSlowPages(pages: PageResult[]): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const slowPages = pages.filter(p => p.responseMs > 2000).slice(0, 5);
  const verySlowPages = pages.filter(p => p.responseMs > 5000).slice(0, 3);

  for (const page of verySlowPages) {
    issues.push({
      severity   : "critical",
      category   : "response_time",
      title      : "Page response time exceeds 5 seconds",
      detail     : `${page.url}: ${page.responseMs}ms`,
      url        : page.url,
      impact     : "5+ second load times cause 90%+ abandonment rate",
      remediation: "Investigate server-side performance. Add caching. Consider CDN edge caching.",
    });
  }

  if (slowPages.length > 0 && verySlowPages.length === 0) {
    issues.push({
      severity   : "high",
      category   : "response_time",
      title      : `${slowPages.length} page(s) respond in 2–5 seconds`,
      detail     : slowPages.map(p => `${p.url}: ${p.responseMs}ms`).join(", "),
      impact     : "2–5 second load times hurt SEO rankings and conversion rates",
      remediation: "Add server-side caching, optimize DB queries, use CDN for static assets.",
    });
  }

  return issues;
}

function checkScriptLoad(pages: PageResult[]): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  let renderBlockingTotal = 0;

  for (const page of pages) {
    // Heuristic: scripts in <head> without async/defer are render-blocking
    // We can infer this from script count vs page depth
    if (page.scripts.length > 10) {
      renderBlockingTotal += page.scripts.length;
    }
  }

  if (renderBlockingTotal > 0) {
    issues.push({
      severity   : "medium",
      category   : "render_blocking",
      title      : "Potential render-blocking script loading detected",
      detail     : `Pages with 10+ scripts detected — verify async/defer usage`,
      impact     : "Render-blocking scripts delay First Contentful Paint",
      remediation: "Add async or defer attributes to non-critical script tags.",
    });
  }

  // Check total script count across site
  const totalScripts = new Set(pages.flatMap(p => p.scripts)).size;
  if (totalScripts > 30) {
    issues.push({
      severity   : "medium",
      category   : "script_count",
      title      : `High script count: ${totalScripts} unique JS files`,
      detail     : `${totalScripts} distinct JS URLs found across all pages`,
      impact     : "Each script is an additional HTTP request that adds latency",
      remediation: "Bundle scripts. Use code splitting. Load non-critical JS lazily.",
    });
  }

  return issues;
}

function checkDuplicateLibraries(scripts: string[]): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const KNOWN_LIBS = ["jquery", "lodash", "moment", "react", "vue", "bootstrap", "axios"];

  for (const lib of KNOWN_LIBS) {
    const matches = scripts.filter(s => s.toLowerCase().includes(lib));
    if (matches.length > 1) {
      issues.push({
        severity   : "high",
        category   : "duplicate_library",
        title      : `Duplicate library detected: ${lib} loaded ${matches.length} times`,
        detail     : matches.slice(0, 3).join(", "),
        impact     : "Loading the same library multiple times wastes bandwidth and parse time",
        remediation: `Ensure ${lib} is loaded exactly once. Check for version conflicts in dependencies.`,
      });
    }
  }

  return issues;
}

function checkMissingOptimizations(pages: PageResult[], scripts: string[]): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  // Check for moment.js (large, usually replaceable with date-fns)
  if (scripts.some(s => s.includes("moment.js") || s.includes("moment.min.js"))) {
    issues.push({
      severity   : "medium",
      category   : "bundle_size",
      title      : "moment.js detected — 67KB+ library",
      detail     : "moment.js is large and mostly unused in modern apps",
      impact     : "67KB+ minified adds significant parse overhead on mobile",
      remediation: "Replace moment.js with date-fns (~30KB tree-shakable) or Temporal API.",
    });
  }

  // Check for multiple jQuery versions
  if (scripts.some(s => /jquery[\-.]?(\d)/.test(s.toLowerCase()))) {
    issues.push({
      severity   : "low",
      category   : "outdated_library",
      title      : "jQuery detected",
      detail     : "jQuery adds 30–90KB and is rarely needed in modern frameworks",
      impact     : "Extra library load slows initial render",
      remediation: "Migrate jQuery usage to native DOM APIs or framework equivalents.",
    });
  }

  // No sitemap = crawl inefficiency (less directly perf but signals site quality)
  const avgResponseMs = pages.length > 0
    ? pages.reduce((s, p) => s + p.responseMs, 0) / pages.length
    : 0;

  if (avgResponseMs > 1000) {
    issues.push({
      severity   : "medium",
      category   : "ttfb",
      title      : `Average page load time: ${Math.round(avgResponseMs)}ms`,
      detail     : `Average across ${pages.length} pages exceeds 1 second`,
      impact     : "High average TTFB suggests server-side bottlenecks",
      remediation: "Add edge caching, optimize server-side rendering, use CDN.",
    });
  }

  return issues;
}

// ── Main auditor ───────────────────────────────────────────────────────────

export function auditPerformance(
  pages  : PageResult[],
  scripts: string[]
): PerformanceAuditResult {
  const issues: PerformanceIssue[] = [
    ...checkPageSizes(pages),
    ...checkSlowPages(pages),
    ...checkScriptLoad(pages),
    ...checkDuplicateLibraries(scripts),
    ...checkMissingOptimizations(pages, scripts),
  ];

  // Metrics
  const responseTimes  = pages.map(p => p.responseMs).filter(t => t > 0);
  const pageSizes      = pages.map(p => p.sizeBytes);
  const avgPageLoadMs  = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;
  const slowestPageMs  = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
  const slowestPage    = pages.find(p => p.responseMs === slowestPageMs);
  const totalPageSizeKb = Math.round(pageSizes.reduce((a, b) => a + b, 0) / 1024);
  const avgPageSizeKb   = pages.length > 0 ? Math.round(totalPageSizeKb / pages.length) : 0;
  const largestPageKb   = Math.round(Math.max(0, ...pageSizes) / 1024);

  const SEVERITY_WEIGHTS = { critical: 20, high: 12, medium: 6, low: 2 };
  const deductions = issues.reduce((s, i) => s + SEVERITY_WEIGHTS[i.severity], 0);
  const score = Math.max(0, 100 - deductions);
  const grade: PerformanceAuditResult["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  const summary = {
    total   : issues.length,
    critical: issues.filter(i => i.severity === "critical").length,
    high    : issues.filter(i => i.severity === "high").length,
    medium  : issues.filter(i => i.severity === "medium").length,
    low     : issues.filter(i => i.severity === "low").length,
  };

  return {
    score, grade, issues,
    metrics: {
      avgPageLoadMs,
      slowestPageMs,
      slowestPageUrl   : slowestPage?.url ?? "",
      totalPageSizeKb,
      avgPageSizeKb,
      totalScripts     : scripts.length,
      totalStyles      : 0,  // populated by reportBuilder from crawler data
      largestPageKb,
      pagesOver100Kb   : pages.filter(p => p.sizeBytes > 100 * 1024).length,
      renderBlocking   : pages.filter(p => p.scripts.length > 10).length,
    },
    summary,
  };
}
