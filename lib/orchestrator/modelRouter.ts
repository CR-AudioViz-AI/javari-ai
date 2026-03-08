// lib/orchestrator/modelRouter.ts
// Purpose: Routes task types to optimal model combinations. Deterministic:
//          same task_type + priority → same selection.
// Routing rules per spec: security_audit, code_repair, architecture_design,
//   documentation_generation, performance_optimization, + all existing types.
// Date: 2026-03-08 — added documentation_generation, performance_optimization,
//   fixed groq:qwen-2.5-coder-32b-instruct model ID

import {
  OrchestratorModel, ModelCapabilityTag,
  getModelsByCapability, ORCHESTRATOR_REGISTRY,
} from "./modelRegistry";

export type TaskType =
  | "security_audit"           | "code_repair"
  | "architecture_design"      | "documentation_generation"
  | "performance_optimization" | "performance_audit"
  | "frontend_coding"          | "backend_coding"
  | "database_design"          | "devops_analysis"
  | "ai_integration"           | "brand_analysis"
  | "ux_analysis"              | "general_analysis"
  | "summarization"            | "classification"
  | "math_reasoning"           | "creative_writing"
  | "translation"              | "fast_qa";

export type RoutingPriority = "quality" | "cost" | "speed" | "balanced";

export interface ModelSelection {
  primary          : OrchestratorModel;
  ensemble         : OrchestratorModel[];
  fallback         : OrchestratorModel;
  reason           : string;
  estimatedCostPer1k: number;
}

const TASK_CAPABILITY_MAP: Record<TaskType, ModelCapabilityTag[]> = {
  security_audit         : ["security_audit","reasoning","coding"],
  code_repair            : ["code_repair","coding","backend"],
  architecture_design    : ["architecture_design","reasoning","analysis"],
  documentation_generation: ["summarization","analysis","reasoning"],
  performance_optimization: ["analysis","coding","reasoning"],
  performance_audit      : ["analysis","coding","reasoning"],
  frontend_coding        : ["frontend","coding","fast"],
  backend_coding         : ["backend","coding","database"],
  database_design        : ["database","coding","analysis"],
  devops_analysis        : ["devops","analysis"],
  ai_integration         : ["coding","reasoning","backend"],
  brand_analysis         : ["analysis","classification"],
  ux_analysis            : ["analysis","classification","frontend"],
  general_analysis       : ["analysis","reasoning"],
  summarization          : ["summarization","fast"],
  classification         : ["classification","fast"],
  math_reasoning         : ["math","reasoning"],
  creative_writing       : ["creative","analysis"],
  translation            : ["translation"],
  fast_qa                : ["ultra_fast","fast"],
};

const QUALITY_PRIMARY: Partial<Record<TaskType, string[]>> = {
  security_audit         : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","deepseek:deepseek-coder"],
  code_repair            : ["anthropic:claude-sonnet-4-20250514","deepseek:deepseek-coder","openai:gpt-4o"],
  architecture_design    : ["openai:gpt-4o","anthropic:claude-sonnet-4-20250514","openrouter:gemini-2.5-pro-or"],
  documentation_generation: ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","openrouter:gemini-2.0-flash-or"],
  performance_optimization: ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","openrouter:gemini-2.0-flash-or"],
  performance_audit      : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","openrouter:gemini-2.0-flash-or"],
  frontend_coding        : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","groq:llama-3.3-70b-versatile"],
  backend_coding         : ["deepseek:deepseek-coder","anthropic:claude-sonnet-4-20250514","mistral:codestral-latest"],
  database_design        : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","deepseek:deepseek-coder"],
  math_reasoning         : ["openai:o3-mini","deepseek:deepseek-reasoner","groq:deepseek-r1-distill-llama-70b"],
};

const COST_PRIMARY: Partial<Record<TaskType, string[]>> = {
  security_audit         : ["groq:llama-3.3-70b-versatile","deepseek:deepseek-coder","openrouter:gemini-2.0-flash-or"],
  code_repair            : ["groq:qwen-2.5-coder-32b-instruct","deepseek:deepseek-coder","openrouter:deepseek/deepseek-chat"],
  architecture_design    : ["groq:llama-3.3-70b-versatile","openrouter:meta-llama/llama-3.1-405b","openrouter:gemini-2.0-flash-or"],
  documentation_generation: ["groq:llama-3.3-70b-versatile","openrouter:gemini-2.0-flash-or","openai:gpt-4o-mini"],
  performance_optimization: ["groq:llama-3.3-70b-versatile","openrouter:gemini-2.0-flash-or","deepseek:deepseek-coder"],
  general_analysis       : ["groq:llama-3.1-70b-versatile","openrouter:qwen/qwen-2.5-72b","openrouter:gemini-2.0-flash-or"],
  summarization          : ["groq:llama-3.1-8b-instant","openrouter:gemini-1.5-flash-or","openai:gpt-4o-mini"],
  classification         : ["groq:gemma2-9b-it","openai:gpt-4o-mini","openrouter:gemini-1.5-flash-or"],
  fast_qa                : ["groq:llama-3.1-8b-instant","groq:gemma2-9b-it","openrouter:gemini-1.5-flash-or"],
};

