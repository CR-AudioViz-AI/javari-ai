// lib/memory/relationshipMapper.ts
// Purpose: Analyzes the memory graph to discover, infer, and surface
//          relationships between nodes. Runs pattern matching across issue/fix
//          pairs to find recurring patterns, root cause chains, and clusters.
//          Also generates relationship suggestions for the repair engine.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";
import {
  upsertEdge, upsertNode, getNeighbors,
  MemoryNode, MemoryEdge, EdgeType,
} from "./memoryGraph";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RelationshipSuggestion {
  sourceNode  : MemoryNode;
  targetNode  : MemoryNode;
  suggestedEdge: EdgeType;
  confidence  : number;    // 0-100
  reason      : string;
}

export interface PatternCluster {
  patternLabel: string;
  nodeIds     : string[];
  technology  : string;
  domain      : string;
  frequency   : number;
  avgSeverity : string;
}

export interface RootCauseChain {
  rootNode    : MemoryNode;
  chain       : Array<{ node: MemoryNode; edge: MemoryEdge }>;
  depth       : number;
  totalWeight : number;
}

// ── Supabase client ────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Pattern detection ──────────────────────────────────────────────────────
// Finds issues that share the same technology + domain + severity combination.
// Groups them into pattern clusters and creates "instance_of" edges.

