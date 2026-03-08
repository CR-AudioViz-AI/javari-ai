// lib/learning/knowledgeDomainTracker.ts
// Purpose: Tracks Javari's proficiency per knowledge domain. Score formula
//          weights issues detected, issues repaired, and systems analyzed.
//          Higher repair-to-detection ratio = higher mastery score.
// Date: 2026-03-07

import type { LearningEvent, KnowledgeDomain } from "./learningCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DomainScore {
  domain          : KnowledgeDomain;
  label           : string;
  score           : number;       // 0–100
  grade           : "A" | "B" | "C" | "D" | "F";
  proficiency     : "novice" | "developing" | "competent" | "proficient" | "expert";
  issuesDetected  : number;
  issuesRepaired  : number;
  systemsAnalyzed : number;
  eventsCount     : number;
  repairRate      : number;       // 0–1
  trend           : "improving" | "stable" | "declining";
  topTechnologies : string[];
  lastActivity?   : string;
}

export interface KnowledgeDomainReport {
  domainScores    : DomainScore[];
  topDomain       : KnowledgeDomain;
  weakestDomain   : KnowledgeDomain;
  overallMaturity : number;       // 0–100 weighted average
  totalEvents     : number;
}

// ── Domain metadata ────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<KnowledgeDomain, string> = {
  security      : "Security Auditing",
  performance   : "Performance Optimization",
  architecture  : "System Architecture",
  frontend      : "Frontend Engineering",
  backend       : "Backend Engineering",
  infrastructure: "Infrastructure & DevOps",
  ai_systems    : "AI Systems Integration",
  databases     : "Database Engineering",
  devops        : "DevOps & CI/CD",
};

// ── Score calculator ───────────────────────────────────────────────────────

function scoreDomain(
  domain : KnowledgeDomain,
  events : LearningEvent[]
): DomainScore {
  const label   = DOMAIN_LABELS[domain] ?? domain;
  const detected = events.filter(e => e.event_type === "issue_detected" || e.event_type === "failure_observed").length;
  const repaired = events.filter(e => e.event_type === "issue_repaired" || e.event_type === "capability_proven").length;
  const scanned  = events.filter(e => e.event_type === "scan_completed" || e.event_type === "audit_completed" || e.event_type === "ecosystem_analyzed").length;
  const encountered = events.filter(e => e.event_type === "tech_encountered").length;

  // Score formula:
  // Base = min(events / 20, 40)             — exposure score (max 40pts)
  // Repair bonus = (repaired / max(detected,1)) * 40  — mastery score (max 40pts)
  // Scan bonus = min(scanned * 2, 20)        — analysis breadth (max 20pts)
  const exposure    = Math.min((events.length / 20) * 40, 40);
  const repairRate  = detected > 0 ? repaired / detected : repaired > 0 ? 0.5 : 0;
  const masteryPts  = Math.min(repairRate * 40, 40);
  const analysisPts = Math.min(scanned * 2, 20);
  const raw         = exposure + masteryPts + analysisPts;

  // Tiny penalty for unresolved failures
  const failures    = events.filter(e => e.event_type === "failure_observed").length;
  const score       = Math.max(0, Math.min(100, Math.round(raw - (failures * 0.5))));

  const grade: DomainScore["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  const proficiency: DomainScore["proficiency"] =
    score >= 80 ? "expert"
    : score >= 65 ? "proficient"
    : score >= 50 ? "competent"
    : score >= 30 ? "developing"
    : "novice";

  // Top technologies in this domain
  const techCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.technology && e.technology !== "unknown") {
      techCounts[e.technology] = (techCounts[e.technology] ?? 0) + 1;
    }
  }
  const topTechnologies = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  // Trend: compare first half vs second half event counts
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const half   = Math.floor(sorted.length / 2);
  const first  = sorted.slice(0, half).length;
  const second = sorted.slice(half).length;
  const trend: DomainScore["trend"] =
    sorted.length < 4 ? "stable"
    : second > first * 1.2 ? "improving"
    : second < first * 0.8 ? "declining"
    : "stable";

  return {
    domain, label, score, grade, proficiency,
    issuesDetected  : detected,
    issuesRepaired  : repaired,
    systemsAnalyzed : scanned + encountered,
    eventsCount     : events.length,
    repairRate      : Math.round(repairRate * 100) / 100,
    trend,
    topTechnologies,
    lastActivity    : sorted[sorted.length - 1]?.timestamp,
  };
}

// ── Main tracker ───────────────────────────────────────────────────────────

export function buildKnowledgeDomainReport(events: LearningEvent[]): KnowledgeDomainReport {
  const ALL_DOMAINS: KnowledgeDomain[] = [
    "security", "performance", "architecture", "frontend",
    "backend", "infrastructure", "ai_systems", "databases",
  ];

  const byDomain = new Map<KnowledgeDomain, LearningEvent[]>();
  for (const d of ALL_DOMAINS) byDomain.set(d, []);
  for (const e of events) {
    const bucket = byDomain.get(e.domain);
    if (bucket) bucket.push(e);
    // If domain is "devops", route to infrastructure
    else byDomain.get("infrastructure")?.push(e);
  }

  const domainScores = ALL_DOMAINS.map(d => scoreDomain(d, byDomain.get(d) ?? []));

  const sorted         = [...domainScores].sort((a, b) => b.score - a.score);
  const topDomain      = sorted[0]?.domain ?? "security";
  const weakestDomain  = sorted[sorted.length - 1]?.domain ?? "databases";

  const weights: Record<KnowledgeDomain, number> = {
    security: 1.5, performance: 1.3, architecture: 1.2, ai_systems: 1.2,
    backend: 1.0, frontend: 1.0, databases: 1.0, infrastructure: 0.9, devops: 0.8,
  };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const ds of domainScores) {
    const w = weights[ds.domain] ?? 1.0;
    weightedSum += ds.score * w;
    weightTotal += w;
  }
  const overallMaturity = Math.round(weightedSum / weightTotal);

  return { domainScores, topDomain, weakestDomain, overallMaturity, totalEvents: events.length };
}
