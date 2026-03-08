// app/api/javari/crawl/route.ts
// Purpose: Universal Web Crawler API endpoint — orchestrates full platform audit:
//          Crawl → DOM Analysis → API Mapping → Tech Detection →
//          Security Audit → Performance Audit → Report → Task Seeding
// Date: 2026-03-07
//
// POST /api/javari/crawl
// { "url": "https://example.com", "maxDepth": 4, "maxPages": 200, "seedTasks": true }
//
// GET  /api/javari/crawl — returns usage info

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

  const { url, maxDepth = 4, maxPages = 200, seedTasks = true, timeoutMs = 8000 } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ ok: false, error: "url is required" }, { status: 400 });
  }

  // Validate URL
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
    // ── Phase 1: Crawl ───────────────────────────────────────────────────────
    const crawlResult = await crawlSite({ url: validUrl, maxDepth, maxPages, timeoutMs });
    console.log(`[crawl] Crawled ${crawlResult.pages.length} pages, ${crawlResult.scripts.length} scripts`);

    // Fetch root page headers
    let rootHeaders: Record<string, string> = {};
    try {
      const headRes = await fetch(validUrl, { method: "HEAD", signal: AbortSignal.timeout(8_000) });
      headRes.headers.forEach((v, k) => { rootHeaders[k.toLowerCase()] = v; });
    } catch {
      try {
        const getRes = await fetch(validUrl, { signal: AbortSignal.timeout(8_000) });
        getRes.headers.forEach((v, k) => { rootHeaders[k.toLowerCase()] = v; });
      } catch { /* best-effort */ }
    }

    // Build HTML map for DOM analysis
    const htmlMap    = new Map<string, string>();
    const htmlSamples: string[] = [];
    // Re-fetch a sample of pages for DOM analysis (first 5)
    for (const page of crawlResult.pages.slice(0, 5)) {
      try {
        const r = await fetch(page.url, { signal: AbortSignal.timeout(8_000) });
        if (r.ok) {
          const html = await r.text();
          htmlMap.set(page.url, html);
          htmlSamples.push(html.slice(0, 50_000));
        }
      } catch { /* best-effort */ }
    }

    // Fetch JS for analysis
    const jsContents   = new Map<string, string>();
    const jsSamples    : string[] = [];
    for (const jsUrl of crawlResult.scripts.slice(0, 5)) {
      try {
        const r = await fetch(jsUrl, { signal: AbortSignal.timeout(8_000) });
        if (r.ok) {
          const js = (await r.text()).slice(0, 200_000);
          jsContents.set(jsUrl, js);
          jsSamples.push(js);
        }
      } catch { /* best-effort */ }
    }

    // ── Phase 2: DOM Analysis ────────────────────────────────────────────────
    const domResult = await analyzeDom(crawlResult.pages, htmlMap);
    console.log(`[crawl] DOM: ${domResult.forms.length} forms, ${domResult.adminPaths.length} admin paths`);

    // ── Phase 3: API Mapping ─────────────────────────────────────────────────
    const htmlContents = new Map<string, string>(htmlSamples.map((h, i) => [crawlResult.pages[i]?.url ?? `page-${i}`, h]));
    const apiResult    = await mapApis(jsContents, htmlContents);
    console.log(`[crawl] APIs: ${apiResult.totalFound} endpoints mapped`);

    // ── Phase 4: Technology Detection ────────────────────────────────────────
    const techStack = detectTechnologies(htmlSamples, jsSamples, rootHeaders);
    console.log(`[crawl] Tech: ${techStack.frontendFramework} / ${techStack.hostingProvider}`);

    // ── Phase 5: Security Audit ──────────────────────────────────────────────
    const exposedPaths  = await checkExposedPaths(validUrl);
    const securityResult = auditSecurity(rootHeaders, htmlSamples, jsSamples, crawlResult.pages.map(p => p.url), exposedPaths);
    console.log(`[crawl] Security: ${securityResult.grade} score=${securityResult.score}`);

    // ── Phase 6: Performance Audit ───────────────────────────────────────────
    const perfResult = auditPerformance(crawlResult.pages, crawlResult.scripts);
    console.log(`[crawl] Performance: ${perfResult.grade} score=${perfResult.score}`);

    // ── Phase 7: Report ──────────────────────────────────────────────────────
    const durationMs = Date.now() - globalT0;
    const report = await buildReport(
      crawlResult, domResult, apiResult, techStack,
      securityResult, perfResult, durationMs, seedTasks
    );
    console.log(`[crawl] ✅ Report ${report.reportId} | ${durationMs}ms | ${report.tasksCreated} tasks seeded`);

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
    version: "1.0.0",
    usage  : {
      method : "POST",
      body   : {
        url       : "https://example.com  (required)",
        maxDepth  : "4 (default) — crawl depth limit",
        maxPages  : "200 (default) — page count limit",
        seedTasks : "true (default) — inject repair tasks for findings",
        timeoutMs : "8000 (default) — per-request timeout",
      },
      output : {
        architecture    : "pages, scripts, styles, sitemap, tech stack",
        security        : "score, grade, header audit, exposed paths",
        performance     : "score, grade, metrics, bundle analysis",
        domAnalysis     : "forms, auth flows, admin paths, risks",
        apiMap          : "discovered REST, GraphQL, WebSocket endpoints",
        recommendations : "prioritized action list",
        tasksCreated    : "roadmap_tasks seeded for repair_code executor",
      },
    },
  });
}
