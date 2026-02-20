// lib/javari/cost/policy.ts
// HENDERSON COST STANDARD — Every AI/API decision runs through this
// Rule: Free → Low → Moderate → Expensive. Never skip tiers.
// Multipliers protect margin. Never lose money.
// 2026-02-20

export interface CostTier {
  name: 'free' | 'low' | 'moderate' | 'expensive';
  maxCostPerCall: number;  // USD
  marginMultiplier: number; // charge user this × cost
  examples: string[];
}

export const COST_TIERS: CostTier[] = [
  {
    name: 'free',
    maxCostPerCall: 0,
    marginMultiplier: 1,  // pure profit — cost=0, charge credits
    examples: ['groq-llama3-8b', 'groq-llama3-70b', 'template-generation', 'deterministic-code'],
  },
  {
    name: 'low',
    maxCostPerCall: 0.005, // < $0.005 per call
    marginMultiplier: 5,   // 5× markup minimum
    examples: ['gpt-4o-mini', 'claude-haiku', 'mistral-small', 'openrouter-cheap'],
  },
  {
    name: 'moderate',
    maxCostPerCall: 0.05,  // < $0.05 per call
    marginMultiplier: 4,
    examples: ['gpt-4o', 'claude-sonnet', 'mistral-medium'],
  },
  {
    name: 'expensive',
    maxCostPerCall: 0.50,  // < $0.50 per call
    marginMultiplier: 3,   // minimum 3× even at top tier
    examples: ['gpt-4-turbo', 'claude-opus', 'o1'],
  },
];

// ── Provider cost map (per 1M tokens, input/output) ───────────────────────────
// Source: official pricing pages — update when prices change

export const PROVIDER_COSTS: Record<string, {
  inputPer1M: number;
  outputPer1M: number;
  tier: CostTier['name'];
  freeQuota?: string;
}> = {
  // FREE TIER — use first always
  'groq/llama3-8b-8192':         { inputPer1M: 0,    outputPer1M: 0,    tier: 'free', freeQuota: '14,400 req/day' },
  'groq/llama3-70b-8192':        { inputPer1M: 0,    outputPer1M: 0,    tier: 'free', freeQuota: '14,400 req/day' },
  'groq/mixtral-8x7b-32768':     { inputPer1M: 0,    outputPer1M: 0,    tier: 'free', freeQuota: '14,400 req/day' },

  // LOW TIER — embeddings, routing decisions, simple completions
  'openai/text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0,   tier: 'low' },
  'openai/gpt-4o-mini':           { inputPer1M: 0.15,  outputPer1M: 0.60, tier: 'low' },
  'anthropic/claude-haiku-3':     { inputPer1M: 0.25,  outputPer1M: 1.25, tier: 'low' },
  'mistral/mistral-small':        { inputPer1M: 0.20,  outputPer1M: 0.60, tier: 'low' },

  // MODERATE TIER — complex generation, code, reasoning
  'openai/gpt-4o':                { inputPer1M: 2.50,  outputPer1M: 10.00, tier: 'moderate' },
  'anthropic/claude-sonnet-4':    { inputPer1M: 3.00,  outputPer1M: 15.00, tier: 'moderate' },
  'mistral/mistral-medium':       { inputPer1M: 2.70,  outputPer1M: 8.10,  tier: 'moderate' },

  // EXPENSIVE — only when moderate cannot handle it
  'openai/o1':                    { inputPer1M: 15.00, outputPer1M: 60.00, tier: 'expensive' },
  'anthropic/claude-opus-4':      { inputPer1M: 15.00, outputPer1M: 75.00, tier: 'expensive' },
};

// ── Credit pricing (what users pay) ──────────────────────────────────────────
// 1 credit = $0.01 retail
// We must always make money: revenue > cost × multiplier

export const CREDIT_VALUE_USD = 0.01; // $0.01 per credit charged to user

// ── Cost calculator ───────────────────────────────────────────────────────────

export interface CostDecision {
  provider: string;
  model: string;
  tier: CostTier['name'];
  estimatedCostUSD: number;
  minimumCreditsToCharge: number; // what we must charge to not lose money
  recommended: boolean;
  reason: string;
}

export function calculateCost(
  modelKey: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): CostDecision {
  const pricing = PROVIDER_COSTS[modelKey];
  if (!pricing) {
    return {
      provider: modelKey.split('/')[0],
      model: modelKey,
      tier: 'moderate',
      estimatedCostUSD: 0.01,
      minimumCreditsToCharge: 5,
      recommended: false,
      reason: 'Unknown model — defaulting to moderate tier pricing',
    };
  }

  const inputCost  = (estimatedInputTokens  / 1_000_000) * pricing.inputPer1M;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPer1M;
  const totalCost  = inputCost + outputCost;

  const tier = COST_TIERS.find((t) => t.name === pricing.tier)!;
  // Multiply cost by tier multiplier, then convert to credits
  const revenueNeeded = totalCost * tier.marginMultiplier;
  const creditsNeeded = Math.max(1, Math.ceil(revenueNeeded / CREDIT_VALUE_USD));

  return {
    provider: modelKey.split('/')[0],
    model: modelKey.split('/')[1],
    tier: pricing.tier,
    estimatedCostUSD: totalCost,
    minimumCreditsToCharge: creditsNeeded,
    recommended: true,
    reason: `${pricing.tier} tier: $${totalCost.toFixed(6)} cost × ${tier.marginMultiplier}× = $${revenueNeeded.toFixed(4)} revenue = ${creditsNeeded} credits`,
  };
}

// ── Routing decision: pick cheapest model that meets quality bar ──────────────

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex';

export function selectCheapestModel(complexity: TaskComplexity): string {
  // ALWAYS start free. Only escalate if free tier cannot handle complexity.
  switch (complexity) {
    case 'trivial':
    case 'simple':
      return 'groq/llama3-8b-8192';    // FREE — 14,400/day quota
    case 'moderate':
      return 'openai/gpt-4o-mini';     // LOW — $0.15/$0.60 per 1M
    case 'complex':
      return 'openai/gpt-4o';          // MODERATE — only when needed
    // 'expensive' tier never auto-selected — requires explicit override
  }
}

// ── Vercel build cost guard ───────────────────────────────────────────────────
// Each Vercel build costs ~$0.01-0.05 in compute
// Batch commits to minimize build count

export const VERCEL_COST_POLICY = {
  maxBuildsPerHour: 5,
  batchModulesBeforeCommit: true,  // Accumulate modules, single commit
  minBatchSize: 3,                  // At least 3 modules per commit
  preferPreviewDeploys: true,       // Preview = free; production = costs credits
} as const;

// ── Never lose money check ────────────────────────────────────────────────────

export function assertProfitable(
  costUSD: number,
  creditsCharged: number,
  operationName: string
): { profitable: boolean; marginUSD: number; warning?: string } {
  const revenueUSD = creditsCharged * CREDIT_VALUE_USD;
  const marginUSD  = revenueUSD - costUSD;
  const profitable = marginUSD >= 0;

  if (!profitable) {
    console.error(
      `[CostPolicy] LOSING MONEY on ${operationName}: ` +
      `cost=$${costUSD.toFixed(4)} revenue=$${revenueUSD.toFixed(4)} margin=$${marginUSD.toFixed(4)}`
    );
  }

  return {
    profitable,
    marginUSD,
    warning: !profitable
      ? `LOSS: ${operationName} costs $${costUSD.toFixed(4)} but charges only $${revenueUSD.toFixed(4)}`
      : undefined,
  };
}
