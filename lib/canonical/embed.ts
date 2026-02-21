// lib/canonical/embed.ts
// CR AudioViz AI — Canonical Document Embedding
// 2026-02-22 — Canonical Document Ingestion System
//
// Wraps OpenAI text-embedding-3-small (1536 dimensions).
// Provider identity not exposed externally — callers receive float[] only.
// Respects existing OPENAI_API_KEY env var used by the rest of the platform.
// Rate limiting: 50ms sleep between calls to stay within OpenAI 3000 RPM limit.

import { createLogger } from "@/lib/observability/logger";

const log = createLogger("canonical:embed");

// ── Config ────────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL   = "text-embedding-3-small";
const EMBEDDING_DIMS    = 1536;
const MAX_INPUT_CHARS   = 32_000;   // ~8k tokens — model hard limit
const RATE_LIMIT_DELAY_MS = 50;     // 50ms between calls → max 1200 RPM
const TIMEOUT_MS        = 20_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmbedResult {
  embedding:  number[];   // float32 array, length = EMBEDDING_DIMS
  tokenCount: number;     // tokens consumed (from API response)
  model:      string;     // model used (internal use only)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (!key) throw new Error("OPENAI_API_KEY not configured — cannot generate embeddings");
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Core embed function ───────────────────────────────────────────────────────

/**
 * embedText — generate a 1536-dim embedding vector for a text chunk.
 *
 * @param text   The chunk text to embed (truncated to MAX_INPUT_CHARS if needed)
 * @returns      EmbedResult with float[] or throws on unrecoverable error
 *
 * Safety:
 * - Truncates input if too long (never throws on length)
 * - Retries once on 429 (rate limit) with 2s backoff
 * - Throws on auth failures (401, 403) — caller should abort
 * - Throws on server errors (5xx) after retry
 */
export async function embedText(text: string): Promise<EmbedResult> {
  const apiKey   = getApiKey();
  const input    = text.slice(0, MAX_INPUT_CHARS).trim();

  if (!input) throw new Error("embedText: empty input");

  let attempt = 0;

  while (attempt < 2) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type":  "application/json",
        },
        body:   JSON.stringify({ model: EMBEDDING_MODEL, input }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status === 429) {
        // Rate limited — wait 2s then retry once
        log.warn("embedText: rate limited (429) — waiting 2s");
        await sleep(2_000);
        attempt++;
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        throw new Error(`embedText: authentication failed (${res.status}) — check OPENAI_API_KEY`);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`embedText: API error ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json() as {
        data:  Array<{ embedding: number[] }>;
        usage: { prompt_tokens: number; total_tokens: number };
        model: string;
      };

      const embedding = data?.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
        throw new Error(`embedText: unexpected embedding shape — got ${embedding?.length ?? "null"}, expected ${EMBEDDING_DIMS}`);
      }

      // Throttle to respect rate limits
      await sleep(RATE_LIMIT_DELAY_MS);

      return {
        embedding,
        tokenCount: data.usage?.prompt_tokens ?? 0,
        model:      data.model ?? EMBEDDING_MODEL,
      };

    } catch (e) {
      if (attempt === 0 && (e instanceof Error) && e.name === "TimeoutError") {
        log.warn("embedText: timeout — retrying");
        attempt++;
        continue;
      }
      throw e;
    }
  }

  throw new Error("embedText: failed after 2 attempts");
}

/**
 * embedBatch — embed multiple texts with rate limiting between each.
 * On individual failure: logs error and pushes null to results (caller skips).
 * Never throws — always returns an array of the same length as input.
 */
export async function embedBatch(
  texts:    string[],
  onProgress?: (done: number, total: number) => void
): Promise<(EmbedResult | null)[]> {
  const results: (EmbedResult | null)[] = [];

  for (let i = 0; i < texts.length; i++) {
    try {
      const result = await embedText(texts[i]);
      results.push(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      log.error(`embedBatch: chunk ${i} failed — ${msg}`);
      results.push(null);
    }
    onProgress?.(i + 1, texts.length);
  }

  return results;
}

// Export dimension constant for callers that need to validate
export const EMBED_DIMS = EMBEDDING_DIMS;
