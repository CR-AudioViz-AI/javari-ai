// lib/javari/cost/policy.ts
// HENDERSON COST STANDARD — Every AI/API decision runs through this
// Rule: Free → Low → Moderate → Expensive. Never skip tiers.
// Multipliers protect margin. Never lose money.
// 2026-02-20
export interface CostTier {
// ── Provider cost map (per 1M tokens, input/output) ───────────────────────────
// Source: official pricing pages — update when prices change
  // FREE TIER — use first always
  // LOW TIER — embeddings, routing decisions, simple completions
  // MODERATE TIER — complex generation, code, reasoning
  // EXPENSIVE — only when moderate cannot handle it
// ── Credit pricing (what users pay) ──────────────────────────────────────────
// 1 credit = $0.01 retail
// We must always make money: revenue > cost × multiplier
// ── Cost calculator ───────────────────────────────────────────────────────────
export interface CostDecision {
  // Multiply cost by tier multiplier, then convert to credits
// ── Routing decision: pick cheapest model that meets quality bar ──────────────
export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';
  // ALWAYS start free. Only escalate if free tier cannot handle complexity.
    // 'expensive' tier never auto-selected — requires explicit override
// ── Vercel build cost guard ───────────────────────────────────────────────────
// Each Vercel build costs ~$0.01-0.05 in compute
// Batch commits to minimize build count
// ── Never lose money check ────────────────────────────────────────────────────
export default {}
