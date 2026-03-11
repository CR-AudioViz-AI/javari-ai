// lib/javari/router.ts
// Purpose: Universal Javari AI Router — single entry point for ALL AI calls on the platform.
//          Accepts a task type + prompt, selects the cheapest capable model, routes to the
//          correct provider, logs telemetry, and returns a clean result.
//
// Task types and their model strategy:
//   simple_task        → cheapest fast model (Groq Llama, GPT-4o-mini, Haiku)
//   reasoning_task     → Claude Sonnet / GPT-4o (deep reasoning required)
//   code_task          → strongest coding model (Claude Sonnet — best TypeScript)
//   validation_task    → DIFFERENT model than engineer (GPT-4o-mini or Groq for second opinion)
//   documentation_task → cheap LLM (GPT-4o-mini, Haiku, or Groq)
//
// Provider support: Anthropic, OpenAI, Groq, Mistral, Together, Ollama, Replicate, DeepInfra
// Architecture supports 300+ models via model registry.
//
// Usage:
//   import { JavariRouter } from "@/lib/javari/router";
//   const result = await JavariRouter.generate({ taskType: "code_task", prompt: "..." });
//
// Date: 2026-03-11

import { createClient } from "@supabase/supabase-js";
import { getSecret }    from "@/lib/platform-secrets/getSecret";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaskType =
  | "simple_task"
  | "reasoning_task"
  | "code_task"
  | "validation_task"
  | "documentation_task";

export type ProviderName =
  | "anthropic"
  | "openai"
  | "groq"
  | "mistral"
  | "together"
  | "ollama"
  | "replicate"
  | "deepinfra";

export interface RouterRequest {
  taskType   : TaskType;
  prompt     : string;
  system?    : string;
  context?   : Record<string, unknown>;
  maxTokens? : number;
  forceModel?: string;         // Override model selection
  forceProvider?: ProviderName; // Override provider selection
  json?      : boolean;        // Request JSON output
}

export interface RouterResult {
  ok          : boolean;
  content     : string;
  provider    : ProviderName;
  model       : string;
  taskType    : TaskType;
  tokensIn    : number;
  tokensOut   : number;
  costUsd     : number;
  latencyMs   : number;
  error?      : string;
}

// ── Model Strategy Table ──────────────────────────────────────────────────────
// Maps task type → ordered list of [provider, model] to try.
// First entry is primary; subsequent entries are fallbacks.

interface ModelOption {
  provider  : ProviderName;
  model     : string;
  costPer1k : number;  // USD blended (input+output avg)
}

const MODEL_STRATEGY: Record<TaskType, ModelOption[]> = {
  // Cheapest capable model — speed over depth
  simple_task: [
    { provider: "groq",      model: "llama-3.3-70b-versatile",    costPer1k: 0.0003 },
    { provider: "groq",      model: "llama3-8b-8192",              costPer1k: 0.0001 },
    { provider: "openai",    model: "gpt-4o-mini",                 costPer1k: 0.000375 },
    { provider: "anthropic", model: "claude-haiku-4-5-20251001",   costPer1k: 0.001 },
    { provider: "anthropic", model: "claude-sonnet-4-20250514",    costPer1k: 0.009 },
  ],
  // Deep reasoning — Claude or GPT-4o class
  reasoning_task: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514",    costPer1k: 0.009 },
    { provider: "openai",    model: "gpt-4o",                      costPer1k: 0.00625 },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022",  costPer1k: 0.009 },
    { provider: "groq",      model: "llama-3.3-70b-versatile",     costPer1k: 0.0003 },
  ],
  // Strongest code generation — Claude first
  code_task: [
    { provider: "anthropic", model: "claude-sonnet-4-20250514",    costPer1k: 0.009 },
    { provider: "anthropic", model: "claude-3-5-sonnet-20241022",  costPer1k: 0.009 },
    { provider: "openai",    model: "gpt-4o",                      costPer1k: 0.00625 },
    { provider: "groq",      model: "llama-3.3-70b-versatile",     costPer1k: 0.0003 },
  ],
  // Validation — intentionally different from engineer (GPT-4o-mini or Groq)
  validation_task: [
    { provider: "openai",    model: "gpt-4o-mini",                 costPer1k: 0.000375 },
    { provider: "groq",      model: "llama-3.3-70b-versatile",     costPer1k: 0.0003 },
    { provider: "mistral",   model: "mistral-small-latest",        costPer1k: 0.001 },
    { provider: "anthropic", model: "claude-haiku-4-5-20251001",   costPer1k: 0.001 },
  ],
  // Documentation — cheap LLM is sufficient
  documentation_task: [
    { provider: "openai",    model: "gpt-4o-mini",                 costPer1k: 0.000375 },
    { provider: "groq",      model: "llama-3.3-70b-versatile",     costPer1k: 0.0003 },
    { provider: "anthropic", model: "claude-haiku-4-5-20251001",   costPer1k: 0.001 },
    { provider: "anthropic", model: "claude-sonnet-4-20250514",    costPer1k: 0.009 },
  ],
};

