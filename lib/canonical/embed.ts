// lib/canonical/embed.ts
// CR AudioViz AI — Canonical Document Embedding
// 2026-02-22 — Canonical Document Ingestion System
//
// Uses OpenAI text-embedding-3-small (1536 dims).
// Provider identity not exposed to callers — returns float[] only.
// Uses process.env.OPENAI_API_KEY (already set in Vercel).
// No createLogger — uses structured console output to avoid LogSubsystem constraint.

// ── Config ────────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL     = "text-embedding-3-small";
const EMBEDDING_DIMS      = 1536;
const MAX_INPUT_CHARS     = 32_000;   // ~8k tokens
const RATE_LIMIT_DELAY_MS = 60;       // 60ms → ~1000 RPM; OpenAI limit is 3000 RPM
const TIMEOUT_MS          = 20_000;

function clog(level: "info" | "warn" | "error", msg: string) {
  const ts  = new Date().toISOString();
  console[level](`${ts} [${level.toUpperCase()}][canonical:embed] ${msg}`);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmbedResult {
  embedding:  number[];  // float[] length = 1536
  tokenCount: number;    // prompt tokens consumed
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * embedText — generate a 1536-dim embedding vector for a text string.
 * Retries once on 429 with 2s backoff.
 * Throws on auth error (401/403) — caller should abort.
 * Never throws on input length — truncates silently.
 */
export async function embedText(text: string): Promise<EmbedResult> {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const input = text.slice(0, MAX_INPUT_CHARS).trim();
  if (!input) throw new Error("embedText: empty input");

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body:   JSON.stringify({ model: EMBEDDING_MODEL, input }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 429 && attempt === 0) {
      clog("warn", "Rate limited (429) — waiting 2s before retry");
      await new Promise((r) => setTimeout(r, 2_000));
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`embedText: auth failed (${res.status}) — check OPENAI_API_KEY`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`embedText: API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as {
      data:  Array<{ embedding: number[] }>;
      usage: { prompt_tokens: number };
    };

    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
      throw new Error(
        `embedText: unexpected embedding shape — got ${embedding?.length ?? "null"}, ` +
        `expected ${EMBEDDING_DIMS}`
      );
    }

    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));

    return {
      embedding,
      tokenCount: data.usage?.prompt_tokens ?? 0,
    };
  }

  throw new Error("embedText: failed after 2 attempts");
}

/**
 * embedBatch — embed multiple texts with per-item error isolation.
 * On individual failure: logs + pushes null (caller skips that chunk).
 * Never throws — always returns array of same length as input.
 */
export async function embedBatch(
  texts:       string[],
  onProgress?: (done: number, total: number) => void,
): Promise<(EmbedResult | null)[]> {
  const results: (EmbedResult | null)[] = [];

  for (let i = 0; i < texts.length; i++) {
    try {
      results.push(await embedText(texts[i]));
    } catch (e) {
      clog("error", `embedBatch chunk ${i} failed: ${e instanceof Error ? e.message : e}`);
      results.push(null);
    }
    onProgress?.(i + 1, texts.length);
  }

  return results;
}

export const EMBED_DIMS = EMBEDDING_DIMS;
