// lib/orchestrator/modelBenchmark.ts
// Purpose: Benchmarks models across accuracy, latency, cost, and success rate.
//          Results stored in javari_model_benchmarks table. Used by router and
//          costOptimizer to make data-driven routing decisions.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";
import { ORCHESTRATOR_REGISTRY, OrchestratorModel } from "./modelRegistry";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  model_id     : string;
  provider     : string;
  benchmark_id : string;
  task_type    : string;
  prompt_tokens: number;
  output_tokens: number;
  latency_ms   : number;
  cost_usd     : number;
  success      : boolean;
  score        : number;    // 0-100
  error?       : string;
  timestamp    : string;
}

export interface ModelBenchmarkSummary {
  model_id       : string;
  provider       : string;
  display_name   : string;
  avg_score      : number;
  avg_latency_ms : number;
  avg_cost_usd   : number;
  success_rate   : number;
  total_runs     : number;
  task_scores    : Record<string, number>;
  last_benchmark : string;
  tier           : string;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Auto-migration ────────────────────────────────────────────────────────

export async function ensureBenchmarkTable(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const stmts = [
    `CREATE TABLE IF NOT EXISTS javari_model_benchmarks (
      id            text        PRIMARY KEY,
      model_id      text        NOT NULL,
      provider      text        NOT NULL,
      benchmark_id  text        NOT NULL,
      task_type     text        NOT NULL,
      prompt_tokens integer     NOT NULL DEFAULT 0,
      output_tokens integer     NOT NULL DEFAULT 0,
      latency_ms    integer     NOT NULL DEFAULT 0,
      cost_usd      numeric(10,8) NOT NULL DEFAULT 0,
      success       boolean     NOT NULL DEFAULT true,
      score         integer     NOT NULL DEFAULT 0,
      error         text,
      timestamp     timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bench_model ON javari_model_benchmarks(model_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bench_ts ON javari_model_benchmarks(timestamp DESC)`,
    `ALTER TABLE javari_model_benchmarks DISABLE ROW LEVEL SECURITY`,
    `GRANT ALL ON TABLE javari_model_benchmarks TO service_role,authenticated,anon`,
  ];
  for (const sql of stmts) {
    try {
      await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method : "POST",
        headers: { "Content-Type":"application/json", apikey:key, Authorization:`Bearer ${key}` },
        body   : JSON.stringify({ sql: sql + ";" }),
        signal : AbortSignal.timeout(8_000),
      });
    } catch { /* non-fatal */ }
  }
}

// ── Record result ──────────────────────────────────────────────────────────

