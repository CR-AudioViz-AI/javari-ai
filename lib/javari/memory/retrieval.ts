// lib/javari/memory/retrieval.ts
// Retrieves semantically relevant memory for a given user message
// Output: formatted context string prepended to Javari's system prompt
// Safe: returns "" on any failure — pipeline never breaks

import { generateEmbedding } from "./embedding-provider";
import { searchSimilar } from "./semantic-store";

const TOP_K = 15;
const MAX_CONTEXT_CHARS = 12_000; // ~3,000 tokens — budget cap

export async function retrieveRelevantMemory(
  userMessage: string
): Promise<string> {
  if (!userMessage?.trim()) return "";

  try {
    // Step 1: Embed the user query
    const queryEmbedding = await generateEmbedding(userMessage);
    if (!queryEmbedding) {
      console.info("[Retrieval] Could not embed query — skipping memory");
      return "";
    }

    // Step 2: Search for similar chunks
    const chunks = await searchSimilar(queryEmbedding, TOP_K, userMessage);
    if (!chunks.length) return "";

    // Step 3: Format as system context — deduplicate, trim to budget
    const seen = new Set<string>();
    const lines: string[] = ["### Retrieved Context (R2 Canonical Knowledge):"];
    let totalChars = lines[0].length;

    for (const chunk of chunks) {
      const text = chunk.text?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);

      const docRef = chunk.doc_id ? `[${chunk.doc_id}] ` : "";
      const line = `${docRef}${text}`;

      if (totalChars + line.length + 1 > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length + 1;
    }

    if (lines.length <= 1) return ""; // only header, no real content

    return lines.join("
");
  } catch (err) {
    // Total safety net — memory failure must NEVER crash chat
    console.error("[Retrieval] Unexpected error:", err);
    return "";
  }
}
