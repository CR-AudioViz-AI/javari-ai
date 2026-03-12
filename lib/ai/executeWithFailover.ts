// lib/ai/executeWithFailover.ts
// Purpose: Execute AI requests with vault-backed API key resolution and automatic failover.
//          Keys are fetched from the Platform Secret Authority (Supabase AES-256-GCM vault)
//          first, falling back to process.env only during bootstrap.
//          All provider attempts are logged for execution tracing.
// Date: 2026-03-07 — updated: vault-first key resolution, structured logging
import Anthropic          from "@anthropic-ai/sdk";
import OpenAI             from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSecret }      from "@/lib/platform-secrets/getSecret";
import { classifyCapability } from "@/lib/router/capability-classifier";
import { selectBestModel }    from "@/lib/router/model-registry";
import { logExecution }       from "@/lib/autonomy/executionLogger";
export type AIProvider = "anthropic" | "openai" | "google" | "openrouter";
export interface ExecuteResponse {
// ── Vault-first key resolver ───────────────────────────────────────────────
// Order: in-process cache → Supabase vault AES-256-GCM → process.env fallback
// ── JSON extraction ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// executeWithFailover
// ═══════════════════════════════════════════════════════════════════════════
  // ── OpenAI / OpenRouter ────────────────────────────────────────────────
  // ── Anthropic ─────────────────────────────────────────────────────────
    // Router-selected model: use cheapest capable model unless caller specified one
      // Only use router selection if it resolved to an Anthropic model
  // ── Google Gemini ──────────────────────────────────────────────────────
  // NOTE: Direct Google API is non-functional (org policy 403 on all keys).
  // All Google/Gemini requests are routed through OpenRouter.
  // See: fbd41fb — google: provider set inactive, openrouter equivalents active.
    // Map legacy gemini model IDs to OpenRouter model strings
export default {}
