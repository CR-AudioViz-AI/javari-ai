// lib/canonical/chunker.ts
// CR AudioViz AI — Canonical Markdown Chunker
// 2026-02-22 PART 2
// Deterministic: same input always produces the same output.
// No external dependencies.
export interface Chunk {
export interface ChunkOptions {
// ─── Internal helpers ─────────────────────────────────────────────────────────
    // New section starts on any ## or ### heading
// ─── Public API ───────────────────────────────────────────────────────────────
  // Normalise line endings
      // If one paragraph alone exceeds maxChars — hard-split it first
        // Flush buffer first
        // Flush current buffer and start fresh with this paragraph
    // Flush remaining buffer for this section
  // Build output — filter empty, assign indices
export default {}
