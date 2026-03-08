// lib/learning/capabilityProfiler.ts
// Purpose: Generates an AI capability map for Javari — each capability has a
//          confidence score derived from successful repairs, detections, and
//          pattern learning events. Shows what Javari can do well vs where it
//          is still developing.
// Date: 2026-03-07

import type { LearningEvent } from "./learningCollector";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Capability {
  id          : string;
  capability  : string;
  category    : CapabilityCategory;
  confidence  : number;     // 0–100
  grade       : "A" | "B" | "C" | "D" | "F";
  status      : "active" | "developing" | "untested";
  evidenceCount: number;
  description : string;
  derivedFrom : string[];   // event types that contribute
}

export type CapabilityCategory =
  | "security_analysis" | "performance_analysis" | "code_repair"
  | "architecture_design" | "ux_analysis" | "tech_detection"
  | "autonomous_operation" | "knowledge_synthesis";

export interface CapabilityProfile {
  capabilities       : Capability[];
  topCapability      : string;
  developingCapability: string;
  overallConfidence  : number;
  readyForAutonomy   : boolean;
  autonomyBlockers   : string[];
}

// ── Capability definitions ────────────────────────────────────────────────

interface CapabilityDef {
  id         : string;
  capability : string;
  category   : CapabilityCategory;
  description: string;
  domains    : string[];
  eventTypes : string[];
  minEvidence: number;
}

const CAPABILITY_DEFINITIONS: CapabilityDef[] = [
  {
    id: "cap-security-audit", capability: "Security Auditing",
    category: "security_analysis", description: "Detect CSP, HSTS, XSS, injection, and exposed secrets",
    domains: ["security"], eventTypes: ["issue_detected", "audit_completed"], minEvidence: 3,
  },
  {
    id: "cap-security-repair", capability: "Security Issue Repair",
    category: "code_repair", description: "Fix security vulnerabilities in production code",
    domains: ["security"], eventTypes: ["issue_repaired", "capability_proven"], minEvidence: 2,
  },
  {
    id: "cap-perf-analysis", capability: "Performance Analysis",
    category: "performance_analysis", description: "Identify TTFB, bundle size, render-blocking, and caching issues",
    domains: ["performance"], eventTypes: ["issue_detected", "audit_completed"], minEvidence: 3,
  },
  {
    id: "cap-perf-repair", capability: "Performance Optimization",
    category: "code_repair", description: "Optimize page load, reduce bundle size, improve caching",
    domains: ["performance"], eventTypes: ["issue_repaired", "capability_proven"], minEvidence: 2,
  },
  {
    id: "cap-brand-enforcement", capability: "Brand Consistency Enforcement",
    category: "knowledge_synthesis", description: "Detect and fix brand term inconsistencies across codebases",
    domains: ["architecture"], eventTypes: ["issue_detected", "issue_repaired", "pattern_learned"], minEvidence: 2,
  },
  {
    id: "cap-dedup", capability: "Code Deduplication",
    category: "architecture_design", description: "Identify and consolidate duplicate logic across repositories",
    domains: ["architecture", "backend"], eventTypes: ["issue_detected", "pattern_learned"], minEvidence: 2,
  },
  {
    id: "cap-ux-analysis", capability: "UX Flow Analysis",
    category: "ux_analysis", description: "Simulate user journeys and detect broken flows, 404s, and dead routes",
    domains: ["frontend", "backend"], eventTypes: ["issue_detected", "audit_completed"], minEvidence: 2,
  },
  {
    id: "cap-tech-detection", capability: "Technology Detection",
    category: "tech_detection", description: "Identify frameworks, services, auth providers, and payment systems from HTML/JS",
    domains: ["architecture", "frontend", "backend"], eventTypes: ["tech_encountered", "scan_completed"], minEvidence: 3,
  },
  {
    id: "cap-autonomous-repair", capability: "Autonomous Code Repair",
    category: "autonomous_operation", description: "Identify, fix, commit, and verify code issues without human intervention",
    domains: ["backend", "frontend", "infrastructure"], eventTypes: ["issue_repaired", "capability_proven"], minEvidence: 5,
  },
  {
    id: "cap-ecosystem-gov", capability: "Ecosystem Governance",
    category: "knowledge_synthesis", description: "Orchestrate multi-engine analysis across architecture, brand, dedup, and UX",
    domains: ["architecture"], eventTypes: ["ecosystem_analyzed", "scan_completed", "audit_completed"], minEvidence: 2,
  },
  {
    id: "cap-db-analysis", capability: "Database Schema Analysis",
    category: "architecture_design", description: "Analyze schema, RLS policies, indexes, and query performance",
    domains: ["databases"], eventTypes: ["issue_detected", "pattern_learned", "scan_completed"], minEvidence: 2,
  },
  {
    id: "cap-infra-monitoring", capability: "Infrastructure Monitoring",
    category: "autonomous_operation", description: "Track deployment health, cron execution, and system uptime",
    domains: ["infrastructure", "devops"], eventTypes: ["scan_completed", "issue_detected"], minEvidence: 2,
  },
];

