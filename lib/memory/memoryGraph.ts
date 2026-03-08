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
  | "issue"          // a problem that was detected
  | "fix"            // a solution that was applied
  | "technology"     // a tech: Next.js, Supabase, Stripe, etc.
  | "pattern"        // a recurring code or architecture pattern
  | "audit_finding"  // output of a crawl or customer audit
  | "scan_result"    // output of a code intelligence scan
  | "capability"     // a learned capability of Javari
  | "domain"         // a knowledge domain: security, frontend, etc.
  | "component"      // a platform component: payment, auth, etc.
  | "config";        // a configuration: CSP header, env var, etc.

export type EdgeType =
  | "resolved_by"    // issue → fix
  | "caused_by"      // issue → issue (root cause chain)
  | "requires"       // fix → technology/config (dependency)
  | "related_to"     // any → any (soft association)
  | "instance_of"    // issue → pattern (this is an instance of that pattern)
  | "discovered_in"  // issue/fix → technology (found in)
  | "produces"       // scan/audit → issue (scan produced this issue)
  | "affects"        // issue → component (affects this component)
  | "improves"       // fix → capability (fix improved this capability)
  | "supersedes"     // fix → fix (newer, better fix)
  | "co_occurs_with";// pattern → pattern (tends to appear together)

export interface MemoryNode {
  id          : string;
  node_type   : NodeType;
  label       : string;           // human-readable: "Next.js CSP Header Missing"
  description : string;
  technology  : string;           // primary tech: "Next.js", "Supabase", etc.
  domain      : string;           // knowledge domain: "security", "frontend"
  severity    : "low" | "medium" | "high" | "critical" | "none";
  confidence  : number;           // 0-100: how confident we are in this node
  occurrences : number;           // how many times this node has been seen
  metadata    : Record<string, unknown>;
  source      : string;           // "repair" | "scan" | "crawl" | "audit" | "discovery"
  created_at  : string;
  updated_at  : string;
}

export interface MemoryEdge {
  id          : string;
  source_id   : string;           // node id
  target_id   : string;           // node id
  edge_type   : EdgeType;
  weight      : number;           // 0-100: strength of relationship
  metadata    : Record<string, unknown>;
  created_at  : string;
}

export interface MemoryGraphStats {
  totalNodes    : number;
  totalEdges    : number;
  byNodeType    : Record<NodeType, number>;
  byEdgeType    : Record<EdgeType, number>;
  topTechnologies: Array<{ technology: string; count: number }>;
  topDomains    : Array<{ domain: string; count: number }>;
}

// ── Supabase client ────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Table migration ────────────────────────────────────────────────────────

const MIGRATION_STMTS = [
  `CREATE TABLE IF NOT EXISTS javari_memory_graph (
    id          text        PRIMARY KEY,
    record_type text        NOT NULL CHECK (record_type IN ('node','edge')),
    node_type   text,
    edge_type   text,
    label       text        NOT NULL DEFAULT '',
    description text        NOT NULL DEFAULT '',
    source_id   text,
    target_id   text,
    technology  text        NOT NULL DEFAULT 'unknown',
    domain      text        NOT NULL DEFAULT 'general',
    severity    text        NOT NULL DEFAULT 'none',
    confidence  integer     NOT NULL DEFAULT 80,
    occurrences integer     NOT NULL DEFAULT 1,
    weight      integer     NOT NULL DEFAULT 50,
    metadata    jsonb       NOT NULL DEFAULT '{}',
    source      text        NOT NULL DEFAULT 'system',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mg_type     ON javari_memory_graph(record_type)`,
  `CREATE INDEX IF NOT EXISTS idx_mg_node_t   ON javari_memory_graph(node_type) WHERE record_type='node'`,
  `CREATE INDEX IF NOT EXISTS idx_mg_edge_t   ON javari_memory_graph(edge_type) WHERE record_type='edge'`,
  `CREATE INDEX IF NOT EXISTS idx_mg_src      ON javari_memory_graph(source_id) WHERE record_type='edge'`,
  `CREATE INDEX IF NOT EXISTS idx_mg_tgt      ON javari_memory_graph(target_id) WHERE record_type='edge'`,
  `CREATE INDEX IF NOT EXISTS idx_mg_tech     ON javari_memory_graph(technology)`,
  `CREATE INDEX IF NOT EXISTS idx_mg_domain   ON javari_memory_graph(domain)`,
  `CREATE INDEX IF NOT EXISTS idx_mg_label    ON javari_memory_graph(label)`,
  `ALTER TABLE javari_memory_graph DISABLE ROW LEVEL SECURITY`,
  `GRANT ALL ON TABLE javari_memory_graph TO service_role, authenticated, anon`,
];

