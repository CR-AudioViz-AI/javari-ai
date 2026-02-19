// lib/javari/memory/retrieval.ts
// Retrieves semantically relevant R2 Canonical + knowledge base context
// Returns "" on any failure — never breaks the chat pipeline
// Budget: MAX_CONTEXT_CHARS to keep token usage manageable

import { generateEmbedding } from "./embedding-provider";
import { searchSimilar } from "./semantic-store";

const TOP_K = 15;
const MAX_CONTEXT_CHARS = 10_000; // ~2,500 tokens

export async function retrieveRelevantMemory(userMessage: string): Promise<string> {
  if (!userMessage?.trim()) return "";

  try {
    // Step 1: Embed the query
    const queryEmbedding = await generateEmbedding(userMessage);
    if (!queryEmbedding) {
      console.info("[Retrieval] Embedding failed — no memory context");
      return "";
    }

    // Step 2: Search for similar knowledge chunks
    const chunks = await searchSimilar(queryEmbedding, TOP_K, userMessage);
    if (!chunks.length) return "";

    // Step 3: Format as system context block
    const seen = new Set<string>();
    const lines: string[] = ["### Retrieved Context (Javari R2 Knowledge):"];
    let totalChars = lines[0].length;

    for (const chunk of chunks) {
      const text = chunk.text?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);

      const simNote = chunk.similarity !== undefined
        ? ` (relevance: ${(chunk.similarity * 100).toFixed(0)}%)`
        : "";
      const line = `\n---\n${text}${simNote}`;

      if (totalChars + line.length > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length;
    }

    if (lines.length <= 1) return "";
    return lines.join("");
  } catch (err) {
    console.error("[Retrieval] Unexpected error:", err);
    return "";
  }
}
