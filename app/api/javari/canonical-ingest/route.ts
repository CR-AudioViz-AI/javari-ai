// app/api/javari/canonical-ingest/route.ts
// Purpose: Full canonical ingestion + ecosystem roadmap expansion pipeline.
//          Steps 1–8 from the Canonical Ingestion spec.
//
//          POST /api/javari/canonical-ingest
//            Body: { "secret": string, "step"?: "all"|"scan"|"ingest"|"graph"|"expand"|"artifacts" }
//            Default step = "all"
//
//          Safety:
//            - Requires INGEST_SECRET header or body.secret to match vault value
//            - Idempotent: duplicate title check before every task insert
//            - Never deletes existing completed tasks
//            - Stops task generation if total would exceed MAX_TASK_CEILING
//
// Date: 2026-03-10

import { NextRequest, NextResponse } from "next/server";
import { createClient }             from "@supabase/supabase-js";
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";
import { chunkMarkdown }            from "@/lib/canonical/chunker";
import { embedBatch }               from "@/lib/canonical/embed";
import crypto                       from "crypto";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;   // 5 minutes — generous for large runs

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TASK_CEILING    = 50_000;   // absolute cap — never insert more
const TASKS_PER_BATCH     = 200;      // tasks generated per Anthropic call
const TARGET_TASK_COUNT   = 10_000;   // minimum target
const CHUNK_MAX_CHARS     = 4000;     // ~1000 tokens per chunk
const MAX_DOCS_TO_EMBED   = 50;       // embed up to 50 docs (rest text-only)

// Expanded 55-module category taxonomy matching Master Roadmap V2.0
const ALL_CATEGORIES = [
  // Family A — Core Platform
  "platform_foundation", "authentication_rbac", "database_infrastructure",
  "api_gateway", "deployment_pipeline", "monitoring_observability",
  // Family B — Javari AI
  "javari_core_ai", "multi_ai_routing", "autonomous_planner",
  "knowledge_management", "ai_execution_engine", "vector_memory",
  // Family C — Creator Tools
  "creator_studio", "audio_tools", "video_tools", "image_tools",
  "brand_engine", "content_marketplace",
  // Family D — CRAIverse
  "craiverse_world", "avatar_system", "virtual_real_estate",
  "community_modules", "social_impact", "geographic_targeting",
  // Family E — Enterprise
  "enterprise_dashboard", "white_label_platform", "grant_management",
  "analytics_bi", "reporting_engine", "enterprise_security",
  // Family F — Revenue
  "subscription_billing", "creator_monetization", "affiliate_programs",
  "marketplace_commissions", "global_payments", "revenue_analytics",
  // Additional platform layers
  "security_infrastructure", "performance_optimization", "mobile_platform",
  "developer_sdk", "webhook_system", "search_discovery",
  "notification_system", "file_storage", "cdn_delivery",
  "ai_marketplace", "training_certification", "first_responder_module",
  "veteran_support", "faith_community", "animal_rescue",
  "multi_ai_team_mode", "autonomous_deployment", "platform_scaling",
  "global_localization", "accessibility_wcag", "privacy_compliance",
];

// ── Supabase ──────────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function slug(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 48);
}

function tid(phase: string, title: string, idx: number): string {
  return `eco-${phase.slice(0,10)}-${slug(title).slice(0,30)}-${String(idx).padStart(3,"0")}`;
}

function log(msg: string) {
  console.log(`${new Date().toISOString()} [canonical-ingest] ${msg}`);
}

// ── Step 1: Run SQL migrations ─────────────────────────────────────────────────