const SPEED_PRIMARY: Partial<Record<TaskType, string[]>> = {
  security_audit         : ["groq:llama-3.3-70b-versatile","groq:llama-3.1-70b-versatile"],
  code_repair            : ["groq:qwen-2.5-coder-32b-instruct","groq:llama-3.3-70b-versatile"],
  documentation_generation: ["groq:llama-3.3-70b-versatile","groq:llama-3.1-70b-versatile"],
  performance_optimization: ["groq:llama-3.3-70b-versatile","openrouter:gemini-2.0-flash-or"],
  general_analysis       : ["groq:llama-3.1-70b-versatile","groq:llama-3.3-70b-versatile"],
  summarization          : ["groq:llama-3.1-8b-instant","groq:gemma2-9b-it"],
  fast_qa                : ["groq:llama-3.1-8b-instant","groq:gemma2-9b-it"],
};

const FALLBACK_ID = "groq:llama-3.1-70b-versatile";

export function routeTask(
  taskType : TaskType,
  priority : RoutingPriority = "balanced",
  maxModels: number = 3
): ModelSelection {
  const registry = ORCHESTRATOR_REGISTRY.filter(m => m.active);

  let primaryIds: string[] | undefined;
  switch (priority) {
    case "quality" : primaryIds = QUALITY_PRIMARY[taskType]; break;
    case "cost"    : primaryIds = COST_PRIMARY[taskType]; break;
    case "speed"   : primaryIds = SPEED_PRIMARY[taskType]; break;
    case "balanced": primaryIds = QUALITY_PRIMARY[taskType] ?? COST_PRIMARY[taskType]; break;
  }

  let primary: OrchestratorModel | undefined;
  if (primaryIds?.length) {
    for (const id of primaryIds) {
      primary = registry.find(m => m.id === id);
      if (primary) break;
    }
  }
  if (!primary) {
    const caps     = TASK_CAPABILITY_MAP[taskType] ?? ["analysis"];
    const capModels = caps.flatMap(c => getModelsByCapability(c));
    const scored   = [...new Set(capModels)].sort((a, b) => {
      if (priority === "cost")  return a.cost_per_1k_tokens - b.cost_per_1k_tokens;
      if (priority === "speed") return a.latency_ms_p50 - b.latency_ms_p50;
      return (b.reasoning_score + b.coding_score + b.reliability_score)
           - (a.reasoning_score + a.coding_score + a.reliability_score);
    });
    primary = scored[0] ?? registry[0];
  }

  const ensembleIds = primaryIds?.slice(1, maxModels) ?? [];
  const ensemble: OrchestratorModel[] = [];
  for (const id of ensembleIds) {
    const m = registry.find(m2 => m2.id === id && m2.id !== primary!.id);
    if (m) ensemble.push(m);
  }
  if (ensemble.length < 2) {
    const caps      = TASK_CAPABILITY_MAP[taskType] ?? ["analysis"];
    const capModels = getModelsByCapability(caps[0])
      .filter(m => m.id !== primary!.id && m.provider !== primary!.provider)
      .sort((a, b) => b.reliability_score - a.reliability_score);
    for (const m of capModels.slice(0, 2 - ensemble.length)) {
      if (!ensemble.find(e => e.id === m.id)) ensemble.push(m);
    }
  }

  const fallback    = registry.find(m => m.id === FALLBACK_ID)
    ?? registry.find(m => m.tier === "free") ?? primary!;
  const avgCost     = [primary!, ...ensemble]
    .reduce((s, m) => s + m.cost_per_1k_tokens, 0) / (1 + ensemble.length);

  return {
    primary: primary!, ensemble, fallback,
    reason: `${priority} routing for ${taskType}: primary=${primary!.display_name} (${primary!.provider}) + ${ensemble.length} ensemble models`,
    estimatedCostPer1k: avgCost,
  };
}

export function detectTaskType(prompt: string): TaskType {
  const p = prompt.toLowerCase();
  if (/security|csp|hsts|xss|inject|vuln|cve|owasp/.test(p))          return "security_audit";
  if (/repair|fix|bug|patch|broken|error|fail|crash/.test(p))          return "code_repair";
  if (/document|readme|spec|api doc|write docs|jsdoc/.test(p))         return "documentation_generation";
  if (/perform|speed|latency|cache|optim|slow|faster/.test(p))         return "performance_optimization";
  if (/architect|design|structure|system design|diagram/.test(p))      return "architecture_design";
  if (/frontend|react|next|tsx|component|css|tailwind/.test(p))        return "frontend_coding";
  if (/backend|api|route|endpoint|server|node\.js/.test(p))            return "backend_coding";
  if (/database|sql|schema|query|supabase|postgres/.test(p))           return "database_design";
  if (/docker|kubernetes|deploy|ci\/cd|infra|devops|terraform/.test(p))return "devops_analysis";
  if (/ai|llm|model|embedding|vector|gpt|claude|gemini/.test(p))       return "ai_integration";
  if (/math|equation|calcul|proof|theorem|formula/.test(p))            return "math_reasoning";
  if (/translat|spanish|french|german|chinese|japanese/.test(p))       return "translation";
  if (/summar|tldr|brief|overview|digest/.test(p))                     return "summarization";
  if (/classif|categor|label|sort|group/.test(p))                      return "classification";
  if (/quick|fast|simple|short answer/.test(p))                        return "fast_qa";
  return "general_analysis";
}
