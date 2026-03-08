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
  query?          : string;            // full-text keyword
  node_types?     : MemoryNode["node_type"][];
  technologies?   : string[];
  domains?        : string[];
  severities?     : MemoryNode["severity"][];
  min_confidence? : number;
  min_occurrences?: number;
  limit?          : number;
  include_edges?  : boolean;           // also return connected edges
}

export interface MemorySearchResult {
  nodes         : MemoryNode[];
  edges         : MemoryEdge[];
  total         : number;
  query_used    : string;
  context_text  : string;  // formatted for injection into a repair prompt
}

export interface RepairContext {
  priorFixes      : Array<{ issue: string; fix: string; technology: string; occurrences: number }>;
  relatedPatterns : Array<{ label: string; frequency: number; domain: string }>;
  techProfile     : Array<{ technology: string; occurrences: number; domain: string }>;
  contextText     : string;   // formatted for LLM injection
  graphNodesFound : number;
}

// ── Supabase client ────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Main search ────────────────────────────────────────────────────────────

export async function searchMemoryGraph(q: MemorySearchQuery): Promise<MemorySearchResult> {
  const client = db();
  const limit  = Math.min(q.limit ?? 30, 100);

  let queryBuilder = client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .order("occurrences", { ascending: false })
    .limit(limit);

  // Full-text: ilike match on label + description
  if (q.query?.trim()) {
    const safe = q.query.replace(/[%_]/g, "\\$&");
    queryBuilder = queryBuilder.or(
      `label.ilike.%${safe}%,description.ilike.%${safe}%`
    );
  }

  // Type filter
  if (q.node_types?.length) {
    queryBuilder = queryBuilder.in("node_type", q.node_types);
  }

  // Technology filter
  if (q.technologies?.length) {
    queryBuilder = queryBuilder.in("technology", q.technologies);
  }

  // Domain filter
  if (q.domains?.length) {
    queryBuilder = queryBuilder.in("domain", q.domains);
  }

  // Severity filter
  if (q.severities?.length) {
    queryBuilder = queryBuilder.in("severity", q.severities);
  }

  if (q.min_confidence !== undefined) {
    queryBuilder = queryBuilder.gte("confidence", q.min_confidence);
  }
  if (q.min_occurrences !== undefined) {
    queryBuilder = queryBuilder.gte("occurrences", q.min_occurrences);
  }

  const { data: nodes, error } = await queryBuilder;
  if (error) throw new Error(`[memorySearch] ${error.message}`);

  const typedNodes = (nodes ?? []) as unknown[] as MemoryNode[];

  // Optionally load edges connecting these nodes
  let typedEdges: MemoryEdge[] = [];
  if (q.include_edges && typedNodes.length > 0) {
    const ids = typedNodes.map(n => n.id);
    const { data: edgeData } = await client
      .from("javari_memory_graph")
      .select("*")
      .eq("record_type", "edge")
      .or(
        ids.map(id => `source_id.eq.${id}`).join(",") + "," +
        ids.map(id => `target_id.eq.${id}`).join(",")
      )
      .limit(100);
    typedEdges = (edgeData ?? []) as unknown[] as MemoryEdge[];
  }

  const contextText = buildContextText(typedNodes, typedEdges, q.query);

  return {
    nodes       : typedNodes,
    edges       : typedEdges,
    total       : typedNodes.length,
    query_used  : q.query ?? "(no keyword)",
    context_text: contextText,
  };
}

// ── Repair context builder ─────────────────────────────────────────────────
// Given an issue description + technology, fetches the most relevant prior
// fixes, patterns, and tech profile from the graph. Returns structured context
// ready to be injected into a repair prompt.

export async function buildRepairContext(
  issueDescription: string,
  technology      : string,
  domain?         : string
): Promise<RepairContext> {
  const client = db();

  // 1. Find prior fixes in the same technology
  const { data: fixNodes } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .eq("node_type", "fix")
    .eq("technology", technology)
    .order("occurrences", { ascending: false })
    .limit(10);

  // 2. Find issue nodes that match keywords from the description
  const keywords = issueDescription
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter(w => w.length > 4)
    .slice(0, 3);

  let relatedIssues: MemoryNode[] = [];
  for (const kw of keywords) {
    const { data } = await client
      .from("javari_memory_graph")
      .select("*")
      .eq("record_type", "node")
      .eq("node_type", "issue")
      .ilike("label", `%${kw}%`)
      .limit(5);
    relatedIssues = [...relatedIssues, ...((data ?? []) as unknown[] as MemoryNode[])];
  }
  // Dedup
  const seenIds = new Set<string>();
  relatedIssues = relatedIssues.filter(n => { if (seenIds.has(n.id)) return false; seenIds.add(n.id); return true; });

  // 3. Find related patterns
  const { data: patternNodes } = await domain
    ? client.from("javari_memory_graph").select("*")
        .eq("record_type","node").eq("node_type","pattern").eq("domain", domain)
        .order("occurrences",{ascending:false}).limit(5)
    : client.from("javari_memory_graph").select("*")
        .eq("record_type","node").eq("node_type","pattern").eq("technology", technology)
        .order("occurrences",{ascending:false}).limit(5);

  // 4. Tech profile
  const { data: techNode } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type","node")
    .eq("node_type","technology")
    .eq("label", technology)
    .maybeSingle();

  // Build prior fixes: for each fix, find what issue it resolved
  const priorFixes: RepairContext["priorFixes"] = [];
  for (const fix of (fixNodes ?? []).slice(0, 5)) {
    const typedFix = fix as unknown as MemoryNode;
    // Find issue that resolved_by this fix
    const { data: issueEdges } = await client
      .from("javari_memory_graph")
      .select("*")
      .eq("record_type","edge")
      .eq("edge_type","resolved_by")
      .eq("target_id", typedFix.id)
      .limit(1);
    const issueEdge = (issueEdges ?? [])[0] as unknown as MemoryEdge | undefined;
    let issueLabel = "Unknown issue";
    if (issueEdge?.source_id) {
      const { data: issueRow } = await client
        .from("javari_memory_graph")
        .select("label")
        .eq("id", issueEdge.source_id)
        .maybeSingle();
      if (issueRow) issueLabel = (issueRow as {label: string}).label;
    }
    priorFixes.push({
      issue: issueLabel,
      fix  : typedFix.label,
      technology: typedFix.technology,
      occurrences: typedFix.occurrences,
    });
  }

  const relatedPatterns = (patternNodes ?? []).map((p: Record<string,unknown>) => ({
    label    : p.label as string,
    frequency: p.occurrences as number,
    domain   : p.domain as string,
  }));

  const techProfile = techNode ? [{
    technology : (techNode as Record<string,unknown>).label as string,
    occurrences: (techNode as Record<string,unknown>).occurrences as number,
    domain     : (techNode as Record<string,unknown>).domain as string,
  }] : [];

  const graphNodesFound = priorFixes.length + relatedIssues.length + relatedPatterns.length;

  const contextText = buildRepairContextText(issueDescription, technology, priorFixes, relatedPatterns, relatedIssues);

  return { priorFixes, relatedPatterns, techProfile, contextText, graphNodesFound };
}