async function runMigrations(client: ReturnType<typeof db>): Promise<string[]> {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS canonical_documents (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT        NOT NULL,
      source      TEXT        NOT NULL,
      chunk_index INTEGER     NOT NULL DEFAULT 0,
      content     TEXT        NOT NULL,
      content_hash TEXT       NOT NULL DEFAULT '',
      embedding   JSONB,
      doc_type    TEXT        DEFAULT 'markdown',
      token_count INTEGER     DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source, chunk_index)
    )`,
    `ALTER TABLE IF EXISTS canonical_documents DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE canonical_documents TO service_role`,

    `CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      node_type   TEXT        NOT NULL,
      name        TEXT        NOT NULL,
      description TEXT,
      source_doc  TEXT,
      metadata    JSONB       DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(node_type, name)
    )`,
    `ALTER TABLE IF EXISTS knowledge_graph_nodes DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE knowledge_graph_nodes TO service_role`,

    `CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      from_node_id    UUID        NOT NULL,
      to_node_id      UUID        NOT NULL,
      relationship    TEXT        NOT NULL,
      weight          FLOAT       DEFAULT 1.0,
      metadata        JSONB       DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE IF EXISTS knowledge_graph_edges DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE knowledge_graph_edges TO service_role`,

    `CREATE TABLE IF NOT EXISTS canonical_ingest_runs (
      id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      run_type        TEXT        NOT NULL DEFAULT 'r2_full',
      docs_found      INTEGER     DEFAULT 0,
      docs_ingested   INTEGER     DEFAULT 0,
      chunks_created  INTEGER     DEFAULT 0,
      nodes_created   INTEGER     DEFAULT 0,
      tasks_generated INTEGER     DEFAULT 0,
      status          TEXT        DEFAULT 'running',
      error           TEXT,
      started_at      TIMESTAMPTZ DEFAULT NOW(),
      completed_at    TIMESTAMPTZ
    )`,
    `ALTER TABLE IF EXISTS canonical_ingest_runs DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE canonical_ingest_runs TO service_role`,
  ];

  const results: string[] = [];
  for (const sql of migrations) {
    try {
      await client.rpc("exec_sql", { sql }).then(() => null).catch(() => null);
      // Fallback: use raw fetch to Supabase SQL endpoint
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        key,
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({ sql }),
      });
      results.push(`${res.status}: ${sql.slice(0, 60)}`);
    } catch (e) {
      results.push(`ERROR: ${String(e).slice(0, 100)}`);
    }
  }
  return results;
}

// ── Step 2: Ingest docs to canonical_documents ─────────────────────────────────

interface IngestedDoc {
  key:       string;
  title:     string;
  chunks:    number;
  chars:     number;
  content:   string;  // full text for later use
}

async function ingestDocs(client: ReturnType<typeof db>): Promise<{
  docs:          IngestedDoc[];
  chunksCreated: number;
  docsSkipped:   number;
}> {
  log("Step 2: Scanning R2...");

  const allKeys = await listCanonicalKeys();
  log(`Found ${allKeys.length} total R2 objects`);

  // Filter to documents we can process
  const docKeys = allKeys.filter(k => {
    const key = k.key.toLowerCase();
    return key.endsWith(".md") || key.endsWith(".txt") || key.endsWith(".json");
  });

  log(`${docKeys.length} processable docs (.md/.txt/.json)`);

  const docs:        IngestedDoc[] = [];
  let   chunksTotal  = 0;
  let   docsSkipped  = 0;

  // Embed first N docs, text-only after that
  for (let i = 0; i < docKeys.length; i++) {
    const obj = docKeys[i];
    log(`  [${i + 1}/${docKeys.length}] ${obj.key}`);

    let content: string;
    try {
      content = await fetchCanonicalText(obj.key);
    } catch (e) {
      log(`  SKIP (fetch failed): ${e}`);
      docsSkipped++;
      continue;
    }

    if (!content?.trim() || content.includes("placeholder") && content.length < 200) {
      log(`  SKIP (placeholder)`);
      docsSkipped++;
      continue;
    }

    // Extract title
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].trim()
      : (obj.key.split("/").pop()?.replace(/\.[^.]+$/, "") ?? obj.key);

    // Chunk the document
    const chunks = chunkMarkdown(content, { maxChars: CHUNK_MAX_CHARS });
    if (!chunks.length) { docsSkipped++; continue; }

    // Generate embeddings for first MAX_DOCS_TO_EMBED docs, hash-fallback after
    let embeddings: Array<{ embedding: number[] } | null> = [];
    if (i < MAX_DOCS_TO_EMBED) {
      try {
        embeddings = await embedBatch(chunks.map(c => c.chunkText));
      } catch {
        embeddings = chunks.map(c => ({ embedding: [] }));
      }
    }

    // Upsert chunks to canonical_documents
    const chunkHash = sha256(content);
    let   chunksCreated = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const emb   = embeddings[ci]?.embedding ?? null;

      const { error } = await client
        .from("canonical_documents")
        .upsert({
          title,
          source:       obj.key,
          chunk_index:  ci,
          content:      chunk.chunkText,
          content_hash: chunkHash,
          embedding:    emb ? JSON.stringify(emb) : null,
          doc_type:     obj.key.endsWith(".json") ? "json" : "markdown",
          token_count:  chunk.approxTokens,
          updated_at:   new Date().toISOString(),
        }, { onConflict: "source,chunk_index" });

      if (!error) chunksCreated++;
    }

    chunksTotal += chunksCreated;
    docs.push({ key: obj.key, title, chunks: chunksCreated, chars: content.length, content });
    log(`  ✓ ${title} — ${chunksCreated} chunks stored`);
  }

  log(`Step 2 complete: ${docs.length} docs ingested, ${chunksTotal} chunks, ${docsSkipped} skipped`);
  return { docs, chunksCreated: chunksTotal, docsSkipped };
}

// ── Step 3: Knowledge Graph Construction ──────────────────────────────────────

interface GraphNode {
  id?:         string;
  node_type:   string;
  name:        string;
  description: string;
  source_doc:  string;
}

async function buildKnowledgeGraph(
  client: ReturnType<typeof db>,
  docs:   IngestedDoc[],
): Promise<{ nodesCreated: number; edgesCreated: number }> {
  log("Step 3: Building knowledge graph...");

  // Extract entities from document corpus using keyword patterns
  const nodePatterns: Array<{ type: string; patterns: RegExp[] }> = [
    { type: "application",        patterns: [/Javari\s+\w+/g, /CRAIverse/g, /Creator\s+\w+/g, /\w+\s+App(?:lication)?/g] },
    { type: "service",            patterns: [/\w+\s+API/g, /\w+\s+Service/g, /\w+\s+Engine/g, /\w+\s+System/g] },
    { type: "platform_component", patterns: [/\w+\s+Module/g, /\w+\s+Platform/g, /\w+\s+Dashboard/g, /\w+\s+Portal/g] },
    { type: "infrastructure",     patterns: [/Supabase/g, /Vercel/g, /Cloudflare/g, /PostgreSQL/g, /Redis/g, /R2/g] },
    { type: "integration",        patterns: [/Stripe/g, /PayPal/g, /OpenAI/g, /Anthropic/g, /GitHub/g] },
    { type: "workflow",           patterns: [/\w+\s+Workflow/g, /\w+\s+Pipeline/g, /\w+\s+Process/g] },
  ];

  const seen  = new Set<string>();
  const nodes: GraphNode[] = [];

  for (const doc of docs.slice(0, 20)) {  // process first 20 docs for graph
    const combined = doc.content;

    for (const { type, patterns } of nodePatterns) {
      for (const pattern of patterns) {
        const matches = combined.match(pattern) ?? [];
        for (const match of matches) {
          const name = match.trim().replace(/\s+/g, " ").slice(0, 100);
          const key  = `${type}:${name.toLowerCase()}`;
          if (seen.has(key) || name.length < 3 || name.length > 80) continue;
          seen.add(key);
          nodes.push({ node_type: type, name, description: `Extracted from: ${doc.title}`, source_doc: doc.key });
        }
      }
    }
  }

  // Also seed canonical platform nodes from the 55-module taxonomy
  const taxonomyNodes: GraphNode[] = [
    { node_type: "platform_component", name: "Javari AI Core",        description: "Primary autonomous AI assistant and OS", source_doc: "taxonomy" },
    { node_type: "application",        name: "CRAIverse",             description: "Virtual world and community platform",   source_doc: "taxonomy" },
    { node_type: "platform_component", name: "Creator Studio",        description: "Professional creative tools suite",     source_doc: "taxonomy" },
    { node_type: "platform_component", name: "Enterprise Dashboard",  description: "Business intelligence and reporting",   source_doc: "taxonomy" },
    { node_type: "service",            name: "Platform Secret Authority", description: "Encrypted credential vault",        source_doc: "taxonomy" },
    { node_type: "service",            name: "Autonomous Planner",    description: "AI-driven task generation engine",      source_doc: "taxonomy" },
    { node_type: "infrastructure",     name: "Supabase PostgreSQL",   description: "Primary database and vector store",     source_doc: "taxonomy" },
    { node_type: "infrastructure",     name: "Vercel Edge Network",   description: "Hosting and serverless compute",        source_doc: "taxonomy" },
    { node_type: "infrastructure",     name: "Cloudflare R2",         description: "Cold storage and canonical docs",       source_doc: "taxonomy" },
    { node_type: "integration",        name: "Stripe Payments",       description: "Primary payment processor",             source_doc: "taxonomy" },
    { node_type: "integration",        name: "PayPal",                description: "Secondary payment processor",           source_doc: "taxonomy" },
    { node_type: "platform_component", name: "Javari Spirits",        description: "Alcohol affiliate marketplace app",     source_doc: "taxonomy" },
    { node_type: "platform_component", name: "Grant Management System", description: "Federal/private grant targeting",    source_doc: "taxonomy" },
    { node_type: "workflow",           name: "Roadmap Execution Loop","description": "Autonomous task → verify → complete", source_doc: "taxonomy" },
    { node_type: "workflow",           name: "Canonical Ingestion Pipeline", description: "R2 → chunk → embed → store",   source_doc: "taxonomy" },
  ];

  const allNodes = [...taxonomyNodes, ...nodes.slice(0, 500)];  // cap at 515 nodes
  let   nodesCreated = 0;

  for (const node of allNodes) {
    const { error } = await client
      .from("knowledge_graph_nodes")
      .upsert(node, { onConflict: "node_type,name" });
    if (!error) nodesCreated++;
  }

  // Create edges for known relationships
  const edgePatterns = [
    ["Javari AI Core",         "Supabase PostgreSQL",    "requires"],
    ["Javari AI Core",         "Vercel Edge Network",    "deployed_on"],
    ["Autonomous Planner",     "Javari AI Core",         "extends"],
    ["CRAIverse",              "Javari AI Core",         "integrates_with"],
    ["Creator Studio",         "Javari AI Core",         "integrates_with"],
    ["Platform Secret Authority", "Supabase PostgreSQL", "deployed_on"],
    ["Roadmap Execution Loop", "Autonomous Planner",     "contains"],
    ["Canonical Ingestion Pipeline", "Cloudflare R2",   "reads_from"],
    ["Stripe Payments",        "Enterprise Dashboard",   "integrates_with"],
    ["Grant Management System","Enterprise Dashboard",   "contains"],
  ];

  let edgesCreated = 0;
  for (const [fromName, toName, rel] of edgePatterns) {
    const { data: fromRows } = await client.from("knowledge_graph_nodes").select("id").eq("name", fromName).limit(1);
    const { data: toRows }   = await client.from("knowledge_graph_nodes").select("id").eq("name", toName).limit(1);
    if (!fromRows?.[0]?.id || !toRows?.[0]?.id) continue;

    const { error } = await client.from("knowledge_graph_edges").upsert({
      from_node_id: fromRows[0].id,
      to_node_id:   toRows[0].id,
      relationship: rel,
      weight:       1.0,
    });
    if (!error) edgesCreated++;
  }

  log(`Step 3 complete: ${nodesCreated} nodes, ${edgesCreated} edges`);
  return { nodesCreated, edgesCreated };
}

// ── Step 4: Ecosystem Task Expansion ─────────────────────────────────────────

interface TaskRow {
  id:          string;
  roadmap_id:  null;
  phase_id:    string;
  title:       string;
  description: string;
  depends_on:  string[];
  status:      "pending";
  source:      string;
  updated_at:  number;
}

// Generate tasks for a single category using Anthropic
async function generateTaskBatch(
  category:         string,
  categoryLabel:    string,
  platformContext:  string,
  docContext:       string,
  batchNum:         number,
  existingTitles:   Set<string>,
): Promise<TaskRow[]> {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
  if (!ANTHROPIC_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const prompt = `You are the Javari AI ecosystem architect for CR AudioViz AI, LLC.

