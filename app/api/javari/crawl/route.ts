// app/api/javari/crawl/route.ts
// Purpose: Universal Web Crawler API endpoint — orchestrates full platform audit.
//          v1.2.0 — added reachability pre-check, clear error for blocked domains.
// Date: 2026-03-07

import { NextRequest, NextResponse }  from "next/server";
import { crawlSite }                  from "@/lib/crawler/siteCrawler";
import { analyzeDom }                 from "@/lib/crawler/domAnalyzer";
import { mapApis }                    from "@/lib/crawler/apiMapper";
import { detectTechnologies }         from "@/lib/crawler/technologyDetector";
import { auditSecurity }              from "@/lib/crawler/securityAuditor";
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

// Vercel serverless functions cannot reach Vercel-hosted domains via outbound
// fetch (circular loopback prevention). Detect this and return a clear error.
async function isReachable(url: string, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method  : "HEAD",
      redirect: "follow",
      headers : { "User-Agent": "JavariBot/1.0 (audit)" },
      signal  : AbortSignal.timeout(timeoutMs),
    });
    return res.status < 600;
  } catch {
    return false;
  }
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

  // Pre-check: verify target is reachable from this function instance
  const reachable = await isReachable(validUrl, 5000);
  if (!reachable) {
    return NextResponse.json({
      ok    : false,
      error : `Target unreachable from Vercel serverless (${validUrl}). ` +
              `Vercel blocks outbound requests to other Vercel-hosted domains. ` +
              `Use the CLI runner or a non-Vercel proxy for this target.`,
      hint  : "Run: POST /api/javari/crawl with a non-Vercel-hosted target URL, or use the standalone crawler CLI.",
      target: validUrl,
    }, { status: 422 });
  }

  const globalT0 = Date.now();
  console.log(`[crawl] ▶ ${validUrl} maxDepth=${maxDepth} maxPages=${maxPages}`);

  try {
    const crawlResult = await crawlSite({ url: validUrl, maxDepth, maxPages, timeoutMs });
    console.log(`[crawl] Crawled ${crawlResult.pages.length} pages`);

    let rootHeaders: Record<string, string> = {};
    let rootHtml = "";
    try {
      const rootRes = await fetch(validUrl, {
        headers: { "User-Agent": "JavariBot/1.0" },
        signal : AbortSignal.timeout(timeoutMs),
      });
      rootRes.headers.forEach((v, k) => { rootHeaders[k.toLowerCase()] = v; });
      rootHtml = await rootRes.text();
    } catch { /* best-effort */ }

    const htmlMap     = new Map<string, string>();
    const htmlSamples : string[] = [];
    if (rootHtml) { htmlMap.set(validUrl, rootHtml); htmlSamples.push(rootHtml.slice(0, 50_000)); }

    const jsContents  = new Map<string, string>();
    const jsSamples   : string[] = [];
    if (crawlResult.scripts.length > 0) {
      try {
        const jsRes = await fetch(crawlResult.scripts[0], { signal: AbortSignal.timeout(timeoutMs) });
        if (jsRes.ok) {
          const js = (await jsRes.text()).slice(0, 150_000);
          jsContents.set(crawlResult.scripts[0], js);
          jsSamples.push(js);
        }
      } catch { /* best-effort */ }
    }

    const htmlContents = new Map<string, string>();
    if (rootHtml) htmlContents.set(validUrl, rootHtml);

    const domResult     = await analyzeDom(crawlResult.pages, htmlMap);
    const apiResult     = await mapApis(jsContents, htmlContents);
    const techStack     = detectTechnologies(htmlSamples, jsSamples, rootHeaders);
    const securityResult = auditSecurity(rootHeaders, htmlSamples, jsSamples, crawlResult.pages.map(p => p.url), []);
    const perfResult    = auditPerformance(crawlResult.pages, crawlResult.scripts);
    const durationMs    = Date.now() - globalT0;
    const report        = await buildReport(crawlResult, domResult, apiResult, techStack, securityResult, perfResult, durationMs, seedTasks);

    console.log(`[crawl] ✅ ${report.reportId} | ${durationMs}ms | ${report.tasksCreated} tasks`);
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
    version: "1.2.0",
    usage  : {
      method  : "POST",
      body    : { url: "https://example.com (required)", maxDepth: "2 (default)", maxPages: "30 (default)", seedTasks: "true (default)", timeoutMs: "6000 (default)" },
      note    : "Vercel serverless functions cannot reach other Vercel-hosted domains. For Vercel targets, use a non-Vercel proxy or the standalone CLI runner.",
      examples: [
        "POST { url: 'https://shopify.com' }",
        "POST { url: 'https://notion.so', maxDepth: 3, maxPages: 50 }",
      ],
    },
  });
}