export async function recordBenchmarkResult(r: BenchmarkResult): Promise<void> {
  await ensureBenchmarkTable();
  const { error } = await db().from("javari_model_benchmarks").insert({
    id           : `bm-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    model_id     : r.model_id, provider: r.provider, benchmark_id: r.benchmark_id,
    task_type    : r.task_type, prompt_tokens: r.prompt_tokens, output_tokens: r.output_tokens,
    latency_ms   : r.latency_ms, cost_usd: r.cost_usd, success: r.success,
    score        : r.score, error: r.error ?? null, timestamp: r.timestamp,
  });
  if (error) console.warn(`[benchmark] record: ${error.message}`);
}

// ── Benchmark prompts per task type ───────────────────────────────────────

const BENCHMARK_PROMPTS: Record<string, string> = {
  coding    : "Write a TypeScript function that validates an email address using regex. Return only the function.",
  analysis  : "In 2 sentences, explain the difference between REST and GraphQL APIs.",
  reasoning : "A train travels 120km in 90 minutes. What is its speed in km/h? Show your work.",
  fast_qa   : "What is the capital of France?",
  security  : "List 3 common SQL injection prevention techniques in one sentence each.",
};

// ── Benchmark one model ───────────────────────────────────────────────────

export async function benchmarkModel(
  model    : OrchestratorModel,
  taskType : string = "fast_qa",
  apiKeys  : Record<string, string> = {}
): Promise<BenchmarkResult> {
  const prompt      = BENCHMARK_PROMPTS[taskType] ?? BENCHMARK_PROMPTS.fast_qa;
  const benchmarkId = `bench-${Date.now()}`;
  const t0          = Date.now();
  const timestamp   = new Date().toISOString();
  const apiKey      = apiKeys[model.provider] ?? "";

  if (!apiKey && model.cost_per_1k_tokens > 0) {
    return { model_id:model.id, provider:model.provider, benchmark_id:benchmarkId,
      task_type:taskType, prompt_tokens:0, output_tokens:0, latency_ms:0,
      cost_usd:0, success:false, score:0, error:`No API key for ${model.provider}`, timestamp };
  }

  try {
    let response = "";
    const promptTokens = Math.ceil(prompt.length / 4);
    const messages = [{ role:"user" as const, content: prompt }];

    const openAICall = async (url: string, key: string) => {
      const res = await fetch(url, {
        method:"POST",
        headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json" },
        body: JSON.stringify({ model:model.model_id, messages, max_tokens:256 }),
        signal: AbortSignal.timeout(15_000),
      });
      const d = await res.json() as { choices?: Array<{message?:{content?:string}}>; error?:{message?:string} };
      if (!res.ok) throw new Error(d.error?.message ?? `HTTP ${res.status}`);
      return d.choices?.[0]?.message?.content ?? "";
    };

    switch (model.provider) {
      case "groq"      : response = await openAICall("https://api.groq.com/openai/v1/chat/completions", apiKey); break;
      case "openrouter": response = await openAICall("https://openrouter.ai/api/v1/chat/completions", apiKey); break;
      case "openai"    : response = await openAICall("https://api.openai.com/v1/chat/completions", apiKey); break;
      case "deepseek"  : response = await openAICall("https://api.deepseek.com/chat/completions", apiKey); break;
      case "mistral"   : response = await openAICall("https://api.mistral.ai/v1/chat/completions", apiKey); break;
      case "together"  : response = await openAICall("https://api.together.xyz/v1/chat/completions", apiKey); break;
      case "fireworks" : response = await openAICall("https://api.fireworks.ai/inference/v1/chat/completions", apiKey); break;
      case "xai"       : response = await openAICall("https://api.x.ai/v1/chat/completions", apiKey); break;
      case "perplexity": response = await openAICall("https://api.perplexity.ai/chat/completions", apiKey); break;
      case "cohere"    : response = await openAICall("https://api.cohere.ai/compatibility/v1/chat/completions", apiKey); break;
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method:"POST",
          headers:{ "x-api-key":apiKey, "anthropic-version":"2023-06-01", "Content-Type":"application/json" },
          body: JSON.stringify({ model:model.model_id, max_tokens:256, messages }),
          signal: AbortSignal.timeout(20_000),
        });
        const d = await res.json() as { content?:Array<{text?:string}>; error?:{message?:string} };
        if (!res.ok) throw new Error(d.error?.message ?? `HTTP ${res.status}`);
        response = d.content?.[0]?.text ?? ""; break;
      }
      case "google": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${apiKey}`,
          { method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:256} }),
            signal: AbortSignal.timeout(20_000) }
        );
        const d = await res.json() as { candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>; error?:{message?:string} };
        if (!res.ok) throw new Error(d.error?.message ?? `HTTP ${res.status}`);
        response = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ""; break;
      }
      default: response = await openAICall("https://openrouter.ai/api/v1/chat/completions", apiKey);
    }

    const latencyMs    = Date.now() - t0;
    const outputTokens = Math.ceil(response.length / 4);
    const costUsd      = (promptTokens + outputTokens) / 1000 * model.cost_per_1k_tokens;
    const hasContent   = response.trim().length > 10;
    const score        = Math.round(Math.min(100,
      (hasContent ? 30 : 0) +
      Math.min(response.length / 3, 40) +
      Math.max(0, 30 - latencyMs / 100)
    ));

    return { model_id:model.id, provider:model.provider, benchmark_id:benchmarkId,
      task_type:taskType, prompt_tokens:promptTokens, output_tokens:outputTokens,
      latency_ms:latencyMs, cost_usd:costUsd, success:true, score, timestamp };

  } catch (err) {
    return { model_id:model.id, provider:model.provider, benchmark_id:benchmarkId,
      task_type:taskType, prompt_tokens:0, output_tokens:0,
      latency_ms:Date.now()-t0, cost_usd:0, success:false, score:0,
      error:String(err), timestamp };
  }
}

