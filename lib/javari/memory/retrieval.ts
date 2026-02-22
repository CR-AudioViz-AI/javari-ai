// lib/javari/memory/retrieval.ts
// Retrieves semantically relevant context for Javari chat responses.
// Two-layer retrieval (Step 12 — 2026-02-22):
//
//   Layer 1 — General memory (javari_knowledge, all categories)
//             via match_knowledge_pgvector RPC, top 15, threshold 0.40
//
//   Layer 2 — Canonical platform docs (javari_knowledge, category='r2_canonical')
//             via match_canonical_chunks RPC, top 8, threshold 0.60
//
// Both layers run in parallel. Layer 1 result appears first in context
// (closer to the user message). Layer 2 labelled separately so the LLM
// knows it is authoritative architecture documentation.
//
// Returns "" on any failure — never breaks the chat pipeline.
// Budget: MAX_CONTEXT_CHARS across both layers.
//
// Latency budget:
//   Embed query:        300-500ms
//   Layer 1 RPC:        <100ms (HNSW, 376 rows)
//   Layer 2 RPC:        <100ms (HNSW, 332 canonical rows)
//   Total expected:     ~500-700ms
//
// 2026-02-19 — TASK-P0-004 pgvector optimization
// 2026-02-22 — Step 12: added canonical layer

import { generateEmbedding }       from "./embedding-provider";
import { searchSimilar }           from "./semantic-store";
import { retrieveCanonicalContext } from "./canonical-retrieval";

const TOP_K            = 15;
const MAX_CONTEXT_CHARS = 14_000;   // ~3 500 tokens — increased to fit both layers

export async function retrieveRelevantMemory(userMessage: string): Promise<string> {
  if (!userMessage?.trim()) return "";

  const t0 = Date.now();

  try {
    // ── Step 1: Embed query once — shared across both retrieval layers ────────
    const queryEmbedding = await generateEmbedding(userMessage);
    if (!queryEmbedding) {
      console.info("[Retrieval] Embedding failed — no context");
      return "";
    }
    const embedMs = Date.now() - t0;

    // ── Step 2: Both retrieval layers in parallel ─────────────────────────────
    const [generalChunks, canonicalCtx] = await Promise.all([
      searchSimilar(queryEmbedding, TOP_K, userMessage).catch(() => []),
      retrieveCanonicalContext(queryEmbedding, { topK: 8, threshold: 0.60 }).catch(() => ""),
    ]);

    const retrieveMs = Date.now() - t0 - embedMs;
    console.info(
      `[Retrieval] embed=${embedMs}ms retrieve=${retrieveMs}ms ` +
      `general=${generalChunks.length} canonical=${canonicalCtx.length > 0 ? "yes" : "no"}`
    );

    // ── Step 3: Format general memory context ─────────────────────────────────
    let generalCtx = "";
    if (generalChunks.length > 0) {
      const seen      = new Set<string>();
      const lines: string[] = ["### Retrieved Context (Javari Knowledge):"];
      let usedChars   = lines[0].length;
      const budget    = Math.floor(MAX_CONTEXT_CHARS * 0.55); // 55% to general memory

      for (const chunk of generalChunks) {
        const text = chunk.text?.trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);

        const simNote = chunk.similarity !== undefined
          ? ` (relevance: ${(chunk.similarity * 100).toFixed(0)}%)`
          : "";
        const line = `\n---\n${text}${simNote}`;

        if (usedChars + line.length > budget) break;
        lines.push(line);
        usedChars += line.length;
      }

      if (lines.length > 1) generalCtx = lines.join("");
    }

    // ── Step 4: Combine — general first, canonical second ─────────────────────
    const parts: string[] = [];
    if (generalCtx)  parts.push(generalCtx);
    if (canonicalCtx) parts.push(canonicalCtx);

    if (!parts.length) return "";

    const combined = parts.join("\n\n");
    console.info(
      `[Retrieval] total=${Date.now() - t0}ms context_chars=${combined.length}`
    );
    return combined;

  } catch (err) {
    console.error("[Retrieval] Unexpected error:", err);
    return "";
  }
}
