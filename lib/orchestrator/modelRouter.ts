// lib/orchestrator/modelRouter.ts
// Purpose: Routes task types to optimal model combinations. Deterministic:
//          same task_type + priority → same selection.
// Date: 2026-03-07

import {
  OrchestratorModel, ModelCapabilityTag,
  getModelsByCapability, ORCHESTRATOR_REGISTRY,
} from "./modelRegistry";

export type TaskType =
  | "security_audit" | "code_repair" | "architecture_design"
  | "frontend_coding" | "backend_coding" | "database_design"
  | "devops_analysis" | "ai_integration" | "performance_audit"
  | "brand_analysis" | "ux_analysis" | "general_analysis"
  | "summarization" | "classification" | "math_reasoning"
  | "creative_writing" | "translation" | "fast_qa";

export type RoutingPriority = "quality" | "cost" | "speed" | "balanced";

export interface ModelSelection {
  primary     : OrchestratorModel;
  ensemble    : OrchestratorModel[];
  fallback    : OrchestratorModel;
  reason      : string;
  estimatedCostPer1k: number;
}

const TASK_CAPABILITY_MAP: Record<TaskType, ModelCapabilityTag[]> = {
  security_audit    : ["security_audit","reasoning","coding"],
  code_repair       : ["code_repair","coding","backend"],
  architecture_design: ["architecture_design","reasoning","analysis"],
  frontend_coding   : ["frontend","coding","fast"],
  backend_coding    : ["backend","coding","database"],
  database_design   : ["database","coding","analysis"],
  devops_analysis   : ["devops","analysis"],
  ai_integration    : ["coding","reasoning","backend"],
  performance_audit : ["analysis","coding","reasoning"],
  brand_analysis    : ["analysis","classification"],
  ux_analysis       : ["analysis","classification","frontend"],
  general_analysis  : ["analysis","reasoning"],
  summarization     : ["summarization","fast"],
  classification    : ["classification","fast"],
  math_reasoning    : ["math","reasoning"],
  creative_writing  : ["creative","analysis"],
  translation       : ["translation"],
  fast_qa           : ["ultra_fast","fast"],
};

const QUALITY_PRIMARY: Partial<Record<TaskType,string[]>> = {
  security_audit    : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","deepseek:deepseek-coder"],
  code_repair       : ["anthropic:claude-sonnet-4-20250514","deepseek:deepseek-coder","groq:qwen-2.5-coder-32b"],
  architecture_design: ["openai:gpt-4o","anthropic:claude-sonnet-4-20250514","google:gemini-1.5-pro"],
  frontend_coding   : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","groq:llama-3.3-70b-versatile"],
  backend_coding    : ["deepseek:deepseek-coder","anthropic:claude-sonnet-4-20250514","mistral:codestral-latest"],
  database_design   : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","deepseek:deepseek-coder"],
  math_reasoning    : ["openai:o3-mini","deepseek:deepseek-reasoner","groq:deepseek-r1-distill-llama-70b"],
  performance_audit : ["anthropic:claude-sonnet-4-20250514","openai:gpt-4o","google:gemini-2.0-flash-exp"],
};

const COST_PRIMARY: Partial<Record<TaskType,string[]>> = {
  security_audit    : ["groq:llama-3.3-70b-versatile","deepseek:deepseek-coder","openrouter:deepseek/deepseek-r1"],
  code_repair       : ["groq:qwen-2.5-coder-32b","deepseek:deepseek-coder","openrouter:deepseek/deepseek-chat"],
  architecture_design: ["groq:llama-3.3-70b-versatile","openrouter:meta-llama/llama-3.1-405b","google:gemini-2.0-flash-exp"],
  general_analysis  : ["groq:llama-3.1-70b-versatile","openrouter:qwen/qwen-2.5-72b","google:gemini-2.0-flash-exp"],
  summarization     : ["groq:llama-3.1-8b-instant","google:gemini-1.5-flash","openai:gpt-4o-mini"],
  classification    : ["groq:gemma2-9b-it","openai:gpt-4o-mini","google:gemini-1.5-flash"],
  fast_qa           : ["groq:llama-3.1-8b-instant","groq:gemma2-9b-it","google:gemini-1.5-flash"],
};

