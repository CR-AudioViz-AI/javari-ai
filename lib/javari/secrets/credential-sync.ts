// lib/javari/secrets/credential-sync.ts
// Credential health checker — edge-safe, no crypto imports.
// Runs live provider tests and returns structured health report.
// Called by /api/javari/credentials/status

import vault, { type ProviderName } from "./vault";

export interface ProviderHealthResult {
  provider: string;
  envVar: string;
  present: boolean;
  status: "valid" | "missing" | "invalid" | "expired" | "no_credits" | "network_blocked" | "unchecked";
  latencyMs?: number;
  note?: string;
}

// ── Minimal live provider tests ─────────────────────────────────────────────
async function testProvider(
  provider: ProviderName,
  testFn: (key: string) => Promise<{ ok: boolean; note?: string; latencyMs?: number }>
): Promise<Pick<ProviderHealthResult, "status" | "latencyMs" | "note">> {
  const key = vault.get(provider);
  if (!key) return { status: "missing" };
  try {
    const result = await testFn(key);
    return result.ok
      ? { status: "valid", latencyMs: result.latencyMs, note: result.note }
      : { status: "invalid", note: result.note };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) {
      return { status: "network_blocked", note: msg.slice(0, 80) };
    }
    return { status: "invalid", note: msg.slice(0, 80) };
  }
}

export async function vaultSync(options?: { liveTests?: boolean }): Promise<{
  timestamp: string;
  totalProviders: number;
  validCount: number;
  missingCount: number;
  issueCount: number;
  results: ProviderHealthResult[];
  namingMismatches: Array<{ canonical: string; found: string }>;
  criticalIssues: string[];
}> {
  const timestamp = new Date().toISOString();
  const results: ProviderHealthResult[] = [];
  const namingMismatches: Array<{ canonical: string; found: string }> = [];
  const criticalIssues: string[] = [];
  const liveTests = options?.liveTests ?? true;

  // ── Naming mismatch detection ───────────────────────────────────────────────
  // Gemini has 3 possible var names
  if (!process.env.GEMINI_API_KEY) {
    if (process.env.GOOGLE_AI_API_KEY)
      namingMismatches.push({ canonical: "GEMINI_API_KEY", found: "GOOGLE_AI_API_KEY" });
    else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      namingMismatches.push({ canonical: "GEMINI_API_KEY", found: "GOOGLE_GENERATIVE_AI_API_KEY" });
  }

  // Supabase service role project mismatch check
  const svcKey = vault.get("supabase_service");
  const supabaseUrl = vault.get("supabase_url") ?? "";
  if (svcKey && supabaseUrl) {
    try {
      const payload = JSON.parse(
        Buffer.from(svcKey.split(".")[1] ?? "", "base64url").toString()
      );
      const expectedRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1];
      if (expectedRef && payload.ref && payload.ref !== expectedRef) {
        const issue = `SUPABASE_SERVICE_ROLE_KEY is for project "${payload.ref}" but app uses "${expectedRef}"`;
        criticalIssues.push(issue);
        namingMismatches.push({
          canonical: `SUPABASE_SERVICE_ROLE_KEY (project: ${expectedRef})`,
          found: `JWT ref="${payload.ref}" (wrong project)`,
        });
      }
    } catch { /* non-JWT key — skip check */ }
  }

  // ── Live provider test definitions ─────────────────────────────────────────
  const LIVE_TESTS: Array<{
    provider: ProviderName;
    test: (key: string) => Promise<{ ok: boolean; note?: string; latencyMs?: number }>;
  }> = [
    {
      provider: "openai",
      test: async (key) => {
        const t = Date.now();
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t, note: res.ok ? "models endpoint" : `HTTP ${res.status}` };
      },
    },
    {
      provider: "anthropic",
      test: async (key) => {
        const t = Date.now();
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
          signal: AbortSignal.timeout(10000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t, note: res.ok ? "claude-haiku" : `HTTP ${res.status}` };
      },
    },
    {
      provider: "mistral",
      test: async (key) => {
        const t = Date.now();
        const res = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t };
      },
    },
    {
      provider: "openrouter",
      test: async (key) => {
        const t = Date.now();
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t };
      },
    },
    {
      provider: "elevenlabs",
      test: async (key) => {
        const t = Date.now();
        const res = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": key },
          signal: AbortSignal.timeout(8000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t };
      },
    },
    {
      provider: "supabase_anon",
      test: async (key) => {
        const url = vault.get("supabase_url") ?? "";
        if (!url) return { ok: false, note: "supabase_url missing" };
        const t = Date.now();
        const res = await fetch(`${url}/rest/v1/javari_knowledge?select=id&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t };
      },
    },
  ];

  // ── Format-only checks (no network) ────────────────────────────────────────
  const FORMAT_CHECKS: Array<{ provider: ProviderName; prefix: string }> = [
    { provider: "groq",        prefix: "gsk_" },
    { provider: "xai",         prefix: "xai-" },
    { provider: "perplexity",  prefix: "pplx-" },
    { provider: "deepseek",    prefix: "sk-" },
    { provider: "replicate",   prefix: "r8_" },
  ];

  // ── Quick-presence checks ───────────────────────────────────────────────────
  const PRESENCE_ONLY: ProviderName[] = [
    "cohere","fireworks","together","huggingface","stripe","paypal",
    "supabase_service","github","vercel","encryption_key","jwt_secret","cron_secret",
  ];

  // Run live tests
  const providerMap = vault.PROVIDER_MAP;
  for (const { provider, test } of LIVE_TESTS) {
    const map = providerMap[provider];
    const testResult = liveTests
      ? await testProvider(provider, test)
      : { status: vault.has(provider) ? "unchecked" as const : "missing" as const };
    results.push({ provider, envVar: map.primary, present: vault.has(provider), ...testResult });
  }

  // Format checks
  for (const { provider, prefix } of FORMAT_CHECKS) {
    const map = providerMap[provider];
    const key = vault.get(provider);
    const present = !!key;
    let status: ProviderHealthResult["status"] = present ? "valid" : "missing";
    let note = "";
    if (present && !key.startsWith(prefix)) { status = "invalid"; note = `Expected prefix "${prefix}"`; }
    if (provider === "deepseek" && present) { status = "no_credits"; note = "Key present — verify balance"; }
    results.push({ provider, envVar: map.primary, present, status, note });
  }

  // Presence-only checks
  for (const provider of PRESENCE_ONLY) {
    const map = providerMap[provider];
    const present = vault.has(provider);
    let status: ProviderHealthResult["status"] = present ? "valid" : "missing";
    let note = "";
    if (provider === "supabase_service" && criticalIssues.length > 0) {
      status = "invalid"; note = criticalIssues[0].slice(0, 80);
    }
    results.push({ provider, envVar: map?.primary ?? String(provider), present, status, note });
  }

  const validCount   = results.filter(r => r.status === "valid").length;
  const missingCount = results.filter(r => r.status === "missing").length;
  const issueCount   = results.filter(r => !["valid","unchecked"].includes(r.status)).length;

  return { timestamp, totalProviders: results.length, validCount, missingCount, issueCount, results, namingMismatches, criticalIssues };
}
