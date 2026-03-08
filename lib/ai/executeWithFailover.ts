// lib/ai/executeWithFailover.ts
// Purpose: Execute AI requests with vault-backed API key resolution and automatic failover.
//          Keys are fetched from the Platform Secret Authority (Supabase AES-256-GCM vault)
//          first, falling back to process.env only during bootstrap.
//          All provider attempts are logged for execution tracing.
// Date: 2026-03-07 — updated: vault-first key resolution, structured logging

import Anthropic          from "@anthropic-ai/sdk";
import OpenAI             from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSecret }      from "@/lib/platform-secrets/getSecret";
import { classifyCapability } from "@/lib/router/capability-classifier";
import { selectBestModel }    from "@/lib/router/model-registry";
import { logExecution }       from "@/lib/autonomy/executionLogger";

export type AIProvider = "anthropic" | "openai" | "google" | "openrouter";

export interface ExecuteResponse {
  output   : string;
  model?   : string;
  provider?: AIProvider;
  usage?   : {
    prompt_tokens?    : number;
    completion_tokens?: number;
    total_tokens?     : number;
  };
}

// ── Vault-first key resolver ───────────────────────────────────────────────
// Order: in-process cache → Supabase vault AES-256-GCM → process.env fallback

async function resolveKey(
  vaultName   : string,
  envFallback : string
): Promise<string> {
  try {
    const vaultValue = await getSecret(vaultName);
    if (vaultValue && vaultValue.length > 8) {
      console.log(`[failover] 🔐 Key ${vaultName} resolved from vault`);
      return vaultValue;
    }
  } catch (e) {
    console.warn(`[failover] vault miss for ${vaultName}:`, (e as Error).message);
  }
  const envValue = process.env[envFallback] ?? "";
  if (envValue) {
    console.log(`[failover] ⚠️ Key ${vaultName} fell back to process.env.${envFallback}`);
  } else {
    console.error(`[failover] ❌ Key ${vaultName} not found in vault or env`);
  }
  return envValue;
}

// ── JSON extraction ────────────────────────────────────────────────────────

