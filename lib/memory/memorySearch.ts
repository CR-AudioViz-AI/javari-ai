// lib/memory/memorySearch.ts
// Purpose: Full-text and structural search over the memory graph. Used by the
//          repair engine to find prior solutions, detect patterns, and build
//          context before generating a fix. Supports keyword search, node-type
//          filters, technology filters, and graph traversal from a seed node.
// Date: 2026-03-07
import { createClient } from "@supabase/supabase-js";
import { getNeighbors, MemoryNode, MemoryEdge, EdgeType } from "./memoryGraph";
// ── Types ──────────────────────────────────────────────────────────────────
export interface MemorySearchQuery {
export interface MemorySearchResult {
export interface RepairContext {
// ── Supabase client ────────────────────────────────────────────────────────
// ── Main search ────────────────────────────────────────────────────────────
  // Full-text: ilike match on label + description
  // Type filter
  // Technology filter
  // Domain filter
  // Severity filter
  // Optionally load edges connecting these nodes
// ── Repair context builder ─────────────────────────────────────────────────
// Given an issue description + technology, fetches the most relevant prior
// fixes, patterns, and tech profile from the graph. Returns structured context
// ready to be injected into a repair prompt.
  // 1. Find prior fixes in the same technology
  // 2. Find issue nodes that match keywords from the description
  // Dedup
  // 3. Find related patterns
  // 4. Tech profile
  // Build prior fixes: for each fix, find what issue it resolved
    // Find issue that resolved_by this fix
// ── Graph traversal search ─────────────────────────────────────────────────
// BFS from seed node, following edge types up to maxDepth.
// ── Context text builders ──────────────────────────────────────────────────
  // Show resolved_by edges
export default {}
