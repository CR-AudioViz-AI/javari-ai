// app/api/javari/providers/test/route.ts
// POST /api/javari/providers/test — live provider health test
// Tests: groq, openai, anthropic, mistral, openrouter, xai, perplexity
// Returns latency + success/failure per provider
// Auth: CRON_SECRET required

import { NextRequest, NextResponse } from "next/server";
import { vault } from "@/lib/javari/secrets/vault";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

const PROVIDER_CONFIGS = [
  { name: "groq",       url: "https://api.groq.com/openai/v1/chat/completions",    model: "llama-3.1-8b-instant",          vaultKey: "groq" as const },
  { name: "openai",     url: "https://api.openai.com/v1/chat/completions",          model: "gpt-4o-mini",                   vaultKey: "openai" as const },
  { name: "anthropic",  url: "https://api.anthropic.com/v1/messages",              model: "claude-3-haiku-20240307",        vaultKey: "anthropic" as const },
  { name: "mistral",    url: "https://api.mistral.ai/v1/chat/completions",          model: "mistral-tiny",                  vaultKey: "mistral" as const },
  { name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions",       model: "openai/gpt-4o-mini",            vaultKey: "openrouter" as const },
  { name: "xai",        url: "https://api.x.ai/v1/chat/completions",               model: "grok-2-latest",                 vaultKey: "xai" as const },
  { name: "perplexity", url: "https://openrouter.ai/api/v1/chat/completions",       model: "perplexity/llama-3.1-sonar-small-128k-online", vaultKey: "openrouter" as const },
] as const;

const TEST_PROMPT = "Reply with one word: operational";

async function testProvider(cfg: typeof PROVIDER_CONFIGS[number]): Promise<{
  ok: boolean; latency: number; error?: string; model: string;
}> {
  const apiKey = vault.get(cfg.vaultKey);
  if (!apiKey) return { ok: false, latency: 0, error: "Key missing in vault", model: cfg.model };

  const t0 = Date.now();
  try {
    let body: Record<string, unknown>;
    let headers: Record<string, string>;

    if (cfg.name === "anthropic") {
      body = { model: cfg.model, max_tokens: 10, messages: [{ role: "user", content: TEST_PROMPT }] };
      headers = { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
    } else {
      body = { model: cfg.model, messages: [{ role: "user", content: TEST_PROMPT }], max_tokens: 10 };
      headers = { Authorization: \`Bearer \${apiKey}\`, "Content-Type": "application/json",
        ...(cfg.name === "openrouter" || cfg.name === "perplexity"
          ? { "HTTP-Referer": "https://craudiovizai.com", "X-Title": "Javari AI" }
          : {}),
      };
    }

    const res = await fetch(cfg.url, { method: "POST", headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000) });

    const latency = Date.now() - t0;
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, latency, error: \`HTTP \${res.status}: \${txt.slice(0, 120)}\`, model: cfg.model };
    }
    return { ok: true, latency, model: cfg.model };
  } catch (err) {
    return { ok: false, latency: Date.now() - t0,
      error: err instanceof Error ? err.message.slice(0, 120) : "Unknown error",
      model: cfg.model };
  }
}

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization") ?? "";
  if (CRON_SECRET && auth !== \`Bearer \${CRON_SECRET}\`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { providers?: string[] };
  const requested = body.providers ?? PROVIDER_CONFIGS.map((c) => c.name);

  const configs = PROVIDER_CONFIGS.filter((c) => requested.includes(c.name));

  const results = await Promise.allSettled(configs.map((c) => testProvider(c)));

  const output: Record<string, unknown> = {};
  results.forEach((r, i) => {
    const name = configs[i].name;
    if (r.status === "fulfilled") {
      output[name] = r.value;
    } else {
      output[name] = { ok: false, latency: 0, error: r.reason?.message ?? "Promise rejected" };
    }
  });

  const allOk = Object.values(output).every((v) => (v as {ok:boolean}).ok);
  const okCount = Object.values(output).filter((v) => (v as {ok:boolean}).ok).length;

  return NextResponse.json({
    success: allOk,
    results: output,
    summary: { total: configs.length, ok: okCount, failed: configs.length - okCount },
    testedAt: new Date().toISOString(),
  });
}