export async function ensureMemoryGraphTable(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  for (const sql of MIGRATION_STMTS) {
    try {
      await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method : "POST",
        headers: { "Content-Type":"application/json", apikey:key, Authorization:`Bearer ${key}` },
        body   : JSON.stringify({ sql: sql + ";" }),
        signal : AbortSignal.timeout(8_000),
      });
    } catch { /* non-fatal — table may already exist */ }
  }
}

// ── ID generators ──────────────────────────────────────────────────────────

export function nodeId(type: NodeType, label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `node-${type}-${slug}-${Date.now().toString(36)}`;
}

export function edgeId(sourceId: string, edgeType: EdgeType, targetId: string): string {
  return `edge-${sourceId.slice(-8)}-${edgeType}-${targetId.slice(-8)}-${Date.now().toString(36)}`;
}

// ── Upsert node ────────────────────────────────────────────────────────────
// If a node with the same label+technology+node_type exists, increments
// occurrences and updates confidence/metadata rather than creating a duplicate.

export async function upsertNode(node: Omit<MemoryNode, "id" | "created_at" | "updated_at">): Promise<MemoryNode> {
  await ensureMemoryGraphTable();
  const client = db();

  // Check for existing node by label + technology + node_type
  const { data: existing } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .eq("label", node.label)
    .eq("technology", node.technology)
    .eq("node_type", node.node_type)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    // Update occurrences and merge metadata
    const merged = { ...((existing.metadata as Record<string,unknown>) ?? {}), ...node.metadata };
    const { data, error } = await client
      .from("javari_memory_graph")
      .update({
        occurrences: (existing.occurrences ?? 1) + 1,
        confidence : Math.min(100, (existing.confidence ?? 80) + 2),
        metadata   : merged,
        updated_at : now,
        description: node.description || existing.description,
        severity   : node.severity !== "none" ? node.severity : existing.severity,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`[memoryGraph] upsertNode update: ${error.message}`);
    return rowToNode(data);
  }

  const id = nodeId(node.node_type, node.label);
  const { data, error } = await client
    .from("javari_memory_graph")
    .insert({
      id, record_type:"node",
      node_type   : node.node_type,
      label       : node.label,
      description : node.description,
      technology  : node.technology,
      domain      : node.domain,
      severity    : node.severity,
      confidence  : node.confidence,
      occurrences : node.occurrences,
      weight      : 50,
      metadata    : node.metadata,
      source      : node.source,
      created_at  : now,
      updated_at  : now,
    })
    .select("*")
    .single();
  if (error) throw new Error(`[memoryGraph] upsertNode insert: ${error.message}`);
  return rowToNode(data);
}

// ── Upsert edge ────────────────────────────────────────────────────────────

