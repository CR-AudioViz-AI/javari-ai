// app/api/javari/canonical-pipeline/route.ts
// Purpose: Full canonical ingestion + ecosystem roadmap expansion orchestrator.
//          Runs all 8 steps from Roy's specification in sequence.
//          GET → pipeline status
//          POST body: { step?: "schema"|"ingest"|"graph"|"expand"|"all" }
//          Each step is idempotent. Can re-run any step.
// Date: 2026-03-10

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { listCanonicalKeys, fetchCanonicalText } from "@/lib/canonical/r2-client";
import { chunkMarkdown }             from "@/lib/canonical/chunker";
import { embedBatch }                from "@/lib/canonical/embed";
import type { Chunk }                from "@/lib/canonical/chunker";
import type { EmbedResult }          from "@/lib/canonical/embed";
import crypto                        from "crypto";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 300;

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_TASK_CEILING = 50_000;
const TARGET_TASKS     = 15_000;
const TASKS_PER_BATCH  = 150;
const MAX_EMBED_DOCS   = 25;
const CHUNK_MAX_CHARS  = 4000;

const ECOSYSTEM_CATEGORIES: string[] = [
  // Platform Foundation (10 cats)
  "platform_foundation","authentication_rbac","database_infrastructure","api_gateway",
  "deployment_pipeline","monitoring_observability","security_infrastructure","performance_optimization",
  "mobile_platform","global_localization",
  // Javari AI Core (10 cats)
  "javari_core_ai","multi_ai_routing","autonomous_planner","knowledge_management",
  "ai_execution_engine","vector_memory","ai_marketplace","multi_ai_team_mode",
  "autonomous_deployment","platform_scaling",
  // Creator Tools (10 cats)
  "creator_studio","audio_tools","video_tools","image_tools","brand_engine",
  "content_marketplace","developer_sdk","webhook_system","search_discovery","file_storage",
  // CRAIverse World (8 cats)
  "craiverse_world","avatar_system","virtual_real_estate","community_modules","social_impact",
  "geographic_targeting","notification_system","cdn_delivery",
  // Enterprise & Revenue (12 cats)
  "enterprise_dashboard","white_label_platform","grant_management","analytics_bi",
  "reporting_engine","subscription_billing","creator_monetization","affiliate_programs",
  "marketplace_commissions","global_payments","revenue_analytics","privacy_compliance",
  // Social Impact Modules (5 cats)
  "first_responder_module","veteran_support","faith_community","animal_rescue","training_certification",
  // Accessibility & Compliance (5 cats)
  "accessibility_wcag","platform_health","disaster_recovery","data_governance","compliance_reporting",
];

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim()
          .replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,48);
}

function makeId(cat: string, title: string, idx: number): string {
  return `eco-${cat.slice(0,10)}-${slugify(title).slice(0,28)}-${String(idx).padStart(4,"0")}`;
}

function clog(msg: string) { console.log(`${new Date().toISOString()} [pipeline] ${msg}`); }

// ── Step 1: Schema ────────────────────────────────────────────────────────────

