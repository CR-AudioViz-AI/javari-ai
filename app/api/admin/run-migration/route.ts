// app/api/admin/run-migration/route.ts
// Creates model_registry table and seeds 11 models
// Uses Supabase Management API for DDL

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS model_registry (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  reasoning SMALLINT DEFAULT 3,
  json_reliability SMALLINT DEFAULT 3,
  code_quality SMALLINT DEFAULT 3,
  multimodal BOOLEAN DEFAULT FALSE,
  streaming BOOLEAN DEFAULT TRUE,
  tools BOOLEAN DEFAULT FALSE,
  cost_input NUMERIC DEFAULT 0,
  cost_output NUMERIC DEFAULT 0,
  latency_class TEXT DEFAULT 'medium',
  cost_tier TEXT DEFAULT 'low',
  enabled BOOLEAN DEFAULT TRUE,
  registry_version TEXT DEFAULT 'v1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, model)
);
`;

const ADD_REGISTRY_VERSION_COL = `
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS registry_version TEXT;
`;

const SEED_MODELS = [
  { provider:"groq", model:"llama-3.3-70b-versatile", reasoning:3, json_reliability:3, code_quality:3, multimodal:false, streaming:true, tools:false, cost_input:0, cost_output:0, latency_class:"fast", cost_tier:"free" },
  { provider:"groq", model:"llama-3.1-8b-instant", reasoning:2, json_reliability:2, code_quality:2, multimodal:false, streaming:true, tools:false, cost_input:0, cost_output:0, latency_class:"fast", cost_tier:"free" },
  { provider:"openai", model:"gpt-4o-mini", reasoning:3, json_reliability:4, code_quality:3, multimodal:true, streaming:true, tools:true, cost_input:0.00015, cost_output:0.0006, latency_class:"medium", cost_tier:"low" },
  { provider:"openai", model:"o4-mini", reasoning:5, json_reliability:4, code_quality:5, multimodal:false, streaming:true, tools:true, cost_input:0.003, cost_output:0.012, latency_class:"slow", cost_tier:"high" },
  { provider:"openai", model:"o3", reasoning:5, json_reliability:4, code_quality:5, multimodal:false, streaming:false, tools:true, cost_input:0.01, cost_output:0.04, latency_class:"slow", cost_tier:"premium" },
  { provider:"anthropic", model:"claude-sonnet-4-20250514", reasoning:5, json_reliability:4, code_quality:5, multimodal:true, streaming:true, tools:true, cost_input:0.003, cost_output:0.015, latency_class:"medium", cost_tier:"medium" },
  { provider:"mistral", model:"mistral-small-latest", reasoning:3, json_reliability:5, code_quality:3, multimodal:false, streaming:true, tools:true, cost_input:0.001, cost_output:0.003, latency_class:"medium", cost_tier:"low" },
  { provider:"mistral", model:"mistral-large-latest", reasoning:4, json_reliability:5, code_quality:4, multimodal:false, streaming:true, tools:true, cost_input:0.002, cost_output:0.006, latency_class:"medium", cost_tier:"medium" },
  { provider:"openrouter", model:"meta-llama/llama-3.3-70b-instruct", reasoning:3, json_reliability:3, code_quality:3, multimodal:false, streaming:true, tools:false, cost_input:0.0006, cost_output:0.0006, latency_class:"medium", cost_tier:"low" },
  { provider:"xai", model:"grok-2", reasoning:3, json_reliability:3, code_quality:3, multimodal:true, streaming:true, tools:true, cost_input:0.002, cost_output:0.01, latency_class:"medium", cost_tier:"medium" },
  { provider:"perplexity", model:"llama-3.1-sonar-large-128k-online", reasoning:3, json_reliability:2, code_quality:2, multimodal:false, streaming:true, tools:false, cost_input:0.001, cost_output:0.001, latency_class:"medium", cost_tier:"low" },
];

async function execMgmtSQL(sql: string): Promise<{ ok: boolean; data?: any; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!url || !mgmtToken) return { ok: false, error: "Missing credentials" };
  const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) return { ok: false, error: "Bad project ref" };
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` },
    body: JSON.stringify({ query: sql }),
  });
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true, data: await r.json() };
}

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }
  const t0 = Date.now();
  const results: Array<{ step: string; ok: boolean; error?: string }> = [];

  // Step 1: Create table
  const r1 = await execMgmtSQL(CREATE_TABLE_SQL);
  results.push({ step: "create_table", ok: r1.ok, error: r1.error });

  // Step 2: Add registry_version column to ai_router_executions
  const r2 = await execMgmtSQL(ADD_REGISTRY_VERSION_COL);
  results.push({ step: "add_execution_col", ok: r2.ok, error: r2.error });

  // Step 3: Seed models via Supabase REST (upsert)
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const seedRows = SEED_MODELS.map(m => ({ ...m, registry_version: "v1.0", enabled: true }));
  const { error: seedError, count } = await sb.from("model_registry").upsert(seedRows, { onConflict: "provider,model", count: "exact" });
  results.push({ step: "seed_models", ok: !seedError, error: seedError?.message });

  // Step 4: Verify
  const { data: rows } = await sb.from("model_registry").select("provider, model, enabled, registry_version").order("provider");
  const { data: colCheck } = await sb.from("model_registry").select("*").limit(1);

  return Response.json({
    success: results.every(r => r.ok),
    duration_ms: Date.now() - t0,
    results,
    model_count: rows?.length ?? 0,
    models: rows,
    columns: colCheck?.[0] ? Object.keys(colCheck[0]) : [],
  });
}
