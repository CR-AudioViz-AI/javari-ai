// lib/javari/memory/retrieval.ts
// Retrieves semantically relevant context for Javari chat responses.
// Two-layer retrieval (Step 12 — 2026-02-22):
//   Layer 1 — General memory (javari_knowledge, all categories)
//             via match_knowledge_pgvector RPC, top 15, threshold 0.40
//   Layer 2 — Canonical platform docs (javari_knowledge, category='r2_canonical')
//             via match_canonical_chunks RPC, top 8, threshold 0.60
// Both layers run in parallel. Layer 1 result appears first in context
// (closer to the user message). Layer 2 labelled separately so the LLM
// knows it is authoritative architecture documentation.
// Returns "" on any failure — never breaks the chat pipeline.
// Budget: MAX_CONTEXT_CHARS across both layers.
// Latency budget:
//   Embed query:        300-500ms
//   Layer 1 RPC:        <100ms (HNSW, 376 rows)
//   Layer 2 RPC:        <100ms (HNSW, 332 canonical rows)
//   Total expected:     ~500-700ms
// 2026-02-19 — TASK-P0-004 pgvector optimization
// 2026-02-22 — Step 12: added canonical layer
import { generateEmbedding }       from "./embedding-provider";
import { searchSimilar }           from "./semantic-store";
import { retrieveCanonicalContext } from "./canonical-retrieval";
    // ── Step 1: Embed query once — shared across both retrieval layers ────────
    // ── Step 2: Both retrieval layers in parallel ─────────────────────────────
    // ── Step 3: Format general memory context ─────────────────────────────────
    // ── Step 4: Combine — general first, canonical second ─────────────────────
export default {}