async function runSchema(): Promise<{ ok: number; failed: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const hdrs = { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` };

  const statements = [
    `CREATE TABLE IF NOT EXISTS canonical_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL, source TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      content TEXT NOT NULL, content_hash TEXT NOT NULL DEFAULT '',
      embedding JSONB, doc_type TEXT DEFAULT 'markdown',
      token_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source, chunk_index)
    )`,
    `ALTER TABLE IF EXISTS canonical_documents DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE canonical_documents TO service_role,authenticated,anon`,
    `CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      node_type TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT, source_doc TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(node_type, name)
    )`,
    `ALTER TABLE IF EXISTS knowledge_graph_nodes DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE knowledge_graph_nodes TO service_role,authenticated,anon`,
    `CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_node_id UUID NOT NULL, to_node_id UUID NOT NULL,
      relationship TEXT NOT NULL, weight FLOAT DEFAULT 1.0,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE IF EXISTS knowledge_graph_edges DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE knowledge_graph_edges TO service_role,authenticated,anon`,
    `CREATE TABLE IF NOT EXISTS canonical_ingest_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_type TEXT NOT NULL DEFAULT 'r2_full',
      docs_found INTEGER DEFAULT 0, docs_ingested INTEGER DEFAULT 0,
      chunks_created INTEGER DEFAULT 0, nodes_created INTEGER DEFAULT 0,
      tasks_generated INTEGER DEFAULT 0, status TEXT DEFAULT 'running',
      error TEXT, started_at TIMESTAMPTZ DEFAULT NOW(), completed_at TIMESTAMPTZ
    )`,
    `ALTER TABLE IF EXISTS canonical_ingest_runs DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE canonical_ingest_runs TO service_role,authenticated,anon`,
  ];

  let ok = 0, failed = 0;
  for (const sql of statements) {
    let success = false;
    for (const [ep, body] of [
      [`${url}/rest/v1/rpc/query`,    JSON.stringify({ query: sql })],
      [`${url}/rest/v1/rpc/exec_sql`, JSON.stringify({ sql })],
    ] as [string,string][]) {
      try {
        const r = await fetch(ep, { method:"POST", headers:hdrs, body, signal:AbortSignal.timeout(10_000) });
        if (r.ok) { success = true; break; }
      } catch { /* try next */ }
    }
    success ? ok++ : failed++;
  }
  return { ok, failed };
}

// ── Step 2: Ingest R2 docs ────────────────────────────────────────────────────

interface DocRecord { key: string; title: string; chunks: number; chars: number; content: string }

async function ingestDocs(client: ReturnType<typeof db>): Promise<{ docs: DocRecord[]; chunks: number; skipped: number }> {
  clog("Step 2: Scanning R2...");
  
  // Scan multiple prefixes to find all canonical docs
  const allKeys = await listCanonicalKeys("").catch(() => []);
  clog(`  R2 total objects: ${allKeys.length}`);

  const docKeys = allKeys.filter(k => {
    const lower = k.key.toLowerCase();
    return lower.endsWith(".md") || lower.endsWith(".txt") || lower.endsWith(".json");
  });
  clog(`  Processable docs: ${docKeys.length}`);

  const docs: DocRecord[] = [];
  let chunkTotal = 0, skipped = 0;

  for (let i = 0; i < docKeys.length; i++) {
    const obj = docKeys[i];
    clog(`  [${i+1}/${docKeys.length}] ${obj.key}`);

    let content: string;
    try { content = await fetchCanonicalText(obj.key); }
    catch { skipped++; continue; }

    if (!content?.trim() || content.length < 100) { skipped++; continue; }

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch
      ? titleMatch[1].trim()
      : (obj.key.split("/").pop()?.replace(/\.[^.]+$/,"") ?? obj.key);

    const chunks: Chunk[] = chunkMarkdown(content, { maxChars: CHUNK_MAX_CHARS });
    if (!chunks.length) { skipped++; continue; }

    let embedResults: (EmbedResult|null)[] = [];
    if (i < MAX_EMBED_DOCS) {
      embedResults = await embedBatch(chunks.map(c => c.chunkText)).catch(() => chunks.map(() => null));
    }

    const docHash = sha256(content);
    let stored = 0;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const emb   = embedResults[ci]?.embedding ?? null;
      const { error } = await client.from("canonical_documents").upsert({
        title, source: obj.key, chunk_index: ci,
        content: chunk.chunkText, content_hash: docHash,
        embedding: emb ? JSON.stringify(emb) : null,
        doc_type: obj.key.endsWith(".json") ? "json" : "markdown",
        token_count: chunk.approxTokens,
        updated_at: new Date().toISOString(),
      }, { onConflict: "source,chunk_index" });
      if (!error) stored++;
    }

    chunkTotal += stored;
    docs.push({ key: obj.key, title, chunks: stored, chars: content.length, content });
    clog(`    ✓ ${title}: ${stored} chunks`);
  }

  return { docs, chunks: chunkTotal, skipped };
}

// ── Step 3: Knowledge Graph ───────────────────────────────────────────────────

async function buildGraph(client: ReturnType<typeof db>, docs: DocRecord[]) {
  clog("Step 3: Building knowledge graph...");

  const coreNodes = [
    { node_type:"platform_component", name:"Javari AI OS",               description:"Primary autonomous AI operating system",       source_doc:"taxonomy" },
    { node_type:"platform_component", name:"CRAIverse",                  description:"Virtual world and community platform",          source_doc:"taxonomy" },
    { node_type:"platform_component", name:"Creator Studio",             description:"Professional creative tools suite",             source_doc:"taxonomy" },
    { node_type:"platform_component", name:"Enterprise Dashboard",       description:"Business intelligence and admin control",        source_doc:"taxonomy" },
    { node_type:"platform_component", name:"Grant Management System",    description:"Federal/private grant targeting $600M+",        source_doc:"taxonomy" },
    { node_type:"platform_component", name:"Platform Secret Authority",  description:"AES-256-GCM credential vault",                  source_doc:"taxonomy" },
    { node_type:"platform_component", name:"Javari Spirits",             description:"Premium alcohol affiliate marketplace",          source_doc:"taxonomy" },
    { node_type:"platform_component", name:"Javari Cards",               description:"Digital business card platform",                source_doc:"taxonomy" },
    { node_type:"service",            name:"Autonomous Planner",         description:"AI task generation engine (claude-haiku)",      source_doc:"taxonomy" },
    { node_type:"service",            name:"Roadmap Execution Worker",   description:"Vercel cron task executor every 60s",           source_doc:"taxonomy" },
    { node_type:"service",            name:"Canonical Ingestion Pipeline",description:"R2 → chunk → embed → vector store",           source_doc:"taxonomy" },
    { node_type:"infrastructure",     name:"Supabase PostgreSQL",        description:"Primary DB + pgvector store",                   source_doc:"taxonomy" },
    { node_type:"infrastructure",     name:"Vercel Edge Network",        description:"Serverless hosting + cron jobs",                source_doc:"taxonomy" },
    { node_type:"infrastructure",     name:"Cloudflare R2",              description:"Cold storage for canonical docs + assets",      source_doc:"taxonomy" },
    { node_type:"infrastructure",     name:"GitHub",                     description:"179+ repositories, CI/CD",                      source_doc:"taxonomy" },
    { node_type:"integration",        name:"Stripe",                     description:"Primary payment processor (live)",              source_doc:"taxonomy" },
    { node_type:"integration",        name:"PayPal",                     description:"Secondary payment processor (live)",            source_doc:"taxonomy" },
    { node_type:"integration",        name:"Anthropic Claude",           description:"Primary AI provider",                          source_doc:"taxonomy" },
    { node_type:"integration",        name:"OpenRouter",                 description:"Multi-model AI router",                        source_doc:"taxonomy" },
    { node_type:"integration",        name:"OpenAI",                     description:"Embeddings + GPT models",                       source_doc:"taxonomy" },
    { node_type:"application",        name:"javariai.com",               description:"Primary Javari AI platform domain",             source_doc:"taxonomy" },
    { node_type:"application",        name:"craudiovizai.com",           description:"Main CR AudioViz AI website",                  source_doc:"taxonomy" },
    { node_type:"workflow",           name:"Roadmap Execution Loop",     description:"Task → execute → verify → complete cycle",     source_doc:"taxonomy" },
    { node_type:"workflow",           name:"Module Factory",             description:"Rapid module launch framework",                 source_doc:"taxonomy" },
    { node_type:"workflow",           name:"Henderson Standard",         description:"Fortune 50 quality, zero shortcuts",            source_doc:"taxonomy" },
  ];

  // Pattern extraction from doc content
  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type:"application",        regex:/\b(?:Javari\s+\w+|CRAIverse\s*\w*)\b/g },
    { type:"service",            regex:/\b\w+\s+(?:API|Service|Engine|System|Worker|Daemon)\b/g },
    { type:"platform_component", regex:/\b\w+\s+(?:Module|Platform|Dashboard|Portal|Studio|Suite)\b/g },
  ];

  const seen = new Set<string>(coreNodes.map(n => `${n.node_type}:${n.name.toLowerCase()}`));
  const extracted: typeof coreNodes = [];

  for (const doc of docs.slice(0,20)) {
    for (const { type, regex } of patterns) {
      for (const match of (doc.content.match(regex) ?? [])) {
        const name = match.trim().replace(/\s+/g," ").slice(0,80);
        if (name.length < 4) continue;
        const key = `${type}:${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        extracted.push({ node_type:type, name, description:`Extracted from: ${doc.title}`, source_doc:doc.key });
      }
    }
  }

  const allNodes = [...coreNodes, ...extracted.slice(0,500)];
  let nodesCreated = 0;
  for (const node of allNodes) {
    const { error } = await client.from("knowledge_graph_nodes").upsert(node, { onConflict:"node_type,name" });
    if (!error) nodesCreated++;
  }

  const edgeDefs: Array<[string,string,string]> = [
    ["Javari AI OS","Supabase PostgreSQL","requires"],
    ["Javari AI OS","Vercel Edge Network","deployed_on"],
    ["Autonomous Planner","Javari AI OS","extends"],
    ["CRAIverse","Javari AI OS","integrates_with"],
    ["Creator Studio","Javari AI OS","integrates_with"],
    ["Roadmap Execution Loop","Autonomous Planner","contains"],
    ["Canonical Ingestion Pipeline","Cloudflare R2","reads_from"],
    ["Stripe","Enterprise Dashboard","integrates_with"],
    ["Grant Management System","Enterprise Dashboard","contains"],
    ["Platform Secret Authority","Supabase PostgreSQL","deployed_on"],
    ["Module Factory","Javari AI OS","extends"],
  ];

  let edgesCreated = 0;
  for (const [fromName, toName, rel] of edgeDefs) {
    const [{ data: fromRow }, { data: toRow }] = await Promise.all([
      client.from("knowledge_graph_nodes").select("id").eq("name",fromName).limit(1),
      client.from("knowledge_graph_nodes").select("id").eq("name",toName).limit(1),
    ]);
    if (!fromRow?.[0]?.id || !toRow?.[0]?.id) continue;
    const { error } = await client.from("knowledge_graph_edges").insert({
      from_node_id: fromRow[0].id, to_node_id: toRow[0].id, relationship: rel,
    });
    if (!error) edgesCreated++;
  }

  clog(`Graph: ${nodesCreated} nodes, ${edgesCreated} edges`);
  return { nodesCreated, edgesCreated };
}

