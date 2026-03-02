// app/api/admin/run-migration/route.ts
// TEMPORARY: Create model_registry table + seed 11 models + add registry_version to executions
// Delete after migration succeeds

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

ALTER TABLE ai_router_executions ADD COLUMN IF NOT EXISTS registry_version TEXT;
`;

const SEED_SQL = `
INSERT INTO model_registry (provider, model, reasoning, json_reliability, code_quality, multimodal, streaming, tools, cost_input, cost_output, latency_class, cost_tier, enabled, registry_version)
VALUES
  ('groq','llama-3.3-70b-versatile',3,3,3,false,true,false,0,0,'fast','free',true,'v1.0'),
  ('groq','llama-3.1-8b-instant',2,2,2,false,true,false,0,0,'fast','free',true,'v1.0'),
  ('openai','gpt-4o-mini',3,4,3,true,true,true,0.00015,0.0006,'medium','low',true,'v1.0'),
  ('openai','o4-mini',5,4,5,false,true,true,0.0011,0.0044,'slow','medium',true,'v1.0'),
  ('openai','o3',5,4,5,false,false,true,0.01,0.04,'slow','high',true,'v1.0'),
  ('anthropic','claude-sonnet-4-20250514',5,4,5,true,true,true,0.003,0.015,'medium','medium',true,'v1.0'),
  ('mistral','mistral-small-latest',3,5,3,false,true,true,0.0001,0.0003,'medium','low',true,'v1.0'),
  ('mistral','mistral-large-latest',4,5,4,false,true,true,0.002,0.006,'medium','medium',true,'v1.0'),
  ('openrouter','meta-llama/llama-3.3-70b-instruct',3,3,3,false,true,false,0.00059,0.00079,'medium','low',true,'v1.0'),
  ('xai','grok-2',3,3,3,true,true,true,0.002,0.01,'medium','medium',true,'v1.0'),
  ('perplexity','llama-3.1-sonar-large-128k-online',3,2,2,false,true,false,0.001,0.001,'medium','low',true,'v1.0')
ON CONFLICT (provider, model) DO NOTHING;
`;

const VERIFY_SQL = `
SELECT
  (SELECT count(*) FROM model_registry) as total_models,
  (SELECT count(*) FROM model_registry WHERE enabled = true) as enabled_models,
  (SELECT count(DISTINCT provider) FROM model_registry) as providers,
  (SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_router_executions' AND column_name = 'registry_version' LIMIT 1) as exec_col;
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

  const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${mgmtToken}` };

  // Step 1: Create table + add column
  const r1 = await fetch(mgmtUrl, { method: "POST", headers, body: JSON.stringify({ query: CREATE_TABLE_SQL }) });
  if (!r1.ok) {
    return Response.json({ error: "Create table failed", detail: (await r1.text()).slice(0, 300) }, { status: 500 });
  }

  // Step 1b: Grant access + reload PostgREST schema cache
  const grantSql = `
    GRANT ALL ON model_registry TO service_role;
    GRANT ALL ON model_registry TO anon;
    GRANT ALL ON model_registry TO authenticated;
    NOTIFY pgrst, 'reload schema';
  `;
  await fetch(mgmtUrl, { method: "POST", headers, body: JSON.stringify({ query: grantSql }) });

  // Step 2: Seed models
  const r2 = await fetch(mgmtUrl, { method: "POST", headers, body: JSON.stringify({ query: SEED_SQL }) });
  if (!r2.ok) {
    return Response.json({ error: "Seed failed", detail: (await r2.text()).slice(0, 300) }, { status: 500 });
  }

  // Step 3: Verify
  const r3 = await fetch(mgmtUrl, { method: "POST", headers, body: JSON.stringify({ query: VERIFY_SQL }) });
  const verify = r3.ok ? await r3.json() : null;

  // Step 4: Read all models back
  const r4 = await fetch(mgmtUrl, { method: "POST", headers, body: JSON.stringify({ query: "SELECT provider, model, reasoning, json_reliability, code_quality, enabled, registry_version FROM model_registry ORDER BY provider, model;" }) });
  const models = r4.ok ? await r4.json() : [];

  return Response.json({
    success: true,
    duration_ms: Date.now() - t0,
    verify: verify?.[0] ?? null,
    models,
  });
}
