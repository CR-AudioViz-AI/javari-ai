// lib/javari/multi-ai/routing-context.ts
// Javari Routing Context Analyzer — PURE ANALYSIS LAYER
// Registry access REMOVED — capability resolution handled in router.ts

export const ROUTING_ENGINE_VERSION = "v3.0-pure-context";

export type CostSensitivity = "free" | "low" | "moderate" | "expensive";

export interface RoutingContext {
  prompt: string;
  mode: "single" | "super" | "advanced" | "roadmap" | "council";
  requestedProvider?: string;

  requires_reasoning_depth: boolean;
  requires_json: boolean;
  requires_validation: boolean;
  high_risk: boolean;
  cost_sensitivity: CostSensitivity;

  complexity_score: number;
  word_count: number;
  has_code_request: boolean;
  has_multi_step: boolean;
  has_schema_request: boolean;
  is_bulk_task: boolean;

  // NO registry-derived fields here
  capability_target:
    | "json_reliability"
    | "reasoning"
    | "code_quality"
    | "default";
}

const REASONING_KEYWORDS = new Set([
  "analyze","analysis","evaluate","comparison","tradeoff",
  "explain why","logic","step by step","dependency","design",
  "plan","strategy","optimize","recommend","debug","root cause"
]);

const JSON_KEYWORDS = new Set([
  "json","schema","structured output","return json",
  "typescript interface","zod schema","api response"
]);

const HIGH_RISK_KEYWORDS = new Set([
  "production","deploy","database migration","delete",
  "payment","billing","authentication","security",
  "api key","secret","legal","financial"
]);

const BULK_TASK_KEYWORDS = new Set([
  "summarize","extract","classify","rewrite",
  "translate","list all","convert","batch"
]);

const CODE_KEYWORDS = new Set([
  "code","function","class","implement","api endpoint",
  "database","typescript","react","next.js","sql"
]);

const MULTI_STEP_PATTERNS = [
  /\bstep\s*\d+/i,
  /\bfirst\b.*\bthen\b/i,
  /\band then\b/i,
  /\bphase\s+\d+/i,
];

function score(text: string, keywords: Set<string>): number {
  let s = 0;
  for (const kw of keywords) if (text.includes(kw)) s++;
  return s;
}

function detectMultiStep(text: string): boolean {
  return MULTI_STEP_PATTERNS.some(p => p.test(text));
}

export function analyzeRoutingContext(
  prompt: string,
  mode: RoutingContext["mode"] = "single",
  requestedProvider?: string
): RoutingContext {

  const lower = prompt.toLowerCase();
  const words = prompt.trim().split(/\s+/);
  const word_count = words.length;

  const reasoningScore = score(lower, REASONING_KEYWORDS);
  const jsonScore = score(lower, JSON_KEYWORDS);
  const highRiskScore = score(lower, HIGH_RISK_KEYWORDS);
  const bulkScore = score(lower, BULK_TASK_KEYWORDS);
  const codeScore = score(lower, CODE_KEYWORDS);

  const has_multi_step = detectMultiStep(prompt);
  const has_code_request = codeScore >= 1;
  const has_schema_request = jsonScore >= 1;
  const is_bulk_task = bulkScore >= 1;

  const requires_reasoning_depth =
    reasoningScore >= 2 ||
    has_multi_step ||
    mode === "advanced" ||
    mode === "roadmap";

  const requires_json = jsonScore >= 1;
  const high_risk = highRiskScore >= 1;
  const requires_validation =
    high_risk || requires_reasoning_depth || mode === "super";

  let cost_sensitivity: CostSensitivity;
  if (requires_reasoning_depth || high_risk) cost_sensitivity = "moderate";
  else if (is_bulk_task) cost_sensitivity = "free";
  else cost_sensitivity = "low";

  let complexity_score = 0;
  complexity_score += Math.min(word_count / 5, 30);
  complexity_score += reasoningScore * 8;
  complexity_score += codeScore * 5;
  complexity_score += highRiskScore * 6;
  if (has_multi_step) complexity_score += 15;
  complexity_score = Math.min(Math.round(complexity_score), 100);

  let capability_target: RoutingContext["capability_target"] = "default";

  if (requires_json) capability_target = "json_reliability";
  else if (requires_reasoning_depth) capability_target = "reasoning";
  else if (has_code_request && codeScore >= 2) capability_target = "code_quality";

  return {
    prompt,
    mode,
    requestedProvider,
    requires_reasoning_depth,
    requires_json,
    requires_validation,
    high_risk,
    cost_sensitivity,
    complexity_score,
    word_count,
    has_code_request,
    has_multi_step,
    has_schema_request,
    is_bulk_task,
    capability_target,
  };
}
