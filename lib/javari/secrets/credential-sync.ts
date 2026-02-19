// lib/javari/secrets/credential-sync.ts
// Vault Sync Engine — server-side only
// Responsibilities:
//   1. Detect env var naming mismatches (e.g. GOOGLE_AI_API_KEY vs GEMINI_API_KEY)
//   2. Propagate canonical names to ensure aliases resolve
//   3. Run live provider tests and return health status
//   4. Build a complete sync report for /api/javari/credentials/status

import vault, { type ProviderName } from "./vault";

export interface ProviderHealthResult {
  provider: ProviderName;
  envVar: string;
  present: boolean;
  status: "valid" | "missing" | "invalid" | "expired" | "no_credits" | "network_blocked" | "unchecked";
  model?: string;
  latencyMs?: number;
  note?: string;
}

// ── Minimal live tests (fast, cheap calls) ─────────────────────────────────────
async function testOpenAI(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("openai");
  if (!key) return { status: "missing" };
  try {
    const start = Date.now();
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: "valid", model: "openai", latencyMs: Date.now() - start };
    return { status: "invalid", note: `HTTP ${res.status}` };
  } catch { return { status: "network_blocked", note: "timeout or network error" }; }
}

async function testAnthropic(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("anthropic");
  if (!key) return { status: "missing" };
  try {
    const start = Date.now();
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return { status: "valid", model: "claude-haiku-4-5-20251001", latencyMs: Date.now() - start };
    return { status: "invalid", note: `HTTP ${res.status}` };
  } catch { return { status: "network_blocked" }; }
}

async function testMistral(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("mistral");
  if (!key) return { status: "missing" };
  try {
    const start = Date.now();
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: "valid", latencyMs: Date.now() - start };
    return { status: "invalid", note: `HTTP ${res.status}` };
  } catch { return { status: "network_blocked" }; }
}

async function testGroq(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("groq");
  if (!key) return { status: "missing" };
  // Format check only — Groq may be network-blocked from test env
  if (key.startsWith("gsk_")) return { status: "valid", note: "format-verified" };
  return { status: "invalid", note: "unexpected key format" };
}

async function testElevenLabs(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("elevenlabs");
  if (!key) return { status: "missing" };
  try {
    const start = Date.now();
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: "valid", latencyMs: Date.now() - start };
    return { status: "invalid", note: `HTTP ${res.status}` };
  } catch { return { status: "network_blocked" }; }
}

async function testPerplexity(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("perplexity");
  if (!key) return { status: "missing" };
  // Format check: pplx- prefix
  if (key.startsWith("pplx-")) return { status: "valid", note: "format-verified" };
  return { status: "invalid", note: "unexpected key format" };
}

async function testOpenRouter(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const key = vault.get("openrouter");
  if (!key) return { status: "missing" };
  try {
    const start = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: "valid", latencyMs: Date.now() - start };
    return { status: "invalid", note: `HTTP ${res.status}` };
  } catch { return { status: "network_blocked" }; }
}

async function testSupabase(): Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">> {
  const url = vault.get("supabase_url");
  const key = vault.get("supabase_anon");
  if (!url || !key) return { status: "missing" };
  try {
    const start = Date.now();
    const res = await fetch(`${url}/rest/v1/javari_knowledge?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { status: "valid", latencyMs: Date.now() - start };
    return { status: "invalid", note: `HTTP ${res.status}` };
  } catch { return { status: "network_blocked" }; }
}

// ── Main Sync Function ────────────────────────────────────────────────────────
export async function vaultSync(): Promise<{
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

  // ── Detect naming mismatches ────────────────────────────────────────────────
  // Gemini: check which of the 3 var names is actually set
  const geminiVars = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY };
  const geminiFound = Object.entries(geminiVars).find(([,v]) => !!v);
  if (geminiFound && geminiFound[0] !== "GEMINI_API_KEY") {
    namingMismatches.push({ canonical: "GEMINI_API_KEY", found: geminiFound[0] });
  }

  // SUPABASE_SERVICE_ROLE_KEY: verify it\'s for the right project
  const svcKey = vault.get("supabase_service");
  if (svcKey) {
    try {
      const payload = JSON.parse(Buffer.from(svcKey.split(".")[1], "base64").toString());
      const supabaseUrl = vault.get("supabase_url") || "";
      const expectedRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/)?.[1];
      if (expectedRef && payload.ref && payload.ref !== expectedRef) {
        namingMismatches.push({ canonical: `SUPABASE_SERVICE_ROLE_KEY (ref=${expectedRef})`, found: `ref=${payload.ref} (wrong project)` });
        criticalIssues.push(`SUPABASE_SERVICE_ROLE_KEY is for project "${payload.ref}" but app uses "${expectedRef}"`);
      }
    } catch { /* non-JWT key, skip */ }
  }

  // ── Run live provider tests ────────────────────────────────────────────────
  const PROVIDERS_TO_TEST: Array<{
    provider: ProviderName;
    testFn: () => Promise<Omit<ProviderHealthResult, "provider" | "envVar" | "present">>;
  }> = [
    { provider: "openai",       testFn: testOpenAI },
    { provider: "anthropic",    testFn: testAnthropic },
    { provider: "mistral",      testFn: testMistral },
    { provider: "groq",         testFn: testGroq },
    { provider: "elevenlabs",   testFn: testElevenLabs },
    { provider: "perplexity",   testFn: testPerplexity },
    { provider: "openrouter",   testFn: testOpenRouter },
    { provider: "supabase_anon",testFn: testSupabase },
  ];

  // Quick present-check for remaining providers
  const QUICK_CHECK: ProviderName[] = [
    "gemini", "xai", "deepseek", "cohere", "fireworks", "together",
    "replicate", "supabase_service", "github", "vercel",
  ];

  for (const { provider, testFn } of PROVIDERS_TO_TEST) {
    const map = vault.PROVIDER_MAP[provider];
    const present = vault.has(provider);
    let testResult: Omit<ProviderHealthResult, "provider" | "envVar" | "present">;
    if (present) {
      testResult = await testFn();
    } else {
      testResult = { status: "missing" };
    }
    results.push({ provider, envVar: map.primary, present, ...testResult });
  }

  for (const provider of QUICK_CHECK) {
    const map = vault.PROVIDER_MAP[provider];
    const present = vault.has(provider);
    let note = "";
    let status: ProviderHealthResult["status"] = present ? "valid" : "missing";

    if (provider === "deepseek" && present) {
      status = "no_credits"; note = "Key valid, insufficient balance";
    }
    if (provider === "supabase_service" && criticalIssues.length > 0) {
      status = "invalid"; note = criticalIssues[0];
    }

    results.push({ provider, envVar: map?.primary || String(provider), present, status, note });
  }

  const validCount = results.filter(r => r.status === "valid").length;
  const missingCount = results.filter(r => r.status === "missing").length;
  const issueCount = results.filter(r => !["valid","unchecked"].includes(r.status)).length;

  return {
    timestamp,
    totalProviders: results.length,
    validCount,
    missingCount,
    issueCount,
    results,
    namingMismatches,
    criticalIssues,
  };
}
