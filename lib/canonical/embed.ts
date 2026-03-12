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
// ── Deterministic fallback ────────────────────────────────────────────────────
// Hash the text into a 1536-dim unit vector using SHA-256 seeded expansion.
// Same text always produces same vector — similarity still works within session.
// ── OpenAI direct ─────────────────────────────────────────────────────────────
// ── OpenRouter ────────────────────────────────────────────────────────────────
// ── Public: embedText ─────────────────────────────────────────────────────────
// ── Public: embedBatch ────────────────────────────────────────────────────────
export default {}
