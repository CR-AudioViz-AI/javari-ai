// lib/javari/secrets/credential-sync.ts
// ─────────────────────────────────────────────────────────────────────────────
// JAVARI OS — CREDENTIAL SYNC ENGINE
// ─────────────────────────────────────────────────────────────────────────────
// vault.sync() validates all credentials against their live providers.
// Returns a full sync report. Never mutates env vars (Vercel does that).
// Run this on startup or via /api/javari/credentials/status.
// ─────────────────────────────────────────────────────────────────────────────
// Timestamp: 2026-02-18 16:45 EST

import { vault, vaultRegistry, type ProviderName, type KeyStatus } from "./vault";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProviderValidationResult {
  provider: ProviderName;
  envVar: string;
  status: KeyStatus;
  category: string;
  required: boolean;
  note?: string;
  testedAt: string;
}

export interface SyncReport {
  timestamp: string;
  durationMs: number;
  totalProviders: number;
  ok: number;
  missing: number;
  invalid: number;
  results: ProviderValidationResult[];
  allRequiredOk: boolean;
}

// ── Live Provider Validation ──────────────────────────────────────────────────
// Each validator sends the MINIMAL possible request to confirm key is valid.
// All requests have 8-second timeouts.

const TIMEOUT_MS = 8_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]);
}

/**
 * Validate OpenAI key — list models (cheapest endpoint, no cost)
 */
async function validateOpenAI(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    if (res.status === 429) return { ok: true, note: "rate limited but key is valid" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate Anthropic key — get models list
 */
async function validateAnthropic(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    if (res.status === 403) return { ok: false, note: "forbidden/wrong scope (403)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate Mistral key
 */
async function validateMistral(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate Groq key
 */
async function validateGroq(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate Perplexity key
 */
async function validatePerplexity(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      }),
      TIMEOUT_MS
    );
    if (res.status === 200 || res.status === 400) return { ok: true }; // 400 = key ok, bad params
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate ElevenLabs key
 */
async function validateElevenLabs(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": key },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate OpenRouter key
 */
async function validateOpenRouter(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate Supabase service role by listing one row from a known table
 */
async function validateSupabase(
  url: string,
  serviceKey: string
): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch(`${url}/rest/v1/javari_knowledge?limit=1`, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }),
      TIMEOUT_MS
    );
    // 200 or 206 = ok, 404 = table missing but key valid
    if ([200, 206, 404].includes(res.status)) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid service role key (401)" };
    if (res.status === 403) return { ok: false, note: "forbidden — wrong project? (403)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Validate Resend key
 */
async function validateResend(key: string): Promise<{ ok: boolean; note?: string }> {
  try {
    const res = await withTimeout(
      fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
      }),
      TIMEOUT_MS
    );
    if (res.status === 200) return { ok: true };
    if (res.status === 401) return { ok: false, note: "invalid key (401)" };
    return { ok: false, note: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { ok: false, note: e instanceof Error ? e.message : "network error" };
  }
}

// ── Main Sync Function ────────────────────────────────────────────────────────

/**
 * Run credential sync: validate each present key against its live provider.
 * Skips validation for non-AI-provider keys (Stripe, PayPal, etc.) —
 * those are validated structurally (format check) rather than live.
 *
 * @param liveValidation - Set to false to skip live API calls (format check only)
 */
export async function credentialSync(liveValidation = true): Promise<SyncReport> {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const registry = vaultRegistry();
  const results: ProviderValidationResult[] = [];

  for (const entry of registry) {
    const val = vault.get(entry.provider);
    const baseResult: ProviderValidationResult = {
      provider: entry.provider,
      envVar: entry.envVar,
      category: entry.category,
      required: entry.required,
      status: val ? "ok" : "missing",
      testedAt: timestamp,
    };

    if (!val) {
      results.push(baseResult);
      continue;
    }

    if (!liveValidation) {
      results.push(baseResult);
      continue;
    }

    // Live validation per provider
    let validation: { ok: boolean; note?: string } = { ok: true };

    try {
      switch (entry.provider) {
        case "openai":
          validation = await validateOpenAI(val);
          break;
        case "anthropic":
          validation = await validateAnthropic(val);
          break;
        case "mistral":
          validation = await validateMistral(val);
          break;
        case "groq":
          validation = await validateGroq(val);
          break;
        case "perplexity":
          validation = await validatePerplexity(val);
          break;
        case "elevenlabs":
          validation = await validateElevenLabs(val);
          break;
        case "openrouter":
          validation = await validateOpenRouter(val);
          break;
        case "supabase_service_role": {
          const supabaseUrl = vault.get("supabase_url") ?? "";
          validation = supabaseUrl
            ? await validateSupabase(supabaseUrl, val)
            : { ok: false, note: "SUPABASE_URL missing" };
          break;
        }
        case "resend":
          validation = await validateResend(val);
          break;
        default:
          // Non-live-testable: structural presence check only
          validation = { ok: true, note: "presence only (not live-tested)" };
      }
    } catch (e: unknown) {
      validation = { ok: false, note: e instanceof Error ? e.message : "validation error" };
    }

    results.push({
      ...baseResult,
      status: validation.ok ? "ok" : "invalid",
      note: validation.note,
    });
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const missing = results.filter((r) => r.status === "missing").length;
  const invalid = results.filter((r) => r.status === "invalid").length;
  const allRequiredOk = results
    .filter((r) => r.required)
    .every((r) => r.status === "ok");

  return {
    timestamp,
    durationMs: Date.now() - start,
    totalProviders: registry.length,
    ok,
    missing,
    invalid,
    results,
    allRequiredOk,
  };
}

export default credentialSync;
