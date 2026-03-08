// lib/learning/knowledgeDomainTracker.ts
// Purpose: Tracks Javari proficiency per knowledge domain.
//          Domains: security, performance, architecture, frontend, backend,
//                   infrastructure, ai_systems, databases, devops.
//          Score formula: exposure(40) + mastery(40) + analysis(20) = 100max.
//          Enhancement: tech_encountered now feeds systemsAnalyzed, devops domain added.
// Date: 2026-03-08

import type { LearningEvent, KnowledgeDomain } from "./learningCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DomainScore {
  domain          : KnowledgeDomain;
  label           : string;
  score           : number;
  grade           : "A" | "B" | "C" | "D" | "F";
  proficiency     : "novice" | "developing" | "competent" | "proficient" | "expert";
  issuesDetected  : number;
  issuesRepaired  : number;
  systemsAnalyzed : number;
  techEncountered : number;
  eventsCount     : number;
  repairRate      : number;
  trend           : "improving" | "stable" | "declining";
  topTechnologies : string[];
  knowledgeGap    : number;    // 0–100: how much is unresolved (100 = all unresolved)
  lastActivity?   : string;
}

export interface KnowledgeDomainReport {
  domainScores    : DomainScore[];
  topDomain       : KnowledgeDomain;
  weakestDomain   : KnowledgeDomain;
  overallMaturity : number;
  totalEvents     : number;
  knowledgeGaps   : Array<{ domain: KnowledgeDomain; gap: number; recommendation: string }>;
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

const DOMAIN_WEIGHTS: Record<KnowledgeDomain, number> = {
  security      : 1.5,
  performance   : 1.3,
  architecture  : 1.2,
  ai_systems    : 1.2,
  backend       : 1.1,
  databases     : 1.0,
  frontend      : 1.0,
  infrastructure: 0.9,
  devops        : 0.9,
};

// ── Score calculator ───────────────────────────────────────────────────────

function scoreDomain(domain: KnowledgeDomain, events: LearningEvent[]): DomainScore {
  const label = DOMAIN_LABELS[domain] ?? domain;

  const detected    = events.filter(e => e.event_type === "issue_detected"    || e.event_type === "failure_observed").length;
  const repaired    = events.filter(e => e.event_type === "issue_repaired"    || e.event_type === "capability_proven").length;
  const scanned     = events.filter(e => e.event_type === "scan_completed"    || e.event_type === "audit_completed" || e.event_type === "ecosystem_analyzed").length;
  const techSeen    = events.filter(e => e.event_type === "tech_encountered").length;
  const patterns    = events.filter(e => e.event_type === "pattern_learned").length;
  const failures    = events.filter(e => e.event_type === "failure_observed").length;
  const capImproved = events.filter(e => e.event_type === "capability_improved").length;

  // Score formula (max 100):
  // Exposure   = min(events / 20, 40)
  // Repair     = (repaired / max(detected,1)) * 40
  // Analysis   = min((scanned + techSeen*0.5 + patterns*2 + capImproved*3) * 2, 20)
  const exposure    = Math.min((events.length / 20) * 40, 40);
  const repairRate  = detected > 0 ? repaired / detected : repaired > 0 ? 0.7 : 0;
  const masteryPts  = Math.min(repairRate * 40, 40);
  const analysisPts = Math.min(
    (scanned * 2 + techSeen * 1 + patterns * 4 + capImproved * 6), 20
  );
  const raw   = exposure + masteryPts + analysisPts;
  const score = Math.max(0, Math.min(100, Math.round(raw - (failures * 0.3))));

  const grade: DomainScore["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  const proficiency: DomainScore["proficiency"] =
    score >= 80 ? "expert"      :
    score >= 65 ? "proficient"  :
    score >= 50 ? "competent"   :
    score >= 30 ? "developing"  : "novice";

  // Knowledge gap: unresolved issues as % of detected
  const knowledgeGap = detected > 0
    ? Math.round(((detected - repaired) / detected) * 100)
    : 0;

  // Top technologies in this domain
  const techCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.technology && e.technology !== "unknown") {
      techCounts[e.technology] = (techCounts[e.technology] ?? 0) + 1;
    }
  }
  const topTechnologies = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);

  // Trend: second half vs first half
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const half   = Math.floor(sorted.length / 2);
  const first  = sorted.slice(0, half).length;
  const second = sorted.slice(half).length;
  const trend: DomainScore["trend"] =
    sorted.length < 4 ? "stable" :
    second > first * 1.2 ? "improving" :
    second < first * 0.8 ? "declining" : "stable";

  return {
    domain, label, score, grade, proficiency,
    issuesDetected  : detected,
    issuesRepaired  : repaired,
    systemsAnalyzed : scanned,
    techEncountered : techSeen,
    eventsCount     : events.length,
    repairRate      : Math.round(repairRate * 100) / 100,
    trend,
    topTechnologies,
    knowledgeGap,
    lastActivity    : sorted[sorted.length - 1]?.timestamp,
  };
}

