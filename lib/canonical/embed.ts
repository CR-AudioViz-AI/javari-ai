// lib/canonical/embed.ts
// Purpose: Real embedding generation for canonical document chunks.
//          Uses OpenAI text-embedding-3-small (direct or via OpenRouter).
//          Falls back to deterministic hash-based 1536-dim vectors if keys unavailable.
//          Never returns zero vectors. Fully typed. No imports after exports.
// Date: 2026-03-10

import crypto                    from "crypto";
import { getSecret }             from "@/lib/platform-secrets";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmbedResult {
  embedding:  number[];
  model:      string;
  tokenCount: number;
}

// ── Deterministic fallback ────────────────────────────────────────────────────
// Hash the text into a 1536-dim unit vector using SHA-256 seeded expansion.
// Same text always produces same vector — similarity still works within session.

function hashEmbedding(text: string): number[] {
  const seed   = crypto.createHash("sha256").update(text, "utf8").digest();
  const dims   = 1536;
  const result = new Array<number>(dims);
  let   hash   = seed;

  for (let i = 0; i < dims; i++) {
    if (i % 32 === 0 && i > 0) {
      hash = crypto.createHash("sha256").update(hash).digest();
    }
    result[i] = ((hash[i % 32] / 255) * 2) - 1;
  }

  const magnitude = Math.sqrt(result.reduce((s, v) => s + v * v, 0));
  return magnitude > 0 ? result.map(v => v / magnitude) : result;
}

// ── OpenAI direct ─────────────────────────────────────────────────────────────

async function openAIEmbed(texts: string[], apiKey: string): Promise<EmbedResult[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
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
  return data.data.sort((a, b) => a.index - b.index).map(item => ({
    embedding:  item.embedding,
    model:      "text-embedding-3-small",
    tokenCount: tokensEach,
  }));
}

// ── OpenRouter ────────────────────────────────────────────────────────────────

async function openRouterEmbed(texts: string[], apiKey: string): Promise<EmbedResult[]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "openai/text-embedding-3-small", input: texts }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter embed failed ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as {
    data: Array<{ embedding: number[]; index: number }>;
    usage?: { total_tokens: number };
  };
  const tokensEach = Math.round(((data.usage?.total_tokens ?? texts.length * 100)) / texts.length);
  return data.data.sort((a, b) => a.index - b.index).map(item => ({
    embedding:  item.embedding,
    model:      "openai/text-embedding-3-small@openrouter",
    tokenCount: tokensEach,
  }));
}

// ── Public: embedText ─────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const results = await embedBatch([text]);
  return results[0]?.embedding ?? hashEmbedding(text);
}

// ── Public: embedBatch ────────────────────────────────────────────────────────

export async function embedBatch(
  texts:       string[],
  onProgress?: (done: number, total: number) => void,
): Promise<(EmbedResult | null)[]> {
  if (!texts.length) return [];

  let openaiKey     = "";
  let openrouterKey = "";

  try {
    const [k1, k2] = await Promise.all([
      getSecret("OPENAI_API_KEY"),
      getSecret("OPENROUTER_API_KEY"),
    ]);
    openaiKey     = k1?.trim()  ?? "";
    openrouterKey = k2?.trim()  ?? "";
  } catch { /* use hash fallback */ }

  const BATCH_SIZE = 100;
  const results: (EmbedResult | null)[] = new Array(texts.length).fill(null);
  let done = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const slice  = texts.slice(i, i + BATCH_SIZE);
    const offset = i;

    try {
      let batchResults: EmbedResult[];
      if (openaiKey) {
        batchResults = await openAIEmbed(slice, openaiKey);
      } else if (openrouterKey) {
        batchResults = await openRouterEmbed(slice, openrouterKey);
      } else {
        batchResults = slice.map(text => ({
          embedding:  hashEmbedding(text),
          model:      "hash-fallback",
          tokenCount: Math.ceil(text.length / 4),
        }));
      }
      batchResults.forEach((r, j) => { results[offset + j] = r; });
    } catch (err) {
      console.error(`[embed] batch ${i} failed: ${err} — hash fallback`);
      slice.forEach((text, j) => {
        results[offset + j] = {
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
