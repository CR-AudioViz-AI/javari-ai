// lib/memory/knowledgeNodeBuilder.ts
// Purpose: Ingestion adapter — maps every Javari event type to memory graph nodes/edges.
//          Sources: repairs, scans, crawls, audits, tech discoveries, learning events.
//          Pattern detection: automatically identifies recurring issues/fixes.
// Date: 2026-03-08
import { upsertNode, upsertEdge, MemoryNode, NodeType } from "./memoryGraph";
import type { LearningEvent } from "@/lib/learning/learningCollector";
// ── Re-exported helper types ───────────────────────────────────────────────
export interface RepairRecord {
export interface ScanRecord {
export interface CrawlRecord {
export interface TechDiscovery {
// ── Repair event ingestion ─────────────────────────────────────────────────
  // Issue node
  // Fix node
  // Technology node
  // Edges: issue → resolved_by → fix, issue → affects → technology
// ── Scan event ingestion ───────────────────────────────────────────────────
// ── Crawl event ingestion ──────────────────────────────────────────────────
// ── Technology discovery ingestion ─────────────────────────────────────────
// ── Learning event ingestion ───────────────────────────────────────────────
  // Map learning event types to node types
  // LearningEvent stores payload in details, not at top-level
  // If this is a repair event, create edges linking issue → fix
  // Group by strategy to detect recurring patterns
    // Link pattern to each affected technology
// ─── Route-compatible aliases ────────────────────────────────────────────────
// route.ts imports these names; they delegate to the canonical functions above.
export default {}