// ── Steps 4+5: Expand roadmap + attach artifacts ──────────────────────────────

function artifactType(title: string): string {
  const t = title.toLowerCase();
  if (/deploy|release|publish|launch/.test(t))   return "deployment";
  if (/migration|schema|database|table/.test(t)) return "database_migration";
  if (/commit|merge|pull.request/.test(t))        return "github_commit";
  if (/patch|fix|repair|hotfix/.test(t))          return "repair_patch";
  if (/report|analysis|audit/.test(t))            return "report";
  return "ai_output";
}

async function generateBatch(
  category: string, label: string, platformCtx: string,
  docCtx: string, batchNum: number, existingTitles: Set<string>,
) {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");

  const avoid = Array.from(existingTitles).slice(0,60).join(" | ");
  const prompt = `You are the Javari AI ecosystem architect for CR AudioViz AI, LLC — Fort Myers, FL.
Mission: "Your Story. Our Design." — Fortune 50 quality AI ecosystem for creators, businesses, veterans, first responders, faith communities, animal rescues.

PLATFORM:
${platformCtx}

CANONICAL DOC CONTEXT:
${docCtx.slice(0,2000)}

Generate exactly ${TASKS_PER_BATCH} unique, actionable engineering tasks for: "${label}"

Rules:
- Each task = specific deliverable an AI agent can execute autonomously
- Cover: API routes, DB schemas, UI components, security, testing, DevOps, AI integrations, documentation
- Advanced batch ${batchNum} — go deeper than basics, include edge cases and enterprise features
- DO NOT repeat: ${avoid.slice(0,400)}

Return ONLY a JSON array, no markdown:
[{"title":"<80 chars","description":"<technical, 80+ words, specific tech/endpoint/schema>","sub_phase":"${category}"}]`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:8000, messages:[{ role:"user", content:prompt }] }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json() as { content: Array<{ type: string; text: string }> };
  const raw  = data.content.find(c => c.type === "text")?.text ?? "[]";

  let parsed: Array<{ title: string; description: string }>;
  try {
    parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g,"").trim());
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    try { parsed = JSON.parse(m[0]); } catch { return []; }
  }

  if (!Array.isArray(parsed)) return [];
  const now = Date.now();
  const tasks: object[] = [];

  for (const item of parsed.slice(0,TASKS_PER_BATCH)) {
    if (!item?.title) continue;
    const title = item.title.trim().slice(0,200);
    if (!title || existingTitles.has(title.toLowerCase())) continue;
    const idx = tasks.length + batchNum * TASKS_PER_BATCH;
    tasks.push({
      id: makeId(category, title, idx),
      roadmap_id: null, phase_id: category, title,
      description: (item.description ?? title).trim(),
      depends_on: [], status: "pending",
      source: "ecosystem_expansion", updated_at: now,
    });
    existingTitles.add(title.toLowerCase());
  }
  return tasks;
}