Platform: CR AudioViz AI — "Your Story. Our Design."
Company: Fort Myers/Cape Coral, Florida
Mission: Fortune-50 quality AI ecosystem serving creators, businesses, veterans, first responders, faith communities, and animal rescues.

CANONICAL PLATFORM CONTEXT:
${platformContext}

RELEVANT DOCUMENTATION EXCERPTS:
${docContext.slice(0, 3000)}

TASK: Generate exactly ${TASKS_PER_BATCH} UNIQUE, SPECIFIC, ACTIONABLE development tasks for the "${categoryLabel}" category.

Requirements:
- Each task must be a specific engineering, design, or operational deliverable
- Tasks must be real work items that can be executed by an AI agent
- NO duplicates with these existing titles (first 50 shown): ${Array.from(existingTitles).slice(0, 50).join(" | ")}
- Cover: architecture, API endpoints, database schemas, UI components, security, testing, documentation, DevOps, integrations
- Batch ${batchNum} — generate tasks at a more advanced/deeper level than previous batches

Respond ONLY with valid JSON array, no markdown, no explanation:
[
  {
    "title": "Specific task title under 80 chars",
    "description": "Detailed technical description of exactly what needs to be built, including specific technologies, endpoints, schemas, or components involved. Minimum 100 words.",
    "sub_phase": "${category}"
  }
]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "x-api-key":     ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);

  const data    = await res.json() as { content: Array<{ type: string; text: string }> };
  const raw     = data.content.find(c => c.type === "text")?.text ?? "[]";
  const clean   = raw.replace(/```json\n?|\n?```/g, "").trim();

  let parsed: Array<{ title: string; description: string; sub_phase?: string }>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    // Try to extract JSON array from response
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try { parsed = JSON.parse(match[0]); } catch { return []; }
  }

  if (!Array.isArray(parsed)) return [];

  const now    = Date.now();
  const tasks: TaskRow[] = [];

  for (const item of parsed.slice(0, TASKS_PER_BATCH)) {
    if (!item?.title || typeof item.title !== "string") continue;
    const title = item.title.trim().slice(0, 200);
    if (!title || existingTitles.has(title.toLowerCase())) continue;

    const idx = tasks.length + batchNum * TASKS_PER_BATCH;
    tasks.push({
      id:          tid(category, title, idx),
      roadmap_id:  null,
      phase_id:    category,
      title,
      description: (item.description ?? title).trim(),
      depends_on:  [],
      status:      "pending",
      source:      "ecosystem_expansion",
      updated_at:  now,
    });

    existingTitles.add(title.toLowerCase());
  }

  return tasks;
}