// ── Confidence calculator ──────────────────────────────────────────────────

function scoreCapability(def: CapabilityDef, events: LearningEvent[]): Capability {
  // Filter relevant events
  const relevant = events.filter(e =>
    def.domains.includes(e.domain) &&
    def.eventTypes.includes(e.event_type)
  );

  const evidence     = relevant.length;
  const successCount = relevant.filter(e =>
    e.event_type === "issue_repaired" || e.event_type === "capability_proven"
  ).length;
  const detections   = relevant.filter(e =>
    e.event_type === "issue_detected" || e.event_type === "audit_completed" ||
    e.event_type === "scan_completed" || e.event_type === "ecosystem_analyzed"
  ).length;

  if (evidence === 0) {
    return {
      ...def, confidence: 0, grade: "F", status: "untested",
      evidenceCount: 0, derivedFrom: [],
    };
  }

  // Confidence formula:
  // Evidence score: min(evidence / minEvidence * 30, 30)
  // Success score:  min(successCount * 15, 40)
  // Detection score: min(detections * 5, 30)
  const evidenceScore  = Math.min((evidence / def.minEvidence) * 30, 30);
  const successScore   = Math.min(successCount * 15, 40);
  const detectionScore = Math.min(detections * 5, 30);
  const confidence     = Math.round(Math.min(100, evidenceScore + successScore + detectionScore));
  const grade: Capability["grade"] =
    confidence >= 90 ? "A" : confidence >= 75 ? "B" :
    confidence >= 60 ? "C" : confidence >= 40 ? "D" : "F";

  const status: Capability["status"] =
    confidence >= 40 ? "active" : evidence >= 1 ? "developing" : "untested";

  const derivedFrom = [...new Set(relevant.map(e => e.event_type))];

  return {
    id: def.id, capability: def.capability, category: def.category,
    description: def.description, confidence, grade, status, evidenceCount: evidence, derivedFrom,
  };
}

// ── Main profiler ──────────────────────────────────────────────────────────

export function buildCapabilityProfile(events: LearningEvent[]): CapabilityProfile {
  const capabilities = CAPABILITY_DEFINITIONS
    .map(def => scoreCapability(def, events))
    .sort((a, b) => b.confidence - a.confidence);

  const active      = capabilities.filter(c => c.status === "active");
  const developing  = capabilities.filter(c => c.status === "developing");

  const topCapability       = capabilities[0]?.capability ?? "—";
  const developingCapability = developing[0]?.capability
    ?? capabilities.filter(c => c.confidence < 60)[0]?.capability ?? "—";

  const overallConfidence = capabilities.length > 0
    ? Math.round(capabilities.reduce((s, c) => s + c.confidence, 0) / capabilities.length)
    : 0;

  // Autonomy readiness: needs repair + monitoring + tech detection all >= 60
  const repairCap    = capabilities.find(c => c.id === "cap-autonomous-repair");
  const monitorCap   = capabilities.find(c => c.id === "cap-infra-monitoring");
  const techDetCap   = capabilities.find(c => c.id === "cap-tech-detection");

  const autonomyBlockers: string[] = [];
  if ((repairCap?.confidence ?? 0) < 60)  autonomyBlockers.push("Autonomous repair confidence < 60");
  if ((monitorCap?.confidence ?? 0) < 40) autonomyBlockers.push("Infrastructure monitoring confidence < 40");
  if ((techDetCap?.confidence ?? 0) < 40) autonomyBlockers.push("Technology detection confidence < 40");
  if (active.length < 5) autonomyBlockers.push(`Only ${active.length}/5 required capabilities active`);

  const readyForAutonomy = autonomyBlockers.length === 0;

  return { capabilities, topCapability, developingCapability, overallConfidence, readyForAutonomy, autonomyBlockers };
}