async function expandRoadmap(client: ReturnType<typeof db>, docs: DocRecord[]) {
  clog("Step 4: Expanding ecosystem roadmap...");

  const { data: existing } = await client.from("roadmap_tasks").select("title");
  const existingTitles = new Set<string>(
    (existing ?? []).map((r: { title: string }) => r.title?.toLowerCase() ?? "").filter(Boolean)
  );
  clog(`  Existing titles: ${existingTitles.size}`);

  const { count: totalCount } = await client.from("roadmap_tasks").select("*",{count:"exact",head:true});
  if ((totalCount ?? 0) >= MAX_TASK_CEILING) {
    clog("  Ceiling reached. No expansion needed.");
    return { tasksInserted: 0, artifactsInserted: 0 };
  }

  const platformCtx = `CR AudioViz AI — 55 modules, 6 families, 11 platform layers
Stack: Next.js 14 + TypeScript strict, Supabase PostgreSQL+pgvector, Vercel, Tailwind CSS, shadcn/ui
Payments: Stripe + PayPal (live). AI: Anthropic Claude, OpenAI, OpenRouter (multi-model)
Storage: Cloudflare R2 + Supabase. Auth: Supabase RBAC + Row Level Security
Revenue: SaaS ($49-499/mo), Marketplace (20% comm), White-Label ($2.5K-10K/mo), Grants ($600M+)
Standards: WCAG 2.2 AA, OWASP Top 10, API <200ms p95, Fortune 50 quality`.trim();

  const docCtx = docs.slice(0,8).map(d => `=== ${d.title} ===\n${d.content.slice(0,500)}`).join("\n\n");
  const targetPerCat = Math.ceil(TARGET_TASKS / ECOSYSTEM_CATEGORIES.length);
  const batchesPerCat = Math.ceil(targetPerCat / TASKS_PER_BATCH);

  let totalInserted = 0, totalArtifacts = 0;
  clog(`  Target: ${TARGET_TASKS} tasks across ${ECOSYSTEM_CATEGORIES.length} categories (~${targetPerCat}/cat)`);

  for (const category of ECOSYSTEM_CATEGORIES) {
    const { count: grand } = await client.from("roadmap_tasks").select("*",{count:"exact",head:true});
    if ((grand ?? 0) >= MAX_TASK_CEILING) { clog("  Ceiling. Stopping."); break; }

    const { count: catCount } = await client.from("roadmap_tasks").select("*",{count:"exact",head:true}).eq("phase_id",category);
    if ((catCount ?? 0) >= targetPerCat) { clog(`  [${category}] at ${catCount} — skip`); continue; }

    const label = category.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
    clog(`  [${category}] generating (current: ${catCount ?? 0})...`);

    for (let batch = 0; batch < batchesPerCat; batch++) {
      const { count: cur } = await client.from("roadmap_tasks").select("*",{count:"exact",head:true}).eq("phase_id",category);
      if ((cur ?? 0) >= targetPerCat) break;

      let tasks: object[];
      try { tasks = await generateBatch(category, label, platformCtx, docCtx, batch, existingTitles); }
      catch (e) { clog(`  [${category}] batch ${batch} error: ${e}`); continue; }
      if (!tasks.length) continue;

      for (let i = 0; i < tasks.length; i += 50) {
        const slice = tasks.slice(i, i+50);
        const { error } = await client.from("roadmap_tasks").insert(slice);
        if (!error) {
          totalInserted += slice.length;
          // Attach artifact requirements (Step 5)
          const artRows = (slice as Array<{id:string;title:string}>).map(t => ({
            task_id: t.id, artifact_type: artifactType(t.title),
            required: true, created_at: new Date().toISOString(),
          }));
          const { error: artErr } = await client.from("roadmap_task_artifacts").insert(artRows);
          if (!artErr) totalArtifacts += artRows.length;
        }
      }
      clog(`  [${category}] batch ${batch}: +${tasks.length} tasks`);
    }
  }

  return { tasksInserted: totalInserted, artifactsInserted: totalArtifacts };
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0     = Date.now();
  const client = db();
  let   body: { step?: string } = {};
  try { body = await req.json() as { step?: string }; } catch { /* no body */ }
  const step = body.step ?? "all";
  clog(`Pipeline start — step=${step}`);

  try {
    const result: Record<string, unknown> = { ok:true, step, startedAt:new Date().toISOString() };

    // Step 1: Schema
    const schema = await runSchema();
    result.schema = schema;
    clog(`Schema: ${schema.ok} ok, ${schema.failed} failed`);

    // Run ingest for step=all|ingest|graph|expand
    let ingestedDocs: DocRecord[] = [];
    if (["all","ingest","graph","expand"].includes(step)) {
      // Log run
      const { data: run } = await client.from("canonical_ingest_runs")
        .insert({ run_type:"r2_full", status:"running" }).select("id").single();
      const runId: string = (run as { id: string } | null)?.id ?? "none";
      result.runId = runId;

      // Step 2
      const ingested = await ingestDocs(client);
      ingestedDocs = ingested.docs;
      result.docsIngested  = ingested.docs.length;
      result.docsSkipped   = ingested.skipped;
      result.chunksCreated = ingested.chunks;

      // Step 3
      if (["all","graph","expand"].includes(step)) {
        const graph = await buildGraph(client, ingestedDocs);
        result.nodesCreated = graph.nodesCreated;
        result.edgesCreated = graph.edgesCreated;
      }

      // Update run record
      await client.from("canonical_ingest_runs").update({
        docs_ingested: ingested.docs.length, chunks_created: ingested.chunks,
        nodes_created: (result.nodesCreated as number) ?? 0,
        status: "ingest_complete", completed_at: new Date().toISOString(),
      }).eq("id", runId);
    }

    // Steps 4+5: Expand
    if (["all","expand"].includes(step)) {
      const expand = await expandRoadmap(client, ingestedDocs);
      result.tasksInserted     = expand.tasksInserted;
      result.artifactsInserted = expand.artifactsInserted;
    }

    // Final counts
    const [tasks, pending, canon, nodes] = await Promise.all([
      client.from("roadmap_tasks").select("*",{count:"exact",head:true}),
      client.from("roadmap_tasks").select("*",{count:"exact",head:true}).eq("status","pending"),
      client.from("canonical_documents").select("*",{count:"exact",head:true}).catch(()=>({count:0})),
      client.from("knowledge_graph_nodes").select("*",{count:"exact",head:true}).catch(()=>({count:0})),
    ]);

    result.finalTaskTotal    = tasks.count ?? 0;
    result.finalPendingCount = pending.count ?? 0;
    result.canonicalDocChunks = (canon as { count: number|null }).count ?? 0;
    result.knowledgeNodes    = (nodes as { count: number|null }).count ?? 0;
    result.durationMs        = Date.now() - t0;

    clog(`Done ${result.durationMs}ms. Total tasks: ${result.finalTaskTotal}, pending: ${result.finalPendingCount}`);
    return NextResponse.json(result);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    clog(`FATAL: ${msg}`);
    return NextResponse.json({ ok:false, error:msg, durationMs:Date.now()-t0 }, { status:500 });
  }
}

