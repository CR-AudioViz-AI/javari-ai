// lib/javari/memory/retrieval.ts
// Retrieves semantically relevant R2 Canonical + knowledge base context
// Returns "" on any failure — never breaks the chat pipeline
//
// PERF: Uses pgvector native HNSW index via match_knowledge_pgvector RPC
// Expected latency: < 500ms (was 15-19s with JS cosine loop over 281 rows)
//
// Budget: MAX_CONTEXT_CHARS to keep token usage manageable (~2,500 tokens)
// 2026-02-19 — TASK-P0-004 pgvector optimization

import { generateEmbedding } from "./embedding-provider";
import { searchSimilar } from "./semantic-store";

const TOP_K = 15;
const MAX_CONTEXT_CHARS = 10_000; // ~2,500 tokens

export async function retrieveRelevantMemory(userMessage: string): Promise<string> {
  if (!userMessage?.trim()) return "";

  const t0 = Date.now();

  try {
    // Step 1: Embed the query (~300-500ms via OpenAI text-embedding-3-small)
    const queryEmbedding = await generateEmbedding(userMessage);
    if (!queryEmbedding) {
      console.info("[Retrieval] Embedding failed — no memory context");
      return "";
    }

    const embedMs = Date.now() - t0;

    // Step 2: Search via pgvector HNSW index (<100ms for 281 rows)
    const chunks = await searchSimilar(queryEmbedding, TOP_K, userMessage);

    const searchMs = Date.now() - t0 - embedMs;
    console.info(
      `[Retrieval] embed=${embedMs}ms search=${searchMs}ms chunks=${chunks.length}`
    );

    if (!chunks.length) return "";

    // Step 3: Format as system context block
    const seen = new Set<string>();
    const lines: string[] = ["### Retrieved Context (Javari R2 Knowledge):"];
    let totalChars = lines[0].length;

    for (const chunk of chunks) {
      const text = chunk.text?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);

      const simNote =
        chunk.similarity !== undefined
          ? ` (relevance: ${(chunk.similarity * 100).toFixed(0)}%)`
          : "";
      const line = `\n---\n${text}${simNote}`;

      if (totalChars + line.length > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length;
    }

    if (lines.length <= 1) return "";

    console.info(
      `[Retrieval] total=${Date.now() - t0}ms context_chars=${totalChars}`
    );
    return lines.join("");
  } catch (err) {
    console.error("[Retrieval] Unexpected error:", err);
    return "";
  }
}