// ── API key resolver ───────────────────────────────────────────────────────────

async function resolveApiKey(provider: ProviderName): Promise<string> {
  const keyMap: Record<ProviderName, string[]> = {
    anthropic : ["ANTHROPIC_API_KEY"],
    openai    : ["OPENAI_API_KEY"],
    groq      : ["GROQ_API_KEY"],
    mistral   : ["MISTRAL_API_KEY"],
    together  : ["TOGETHER_API_KEY", "TOGETHER_AI_API_KEY"],
    ollama    : ["OLLAMA_API_KEY"],
    replicate : ["REPLICATE_API_TOKEN", "REPLICATE_API_KEY"],
    deepinfra : ["DEEPINFRA_API_KEY"],
  };

  const names = keyMap[provider] ?? [];
  for (const name of names) {
    const val = await getSecret(name).catch(() => "") || process.env[name] || "";
    if (val) return val;
  }
  return "";
}

// ── Provider call implementations ─────────────────────────────────────────────

async function callAnthropic(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = await resolveApiKey("anthropic");
  if (!apiKey) throw new Error("[router] Anthropic API key unavailable");

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system: system || "You are Javari AI, the CR AudioViz AI platform assistant.",
    messages: [{ role: "user", content: json ? `${prompt}\n\nRespond with valid JSON only. No markdown.` : prompt }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[router] Anthropic ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = d.content.filter(b => b.type === "text").map(b => b.text ?? "").join("").trim();
  return {
    content,
    tokensIn  : d.usage?.input_tokens  ?? 0,
    tokensOut : d.usage?.output_tokens ?? 0,
  };
}

async function callOpenAI(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = await resolveApiKey("openai");
  if (!apiKey) throw new Error("[router] OpenAI API key unavailable");

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system || "You are Javari AI, the CR AudioViz AI platform assistant." },
      { role: "user",   content: prompt },
    ],
  };

  if (json) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[router] OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content   : d.choices[0]?.message?.content?.trim() ?? "",
    tokensIn  : d.usage?.prompt_tokens     ?? 0,
    tokensOut : d.usage?.completion_tokens ?? 0,
  };
}

async function callGroq(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = await resolveApiKey("groq");
  if (!apiKey) throw new Error("[router] Groq API key unavailable");

  const body: Record<string, unknown> = {
    model,
    max_tokens: Math.min(maxTokens, 8192), // Groq cap
    messages: [
      { role: "system", content: system || "You are Javari AI." },
      { role: "user",   content: prompt },
    ],
  };

  if (json) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[router] Groq ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content   : d.choices[0]?.message?.content?.trim() ?? "",
    tokensIn  : d.usage?.prompt_tokens     ?? 0,
    tokensOut : d.usage?.completion_tokens ?? 0,
  };
}