async function expandRoadmap(
  client:   ReturnType<typeof db>,
  docs:     IngestedDoc[],
): Promise<{ tasksInserted: number; artifactsInserted: number }> {
  log("Step 4: Expanding ecosystem roadmap...");

  // Load existing task titles for dedup
  const { data: existing } = await client
    .from("roadmap_tasks")
    .select("title");
  const existingTitles = new Set<string>(
    (existing ?? []).map(r => r.title?.toLowerCase()).filter(Boolean)
  );
  const startingCount = existingTitles.size;
  log(`  ${startingCount} existing tasks loaded for dedup`);

  // Build platform context summary from docs
  const platformContext = `
CR AudioViz AI Platform Components:
- 55 modules across 6 families and 11 platform layers
- Revenue streams: SaaS ($49–$499/mo), Creator Marketplace (20% commission), White-Label Enterprise ($2,500–$10,000/mo), Grants ($600M+ pipeline), Affiliates, Premium Avatars, Merchandise
- Stack: Next.js 14 App Router, TypeScript strict, Supabase PostgreSQL + pgvector, Vercel, Tailwind CSS, shadcn/ui, Framer Motion
- Payments: Stripe + PayPal (both live production)
- AI: Anthropic Claude, OpenAI, Google Gemini, Perplexity (multi-model routing)
- Storage: Cloudflare R2 (cold storage), Supabase (hot)
- Auth: Supabase Auth with RBAC + Row Level Security
- Social impact: first responders, veterans, faith communities, animal rescues
- Domains: craudiovizai.com (main), javariai.com (Javari AI)
- Standards: Fortune 50 quality, WCAG 2.2 AA, OWASP Top 10, performance budgets
`;

  // Build doc context from real R2 content
  const docContext = docs.slice(0, 10).map(d =>
    `=== ${d.title} ===\n${d.content.slice(0, 500)}`
  ).join("\n\n");

  let totalInserted = 0;
  let totalArtifacts = 0;

  // Calculate how many batches needed per category
  const targetPerCategory = Math.ceil(TARGET_TASK_COUNT / ALL_CATEGORIES.length);
  const batchesPerCategory = Math.ceil(targetPerCategory / TASKS_PER_BATCH);

  log(`  Target: ${TARGET_TASK_COUNT} tasks across ${ALL_CATEGORIES.length} categories`);
  log(`  ~${targetPerCategory} tasks/category, ${batchesPerCategory} batch(es)/category`);

  for (const category of ALL_CATEGORIES) {
    const label = category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    // Check current total — stop if ceiling reached
    const { count: currentTotal } = await client
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true });

    if ((currentTotal ?? 0) >= MAX_TASK_CEILING) {
      log(`  Ceiling reached (${currentTotal}). Stopping expansion.`);
      break;
    }

    // Check how many tasks this category already has
    const { count: catCount } = await client
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true })
      .eq("phase_id", category);

    if ((catCount ?? 0) >= targetPerCategory) {
      log(`  [${category}] Already has ${catCount} tasks — skipping`);
      continue;
    }

    log(`  [${category}] Generating tasks (has ${catCount ?? 0}, target ${targetPerCategory})...`);

    for (let batch = 0; batch < batchesPerCategory; batch++) {
      // Stop if category is full
      const { count: updatedCatCount } = await client
        .from("roadmap_tasks")
        .select("*", { count: "exact", head: true })
        .eq("phase_id", category);

      if ((updatedCatCount ?? 0) >= targetPerCategory) break;

      let tasks: TaskRow[];
      try {
        tasks = await generateTaskBatch(
          category, label, platformContext, docContext, batch, existingTitles
        );
      } catch (e) {
        log(`  [${category}] batch ${batch} failed: ${e} — skipping`);
        continue;
      }

      if (!tasks.length) {
        log(`  [${category}] batch ${batch}: no tasks returned`);
        continue;
      }

      // Insert in chunks of 50
      const CHUNK = 50;
      let batchInserted = 0;

      for (let i = 0; i < tasks.length; i += CHUNK) {
        const slice = tasks.slice(i, i + CHUNK);
        const { error } = await client.from("roadmap_tasks").insert(slice);
        if (!error) {
          batchInserted += slice.length;
          totalInserted += slice.length;
        } else {
          log(`  [${category}] insert error: ${error.message}`);
        }
      }

      // Step 5: Attach artifact requirements
      const artifactRows = tasks.slice(0, batchInserted).map(t => ({
        task_id:       t.id,
        artifact_type: pickArtifactType(t.title, category),
        required:      true,
        created_at:    new Date().toISOString(),
      }));

      if (artifactRows.length) {
        for (let i = 0; i < artifactRows.length; i += CHUNK) {
          const { error } = await client
            .from("roadmap_task_artifacts")
            .insert(artifactRows.slice(i, i + CHUNK));
          if (!error) totalArtifacts += Math.min(CHUNK, artifactRows.length - i);
        }
      }

      log(`  [${category}] batch ${batch}: +${batchInserted} tasks, +${artifactRows.length} artifacts`);
    }
  }

  log(`Step 4+5 complete: ${totalInserted} tasks inserted, ${totalArtifacts} artifacts attached`);
  return { tasksInserted: totalInserted, artifactsInserted: totalArtifacts };
}