// ── Run benchmark suite ───────────────────────────────────────────────────

export async function runBenchmarkSuite(opts: {
  providers? : string[];
  taskTypes? : string[];
  maxModels? : number;
  apiKeys?   : Record<string, string>;
  parallel?  : number;
}): Promise<{ results: BenchmarkResult[]; summary: ModelBenchmarkSummary[] }> {
  await ensureBenchmarkTable();
  const {
    providers = ["groq","openrouter","google"],
    taskTypes = ["fast_qa","coding","analysis"],
    maxModels = 20,
    apiKeys   = {},
    parallel  = 5,
  } = opts;

  const models = ORCHESTRATOR_REGISTRY
    .filter(m => m.active && providers.includes(m.provider))
    .slice(0, maxModels);

  const allResults: BenchmarkResult[] = [];
  for (let i = 0; i < models.length; i += parallel) {
    const batch      = models.slice(i, i + parallel);
    const taskType   = taskTypes[i % taskTypes.length];
    const batchRes   = await Promise.allSettled(batch.map(m => benchmarkModel(m, taskType, apiKeys)));
    for (const r of batchRes) {
      if (r.status === "fulfilled") {
        allResults.push(r.value);
        await recordBenchmarkResult(r.value).catch(() => {});
      }
    }
    if (i + parallel < models.length) await new Promise(r => setTimeout(r, 300));
  }
  return { results: allResults, summary: buildBenchmarkSummary(allResults) };
}

// ── Build summary ─────────────────────────────────────────────────────────

export function buildBenchmarkSummary(results: BenchmarkResult[]): ModelBenchmarkSummary[] {
  const byModel = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    if (!byModel.has(r.model_id)) byModel.set(r.model_id, []);
    byModel.get(r.model_id)!.push(r);
  }
  return Array.from(byModel.entries()).map(([model_id, runs]) => {
    const ok          = runs.filter(r => r.success);
    const successRate = Math.round(ok.length / runs.length * 100);
    const avgScore    = ok.length ? Math.round(ok.reduce((s,r)=>s+r.score,0)/ok.length) : 0;
    const avgLatency  = Math.round(runs.reduce((s,r)=>s+r.latency_ms,0)/runs.length);
    const avgCost     = ok.reduce((s,r)=>s+r.cost_usd,0)/Math.max(1,ok.length);
    const taskScores: Record<string,number> = {};
    for (const r of ok) taskScores[r.task_type] = r.score;
    const model = ORCHESTRATOR_REGISTRY.find(m => m.id === model_id);
    return { model_id, provider:runs[0].provider, display_name:model?.display_name ?? model_id,
      avg_score:avgScore, avg_latency_ms:avgLatency, avg_cost_usd:avgCost,
      success_rate:successRate, total_runs:runs.length, task_scores:taskScores,
      last_benchmark:runs[runs.length-1]?.timestamp ?? "", tier:model?.tier ?? "unknown" };
  }).sort((a,b) => b.avg_score - a.avg_score);
}

// ── Load historical summaries ─────────────────────────────────────────────

export async function loadBenchmarkSummaries(): Promise<ModelBenchmarkSummary[]> {
  await ensureBenchmarkTable();
  const { data, error } = await db()
    .from("javari_model_benchmarks").select("*")
    .order("timestamp",{ ascending:false }).limit(500);
  if (error || !data) return [];
  return buildBenchmarkSummary(data as BenchmarkResult[]);
}