async function callMistral(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  _json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = await resolveApiKey("mistral");
  if (!apiKey) throw new Error("[router] Mistral API key unavailable");

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system || "You are Javari AI." },
        { role: "user",   content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[router] Mistral ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content   : d.choices[0]?.message?.content?.trim() ?? "",
    tokensIn  : d.usage?.prompt_tokens     ?? 0,
    tokensOut : d.usage?.completion_tokens ?? 0,
  };
}

async function callTogether(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  _json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = await resolveApiKey("together");
  if (!apiKey) throw new Error("[router] Together API key unavailable");

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system || "You are Javari AI." },
        { role: "user",   content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[router] Together ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content   : d.choices[0]?.message?.content?.trim() ?? "",
    tokensIn  : d.usage?.prompt_tokens     ?? 0,
    tokensOut : d.usage?.completion_tokens ?? 0,
  };
}

async function callOllama(
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  _json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      options: { num_predict: maxTokens },
      messages: [
        { role: "system", content: system || "You are Javari AI." },
        { role: "user",   content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[router] Ollama ${res.status}: ${t.slice(0, 200)}`);
  }

  const d = await res.json() as {
    message: { content: string };
    eval_count?: number;
    prompt_eval_count?: number;
  };

  return {
    content   : d.message?.content?.trim() ?? "",
    tokensIn  : d.prompt_eval_count ?? 0,
    tokensOut : d.eval_count        ?? 0,
  };
}

async function callReplicate(
  model: string,
  _system: string,
  prompt: string,
  maxTokens: number,
  _json: boolean
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const apiKey = await resolveApiKey("replicate");
  if (!apiKey) throw new Error("[router] Replicate API token unavailable");

  // Replicate uses a predictions API — create then poll
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${apiKey}`,
    },
    body: JSON.stringify({
      version: model,
      input: { prompt, max_new_tokens: maxTokens },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!createRes.ok) {
    const t = await createRes.text();
    throw new Error(`[router] Replicate create ${createRes.status}: ${t.slice(0, 200)}`);
  }

  const prediction = await createRes.json() as { id: string; urls: { get: string } };
  const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;

  // Poll up to 30 times (60s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { "Authorization": `Token ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    const poll = await pollRes.json() as { status: string; output?: string[] };
    if (poll.status === "succeeded") {
      const content = Array.isArray(poll.output) ? poll.output.join("") : String(poll.output ?? "");
      return { content: content.trim(), tokensIn: 0, tokensOut: 0 };
    }
    if (poll.status === "failed" || poll.status === "canceled") {
      throw new Error(`[router] Replicate prediction ${poll.status}`);
    }
  }

  throw new Error("[router] Replicate prediction timed out");
}

// ── Provider dispatch table ───────────────────────────────────────────────────

type ProviderFn = (
  model: string,
  system: string,
  prompt: string,
  maxTokens: number,
  json: boolean
) => Promise<{ content: string; tokensIn: number; tokensOut: number }>;

const PROVIDER_DISPATCH: Record<ProviderName, ProviderFn> = {
  anthropic : callAnthropic,
  openai    : callOpenAI,
  groq      : callGroq,
  mistral   : callMistral,
  together  : callTogether,
  ollama    : callOllama,
  replicate : callReplicate,
  deepinfra : async (model, system, prompt, maxTokens, _json) => {
    // DeepInfra uses OpenAI-compatible API
    const apiKey = await resolveApiKey("deepinfra");
    if (!apiKey) throw new Error("[router] DeepInfra API key unavailable");
    const res = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        messages: [
          { role: "system", content: system || "You are Javari AI." },
          { role: "user",   content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`[router] DeepInfra ${res.status}: ${t.slice(0, 200)}`); }
    const d = await res.json() as { choices: Array<{ message: { content: string } }>; usage: { prompt_tokens: number; completion_tokens: number } };
    return { content: d.choices[0]?.message?.content?.trim() ?? "", tokensIn: d.usage?.prompt_tokens ?? 0, tokensOut: d.usage?.completion_tokens ?? 0 };
  },
};

// ── Telemetry logger ──────────────────────────────────────────────────────────

function dbClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

async function logTelemetry(result: RouterResult): Promise<void> {
  try {
    const client = dbClient();
    await client.from("ai_router_logs").insert({
      task_type : result.taskType,
      provider  : result.provider,
      model_used: result.model,
      tokens_in : result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd  : result.costUsd,
      latency_ms: result.latencyMs,
      ok        : result.ok,
      error     : result.error ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal — telemetry must never block execution
  }
}

// ── Main router ───────────────────────────────────────────────────────────────

async function generate(req: RouterRequest): Promise<RouterResult> {
  const t0 = Date.now();

  const { taskType, prompt, system = "", context, maxTokens = 8000, forceModel, forceProvider, json = false } = req;

  // Build strategy list — respect force overrides
  let strategy: ModelOption[] = MODEL_STRATEGY[taskType] ?? MODEL_STRATEGY.simple_task;

  if (forceProvider) {
    strategy = strategy.filter(m => m.provider === forceProvider);
    if (strategy.length === 0) {
      // Provider not in strategy — use first model from that provider in any strategy
      const fallbackModel = Object.values(MODEL_STRATEGY).flat().find(m => m.provider === forceProvider);
      if (fallbackModel) strategy = [fallbackModel];
      else strategy = MODEL_STRATEGY[taskType];
    }
  }

  if (forceModel) {
    const found = strategy.find(m => m.model === forceModel);
    if (found) strategy = [found, ...strategy.filter(m => m.model !== forceModel)];
  }

  // Enrich prompt with context if provided
  const enrichedPrompt = context && Object.keys(context).length > 0
    ? `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`
    : prompt;

  let lastError = "";

  // Try each model in strategy order
  for (const option of strategy) {
    const dispatchFn = PROVIDER_DISPATCH[option.provider];
    if (!dispatchFn) continue;

    try {
      console.log(`[router] ${taskType} → ${option.provider}:${option.model}`);

      const response = await dispatchFn(
        option.model,
        system,
        enrichedPrompt,
        maxTokens,
        json
      );

      const latencyMs = Date.now() - t0;
      const totalTokens = response.tokensIn + response.tokensOut;
      const costUsd = (totalTokens / 1000) * option.costPer1k;

      const result: RouterResult = {
        ok       : true,
        content  : response.content,
        provider : option.provider,
        model    : option.model,
        taskType,
        tokensIn : response.tokensIn,
        tokensOut: response.tokensOut,
        costUsd,
        latencyMs,
      };

      await logTelemetry(result);
      console.log(`[router] ✅ ${option.provider}:${option.model} — ${latencyMs}ms $${costUsd.toFixed(5)}`);
      return result;

    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[router] ⚠️ ${option.provider}:${option.model} failed: ${lastError.slice(0, 120)} — trying next`);
    }
  }

  // All providers failed
  const latencyMs = Date.now() - t0;
  const result: RouterResult = {
    ok: false, content: "", provider: strategy[0]?.provider ?? "anthropic",
    model: strategy[0]?.model ?? "unknown", taskType, tokensIn: 0, tokensOut: 0,
    costUsd: 0, latencyMs, error: lastError,
  };

  await logTelemetry(result);
  console.error(`[router] ❌ All providers exhausted for ${taskType}: ${lastError}`);
  return result;
}

// ── Map artifact type to task type ────────────────────────────────────────────

export function artifactTypeToTaskType(artifactType: string): TaskType {
  switch (artifactType) {
    case "generate_documentation": return "documentation_task";
    case "generate_tests":         return "simple_task";
    case "create_database_migration": return "code_task";
    case "generate_ui_component":  return "code_task";
    case "generate_api":           return "code_task";
    case "create_service":         return "code_task";
    case "build_module":           return "code_task";
    case "deploy_microservice":    return "code_task";
    default:                       return "code_task";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const JavariRouter = { generate, artifactTypeToTaskType };
export default JavariRouter;