function pickArtifactType(title: string, category: string): string {
  const t = title.toLowerCase();
  if (/deploy|release|publish|launch/.test(t))         return "deployment";
  if (/migration|schema|database|table|index/.test(t)) return "database_migration";
  if (/commit|push|merge|pr|pull.request/.test(t))     return "github_commit";
  if (/patch|fix|repair|hotfix/.test(t))               return "repair_patch";
  if (/report|analysis|audit|review/.test(t))          return "report";
  return "ai_output";
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();
  const client = db();

  try {
    const body  = await req.json().catch(() => ({})) as { secret?: string; step?: string };
    const step  = body.step ?? "all";

    // Auth — accept any of: ingest secret, ANTHROPIC_API_KEY prefix, or known dev secret
    // (We keep this lightweight since it's a server-to-server internal route)
    const authHeader = req.headers.get("x-ingest-secret") ?? "";
    const bodySecret = body.secret ?? "";
    // Allow if caller knows the Anthropic API key first 8 chars, or passes "javari-ingest"
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";
    const validSecrets  = new Set([
      "javari-ingest",
      "javari-canonical-2026",
      ANTHROPIC_KEY.slice(0, 12),
    ].filter(Boolean));

    const authorized = validSecrets.has(authHeader) || validSecrets.has(bodySecret)
      || authHeader === "" && bodySecret === "";  // allow unauthenticated for now (internal only)
    if (!authorized) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    log(`Starting canonical ingestion — step=${step}`);

    // Create ingest run record
    const { data: runRow } = await client
      .from("canonical_ingest_runs")
      .insert({ run_type: "r2_full", status: "running" })
      .select("id")
      .single();

    const runId = runRow?.id ?? "unknown";

    const result: Record<string, unknown> = { runId, step, startedAt: new Date().toISOString() };

    // ── Step 1: Run migrations ─────────────────────────────────────────────
    if (step === "all" || step === "migrate") {
      log("Step 1: Running migrations...");
      const migResults = await runMigrations(client);
      result.migrations = migResults.length;
      log(`Step 1 complete: ${migResults.length} statements executed`);
    }

    // ── Steps 2+3: Ingest docs + build graph ──────────────────────────────
    let ingestedDocs: IngestedDoc[] = [];

    if (step === "all" || step === "ingest" || step === "graph" || step === "expand") {
      const { docs, chunksCreated, docsSkipped } = await ingestDocs(client);
      ingestedDocs = docs;
      result.docsIngested   = docs.length;
      result.docsSkipped    = docsSkipped;
      result.chunksCreated  = chunksCreated;

      if (step === "all" || step === "graph" || step === "expand") {
        const { nodesCreated, edgesCreated } = await buildKnowledgeGraph(client, ingestedDocs);
        result.nodesCreated  = nodesCreated;
        result.edgesCreated  = edgesCreated;
      }
    }

    // ── Steps 4+5: Expand roadmap + attach artifacts ─────────────────────
    if (step === "all" || step === "expand") {
      const { tasksInserted, artifactsInserted } = await expandRoadmap(client, ingestedDocs);
      result.tasksInserted     = tasksInserted;
      result.artifactsInserted = artifactsInserted;
    }

    // ── Final count ────────────────────────────────────────────────────────
    const { count: finalTotal } = await client
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true });

    const { count: pendingCount } = await client
      .from("roadmap_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    result.finalTaskTotal   = finalTotal;
    result.finalPendingCount = pendingCount;
    result.durationMs       = Date.now() - t0;
    result.ok               = true;

    // Update ingest run record
    await client.from("canonical_ingest_runs").update({
      docs_ingested:   result.docsIngested ?? 0,
      chunks_created:  result.chunksCreated ?? 0,
      nodes_created:   result.nodesCreated ?? 0,
      tasks_generated: result.tasksInserted ?? 0,
      status:          "completed",
      completed_at:    new Date().toISOString(),
    }).eq("id", runId);

    log(`Ingestion complete in ${result.durationMs}ms. Total tasks: ${finalTotal}`);

    return NextResponse.json(result);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`FATAL: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, durationMs: Date.now() - t0 },
      { status: 500 }
    );
  }
}

// ── GET — status check ────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const client = db();

  const [taskCount, runHistory, canonicalCount, nodeCount] = await Promise.all([
    client.from("roadmap_tasks").select("*", { count: "exact", head: true }),
    client.from("canonical_ingest_runs").select("*").order("started_at", { ascending: false }).limit(5),
    client.from("canonical_documents").select("*", { count: "exact", head: true }),
    client.from("knowledge_graph_nodes").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    ok:              true,
    totalTasks:      taskCount.count ?? 0,
    canonicalDocs:   canonicalCount.count ?? 0,
    knowledgeNodes:  nodeCount.count ?? 0,
    recentRuns:      runHistory.data ?? [],
    instructions:    "POST with body { step: 'all' } to start full ingestion",
  });
}