// ── Graph traversal search ─────────────────────────────────────────────────
// BFS from seed node, following edge types up to maxDepth.

export async function traverseFromNode(
  seedNodeId: string,
  edgeTypes : EdgeType[],
  maxDepth  : number = 3,
  maxNodes  : number = 50
): Promise<{ nodes: MemoryNode[]; edges: MemoryEdge[] }> {
  const visitedNodes = new Set<string>([seedNodeId]);
  const allNodes     : MemoryNode[] = [];
  const allEdges     : MemoryEdge[] = [];
  let frontier       = [seedNodeId];

  for (let depth = 0; depth < maxDepth && frontier.length > 0 && allNodes.length < maxNodes; depth++) {
    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      const neighbors = await getNeighbors(nodeId, edgeTypes, 10);
      for (const { node, edge } of neighbors) {
        if (!visitedNodes.has(node.id)) {
          visitedNodes.add(node.id);
          allNodes.push(node);
          allEdges.push(edge);
          nextFrontier.push(node.id);
          if (allNodes.length >= maxNodes) break;
        }
      }
      if (allNodes.length >= maxNodes) break;
    }
    frontier = nextFrontier;
  }

  return { nodes: allNodes, edges: allEdges };
}

// ── Context text builders ──────────────────────────────────────────────────

function buildContextText(nodes: MemoryNode[], edges: MemoryEdge[], query?: string): string {
  if (!nodes.length) return "No relevant memory graph context found.";

  const lines: string[] = [
    `MEMORY GRAPH CONTEXT (${nodes.length} nodes, ${edges.length} edges)${query ? ` for query: "${query}"` : ""}:`,
  ];

  const byType = new Map<string, MemoryNode[]>();
  for (const n of nodes) {
    if (!byType.has(n.node_type)) byType.set(n.node_type, []);
    byType.get(n.node_type)!.push(n);
  }

  for (const [type, typeNodes] of byType.entries()) {
    lines.push(`\n${type.toUpperCase()} (${typeNodes.length}):`);
    for (const n of typeNodes.slice(0, 5)) {
      lines.push(`  • [${n.technology}/${n.domain}] ${n.label} (seen ${n.occurrences}x, confidence=${n.confidence})`);
    }
  }

  // Show resolved_by edges
  const resolved = edges.filter(e => e.edge_type === "resolved_by");
  if (resolved.length) {
    lines.push(`\nPRIOR RESOLUTIONS (${resolved.length}):`);
    for (const e of resolved.slice(0, 5)) {
      const src = nodes.find(n => n.id === e.source_id);
      const tgt = nodes.find(n => n.id === e.target_id);
      if (src && tgt) lines.push(`  • "${src.label}" → resolved_by → "${tgt.label}"`);
    }
  }

  return lines.join("\n");
}

function buildRepairContextText(
  issue      : string,
  technology : string,
  fixes      : RepairContext["priorFixes"],
  patterns   : RepairContext["relatedPatterns"],
  related    : MemoryNode[]
): string {
  const lines: string[] = [
    `JAVARI MEMORY GRAPH — REPAIR CONTEXT`,
    `Issue: ${issue}`,
    `Technology: ${technology}`,
  ];

  if (fixes.length) {
    lines.push(`\nPRIOR FIXES (from memory graph):`);
    for (const f of fixes) {
      lines.push(`  • Issue: "${f.issue}" → Fix: "${f.fix}" [seen ${f.occurrences}x]`);
    }
  }

  if (patterns.length) {
    lines.push(`\nKNOWN PATTERNS:`);
    for (const p of patterns) {
      lines.push(`  • ${p.label} (${p.domain}, seen ${p.frequency}x)`);
    }
  }

  if (related.length) {
    lines.push(`\nRELATED ISSUES:`);
    for (const n of related.slice(0, 3)) {
      lines.push(`  • [${n.severity}] ${n.label}`);
    }
  }

  if (!fixes.length && !patterns.length && !related.length) {
    lines.push(`\nNo prior knowledge found for this issue. Generating fresh repair.`);
  }

  return lines.join("\n");
}
