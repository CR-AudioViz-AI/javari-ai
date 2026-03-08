// lib/crawler/siteCrawler.ts
// Purpose: Universal web crawler — starts from a root URL, crawls internal links
//          up to a configurable depth and page count, discovers pages, scripts,
//          styles, and API endpoints. No headless browser — pure fetch + regex.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export interface CrawlInput {
  url        : string;
  maxDepth?  : number;   // default 4
  maxPages?  : number;   // default 200
  timeoutMs? : number;   // per-request timeout, default 8000
  userAgent? : string;
}

export interface PageResult {
  url        : string;
  statusCode : number;
  title?     : string;
  contentType: string;
  sizeBytes  : number;
  depth      : number;
  links      : string[];
  forms      : number;
  scripts    : string[];
  styles     : string[];
  metaTags   : Record<string, string>;
  responseMs : number;
}

export interface CrawlOutput {
  rootUrl     : string;
  domain      : string;
  pages       : PageResult[];
  scripts     : string[];   // unique absolute JS URLs
  styles      : string[];   // unique absolute CSS URLs
  apiEndpoints: string[];   // discovered API paths
  sitemapFound: boolean;
  robotsTxt   : string;
  crawledAt   : string;
  durationMs  : number;
  errors      : string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return ""; }
}

function normalizeUrl(base: string, href: string): string | null {
  try {
    if (href.startsWith("mailto:") || href.startsWith("tel:") ||
        href.startsWith("javascript:") || href.startsWith("#")) return null;
    const resolved = new URL(href, base);
    resolved.hash = "";
    return resolved.toString();
  } catch { return null; }
}

function isSameDomain(urlStr: string, domain: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.hostname === domain || u.hostname.endsWith(`.${domain}`);
  } catch { return false; }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefPattern.exec(html)) !== null) {
    const normalized = normalizeUrl(baseUrl, m[1]);
    if (normalized) links.push(normalized);
  }
  return links;
}

function extractScripts(html: string, baseUrl: string): string[] {
  const scripts: string[] = [];
  const srcPattern = /<script[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = new RegExp(srcPattern.source, srcPattern.flags).exec(html)) !== null) {
    const normalized = normalizeUrl(baseUrl, m[1]);
    if (normalized) scripts.push(normalized);
  }
  return scripts;
}

function extractStyles(html: string, baseUrl: string): string[] {
  const styles: string[] = [];
  const linkPattern = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const linkPattern2 = /<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi;
  for (const pat of [linkPattern, linkPattern2]) {
    let m: RegExpExecArray | null;
    while ((m = new RegExp(pat.source, pat.flags).exec(html)) !== null) {
      const normalized = normalizeUrl(baseUrl, m[1]);
      if (normalized) styles.push(normalized);
    }
  }
  return styles;
}

function extractTitle(html: string): string | undefined {
  const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html);
  return m ? m[1].trim() : undefined;
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const metaPattern = /<meta[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaPattern.exec(html)) !== null) {
    const tag = m[0];
    const nameMatch    = /name\s*=\s*["']([^"']+)["']/i.exec(tag);
    const propMatch    = /property\s*=\s*["']([^"']+)["']/i.exec(tag);
    const contentMatch = /content\s*=\s*["']([^"']{0,200})["']/i.exec(tag);
    const key = (nameMatch?.[1] ?? propMatch?.[1] ?? "").toLowerCase();
    if (key && contentMatch) meta[key] = contentMatch[1];
  }
  return meta;
}

function extractApiEndpoints(html: string, js: string): string[] {
  const combined = html + "\n" + js;
  const endpoints = new Set<string>();
  // fetch("/api/...") or axios.get("/api/...")
  const fetchPat = /(?:fetch|axios\.(?:get|post|put|delete|patch))\s*\(\s*["'`]([^"'`\s]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = new RegExp(fetchPat.source, fetchPat.flags).exec(combined)) !== null) {
    if (m[1].startsWith("/") || m[1].startsWith("http")) endpoints.add(m[1]);
  }
  // "method": "POST", "url": "/api/..."
  const urlPat = /"url"\s*:\s*["']([/][^"']+)["']/g;
  while ((m = new RegExp(urlPat.source, urlPat.flags).exec(combined)) !== null) {
    endpoints.add(m[1]);
  }
  return Array.from(endpoints).slice(0, 200);
}

function countForms(html: string): number {
  return (html.match(/<form[\s>]/gi) ?? []).length;
}

async function fetchPage(
  url: string,
  timeoutMs: number,
  userAgent: string
): Promise<{ html: string; status: number; contentType: string; sizeBytes: number; ms: number } | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent"     : userAgent,
        "Accept"         : "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal  : AbortSignal.timeout(timeoutMs),
    });
    const contentType = res.headers.get("content-type") ?? "";
    const text        = await res.text();
    return {
      html       : text,
      status     : res.status,
      contentType,
      sizeBytes  : Buffer.byteLength(text, "utf8"),
      ms         : Date.now() - t0,
    };
  } catch {
    return null;
  }
}

