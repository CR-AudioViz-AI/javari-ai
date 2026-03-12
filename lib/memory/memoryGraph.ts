// lib/memory/memoryGraph.ts
// Purpose: Core graph data model and Supabase persistence layer for the Javari
//          Memory Graph. Stores nodes (issues, fixes, technologies, patterns)
//          and directed edges (resolved_by, caused_by, requires, related_to, etc.)
//          in javari_memory_graph. All learning — repairs, scans, crawls, audits,
//          technology discoveries — feeds into this graph.
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
// ── Types ──────────────────────────────────────────────────────────────────
export type NodeType =
export type EdgeType =
export interface MemoryNode {
export interface MemoryEdge {
export interface MemoryGraphStats {
// ── Supabase client ────────────────────────────────────────────────────────
// ── Table migration ────────────────────────────────────────────────────────
// ── ID generators ──────────────────────────────────────────────────────────
// ── Upsert node ────────────────────────────────────────────────────────────
// If a node with the same label+technology+node_type exists, increments
// occurrences and updates confidence/metadata rather than creating a duplicate.
  // Check for existing node by label + technology + node_type
    // Update occurrences and merge metadata
// ── Upsert edge ────────────────────────────────────────────────────────────
  // Check for existing edge
// ── Load node ──────────────────────────────────────────────────────────────
// ── Get neighbors ──────────────────────────────────────────────────────────
// ── Graph stats ────────────────────────────────────────────────────────────
// ── Row converters ─────────────────────────────────────────────────────────
export default {}