// ── Gap analysis ───────────────────────────────────────────────────────────

function buildKnowledgeGaps(domainScores: DomainScore[]): Array<{
  domain: KnowledgeDomain; gap: number; recommendation: string;
}> {
  const gaps: Array<{ domain: KnowledgeDomain; gap: number; recommendation: string }> = [];

  for (const ds of domainScores) {
    if (ds.knowledgeGap >= 50 || ds.score < 40) {
      const recommendation =
        ds.issuesDetected === 0
          ? `Run a ${ds.label} scan to discover issues`
          : ds.issuesRepaired === 0
          ? `Prioritize ${ds.issuesDetected} unresolved ${ds.label} issues`
          : `Continue repairing ${ds.issuesDetected - ds.issuesRepaired} remaining ${ds.label} issues`;

      gaps.push({ domain: ds.domain, gap: ds.knowledgeGap, recommendation });
    }
  }

  return gaps.sort((a, b) => b.gap - a.gap);
}

// ── Main tracker ───────────────────────────────────────────────────────────

export function buildKnowledgeDomainReport(events: LearningEvent[]): KnowledgeDomainReport {
  const ALL_DOMAINS: KnowledgeDomain[] = [
    "security", "performance", "architecture", "frontend",
    "backend", "infrastructure", "ai_systems", "databases", "devops",
  ];

  const byDomain = new Map<KnowledgeDomain, LearningEvent[]>();
  for (const d of ALL_DOMAINS) byDomain.set(d, []);

  for (const e of events) {
    const bucket = byDomain.get(e.domain as KnowledgeDomain);
    if (bucket) {
      bucket.push(e);
    } else {
      // Map unknown domains to closest match
      const fallback: KnowledgeDomain =
        e.domain === "devops" ? "infrastructure" :
        e.domain === "cloud"  ? "infrastructure" :
        e.domain === "ml"     ? "ai_systems"     :
        e.domain === "api"    ? "backend"        : "backend";
      byDomain.get(fallback)?.push(e);
    }
  }

  const domainScores = ALL_DOMAINS.map(d => scoreDomain(d, byDomain.get(d) ?? []));
  const sorted       = [...domainScores].sort((a, b) => b.score - a.score);
  const topDomain    = sorted[0]?.domain     ?? "security";
  const weakestDomain= sorted[sorted.length - 1]?.domain ?? "databases";

  let weightedSum = 0;
  let weightTotal = 0;
  for (const ds of domainScores) {
    const w = DOMAIN_WEIGHTS[ds.domain] ?? 1.0;
    weightedSum += ds.score * w;
    weightTotal += w;
  }
  const overallMaturity = Math.round(weightedSum / weightTotal);

  const knowledgeGaps = buildKnowledgeGaps(domainScores);

  return { domainScores, topDomain, weakestDomain, overallMaturity, totalEvents: events.length, knowledgeGaps };
}
