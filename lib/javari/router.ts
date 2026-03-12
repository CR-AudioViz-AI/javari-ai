// lib/javari/router.ts
// Purpose: Universal Javari AI Router — single entry point for ALL AI calls on the platform.
//          Accepts a task type + prompt, selects the cheapest capable model, routes to the
//          correct provider, logs telemetry, and returns a clean result.
// Task types and their model strategy:
//   simple_task        → cheapest fast model (Groq Llama, GPT-4o-mini, Haiku)
//   reasoning_task     → Claude Sonnet / GPT-4o (deep reasoning required)
//   code_task          → strongest coding model (Claude Sonnet — best TypeScript)
//   validation_task    → DIFFERENT model than engineer (GPT-4o-mini or Groq for second opinion)
//   documentation_task → cheap LLM (GPT-4o-mini, Haiku, or Groq)
// Provider support: Anthropic, OpenAI, Groq, Mistral, Together, Ollama, Replicate, DeepInfra
// Architecture supports 300+ models via model registry.
// Usage:
//   import { JavariRouter } from "@/lib/javari/router";
//   const result = await JavariRouter.generate({ taskType: "code_task", prompt: "..." });
// Date: 2026-03-11
import { createClient } from "@supabase/supabase-js";
import { getSecret }    from "@/lib/platform-secrets/getSecret";
// ── Types ─────────────────────────────────────────────────────────────────────
export type TaskType =
export type ProviderName =
export interface RouterRequest {
export interface RouterResult {
// ── Model Strategy Table ──────────────────────────────────────────────────────
// Maps task type → ordered list of [provider, model] to try.
// First entry is primary; subsequent entries are fallbacks.
  // Cheapest capable model — speed over depth
  // Deep reasoning — Claude or GPT-4o class
  // Strongest code generation — Claude first
  // Validation — intentionally different from engineer (GPT-4o-mini or Groq)
  // Documentation — cheap LLM is sufficient
// ── API key resolver ───────────────────────────────────────────────────────────
// ── Provider call implementations ─────────────────────────────────────────────
  // Replicate uses a predictions API — create then poll
  // Poll up to 30 times (60s)
// ── Provider dispatch table ───────────────────────────────────────────────────
    // DeepInfra uses OpenAI-compatible API
// ── Telemetry logger ──────────────────────────────────────────────────────────
    // Non-fatal — telemetry must never block execution
// ── Main router ───────────────────────────────────────────────────────────────
  // Build strategy list — respect force overrides
      // Provider not in strategy — use first model from that provider in any strategy
  // Enrich prompt with context if provided
  // Try each model in strategy order
  // All providers failed
// ── Map artifact type to task type ────────────────────────────────────────────
// ── Public API ────────────────────────────────────────────────────────────────
export default {}