export async function detectPatterns(): Promise<PatternCluster[]> {
  const { data: issues } = await db()
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .eq("node_type", "issue")
    .order("occurrences", { ascending: false })
    .limit(200);

  if (!issues?.length) return [];

  // Group by technology + domain + severity
  const groups = new Map<string, typeof issues>();
  for (const issue of issues) {
    const key = `${issue.technology}:${issue.domain}:${issue.severity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(issue);
  }

  const clusters: PatternCluster[] = [];
  for (const [key, nodes] of groups.entries()) {
    if (nodes.length < 2) continue; // Not a pattern unless seen 2+ times
    const [technology, domain, severity] = key.split(":");
    const patternLabel = `${technology} ${domain} ${severity} pattern`;

    // Create/update a pattern node
    const patternNode = await upsertNode({
      node_type  : "pattern",
      label      : patternLabel,
      description: `Recurring ${severity} issue in ${technology} ${domain}`,
      technology : technology,
      domain     : domain,
      severity   : severity as MemoryNode["severity"],
      confidence : Math.min(100, 60 + nodes.length * 5),
      occurrences: nodes.length,
      metadata   : { instance_count: nodes.length },
      source     : "relationship_mapper",
    });

    // Create instance_of edges from each issue to the pattern
    for (const issue of nodes.slice(0, 10)) { // cap at 10 per pattern
      try {
        await upsertEdge(issue.id, "instance_of", patternNode.id, 75, {});
      } catch { /* non-fatal */ }
    }

    clusters.push({
      patternLabel,
      nodeIds    : nodes.map(n => n.id),
      technology,
      domain,
      frequency  : nodes.length,
      avgSeverity: severity,
    });
  }

  return clusters.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
}

// ── Root cause chain analysis ──────────────────────────────────────────────
// Traces "caused_by" edges from a starting node to find the root cause.

export async function buildRootCauseChain(startNodeId: string, maxDepth = 5): Promise<RootCauseChain | null> {
  const startNode = (await db()
    .from("javari_memory_graph")
    .select("*")
    .eq("id", startNodeId)
    .maybeSingle()).data;
  if (!startNode) return null;

  const chain: Array<{ node: MemoryNode; edge: MemoryEdge }> = [];
  let currentId = startNodeId;
  let totalWeight = 0;

  for (let depth = 0; depth < maxDepth; depth++) {
    const neighbors = await getNeighbors(currentId, ["caused_by"], 5);
    if (!neighbors.length) break;
    // Follow highest-weight edge
    const best = neighbors.sort((a, b) => b.edge.weight - a.edge.weight)[0];
    chain.push({ node: best.node, edge: best.edge });
    totalWeight += best.edge.weight;
    currentId = best.node.id;
    if (best.node.id === startNodeId) break; // cycle guard
  }

  const root = chain.length > 0 ? chain[chain.length - 1].node : rowToNode(startNode);
  return { rootNode: root, chain, depth: chain.length, totalWeight };
}

// ── Relationship suggestions ───────────────────────────────────────────────
// Finds nodes that might be related but don't yet have an explicit edge.

export async function suggestRelationships(limit = 20): Promise<RelationshipSuggestion[]> {
  const client = db();
  const suggestions: RelationshipSuggestion[] = [];

  // Heuristic 1: Issues with the same technology that don't share any edge
  const { data: issues } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .eq("node_type", "issue")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (issues?.length) {
    const byTech = new Map<string, typeof issues>();
    for (const n of issues) {
      if (!byTech.has(n.technology)) byTech.set(n.technology, []);
      byTech.get(n.technology)!.push(n);
    }
    for (const [, techIssues] of byTech.entries()) {
      if (techIssues.length < 2) continue;
      // Suggest co_occurs_with between first two issues of the same tech
      const a = techIssues[0], b = techIssues[1];
      // Check no existing edge
      const { data: existing } = await client
        .from("javari_memory_graph")
        .select("id")
        .eq("record_type", "edge")
        .or(`and(source_id.eq.${a.id},target_id.eq.${b.id}),and(source_id.eq.${b.id},target_id.eq.${a.id})`)
        .maybeSingle();
      if (!existing) {
        suggestions.push({
          sourceNode   : rowToNode(a),
          targetNode   : rowToNode(b),
          suggestedEdge: "co_occurs_with",
          confidence   : 65,
          reason       : `Both are ${a.technology} issues in ${a.domain}`,
        });
      }
      if (suggestions.length >= limit) break;
    }
  }

  // Heuristic 2: Fixes that might supersede older fixes in same tech+domain
  const { data: fixes } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .eq("node_type", "fix")
    .order("created_at", { ascending: false })
    .limit(30);

  if (fixes?.length) {
    const byTechDomain = new Map<string, typeof fixes>();
    for (const n of fixes) {
      const key = `${n.technology}:${n.domain}`;
      if (!byTechDomain.has(key)) byTechDomain.set(key, []);
      byTechDomain.get(key)!.push(n);
    }
    for (const [, techFixes] of byTechDomain.entries()) {
      if (techFixes.length < 2) continue;
      const newer = techFixes[0], older = techFixes[1];
      if (newer.id !== older.id) {
        suggestions.push({
          sourceNode   : rowToNode(newer),
          targetNode   : rowToNode(older),
          suggestedEdge: "supersedes",
          confidence   : 55,
          reason       : `Newer fix in same ${newer.technology} ${newer.domain} scope`,
        });
      }
      if (suggestions.length >= limit) break;
    }
  }

  return suggestions.slice(0, limit);
}

// ── Apply relationship suggestions ────────────────────────────────────────

export async function applyRelationshipSuggestions(
  suggestions: RelationshipSuggestion[],
  minConfidence = 70
): Promise<number> {
  let applied = 0;
  for (const s of suggestions) {
    if (s.confidence < minConfidence) continue;
    try {
      await upsertEdge(s.sourceNode.id, s.suggestedEdge, s.targetNode.id, s.confidence, {
        reason: s.reason, auto_suggested: true,
      });
      applied++;
    } catch { /* non-fatal */ }
  }
  return applied;
}

// ── Full mapping run ───────────────────────────────────────────────────────

export async function runRelationshipMapper(): Promise<{
  patternsFound    : number;
  suggestionsFound : number;
  suggestionsApplied: number;
}> {
  const patterns       = await detectPatterns();
  const suggestions    = await suggestRelationships(30);
  const applied        = await applyRelationshipSuggestions(suggestions, 70);
  return {
    patternsFound    : patterns.length,
    suggestionsFound : suggestions.length,
    suggestionsApplied: applied,
  };
}

// ── Row helper (private) ───────────────────────────────────────────────────

function rowToNode(r: Record<string, unknown>): MemoryNode {
  return {
    id: r.id as string, node_type: r.node_type as MemoryNode["node_type"],
    label: r.label as string, description: r.description as string,
    technology: r.technology as string, domain: r.domain as string,
    severity: r.severity as MemoryNode["severity"], confidence: r.confidence as number,
    occurrences: r.occurrences as number, metadata: (r.metadata as Record<string,unknown>) ?? {},
    source: r.source as string, created_at: r.created_at as string, updated_at: r.updated_at as string,
  };
}
