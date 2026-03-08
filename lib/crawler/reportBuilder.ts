// lib/crawler/reportBuilder.ts
// Purpose: Report builder — combines outputs from all crawler subsystems into a
//          structured platform audit report. Generates roadmap_tasks for
//          actionable issues and provides prioritized recommendations.
// Date: 2026-03-07

import { createClient }               from "@supabase/supabase-js";
import type { CrawlOutput }           from "./siteCrawler";
import type { DomAnalysisResult }     from "./domAnalyzer";
import type { ApiMapResult }          from "./apiMapper";
import type { TechStackProfile }      from "./technologyDetector";
import type { SecurityAuditResult }   from "./securityAuditor";
import type { PerformanceAuditResult } from "./performanceAuditor";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlatformAuditReport {
  reportId     : string;
  targetUrl    : string;
  domain       : string;
  auditedAt    : string;
  durationMs   : number;
  architecture : {
    pagesFound       : number;
    scriptsFound     : number;
    stylesFound      : number;
    sitemapPresent   : boolean;
    techStack        : TechStackProfile;
    apiEndpoints     : string[];
    crawlDepthReached: number;
  };
  security     : {
    score          : number;
    grade          : string;
    findings       : SecurityAuditResult["findings"];
    headerAudit    : SecurityAuditResult["headerAudit"];
    exposedPaths   : string[];
    summary        : SecurityAuditResult["summary"];
  };
  performance  : {
    score    : number;
    grade    : string;
    issues   : PerformanceAuditResult["issues"];
    metrics  : PerformanceAuditResult["metrics"];
    summary  : PerformanceAuditResult["summary"];
  };
  domAnalysis  : {
    forms       : DomAnalysisResult["forms"];
    adminPaths  : string[];
    loginPages  : string[];
    paymentPages: string[];
    uploadPages : string[];
    findings    : DomAnalysisResult["findings"];
  };
  apiMap       : {
    endpoints    : ApiMapResult["endpoints"];
    graphqlUrls  : string[];
    websocketUrls: string[];
    totalFound   : number;
  };
  recommendations: Recommendation[];
  tasksCreated : number;
  taskIds      : string[];
}

export interface Recommendation {
  priority   : "critical" | "high" | "medium" | "low";
  category   : string;
  title      : string;
  detail     : string;
  effort     : "low" | "medium" | "high";
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Task seeder ────────────────────────────────────────────────────────────

async function seedAuditTasks(
  findings     : Array<{ severity: string; title: string; detail: string; rule?: string; remediation?: string; url?: string }>,
  targetUrl    : string,
  reportId     : string
): Promise<{ count: number; ids: string[] }> {
  const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const actionable = findings
    .filter(f => SEVERITY_ORDER[f.severity] <= 2)  // critical, high, medium
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))
    .slice(0, 15);

  if (actionable.length === 0) return { count: 0, ids: [] };

  const ts  = Date.now();
  const rows = actionable.map((f, i) => {
    const slug = f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 35);
    const id   = `audit-${slug}-${ts + i}`.slice(0, 80);
    return {
      id,
      phase_id   : f.severity === "critical" || f.severity === "high" ? "security" : "maintenance",
      title      : `[AUDIT][${f.severity.toUpperCase()}] ${f.title.slice(0, 80)}`,
      description: `[type:ai_task] executor:repair_code\n` +
        `Automated audit finding for: ${targetUrl}\n` +
        `Report: ${reportId}\n` +
        `Severity: ${f.severity}\n` +
        `Finding: ${f.title}\n` +
        `Detail: ${f.detail?.slice(0, 300) ?? ""}\n` +
        `Remediation: ${(f as {remediation?: string}).remediation?.slice(0, 300) ?? "See audit report"}\n` +
        (f.url ? `URL: ${f.url}\n` : "") +
        `Rule: ${(f as {rule?: string}).rule ?? "general"}\n\n` +
        "```json\n" + JSON.stringify([{
          severity     : f.severity,
          type         : "security",
          file         : f.url ?? targetUrl,
          description  : f.title,
          suggested_fix: (f as {remediation?: string}).remediation ?? f.detail,
          rule         : (f as {rule?: string}).rule ?? "AUDIT_FINDING",
        }], null, 2) + "\n```",
      depends_on : [],
      status     : "pending",
      source     : "web_audit",
      updated_at : ts + i,
    };
  });

  // Dedup
  const { data: existing } = await db().from("roadmap_tasks").select("id").in("id", rows.map(r => r.id));
  const existingSet = new Set((existing ?? []).map((r: {id: string}) => r.id));
  const toInsert = rows.filter(r => !existingSet.has(r.id));

  if (toInsert.length === 0) return { count: 0, ids: [] };

  const { error } = await db().from("roadmap_tasks").insert(toInsert);
  if (error) {
    console.error(`[reportBuilder] Task seeding failed: ${error.message}`);
    return { count: 0, ids: [] };
  }

  return { count: toInsert.length, ids: toInsert.map(r => String(r.id)) };
}

