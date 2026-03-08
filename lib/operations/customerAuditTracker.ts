// lib/operations/customerAuditTracker.ts
// Purpose: Tracks customer domain audits run through the Javari Web Crawler.
//          Stores results in javari_customer_audits and provides aggregated
//          reporting for the operations dashboard.
// Date: 2026-03-07

import type { RawOperationsData, CustomerAuditRow } from "./operationsCollector";
import { recordCustomerAudit } from "./operationsCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CustomerAuditSummary {
  totalAudits        : number;
  uniqueDomains      : number;
  avgSecurityScore   : number;
  avgPerformanceScore: number;
  avgIssuesPerAudit  : number;
  last24hAudits      : number;
  totalTasksCreated  : number;
  recentAudits       : CustomerAuditRow[];
  byDomain           : Record<string, DomainAuditSummary>;
  worstSecurityDomain: string;
  mostImprovedDomain : string;
}

export interface DomainAuditSummary {
  domain             : string;
  auditCount         : number;
  latestSecurityScore: number;
  latestPerfScore    : number;
  totalIssues        : number;
  trend              : "improving" | "stable" | "degrading";
}

// ── Aggregator ─────────────────────────────────────────────────────────────

export function aggregateCustomerAudits(data: RawOperationsData): CustomerAuditSummary {
  const audits = data.customerAudits;
  const avg = (arr: number[]) => arr.length > 0
    ? Math.round(arr.reduce((a,b) => a+b, 0) / arr.length) : 0;

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent24 = audits.filter(a => new Date(a.scan_date).getTime() > dayAgo);

  const byDomain: Record<string, DomainAuditSummary> = {};
  for (const a of audits) {
    if (!byDomain[a.domain]) {
      byDomain[a.domain] = {
        domain: a.domain, auditCount: 0,
        latestSecurityScore: 0, latestPerfScore: 0, totalIssues: 0, trend: "stable",
      };
    }
    const d = byDomain[a.domain];
    d.auditCount++;
    d.totalIssues += a.issues_found ?? 0;
    d.latestSecurityScore = a.security_score;
    d.latestPerfScore = a.performance_score;
  }

  const domainEntries = Object.values(byDomain);
  const worstSecurity = domainEntries.sort((a,b) => a.latestSecurityScore - b.latestSecurityScore)[0]?.domain ?? "";

  return {
    totalAudits        : audits.length,
    uniqueDomains      : Object.keys(byDomain).length,
    avgSecurityScore   : avg(audits.map(a => a.security_score ?? 0)),
    avgPerformanceScore: avg(audits.map(a => a.performance_score ?? 0)),
    avgIssuesPerAudit  : avg(audits.map(a => a.issues_found ?? 0)),
    last24hAudits      : recent24.length,
    totalTasksCreated  : audits.reduce((s, a) => s + (a.tasks_created ?? 0), 0),
    recentAudits       : audits.slice(0, 10),
    byDomain,
    worstSecurityDomain: worstSecurity,
    mostImprovedDomain : "",
  };
}

// ── Record a customer audit (called from crawler) ──────────────────────────

export async function trackCustomerAudit(params: {
  domain            : string;
  reportId          : string;
  pagesCrawled      : number;
  issuesFound       : number;
  securityScore     : number;
  performanceScore  : number;
  tasksCreated      : number;
  metadata?         : Record<string, unknown>;
}): Promise<void> {
  const audit: Omit<CustomerAuditRow, "created_at"> = {
    id               : `audit-cust-${Date.now()}-${params.domain.replace(/\./g, "-").slice(0, 20)}`,
    domain           : params.domain,
    scan_date        : new Date().toISOString(),
    pages_crawled    : params.pagesCrawled,
    issues_found     : params.issuesFound,
    security_score   : params.securityScore,
    performance_score: params.performanceScore,
    report_id        : params.reportId,
    tasks_created    : params.tasksCreated,
    metadata         : params.metadata,
  };
  await recordCustomerAudit(audit);
}
