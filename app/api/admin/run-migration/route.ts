// app/api/admin/run-migration/route.ts
// Creates model_registry table, seeds 11 models, adds registry_version to ai_router_executions
// Delete after migration succeeds

import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const t0 = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN;

  if (!url || !mgmtToken) {
    return Response.json({ error: "Missing credentials", url: !!url, mgmt: !!mgmtToken }, { status: 500 });
  }

  const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) {
    return Response.json({ error: "Cannot extract project ref" }, { status: 500 });
  }

  const API = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` };

  async function runSql(sql: string, label: string): Promise<{ ok: boolean; data: any; label: string }> {
    try {
      const r = await fetch(API, { method: "POST", headers, body: JSON.stringify({ query: sql }) });
      const data = await r.json();
      return { ok: r.ok, data, label };
    } catch (err: any) {
      return { ok: false, data: err.message, label };
    }
  }

  const results: any[] = [];

  // Step 1: Create model_registry table
  results.push(await runSql(`
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
  CONSTRAINT model_registry_pkey PRIMARY KEY (provider, model)
);`, "create_table"));

  // Step 2: Seed 11 models
  results.push(await runSql(`
INSERT INTO model_registry (provider, model, reasoning, json_reliability, code_quality, multimodal, streaming, tools, cost_input, cost_output, latency_class, cost_tier, enabled, registry_version) VALUES
  ('groq',       'llama-3.3-70b-versatile',               3, 3, 3, false, true,  false, 0,      0,      'fast',   'free',     true,  'v1.0'),
  ('groq',       'llama-3.1-8b-instant',                   2, 2, 2, false, true,  false, 0,      0,      'fast',   'free',     true,  'v1.0'),
  ('openai',     'gpt-4o-mini',                            3, 4, 3, true,  true,  true,  0.00015,0.0006, 'medium', 'low',      true,  'v1.0'),
  ('openai',     'o4-mini',                                5, 4, 5, false, true,  true,  0.0011, 0.0044, 'slow',   'medium',   true,  'v1.0'),
  ('openai',     'o3',                                     5, 4, 5, false, false, true,  0.01,   0.04,   'slow',   'premium',  true,  'v1.0'),
  ('anthropic',  'claude-sonnet-4-20250514',               5, 4, 5, true,  true,  true,  0.003,  0.015,  'medium', 'medium',   true,  'v1.0'),
  ('mistral',    'mistral-small-latest',                   3, 5, 3, false, true,  true,  0.0001, 0.0003, 'medium', 'low',      true,  'v1.0'),
  ('mistral',    'mistral-large-latest',                   4, 5, 4, false, true,  true,  0.002,  0.006,  'medium', 'medium',   true,  'v1.0'),
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct',     3, 3, 3, false, true,  false, 0.00059,0.00079,'medium', 'low',      true,  'v1.0'),
  ('xai',        'grok-2',                                 3, 3, 3, true,  true,  true,  0.002,  0.01,   'medium', 'medium',   true,  'v1.0'),
  ('perplexity', 'llama-3.1-sonar-large-128k-online',     3, 2, 2, false, true,  false, 0.001,  0.001,  'medium', 'low',      true,  'v1.0')
ON CONFLICT (provider, model) DO NOTHING;`, "seed_models"));

  // Step 2b: Reload PostgREST schema cache so Supabase JS client can see the new table
  results.push(await runSql("NOTIFY pgrst, 'reload schema';", "reload_schema_cache"));

  // Step 3: Add registry_version column to ai_router_executions
  results.push(await runSql(`
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS registry_version TEXT;`, "add_registry_version_col"));

  // Step 4: Verify
  results.push(await runSql(`
SELECT
  (SELECT COUNT(*) FROM model_registry WHERE enabled = true) as enabled_count,
  (SELECT COUNT(*) FROM model_registry) as total_count,
  (SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_router_executions' AND column_name = 'registry_version'
  )) as has_registry_version_col;`, "verify"));

  // Step 5: Sample
  results.push(await runSql(`
SELECT provider, model, reasoning, json_reliability, code_quality, enabled, registry_version
FROM model_registry ORDER BY provider, model;`, "sample_data"));

  return Response.json({
    success: results.every((r) => r.ok),
    duration_ms: Date.now() - t0,
    steps: results.map((r) => ({ label: r.label, ok: r.ok, data: r.data })),
  });
}
