// lib/javari/memory/embedding-provider.ts
// Generates 1536-dim embeddings via OpenAI text-embedding-3-small
// Consistent with lib/autonomous-enhanced/embeddings.ts (same model)
// Safe: never throws — returns null on failure

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_INPUT_CHARS = 8000;
const MAX_RETRIES = 2;

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  error?: { message: string };
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[EmbeddingProvider] OPENAI_API_KEY not configured");
    return null;
  }

  const input = text.trim().substring(0, MAX_INPUT_CHARS);
  if (!input) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[EmbeddingProvider] API error ${res.status}:`, errText);
        if (res.status === 429 && attempt < MAX_RETRIES) {
          await delay(1000 * (attempt + 1));
          continue;
        }
        return null;
      }

      const data: OpenAIEmbeddingResponse = await res.json();
      const embedding = data?.data?.[0]?.embedding;

      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        console.warn("[EmbeddingProvider] Unexpected embedding shape");
        return null;
      }

      return embedding;
    } catch (err) {
      console.error(`[EmbeddingProvider] Attempt ${attempt + 1} failed:`, err);
      if (attempt < MAX_RETRIES) {
        await delay(500 * (attempt + 1));
      }
    }
  }

  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const embeddingProvider = { generateEmbedding };