// ── Recommendation generator ───────────────────────────────────────────────

function buildRecommendations(
  security   : SecurityAuditResult,
  perf       : PerformanceAuditResult,
  dom        : DomAnalysisResult,
  tech       : TechStackProfile
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Security recommendations
  for (const f of security.findings.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 5)) {
    recs.push({
      priority: f.severity as "critical" | "high",
      category: "security",
      title   : f.title,
      detail  : f.remediation,
      effort  : f.category === "headers" ? "low" : "medium",
    });
  }

  // Performance recommendations
  for (const i of perf.issues.filter(i => i.severity === "high" || i.severity === "critical").slice(0, 3)) {
    recs.push({
      priority: i.severity as "critical" | "high",
      category: "performance",
      title   : i.title,
      detail  : i.remediation,
      effort  : "medium",
    });
  }

  // DOM recommendations
  for (const f of dom.findings.filter(f => f.severity === "high" || f.severity === "critical").slice(0, 3)) {
    recs.push({
      priority: f.severity as "critical" | "high",
      category: "auth_flow",
      title   : f.finding,
      detail  : `Found at ${f.url}`,
      effort  : "medium",
    });
  }

  // Tech-based recommendations
  if (tech.analyticsTools.length === 0) {
    recs.push({ priority: "low", category: "observability", title: "No analytics detected", detail: "Consider adding privacy-respecting analytics (Plausible, Fathom) for traffic insights.", effort: "low" });
  }
  if (!tech.authProviders.length && dom.loginPages.length > 0) {
    recs.push({ priority: "medium", category: "auth", title: "Auth provider not identified", detail: "Verify authentication implementation — no known auth service detected.", effort: "medium" });
  }

  return recs.sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  }).slice(0, 15);
}

// ── Main report builder ────────────────────────────────────────────────────

export async function buildReport(
  crawl        : CrawlOutput,
  dom          : DomAnalysisResult,
  apiMap       : ApiMapResult,
  techStack    : TechStackProfile,
  security     : SecurityAuditResult,
  performance  : PerformanceAuditResult,
  durationMs   : number,
  seedTasks    : boolean = true
): Promise<PlatformAuditReport> {
  const reportId = `audit-${Date.now()}`;
  const maxDepth = crawl.pages.length > 0 ? Math.max(...crawl.pages.map(p => p.depth)) : 0;

  const allFindings = [
    ...security.findings,
    ...dom.findings.map(f => ({ ...f, rule: "DOM_FINDING", remediation: f.detail })),
  ];

  let tasksCreated = 0;
  let taskIds: string[] = [];
  if (seedTasks) {
    const seeded = await seedAuditTasks(allFindings, crawl.rootUrl, reportId);
    tasksCreated = seeded.count;
    taskIds      = seeded.ids;
  }

  const recommendations = buildRecommendations(security, performance, dom, techStack);

  return {
    reportId,
    targetUrl   : crawl.rootUrl,
    domain      : crawl.domain,
    auditedAt   : crawl.crawledAt,
    durationMs,
    architecture: {
      pagesFound       : crawl.pages.length,
      scriptsFound     : crawl.scripts.length,
      stylesFound      : crawl.styles.length,
      sitemapPresent   : crawl.sitemapFound,
      techStack,
      apiEndpoints     : crawl.apiEndpoints,
      crawlDepthReached: maxDepth,
    },
    security: {
      score      : security.score,
      grade      : security.grade,
      findings   : security.findings,
      headerAudit: security.headerAudit,
      exposedPaths: security.exposedPaths,
      summary    : security.summary,
    },
    performance: {
      score  : performance.score,
      grade  : performance.grade,
      issues : performance.issues,
      metrics: performance.metrics,
      summary: performance.summary,
    },
    domAnalysis: {
      forms       : dom.forms,
      adminPaths  : dom.adminPaths,
      loginPages  : dom.loginPages,
      paymentPages: dom.paymentPages,
      uploadPages : dom.uploadPages,
      findings    : dom.findings,
    },
    apiMap: {
      endpoints    : apiMap.endpoints,
      graphqlUrls  : apiMap.graphqlUrls,
      websocketUrls: apiMap.websocketUrls,
      totalFound   : apiMap.totalFound,
    },
    recommendations,
    tasksCreated,
    taskIds,
  };
}