function extractJSON(text: string): unknown | null {
  try { return JSON.parse(text); } catch { /* continue */ }
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const match   = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// executeWithFailover
// ═══════════════════════════════════════════════════════════════════════════

export async function executeWithFailover(
  prompt     : string,
  provider   : AIProvider,
  enforceJSON: boolean = false,
  modelId?   : string,
  taskId?    : string,
  taskType?  : string,
): Promise<ExecuteResponse> {
  const _t0 = Date.now();
  console.log(`[failover] ▶ provider=${provider} model=${modelId ?? "default"} json=${enforceJSON}`);

  // ── OpenAI / OpenRouter ────────────────────────────────────────────────
  if (provider === "openai" || provider === "openrouter") {
    const vaultKey  = provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY";
    const envKey    = provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY";
    const baseURL   = provider === "openrouter" ? "https://openrouter.ai/api/v1" : undefined;
    const apiKey    = await resolveKey(vaultKey, envKey);

    if (!apiKey) throw new Error(`${provider.toUpperCase()} API key not found in vault or env`);

    const client  = new OpenAI({ apiKey, baseURL });
    const model   = modelId ?? (provider === "openai" ? "gpt-4o" : "gpt-4o-2024-11-20");
    const reqOpts: Record<string, unknown> = {
      model,
      messages  : [{ role: "user", content: prompt }],
      temperature: 0.2,
    };
    if (enforceJSON) reqOpts.response_format = { type: "json_object" };

    console.log(`[failover] → OpenAI model=${model}`);
    const completion = await client.chat.completions.create(reqOpts as Parameters<typeof client.chat.completions.create>[0]);
    const content    = completion.choices[0]?.message?.content ?? "";
    let output: unknown = content;
    if (enforceJSON) {
      const extracted = extractJSON(content);
      if (extracted) output = extracted;
    }
    console.log(`[failover] ✅ OpenAI ok | tokens=${completion.usage?.total_tokens ?? 0}`);
    void logExecution({
      task_id       : taskId ?? `failover-${_t0}`,
      model_used    : model,
      cost_estimate : 0,
      execution_time: Date.now() - _t0,
      status        : "success",
      tokens_in     : completion.usage?.prompt_tokens    ?? 0,
      tokens_out    : completion.usage?.completion_tokens ?? 0,
      provider      : provider,
      task_type     : taskType,
    });
    return {
      output  : typeof output === "string" ? output : JSON.stringify(output),
      model,
      provider: provider,
      usage   : {
        prompt_tokens    : completion.usage?.prompt_tokens,
        completion_tokens: completion.usage?.completion_tokens,
        total_tokens     : completion.usage?.total_tokens,
      },
    };
  }

  // ── Anthropic ─────────────────────────────────────────────────────────
  if (provider === "anthropic") {
    const apiKey = await resolveKey("ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not found in vault or env");

    const client = new Anthropic({ apiKey });

    // Router-selected model: use cheapest capable model unless caller specified one
    let anthropicModel = modelId;
    if (!anthropicModel) {
      const capability  = classifyCapability(prompt);
      const best        = selectBestModel(capability);
      // Only use router selection if it resolved to an Anthropic model
      anthropicModel = best.provider === "anthropic"
        ? best.id
        : "claude-haiku-4-5-20251001";  // cheapest capable Anthropic model as default
    }

    console.log(`[failover] → Anthropic model=${anthropicModel}`);
    const message = await client.messages.create({
      model     : anthropicModel,
      max_tokens: 4000,
      temperature: 0.2,
      messages  : [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    let output: unknown = block.type === "text" ? block.text : JSON.stringify(block);
    if (enforceJSON) {
      const extracted = extractJSON(output as string);
      if (extracted) output = extracted;
    }
    const totalTokens = message.usage.input_tokens + message.usage.output_tokens;
    console.log(`[failover] ✅ Anthropic ok | tokens=${totalTokens}`);
    void logExecution({
      task_id       : taskId ?? `failover-${_t0}`,
      model_used    : anthropicModel,
      cost_estimate : 0,
      execution_time: Date.now() - _t0,
      status        : "success",
      tokens_in     : message.usage.input_tokens,
      tokens_out    : message.usage.output_tokens,
      provider      : "anthropic",
      task_type     : taskType,
    });
    return {
      output  : typeof output === "string" ? output : JSON.stringify(output),
      model   : anthropicModel,
      provider: "anthropic",
      usage   : {
        prompt_tokens    : message.usage.input_tokens,
        completion_tokens: message.usage.output_tokens,
        total_tokens     : totalTokens,
      },
    };
  }

  // ── Google Gemini ──────────────────────────────────────────────────────
  // NOTE: Direct Google API is non-functional (org policy 403 on all keys).
  // All Google/Gemini requests are routed through OpenRouter.
  // See: fbd41fb — google: provider set inactive, openrouter equivalents active.
  if (provider === "google") {
    const apiKey  = await resolveKey("OPENROUTER_API_KEY", "OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not found in vault or env — required for Google/Gemini routing");

    const client    = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });
    // Map legacy gemini model IDs to OpenRouter model strings
    const modelMap: Record<string, string> = {
      "gemini-2.0-flash-exp"        : "google/gemini-2.0-flash-001",
      "gemini-1.5-flash"            : "google/gemini-flash-1.5",
      "gemini-1.5-pro"              : "google/gemini-1.5-pro",
      "gemini-2.5-pro"              : "google/gemini-2.5-pro",
      "gemini-2.0-flash-thinking-exp": "google/gemini-2.0-flash-001",
    };
    const googleModel = modelId ?? "gemini-2.0-flash-exp";
    const orModel     = modelMap[googleModel] ?? "google/gemini-2.0-flash-001";

    console.log(`[failover] → Google via OpenRouter model=${orModel} (was ${googleModel})`);
    const reqOpts: Record<string, unknown> = {
      model   : orModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    };
    if (enforceJSON) reqOpts.response_format = { type: "json_object" };

    const completion = await client.chat.completions.create(reqOpts as Parameters<typeof client.chat.completions.create>[0]);
    const content    = completion.choices[0]?.message?.content ?? "";
    let output: unknown = content;
    if (enforceJSON) {
      const extracted = extractJSON(content);
      if (extracted) output = extracted;
    }
    const totalTokens = completion.usage?.total_tokens ?? 0;
    console.log(`[failover] ✅ Google/OR ok | tokens=${totalTokens}`);
    void logExecution({
      task_id       : taskId ?? `failover-${_t0}`,
      model_used    : orModel,
      cost_estimate : 0,
      execution_time: Date.now() - _t0,
      status        : "success",
      tokens_in     : completion.usage?.prompt_tokens    ?? 0,
      tokens_out    : completion.usage?.completion_tokens ?? 0,
      provider      : "openrouter",
      task_type     : taskType,
    });
    return {
      output  : typeof output === "string" ? output : JSON.stringify(output),
      model   : orModel,
      provider: "google",
      usage   : {
        prompt_tokens    : completion.usage?.prompt_tokens,
        completion_tokens: completion.usage?.completion_tokens,
        total_tokens     : totalTokens,
      },
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