const SPEED_PRIMARY: Partial<Record<TaskType,string[]>> = {
  security_audit    : ["groq:llama-3.3-70b-versatile","groq:qwen-2.5-coder-32b"],
  code_repair       : ["groq:qwen-2.5-coder-32b","groq:llama-3.3-70b-versatile"],
  general_analysis  : ["groq:llama-3.1-70b-versatile","groq:llama-3.3-70b-versatile"],
  summarization     : ["groq:llama-3.1-8b-instant","groq:gemma2-9b-it"],
  fast_qa           : ["groq:llama-3.1-8b-instant","groq:gemma2-9b-it"],
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
    const caps = TASK_CAPABILITY_MAP[taskType] ?? ["analysis"];
    const capModels = caps.flatMap(c => getModelsByCapability(c));
    const scored = [...new Set(capModels)].sort((a,b) => {
      if (priority === "cost")  return a.cost_per_1k_tokens - b.cost_per_1k_tokens;
      if (priority === "speed") return a.latency_ms_p50 - b.latency_ms_p50;
      return (b.reasoning_score+b.coding_score+b.reliability_score)-(a.reasoning_score+a.coding_score+a.reliability_score);
    });
    primary = scored[0];
  }

  const ensembleIds = primaryIds?.slice(1, maxModels) ?? [];
  const ensemble: OrchestratorModel[] = [];
  for (const id of ensembleIds) {
    const m = registry.find(m2 => m2.id === id && m2.id !== primary!.id);
    if (m) ensemble.push(m);
  }
  if (ensemble.length < 2) {
    const caps = TASK_CAPABILITY_MAP[taskType] ?? ["analysis"];
    const capModels = getModelsByCapability(caps[0])
      .filter(m => m.id !== primary!.id && m.provider !== primary!.provider)
      .sort((a,b) => b.reliability_score - a.reliability_score);
    for (const m of capModels.slice(0, 2 - ensemble.length)) {
      if (!ensemble.find(e => e.id === m.id)) ensemble.push(m);
    }
  }

  const fallback = registry.find(m => m.id === FALLBACK_ID)
    ?? registry.find(m => m.tier === "free") ?? primary!;
  const avgCost = [primary!,...ensemble].reduce((s,m) => s+m.cost_per_1k_tokens,0)/(1+ensemble.length);

  return {
    primary: primary!, ensemble, fallback,
    reason: `${priority} routing: primary=${primary!.display_name} (${primary!.provider}) + ${ensemble.length} ensemble`,
    estimatedCostPer1k: avgCost,
  };
}

export function detectTaskType(prompt: string): TaskType {
  const p = prompt.toLowerCase();
  if (/security|csp|hsts|xss|inject|vuln|cve|audit/.test(p))     return "security_audit";
  if (/repair|fix|bug|patch|broken|error|fail/.test(p))           return "code_repair";
  if (/architect|design|structure|system design/.test(p))         return "architecture_design";
  if (/frontend|react|next|tsx|component|css|tailwind/.test(p))   return "frontend_coding";
  if (/backend|api|route|endpoint|server|node/.test(p))           return "backend_coding";
  if (/database|sql|schema|query|supabase|postgres/.test(p))      return "database_design";
  if (/docker|kubernetes|deploy|ci\/cd|infra|devops/.test(p))     return "devops_analysis";
  if (/ai|llm|model|embedding|vector|gpt|claude/.test(p))         return "ai_integration";
  if (/performance|speed|latency|cache|optimize/.test(p))         return "performance_audit";
  if (/math|equation|calcul|proof|theorem/.test(p))               return "math_reasoning";
  if (/translat|spanish|french|german|chinese/.test(p))           return "translation";
  if (/summar|tldr|brief|overview/.test(p))                       return "summarization";
  if (/classif|categor|label|sort|group/.test(p))                 return "classification";
  if (/quick|fast|simple|short answer/.test(p))                   return "fast_qa";
  return "general_analysis";
}
