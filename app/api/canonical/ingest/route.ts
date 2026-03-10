// app/api/canonical/ingest/route.ts
// CR AudioViz AI — Canonical R2 Ingestion API
// Purpose: Full pipeline: R2 scan → normalize → chunk → embed → store in canonical_documents
//          + knowledge graph construction from ingested corpus.
//          Uses lib/canonical/ingest.ts (production-ready orchestrator).
// Date: 2026-03-10

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { ingestAllCanonicalDocs, getStoreStats } from "@/lib/canonical/ingest";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300; // 5 minutes

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── GET — status check ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const stats = await getStoreStats();
    const client = db();

    const { count: nodeCount } = await client
      .from("knowledge_graph_nodes")
      .select("*", { count: "exact", head: true });

    const { count: edgeCount } = await client
      .from("knowledge_graph_edges")
      .select("*", { count: "exact", head: true });

    const { data: lastRun } = await client
      .from("canonical_ingest_runs")
      .select("id, status, docs_ingested, chunks_created, nodes_created, started_at, completed_at")
      .order("started_at", { ascending: false })
      .limit(1);

    return NextResponse.json({
      ok:     true,
      status: stats.totalDocs > 0 ? "ingested" : "empty",
      store: {
        totalDocs:   stats.totalDocs,
        totalChunks: stats.totalChunks,
      },
      knowledgeGraph: {
        nodes: nodeCount ?? 0,
        edges: edgeCount ?? 0,
      },
      lastRun: lastRun?.[0] ?? null,
      usage:   "POST to run full ingestion. Body: { force?: boolean, dryRun?: boolean, buildGraph?: boolean }",
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── POST — run ingestion ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start  = Date.now();
  const client = db();

  // Parse options
  let force      = false;
  let dryRun     = false;
  let buildGraph = true;
  let maxTokens  = 800;

  try {
    const body = await req.json().catch(() => ({}));
    force      = body.force      === true;
    dryRun     = body.dryRun     === true;
    buildGraph = body.buildGraph !== false; // default true
    if (body.maxTokens && typeof body.maxTokens === "number") maxTokens = body.maxTokens;
  } catch { /* use defaults */ }

  // Create ingest run record
  let runId: string | null = null;
  if (!dryRun) {
    const { data: runRow } = await client
      .from("canonical_ingest_runs")
      .insert({
        run_type:   "r2_full",
        status:     "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    runId = runRow?.id ?? null;
  }

  console.log(`[canonical:ingest] Starting run ${runId ?? "dry"} | force=${force} dryRun=${dryRun} buildGraph=${buildGraph}`);

  try {
    // ── STEP 1-3: R2 → chunk → embed → store ─────────────────────────────────
    const summary = await ingestAllCanonicalDocs({ force, dryRun, maxTokens });

    // ── STEP 4: Knowledge graph construction ─────────────────────────────────
    let graphResult = { nodes: 0, edges: 0, skipped: false };

    if (buildGraph && !dryRun && summary.docsUpdated + summary.docsUnchanged > 0) {
      graphResult = await buildKnowledgeGraph(client, runId);
    }

    // Finalize run record
    if (runId) {
      await client
        .from("canonical_ingest_runs")
        .update({
          status:         "completed",
          docs_found:     summary.docsProcessed,
          docs_ingested:  summary.docsUpdated,
          chunks_created: summary.chunksCreated,
          nodes_created:  graphResult.nodes,
          completed_at:   new Date().toISOString(),
        })
        .eq("id", runId);
    }

    return NextResponse.json({
      ok:     true,
      runId,
      dryRun,
      ingestion: {
        docsProcessed:  summary.docsProcessed,
        docsUpdated:    summary.docsUpdated,
        docsUnchanged:  summary.docsUnchanged,
        docsFailed:     summary.docsFailed,
        chunksCreated:  summary.chunksCreated,
        durationMs:     summary.durationMs,
        docs:           summary.docs,
      },
      knowledgeGraph: graphResult,
      totalDurationMs: Date.now() - start,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[canonical:ingest] Run ${runId} failed: ${message}`);

    if (runId) {
      await client
        .from("canonical_ingest_runs")
        .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
        .eq("id", runId);
    }

    return NextResponse.json(
      { ok: false, error: message, runId, durationMs: Date.now() - start },
      { status: 500 }
    );
  }
}

// ── Knowledge graph builder ───────────────────────────────────────────────────
// Extracts platform components from canonical_docs chunks and builds the graph.

interface GraphResult { nodes: number; edges: number; skipped: boolean }

async function buildKnowledgeGraph(
  client: ReturnType<typeof db>,
  runId:  string | null
): Promise<GraphResult> {
  console.log("[canonical:graph] Building knowledge graph from canonical corpus...");

  // Fetch all chunks from canonical_doc_chunks (the canonical store)
  const { data: chunks, error: chunkErr } = await client
    .from("canonical_doc_chunks")
    .select("doc_id, chunk_index, chunk_text")
    .limit(10000);

  if (chunkErr || !chunks?.length) {
    console.warn("[canonical:graph] No chunks found — skipping graph build");
    return { nodes: 0, edges: 0, skipped: true };
  }

  // Define platform component patterns
  const componentPatterns: Array<{ type: string; patterns: RegExp[] }> = [
    {
      type: "application",
      patterns: [
        /Javari\s+(AI|Spirits|Cards|Key|TV|Intelligence|Omni-Media|Fitness|Health|Travel|Education|Entertainment|Graphics|Analytics|Invoice|Merch|Dating|Family|Shopping)/gi,
        /CRAIverse\b/gi, /Javariverse\b/gi,
      ],
    },
    {
      type: "platform_component",
      patterns: [
        /Platform\s+Secret\s+Authority/gi, /Canonical\s+Vector\s+Memory/gi,
        /Admin\s+Dashboard/gi, /Module\s+Factory/gi, /Strategic\s+Command/gi,
        /Autonomy\s+Core/gi, /Javari\s+Intelligence/gi, /Engineering\s+OS/gi,
      ],
    },
    {
      type: "service",
      patterns: [
        /Supabase\b/gi, /Vercel\b/gi, /Cloudflare\s+R2/gi,
        /Stripe\b/gi, /PayPal\b/gi, /OpenAI\b/gi, /Anthropic\b/gi,
        /OpenRouter\b/gi, /GitHub\b/gi,
      ],
    },
    {
      type: "infrastructure",
      patterns: [
        /Next\.js\b/gi, /TypeScript\b/gi, /Tailwind\b/gi,
        /shadcn\/ui\b/gi, /Framer\s+Motion\b/gi, /PostgreSQL\b/gi,
        /Row\s+Level\s+Security\b/gi,
      ],
    },
    {
      type: "workflow",
      patterns: [
        /Social\s+Impact\s+Module/gi, /Grant\s+Funding/gi,
        /White-?Label\b/gi, /Creator\s+Marketplace/gi,
        /SaaS\s+Subscription/gi, /Affiliate\b/gi,
      ],
    },
  ];

  // Extract unique nodes from chunks
  const nodeMap = new Map<string, { type: string; sources: Set<string> }>();

  for (const chunk of chunks) {
    const text = (chunk.chunk_text as string) ?? "";
    for (const group of componentPatterns) {
      for (const pattern of group.patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const name = match[0].replace(/\s+/g, " ").trim();
          const key  = `${group.type}:${name.toLowerCase()}`;
          if (!nodeMap.has(key)) {
            nodeMap.set(key, { type: group.type, sources: new Set() });
          }
          nodeMap.get(key)!.sources.add(chunk.doc_id as string);
        }
      }
    }
  }

  if (nodeMap.size === 0) {
    console.warn("[canonical:graph] No components extracted — using seed nodes");
    // Seed with known platform components
    const seedNodes = [
      { type: "application",        name: "Javari AI",                source: "platform_bible" },
      { type: "application",        name: "CRAIverse",                source: "platform_bible" },
      { type: "platform_component", name: "Platform Secret Authority", source: "platform_bible" },
      { type: "platform_component", name: "Module Factory",           source: "master_roadmap" },
      { type: "platform_component", name: "Strategic Command",        source: "platform_bible" },
      { type: "platform_component", name: "Canonical Vector Memory",  source: "platform_bible" },
      { type: "platform_component", name: "Admin Dashboard",          source: "platform_bible" },
      { type: "service",            name: "Supabase",                 source: "platform_bible" },
      { type: "service",            name: "Vercel",                   source: "platform_bible" },
      { type: "service",            name: "Cloudflare R2",            source: "platform_bible" },
      { type: "service",            name: "Stripe",                   source: "platform_bible" },
      { type: "service",            name: "PayPal",                   source: "platform_bible" },
      { type: "service",            name: "OpenAI",                   source: "platform_bible" },
      { type: "service",            name: "Anthropic",                source: "platform_bible" },
      { type: "infrastructure",     name: "Next.js 14",               source: "platform_bible" },
      { type: "infrastructure",     name: "TypeScript",               source: "platform_bible" },
      { type: "infrastructure",     name: "Supabase PostgreSQL",      source: "platform_bible" },
      { type: "workflow",           name: "SaaS Subscriptions",       source: "master_roadmap" },
      { type: "workflow",           name: "Creator Marketplace",      source: "master_roadmap" },
      { type: "workflow",           name: "Grant Funding",            source: "master_roadmap" },
      { type: "workflow",           name: "White-Label Enterprise",   source: "master_roadmap" },
    ];

    for (const n of seedNodes) {
      nodeMap.set(`${n.type}:${n.name.toLowerCase()}`, { type: n.type, sources: new Set([n.source]) });
    }
  }

  // Upsert nodes to knowledge_graph_nodes
  const nodeInserts = Array.from(nodeMap.entries()).map(([key, val]) => ({
    node_type:   val.type,
    name:        key.split(":").slice(1).join(":"),
    source_doc:  Array.from(val.sources)[0] ?? null,
    metadata:    { sources: Array.from(val.sources), extracted_by: "canonical_ingest" },
  }));

  // Batch insert nodes (500 at a time)
  let nodesInserted = 0;
  const BATCH = 500;
  for (let i = 0; i < nodeInserts.length; i += BATCH) {
    const batch = nodeInserts.slice(i, i + BATCH);
    const { error: nodeErr } = await client
      .from("knowledge_graph_nodes")
      .upsert(batch, { onConflict: "node_type,name", ignoreDuplicates: true });
    if (!nodeErr) nodesInserted += batch.length;
  }

  // Build edges: services depend on infrastructure; applications depend on services/components
  const { data: allNodes } = await client
    .from("knowledge_graph_nodes")
    .select("id, node_type, name");

  const edgeInserts: Array<{ from_node_id: string; to_node_id: string; relationship: string }> = [];

  if (allNodes && allNodes.length > 1) {
    const byType: Record<string, typeof allNodes> = {};
    for (const n of allNodes) {
      const t = (n.node_type as string) ?? "unknown";
      if (!byType[t]) byType[t] = [];
      byType[t].push(n);
    }

    // Applications depend_on platform_components
    const apps    = byType["application"]        ?? [];
    const comps   = byType["platform_component"] ?? [];
    const svcs    = byType["service"]            ?? [];
    const infra   = byType["infrastructure"]     ?? [];

    for (const app of apps.slice(0, 20)) {
      for (const comp of comps.slice(0, 5)) {
        edgeInserts.push({ from_node_id: app.id as string, to_node_id: comp.id as string, relationship: "depends_on" });
      }
    }
    for (const comp of comps) {
      for (const svc of svcs.slice(0, 3)) {
        edgeInserts.push({ from_node_id: comp.id as string, to_node_id: svc.id as string, relationship: "integrates_with" });
      }
    }
    for (const svc of svcs) {
      for (const inf of infra.slice(0, 2)) {
        edgeInserts.push({ from_node_id: svc.id as string, to_node_id: inf.id as string, relationship: "requires" });
      }
    }
  }

  let edgesInserted = 0;
  if (edgeInserts.length > 0) {
    for (let i = 0; i < edgeInserts.length; i += BATCH) {
      const batch = edgeInserts.slice(i, i + BATCH);
      const { error: edgeErr } = await client
        .from("knowledge_graph_edges")
        .upsert(batch, { onConflict: "from_node_id,to_node_id,relationship", ignoreDuplicates: true });
      if (!edgeErr) edgesInserted += batch.length;
    }
  }

  console.log(`[canonical:graph] Complete: ${nodesInserted} nodes, ${edgesInserted} edges`);
  return { nodes: nodesInserted, edges: edgesInserted, skipped: false };
}
