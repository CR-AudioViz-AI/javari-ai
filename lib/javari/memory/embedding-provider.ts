// lib/javari/memory/embedding-provider.ts
// Generates 1536-dim embeddings via OpenAI text-embedding-3-small
// Consistent with existing javari_knowledge table (44 rows already embedded)
// Retry-safe: never throws — returns null on failure

const EMBEDDING_MODEL = "text-embedding-3-small";
const EXPECTED_DIMS = 1536;
const MAX_CHARS = 8000;
const MAX_RETRIES = 2;

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[EmbeddingProvider] OPENAI_API_KEY not set");
    return null;
  }
  const input = text.trim().substring(0, MAX_CHARS);
  if (!input) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
      });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 429 && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        console.warn(`[EmbeddingProvider] API ${res.status}:`, err.slice(0, 120));
        return null;
      }
      const data = await res.json() as { data: Array<{ embedding: number[] }> };
      const emb = data?.data?.[0]?.embedding;
      if (!Array.isArray(emb) || emb.length !== EXPECTED_DIMS) {
        console.warn("[EmbeddingProvider] Unexpected shape:", emb?.length);
        return null;
      }
      return emb;
    } catch (err) {
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      else console.error("[EmbeddingProvider] All retries failed:", err);
    }
  }
  return null;
}

export const embeddingProvider = { generateEmbedding };
