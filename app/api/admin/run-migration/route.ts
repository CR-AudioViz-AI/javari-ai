// app/api/admin/run-migration/route.ts
// Schema migration: model_registry table + registry_version column + seed data
// Delete after successful migration

import { NextRequest } from "next/server";

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
  CONSTRAINT model_registry_pkey PRIMARY KEY (provider, model)
);
`;

const ADD_COLUMN_SQL = `
ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS registry_version TEXT;
`;

const SEED_SQL = `
INSERT INTO model_registry (provider, model, reasoning, json_reliability, code_quality, multimodal, streaming, tools, cost_input, cost_output, latency_class, cost_tier, enabled, registry_version)
VALUES
  ('groq', 'llama-3.3-70b-versatile', 3, 3, 3, FALSE, TRUE, FALSE, 0, 0, 'fast', 'free', TRUE, 'v1.0'),
  ('groq', 'llama-3.1-8b-instant', 2, 2, 2, FALSE, TRUE, FALSE, 0, 0, 'fast', 'free', TRUE, 'v1.0'),
  ('openai', 'gpt-4o-mini', 3, 4, 3, TRUE, TRUE, TRUE, 0.00015, 0.0006, 'medium', 'low', TRUE, 'v1.0'),
  ('openai', 'o4-mini', 5, 4, 5, FALSE, TRUE, TRUE, 0.0011, 0.0044, 'slow', 'medium', TRUE, 'v1.0'),
  ('openai', 'o3', 5, 4, 5, FALSE, FALSE, TRUE, 0.01, 0.04, 'slow', 'premium', TRUE, 'v1.0'),
  ('anthropic', 'claude-sonnet-4-20250514', 5, 4, 5, TRUE, TRUE, TRUE, 0.003, 0.015, 'medium', 'medium', TRUE, 'v1.0'),
  ('mistral', 'mistral-small-latest', 3, 5, 3, FALSE, TRUE, TRUE, 0.0001, 0.0003, 'medium', 'low', TRUE, 'v1.0'),
  ('mistral', 'mistral-large-latest', 4, 5, 4, FALSE, TRUE, TRUE, 0.002, 0.006, 'medium', 'medium', TRUE, 'v1.0'),
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct', 3, 3, 3, FALSE, TRUE, FALSE, 0.00059, 0.00079, 'medium', 'low', TRUE, 'v1.0'),
  ('xai', 'grok-2', 3, 3, 3, TRUE, TRUE, TRUE, 0.002, 0.01, 'medium', 'medium', TRUE, 'v1.0'),
  ('perplexity', 'llama-3.1-sonar-large-128k-online', 3, 2, 2, FALSE, TRUE, FALSE, 0.001, 0.001, 'medium', 'low', TRUE, 'v1.0')
ON CONFLICT (provider, model) DO UPDATE SET
  reasoning = EXCLUDED.reasoning,
  json_reliability = EXCLUDED.json_reliability,
  code_quality = EXCLUDED.code_quality,
  multimodal = EXCLUDED.multimodal,
  streaming = EXCLUDED.streaming,
  tools = EXCLUDED.tools,
  cost_input = EXCLUDED.cost_input,
  cost_output = EXCLUDED.cost_output,
  latency_class = EXCLUDED.latency_class,
  cost_tier = EXCLUDED.cost_tier,
  enabled = EXCLUDED.enabled,
  registry_version = EXCLUDED.registry_version,
  updated_at = NOW();
`;

const VERIFY_TABLE_SQL = `
SELECT provider, model, reasoning, json_reliability, code_quality, enabled, registry_version
FROM model_registry ORDER BY provider, model;
`;

const VERIFY_COLUMN_SQL = `
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ai_router_executions' AND column_name = 'registry_version';
`;

export async function POST(_req: NextRequest) {
  if (process.env.ADMIN_MODE !== "1") {
    return Response.json({ error: "Admin mode disabled" }, { status: 403 });
  }

  const t0 = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN;

  if (!url || !mgmtToken) {
    return Response.json({ error: "Missing credentials" }, { status: 500 });
  }

  const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) {
    return Response.json({ error: "Cannot extract project ref" }, { status: 500 });
  }

  const results: Record<string, any> = {};

  async function runSQL(label: string, sql: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` },
      body: JSON.stringify({ query: sql }),
    });
    if (!r.ok) {
      const text = await r.text();
      results[label] = { error: r.status, detail: text.slice(0, 300) };
      return false;
    }
    results[label] = await r.json();
    return true;
  }

  await runSQL("create_table", CREATE_TABLE_SQL);
  // Force PostgREST schema reload
  await runSQL("schema_reload", "NOTIFY pgrst, 'reload schema';");
  await runSQL("add_column", ADD_COLUMN_SQL);
  await runSQL("seed_models", SEED_SQL);
  await runSQL("verify_models", VERIFY_TABLE_SQL);
  await runSQL("verify_column", VERIFY_COLUMN_SQL);

  const modelCount = Array.isArray(results.verify_models) ? results.verify_models.length : 0;

  return Response.json({
    success: true,
    duration_ms: Date.now() - t0,
    model_count: modelCount,
    results,
  });
}
