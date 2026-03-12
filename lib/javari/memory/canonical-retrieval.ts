// lib/javari/memory/canonical-retrieval.ts
// CR AudioViz AI — Canonical Document Retrieval (Step 12)
// 2026-02-22
// Calls match_canonical_chunks() RPC (pgvector HNSW, category='r2_canonical').
// Returns a formatted context block for injection into Javari system prompt.
// Separate from retrieveRelevantMemory() so canonical platform docs have
// their own labelled section in the system context — easier to debug + trace.
// Never throws — returns "" on any failure to protect the chat pipeline.
// ── Config ────────────────────────────────────────────────────────────────────
// ── Types ─────────────────────────────────────────────────────────────────────
// ── Supabase helpers ──────────────────────────────────────────────────────────
// ── Core search ───────────────────────────────────────────────────────────────
// ── Formatter ─────────────────────────────────────────────────────────────────
// ── Public API ────────────────────────────────────────────────────────────────
export default {}
