// lib/javari/providers.ts
// Javari Provider Registry — vault-powered, edge-safe.
// All API key access goes through vault.get() — no direct process.env calls.
// Timestamp: 2026-02-19 09:50 EST — fixed named import
import { vault, type ProviderName } from "./secrets/vault";
export interface JavariProvider {
// ── SSE stream helpers ─────────────────────────────────────────────────────
// ── OpenAI ────────────────────────────────────────────────────────────────
// ── Anthropic ─────────────────────────────────────────────────────────────
// ── Mistral ───────────────────────────────────────────────────────────────
// ── OpenRouter ────────────────────────────────────────────────────────────
// ── Groq ──────────────────────────────────────────────────────────────────
// ── Perplexity via OpenRouter (avoids Cloudflare interference on direct API) ──
// ── xAI / Grok (OpenAI-compatible API) ───────────────────────────────────────
export default {}
