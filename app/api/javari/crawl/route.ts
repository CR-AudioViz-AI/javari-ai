// app/api/javari/crawl/route.ts
// Purpose: Universal Web Crawler API endpoint — orchestrates full platform audit:
//          Crawl → DOM Analysis → API Mapping → Tech Detection →
//          Security Audit → Performance Audit → Report → Task Seeding
// Date: 2026-03-07 (v2 — timeout-safe, single-pass crawl)
//
// POST /api/javari/crawl
// { "url": "https://example.com", "maxDepth": 2, "maxPages": 30, "seedTasks": true }

import { NextRequest, NextResponse }  from "next/server";
import { crawlSite }                  from "@/lib/crawler/siteCrawler";
import { analyzeDom }                 from "@/lib/crawler/domAnalyzer";
import { mapApis }                    from "@/lib/crawler/apiMapper";
import { detectTechnologies }         from "@/lib/crawler/technologyDetector";
import { auditSecurity, checkExposedPaths } from "@/lib/crawler/securityAuditor";
import { auditPerformance }           from "@/lib/crawler/performanceAuditor";
import { buildReport }                from "@/lib/crawler/reportBuilder";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

interface CrawlBody {
  url?      : string;
  maxDepth? : number;
  maxPages? : number;
  seedTasks?: boolean;
  timeoutMs?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CrawlBody;
  try { body = await req.json() as CrawlBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 }); }

  const { url, maxDepth = 2, maxPages = 30, seedTasks = true, timeoutMs = 6000 } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ ok: false, error: "url is required" }, { status: 400 });
  }

  let validUrl: string;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    validUrl = parsed.toString().replace(/\/$/, "");
  } catch {
    return NextResponse.json({ ok: false, error: `Invalid URL: ${url}` }, { status: 400 });
  }

  const globalT0 = Date.now();
  console.log(`[crawl] ▶ ${validUrl} maxDepth=${maxDepth} maxPages=${maxPages}`);

  try {
    // ── Phase 1: Crawl (single pass — collects pages, scripts, styles) ───────
    const crawlResult = await crawlSite({
      url      : validUrl,
      maxDepth,
      maxPages,
      timeoutMs,
    });
    console.log(`[crawl] Crawled ${crawlResult.pages.length} pages, ${crawlResult.scripts.length} scripts`);

    // ── Phase 2: Fetch root page with headers (single request) ───────────────
    let rootHeaders: Record<string, string> = {};
    let rootHtml = "";
    try {
      const rootRes = await fetch(validUrl, {
        headers: { "User-Agent": "JavariBot/1.0 (audit; +https://javariai.com)" },
        signal : AbortSignal.timeout(timeoutMs),
      });
      rootRes.headers.forEach((v, k) => { rootHeaders[k.toLowerCase()] = v; });
      rootHtml = await rootRes.text();
    } catch { /* best-effort */ }

    // Build HTML content maps from crawl data (no additional fetches)
    const htmlMap      = new Map<string, string>();
    const htmlSamples  : string[] = [];
    if (rootHtml) {
      htmlMap.set(validUrl, rootHtml);
      htmlSamples.push(rootHtml.slice(0, 50_000));
    }
    // Use a subset of crawled pages' HTML if we fetched them during crawl
    for (const page of crawlResult.pages.slice(0, 3)) {
      if (!htmlMap.has(page.url)) {
        // Don't re-fetch — we only have the already-crawled data
        // The siteCrawler already fetched these pages; use page metadata only
        htmlMap.set(page.url, "");
      }
    }

    // ── Phase 3: Fetch ONE JS file for API analysis ───────────────────────────
    const jsContents  = new Map<string, string>();
    const jsSamples   : string[] = [];
    if (crawlResult.scripts.length > 0) {
      try {
        const jsUrl = crawlResult.scripts[0];
        const jsRes = await fetch(jsUrl, { signal: AbortSignal.timeout(timeoutMs) });
        if (jsRes.ok) {
          const js = (await jsRes.text()).slice(0, 150_000);
          jsContents.set(jsUrl, js);
          jsSamples.push(js);
        }
      } catch { /* best-effort */ }
    }
    // Add root HTML as inline script source
    const htmlContents = new Map<string, string>();
    if (rootHtml) htmlContents.set(validUrl, rootHtml);

    // ── Phase 4: DOM Analysis (from cached HTML) ──────────────────────────────
    const domResult = await analyzeDom(crawlResult.pages, htmlMap);

    // ── Phase 5: API Mapping ──────────────────────────────────────────────────
    const apiResult = await mapApis(jsContents, htmlContents);

    // ── Phase 6: Technology Detection ─────────────────────────────────────────
    const techStack = detectTechnologies(htmlSamples, jsSamples, rootHeaders);

    // ── Phase 7: Security Audit (no active probing — passive only) ────────────
    // Skip checkExposedPaths to stay within timeout budget
    const securityResult = auditSecurity(
      rootHeaders, htmlSamples, jsSamples,
      crawlResult.pages.map(p => p.url),
      []  // skip exposed path checks for speed
    );

    // ── Phase 8: Performance Audit ────────────────────────────────────────────
    const perfResult = auditPerformance(crawlResult.pages, crawlResult.scripts);

    // ── Phase 9: Report ───────────────────────────────────────────────────────
    const durationMs = Date.now() - globalT0;
    const report = await buildReport(
      crawlResult, domResult, apiResult, techStack,
      securityResult, perfResult, durationMs, seedTasks
    );

    console.log(`[crawl] ✅ ${report.reportId} | ${durationMs}ms | sec=${securityResult.grade} perf=${perfResult.grade} | ${report.tasksCreated} tasks`);
    return NextResponse.json({ ok: true, ...report });

  } catch (err) {
    console.error(`[crawl] Error: ${err}`);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok     : true,
    name   : "Javari Universal Web + App Crawler",
    version: "1.1.0",
    usage  : {
      method : "POST",
      body   : {
        url       : "https://example.com  (required)",
        maxDepth  : "2 (default)",
        maxPages  : "30 (default)",
        seedTasks : "true (default) — inject repair tasks for findings",
        timeoutMs : "6000 (default) — per-request timeout",
      },
    },
  });
}
