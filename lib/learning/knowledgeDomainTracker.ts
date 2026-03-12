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
export interface KnowledgeDomainReport {
// ── Domain metadata ────────────────────────────────────────────────────────
// ── Score calculator ───────────────────────────────────────────────────────
  // Score formula (max 100):
  // Exposure   = min(events / 20, 40)
  // Repair     = (repaired / max(detected,1)) * 40
  // Analysis   = min((scanned + techSeen*0.5 + patterns*2 + capImproved*3) * 2, 20)
  // Knowledge gap: unresolved issues as % of detected
  // Top technologies in this domain
  // Trend: second half vs first half
// ── Gap analysis ───────────────────────────────────────────────────────────
// ── Main tracker ───────────────────────────────────────────────────────────
      // Map unknown domains to closest match
export default {}