// ── Main crawler ───────────────────────────────────────────────────────────

export async function crawlSite(input: CrawlInput): Promise<CrawlOutput> {
  const t0        = Date.now();
  const maxDepth  = input.maxDepth  ?? 4;
  const maxPages  = input.maxPages  ?? 200;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const userAgent = input.userAgent ?? "JavariBot/1.0 (platform audit; +https://javariai.com)";

  const rootUrl = input.url.endsWith("/") ? input.url.slice(0, -1) : input.url;
  const domain  = normalizeDomain(rootUrl);

  const visited   = new Set<string>();
  const queue     : Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
  const pages     : PageResult[] = [];
  const allScripts = new Set<string>();
  const allStyles  = new Set<string>();
  const errors    : string[] = [];
  let   jsContent  = "";

  // Fetch robots.txt
  let robotsTxt = "";
  try {
    const r = await fetch(`${rootUrl}/robots.txt`, { signal: AbortSignal.timeout(5_000), headers: { "User-Agent": userAgent } });
    if (r.ok) robotsTxt = await r.text();
  } catch { /* best-effort */ }

  // Check sitemap.xml
  let sitemapFound = false;
  try {
    const r = await fetch(`${rootUrl}/sitemap.xml`, { signal: AbortSignal.timeout(5_000), headers: { "User-Agent": userAgent } });
    if (r.ok) {
      sitemapFound = true;
      const sitemapXml = await r.text();
      // Extract URLs from sitemap
      const urlPat = /<loc>([^<]+)<\/loc>/g;
      let m: RegExpExecArray | null;
      while ((m = urlPat.exec(sitemapXml)) !== null) {
        const sitemapUrl = m[1].trim();
        if (isSameDomain(sitemapUrl, domain) && !visited.has(sitemapUrl)) {
          queue.push({ url: sitemapUrl, depth: 1 });
        }
      }
    }
  } catch { /* best-effort */ }

  // BFS crawl
  while (queue.length > 0 && pages.length < maxPages) {
    const item = queue.shift()!;
    if (visited.has(item.url)) continue;
    if (!isSameDomain(item.url, domain)) continue;
    if (item.depth > maxDepth) continue;

    visited.add(item.url);

    const result = await fetchPage(item.url, timeoutMs, userAgent);
    if (!result) {
      errors.push(`Failed to fetch: ${item.url}`);
      continue;
    }

    const { html, status, contentType, sizeBytes, ms } = result;
    const isHtml = contentType.includes("text/html") || contentType === "";

    if (!isHtml) {
      // Track non-HTML assets but don't parse links
      if (item.url.endsWith(".js") || contentType.includes("javascript")) {
        jsContent += "\n" + html.slice(0, 50_000); // cap JS accumulation
      }
      continue;
    }

    const links   = extractLinks(html, item.url);
    const scripts = extractScripts(html, item.url);
    const styles  = extractStyles(html, item.url);

    scripts.forEach(s => allScripts.add(s));
    styles.forEach(s => allStyles.add(s));

    pages.push({
      url        : item.url,
      statusCode : status,
      title      : extractTitle(html),
      contentType,
      sizeBytes,
      depth      : item.depth,
      links      : links.filter(l => isSameDomain(l, domain)).slice(0, 50),
      forms      : countForms(html),
      scripts,
      styles,
      metaTags   : extractMetaTags(html),
      responseMs : ms,
    });

    // Enqueue new internal links
    if (item.depth < maxDepth) {
      for (const link of links) {
        if (isSameDomain(link, domain) && !visited.has(link)) {
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    }
  }

  // Fetch a sample of JS files for endpoint extraction (first 5, capped at 100KB each)
  const jsUrls = Array.from(allScripts).slice(0, 5);
  for (const jsUrl of jsUrls) {
    try {
      const r = await fetch(jsUrl, { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": userAgent } });
      if (r.ok) jsContent += "\n" + (await r.text()).slice(0, 100_000);
    } catch { /* best-effort */ }
  }

  const allHtml    = pages.map(p => p.url).join("\n");
  const apiEndpoints = extractApiEndpoints(allHtml, jsContent);

  return {
    rootUrl,
    domain,
    pages,
    scripts    : Array.from(allScripts),
    styles     : Array.from(allStyles),
    apiEndpoints,
    sitemapFound,
    robotsTxt  : robotsTxt.slice(0, 2000),
    crawledAt  : new Date().toISOString(),
    durationMs : Date.now() - t0,
    errors     : errors.slice(0, 20),
  };
}