export async function upsertEdge(
  sourceId : string,
  edgeType : EdgeType,
  targetId : string,
  weight   : number = 50,
  metadata : Record<string, unknown> = {}
): Promise<MemoryEdge> {
  await ensureMemoryGraphTable();
  const client = db();
  const now = new Date().toISOString();

  // Check for existing edge
  const { data: existing } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "edge")
    .eq("source_id", sourceId)
    .eq("edge_type", edgeType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await client
      .from("javari_memory_graph")
      .update({ weight: Math.min(100, (existing.weight ?? 50) + 5), updated_at: now })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(`[memoryGraph] upsertEdge update: ${error.message}`);
    return rowToEdge(data);
  }

  const id = edgeId(sourceId, edgeType, targetId);
  const { data, error } = await client
    .from("javari_memory_graph")
    .insert({
      id, record_type:"edge",
      source_id: sourceId, target_id: targetId,
      edge_type: edgeType, weight,
      label: `${edgeType}`, description: "",
      technology: "unknown", domain: "general",
      severity: "none", confidence: 80, occurrences: 1,
      metadata, source: "system",
      created_at: now, updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(`[memoryGraph] upsertEdge insert: ${error.message}`);
  return rowToEdge(data);
}

// ── Load node ──────────────────────────────────────────────────────────────

export async function getNode(id: string): Promise<MemoryNode | null> {
  const { data } = await db()
    .from("javari_memory_graph")
    .select("*")
    .eq("id", id)
    .eq("record_type", "node")
    .maybeSingle();
  return data ? rowToNode(data) : null;
}

// ── Get neighbors ──────────────────────────────────────────────────────────

export async function getNeighbors(
  nodeId  : string,
  edgeTypes?: EdgeType[],
  limit   : number = 20
): Promise<{ node: MemoryNode; edge: MemoryEdge }[]> {
  const client  = db();
  let edgeQuery = client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "edge")
    .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`)
    .order("weight", { ascending: false })
    .limit(limit);

  if (edgeTypes?.length) {
    edgeQuery = edgeQuery.in("edge_type", edgeTypes);
  }
  const { data: edges } = await edgeQuery;
  if (!edges?.length) return [];

  const neighborIds = [...new Set(
    edges.flatMap(e => [e.source_id, e.target_id].filter(id => id !== nodeId))
  )];
  const { data: nodes } = await client
    .from("javari_memory_graph")
    .select("*")
    .eq("record_type", "node")
    .in("id", neighborIds);

  const nodeMap = new Map((nodes ?? []).map(n => [n.id, rowToNode(n)]));
  const results: { node: MemoryNode; edge: MemoryEdge }[] = [];
  for (const e of edges) {
    const neighborId = e.source_id === nodeId ? e.target_id : e.source_id;
    const node = nodeMap.get(neighborId);
    if (node) results.push({ node, edge: rowToEdge(e) });
  }
  return results;
}

// ── Graph stats ────────────────────────────────────────────────────────────

export async function getGraphStats(): Promise<MemoryGraphStats> {
  const client = db();
  const { data: all } = await client
    .from("javari_memory_graph")
    .select("record_type,node_type,edge_type,technology,domain");

  const nodes  = (all ?? []).filter(r => r.record_type === "node");
  const edges  = (all ?? []).filter(r => r.record_type === "edge");

  const byNodeType: Record<string, number> = {};
  const byEdgeType: Record<string, number> = {};
  const byTech    : Record<string, number> = {};
  const byDomain  : Record<string, number> = {};

  for (const n of nodes) {
    byNodeType[n.node_type ?? "unknown"] = (byNodeType[n.node_type ?? "unknown"] ?? 0) + 1;
    byTech[n.technology ?? "unknown"]    = (byTech[n.technology ?? "unknown"] ?? 0) + 1;
    byDomain[n.domain ?? "general"]      = (byDomain[n.domain ?? "general"] ?? 0) + 1;
  }
  for (const e of edges) {
    byEdgeType[e.edge_type ?? "unknown"] = (byEdgeType[e.edge_type ?? "unknown"] ?? 0) + 1;
  }

  return {
    totalNodes    : nodes.length,
    totalEdges    : edges.length,
    byNodeType    : byNodeType as Record<NodeType, number>,
    byEdgeType    : byEdgeType as Record<EdgeType, number>,
    topTechnologies: Object.entries(byTech).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([technology,count])=>({ technology, count })),
    topDomains    : Object.entries(byDomain).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([domain,count])=>({ domain, count })),
  };
}

// ── Row converters ─────────────────────────────────────────────────────────

function rowToNode(r: Record<string, unknown>): MemoryNode {
  return {
    id         : r.id as string,
    node_type  : r.node_type as NodeType,
    label      : r.label as string,
    description: r.description as string,
    technology : r.technology as string,
    domain     : r.domain as string,
    severity   : r.severity as MemoryNode["severity"],
    confidence : r.confidence as number,
    occurrences: r.occurrences as number,
    metadata   : (r.metadata as Record<string,unknown>) ?? {},
    source     : r.source as string,
    created_at : r.created_at as string,
    updated_at : r.updated_at as string,
  };
}

function rowToEdge(r: Record<string, unknown>): MemoryEdge {
  return {
    id        : r.id as string,
    source_id : r.source_id as string,
    target_id : r.target_id as string,
    edge_type : r.edge_type as EdgeType,
    weight    : r.weight as number,
    metadata  : (r.metadata as Record<string,unknown>) ?? {},
    created_at: r.created_at as string,
  };
}