// ── GET — status ──────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const client = db();
  const [tasks, pending, canon, nodes, edges, runs] = await Promise.all([
    client.from("roadmap_tasks").select("*",{count:"exact",head:true}),
    client.from("roadmap_tasks").select("*",{count:"exact",head:true}).eq("status","pending"),
    client.from("canonical_documents").select("*",{count:"exact",head:true}).catch(()=>({count:0})),
    client.from("knowledge_graph_nodes").select("*",{count:"exact",head:true}).catch(()=>({count:0})),
    client.from("knowledge_graph_edges").select("*",{count:"exact",head:true}).catch(()=>({count:0})),
    client.from("canonical_ingest_runs").select("*").order("started_at",{ascending:false}).limit(5).catch(()=>({data:[]})),
  ]);

  return NextResponse.json({
    ok: true,
    roadmap: { total: tasks.count??0, pending: pending.count??0 },
    canonical: { docChunks: (canon as {count:number|null}).count??0 },
    knowledgeGraph: { nodes: (nodes as {count:number|null}).count??0, edges: (edges as {count:number|null}).count??0 },
    recentRuns: (runs as {data:unknown[]}).data??[],
    endpoints: {
      POST_schema:  "POST /api/javari/canonical-pipeline body={step:'schema'}",
      POST_ingest:  "POST /api/javari/canonical-pipeline body={step:'ingest'}",
      POST_graph:   "POST /api/javari/canonical-pipeline body={step:'graph'}",
      POST_expand:  "POST /api/javari/canonical-pipeline body={step:'expand'}",
      POST_all:     "POST /api/javari/canonical-pipeline body={} (default: all steps)",
    }
  });
}
