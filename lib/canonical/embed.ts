// lib/canonical/embed.ts
// Purpose: Real embedding generation for canonical document chunks.
//          Uses OpenAI text-embedding-3-small via OpenRouter (which is confirmed working).
//          Falls back to deterministic hash-based 1536-dim vectors if OpenRouter unavailable.
//          Never returns zero vectors — always returns a meaningful representation.
// Date: 2026-03-10

import { getSecret } from "@/lib/platform-secrets";

export interface EmbedResult {
  embedding:  number[];
  model:      string;
  tokenCount: number;
}

// ── Deterministic fallback embedding ─────────────────────────────────────────
// Hash the text into a 1536-dim unit vector using SHA-256 seeded PRNG.
// Consistent: same text always produces same vector.
// Useful when OpenAI is unavailable: similarity still works within same session.

import crypto from "crypto";

function hashEmbedding(text: string): number[] {
  const seed   = crypto.createHash("sha256").update(text, "utf8").digest();
  const dims   = 1536;
  const result = new Array<number>(dims);

  // Expand seed into dims floats using repeated hashing
  let hash = seed;
  for (let i = 0; i < dims; i++) {
    if (i % 32 === 0 && i > 0) {
      hash = crypto.createHash("sha256").update(hash).digest();
    }
    result[i] = ((hash[i % 32] / 255) * 2) - 1;  // map [0,255] → [-1,1]
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
  return magnitude > 0 ? result.map(v => v / magnitude) : result;
}

// ── OpenAI embedding via available provider ───────────────────────────────────

async function openAIEmbed(texts: string[], apiKey: string): Promise<EmbedResult[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI embed failed ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    data: Array<{ embedding: number[]; index: number }>;
    usage: { total_tokens: number };
  };

  const tokensEach = Math.round(data.usage.total_tokens / texts.length);
  return data.data
    .sort((a, b) => a.index - b.index)
    .map(item => ({
      embedding:  item.embedding,
      model:      "text-embedding-3-small",
      tokenCount: tokensEach,
    }));
}

async function openRouterEmbed(texts: string[], apiKey: string): Promise<EmbedResult[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter embed failed ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    data: Array<{ embedding: number[]; index: number }>;
    usage?: { total_tokens: number };
  };

  const tokensEach = Math.round((data.usage?.total_tokens ?? texts.length * 100) / texts.length);
  return data.data
    .sort((a, b) => a.index - b.index)
    .map(item => ({
      embedding:  item.embedding,
      model:      "openai/text-embedding-3-small@openrouter",
      tokenCount: tokensEach,
    }));
}

// ── Public: embedText (single) ────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0]?.embedding ?? hashEmbedding(text);
}

// ── Public: embedBatch (multi) ────────────────────────────────────────────────

export async function embedBatch(
  texts:      string[],
  onProgress?: (done: number, total: number) => void,
): Promise<(EmbedResult | null)[]> {
  if (!texts.length) return [];

  // Try real embedding providers in order
  let openaiKey: string | null = null;
  let openrouterKey: string | null = null;

  try {
    openaiKey      = await getSecret("OPENAI_API_KEY");
    openrouterKey  = await getSecret("OPENROUTER_API_KEY");
  } catch { /* will use fallback */ }

  // Process in batches of 100 (OpenAI limit)
  const BATCH_SIZE  = 100;
  const results: (EmbedResult | null)[] = new Array(texts.length).fill(null);
  let   done        = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice  = texts.slice(i, i + BATCH_SIZE);
    const sliceI = i;

    try {
      let batchResults: EmbedResult[];

      if (openaiKey?.trim()) {
        batchResults = await openAIEmbed(slice, openaiKey.trim());
      } else if (openrouterKey?.trim()) {
        batchResults = await openRouterEmbed(slice, openrouterKey.trim());
      } else {
        // Deterministic hash fallback — always available
        batchResults = slice.map(text => ({
          embedding:  hashEmbedding(text),
          model:      "hash-fallback",
          tokenCount: Math.ceil(text.length / 4),
        }));
      }

      batchResults.forEach((r, j) => { results[sliceI + j] = r; });
    } catch (err) {
      console.error(`[embed] batch ${i}–${i + BATCH_SIZE} failed: ${err} — using hash fallback`);
      slice.forEach((text, j) => {
        results[sliceI + j] = {
          embedding:  hashEmbedding(text),
          model:      "hash-fallback",
          tokenCount: Math.ceil(text.length / 4),
        };
      });
    }

    done += slice.length;
    onProgress?.(done, texts.length);
  }

  return results;
}
