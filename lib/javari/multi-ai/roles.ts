// lib/javari/multi-ai/roles.ts
// Javari Multi-AI Team Mode — Role Definitions
// 2026-02-20 — STEP 3 implementation
//
// 6 specialist roles. Each maps to a specific provider + model.
// Zero role crossover — architect never codes, engineer never plans.
//
// Role hierarchy:
//   architect      → plans, structures, reasons (ChatGPT GPT-4.1 / o4-mini)
//   engineer       → implements, codes, builds   (Claude Sonnet)
//   validator      → checks, critiques, scores   (Claude Sonnet / Haiku)
//   bulk_worker    → high-volume, cheap tasks    (Llama 70B / Mixtral via Groq)
//   json_specialist→ schema, structured output   (Mistral Large)
//   signal_reader  → web signals, current events (xAI Grok — optional)

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentRole =
  | "architect"
  | "engineer"
  | "validator"
  | "bulk_worker"
  | "json_specialist"
  | "signal_reader";

export type AgentTier = "free" | "low" | "moderate" | "expensive";

export interface AgentCapabilities {
  planning:     number;  // 0–10
  reasoning:    number;  // 0–10
  coding:       number;  // 0–10
  validation:   number;  // 0–10
  speed:        number;  // 0–10
  json_fidelity:number;  // 0–10
  signal_read:  number;  // 0–10
}

export interface AgentDefinition {
  role:         AgentRole;
  displayName:  string;
  description:  string;
  provider:     string;   // primary provider key
  model:        string;   // primary model id
  fallbackProvider: string;
  fallbackModel:    string;
  tier:         AgentTier;
  capabilities: AgentCapabilities;
  systemPromptSuffix: string;  // role-specific instruction appended to system prompt
  maxTokens:    number;
  timeoutMs:    number;
  optional:     boolean;  // if true and provider unavailable, skip gracefully
}

// ── Role definitions ──────────────────────────────────────────────────────────

export const AGENT_ROLES: Record<AgentRole, AgentDefinition> = {
  architect: {
    role:        "architect",
    displayName: "Architect (ChatGPT)",
    description: "High-level planning, system design, multi-step reasoning, strategy",
    provider:    "openai",
    model:       "gpt-4.1",          // GPT-4.1 when available, fallback below
    fallbackProvider: "openai",
    fallbackModel:    "gpt-4o",
    tier:        "moderate",
    capabilities: {
      planning:     10,
      reasoning:    9,
      coding:       7,
      validation:   6,
      speed:        6,
      json_fidelity:7,
      signal_read:  5,
    },
    systemPromptSuffix: [
      "You are the ARCHITECT agent.",
      "Your role: high-level planning, system design, and strategic reasoning.",
      "DO NOT write implementation code. DO NOT validate outputs.",
      "Produce clear, structured plans, designs, and reasoning chains.",
      "If asked to code, respond with a design specification instead.",
    ].join(" "),
    maxTokens:  4096,
    timeoutMs:  45_000,
    optional:   false,
  },

  engineer: {
    role:        "engineer",
    displayName: "Engineer (Claude)",
    description: "Implementation, code generation, technical execution",
    provider:    "anthropic",
    model:       "claude-sonnet-4-20250514",
    fallbackProvider: "openai",
    fallbackModel:    "gpt-4o",
    tier:        "moderate",
    capabilities: {
      planning:     6,
      reasoning:    8,
      coding:       10,
      validation:   7,
      speed:        7,
      json_fidelity:8,
      signal_read:  4,
    },
    systemPromptSuffix: [
      "You are the ENGINEER agent.",
      "Your role: technical implementation, code generation, and precise execution.",
      "DO NOT create high-level plans. DO NOT validate other agents' work.",
      "Write production-quality code and technical specifications.",
      "Follow the architect's design exactly.",
    ].join(" "),
    maxTokens:  8192,
    timeoutMs:  50_000,
    optional:   false,
  },

  validator: {
    role:        "validator",
    displayName: "Validator (Claude)",
    description: "Output validation, quality scoring, cross-agent review",
    provider:    "anthropic",
    model:       "claude-haiku-4-5-20251001",  // fast + cheap for validation
    fallbackProvider: "anthropic",
    fallbackModel:    "claude-sonnet-4-20250514",
    tier:        "low",
    capabilities: {
      planning:     4,
      reasoning:    8,
      coding:       6,
      validation:   10,
      speed:        9,
      json_fidelity:7,
      signal_read:  3,
    },
    systemPromptSuffix: [
      "You are the VALIDATOR agent.",
      "Your role: review, critique, and score outputs from other agents.",
      "Return ONLY a JSON object: { score: 0-100, passed: boolean, issues: string[], corrected?: string }",
      "Be rigorous but fair. A score >= 70 is passing.",
    ].join(" "),
    maxTokens:  2048,
    timeoutMs:  20_000,
    optional:   false,
  },

  bulk_worker: {
    role:        "bulk_worker",
    displayName: "Bulk Worker (Llama/Groq)",
    description: "High-volume, cost-optimized tasks: summarization, extraction, classification",
    provider:    "groq",
    model:       "llama-3.1-70b-versatile",
    fallbackProvider: "groq",
    fallbackModel:    "mixtral-8x7b-32768",
    tier:        "free",
    capabilities: {
      planning:     5,
      reasoning:    6,
      coding:       5,
      validation:   4,
      speed:        10,
      json_fidelity:5,
      signal_read:  3,
    },
    systemPromptSuffix: [
      "You are the BULK WORKER agent.",
      "Your role: fast, high-volume processing — summarization, extraction, classification, rewriting.",
      "Be concise and efficient. Prioritize speed over elaboration.",
    ].join(" "),
    maxTokens:  4096,
    timeoutMs:  20_000,
    optional:   false,
  },

  json_specialist: {
    role:        "json_specialist",
    displayName: "JSON Specialist (Mistral)",
    description: "Strict structured output, schema generation, data transformation",
    provider:    "mistral",
    model:       "mistral-large-latest",
    fallbackProvider: "openai",
    fallbackModel:    "gpt-4o-mini",
    tier:        "moderate",
    capabilities: {
      planning:     5,
      reasoning:    7,
      coding:       7,
      validation:   6,
      speed:        7,
      json_fidelity:10,
      signal_read:  3,
    },
    systemPromptSuffix: [
      "You are the JSON SPECIALIST agent.",
      "Your role: produce perfectly valid JSON schemas, structured data, and API response shapes.",
      "Return ONLY valid JSON. No markdown, no backticks, no prose outside the JSON structure.",
      "Validate your own JSON before returning it.",
    ].join(" "),
    maxTokens:  4096,
    timeoutMs:  30_000,
    optional:   false,
  },

  signal_reader: {
    role:        "signal_reader",
    displayName: "Signal Reader (Grok/xAI)",
    description: "Real-time web signals, current events, trend detection",
    provider:    "xai",
    model:       "grok-2-latest",
    fallbackProvider: "openai",
    fallbackModel:    "gpt-4o",
    tier:        "moderate",
    capabilities: {
      planning:     5,
      reasoning:    7,
      coding:       5,
      validation:   4,
      speed:        7,
      json_fidelity:5,
      signal_read:  10,
    },
    systemPromptSuffix: [
      "You are the SIGNAL READER agent.",
      "Your role: identify real-time trends, web signals, and current event context.",
      "Prioritize recency and factual accuracy.",
    ].join(" "),
    maxTokens:  2048,
    timeoutMs:  25_000,
    optional:   true,  // skip gracefully if xAI key unavailable
  },
};

// ── Delegation rules ──────────────────────────────────────────────────────────
// Deterministic priority: first matching rule wins.
// Multiple agents can be assigned to one task (e.g. engineer + validator for high_risk).

export interface DelegationRule {
  condition: (flags: TaskFlags) => boolean;
  primaryRole:   AgentRole;
  supportRoles?: AgentRole[];  // run in parallel or sequence after primary
  reason: string;
}

export interface TaskFlags {
  requires_reasoning_depth: boolean;
  requires_json:            boolean;
  requires_validation:      boolean;
  high_risk:                boolean;
  is_bulk_task:             boolean;
  has_code_request:         boolean;
  task_type:                string;
  complexity_score:         number;
}

export const DELEGATION_RULES: DelegationRule[] = [
  // 1. JSON/structured output → json_specialist
  {
    condition: (flags) => f.requires_json,
    primaryRole:   "json_specialist",
    supportRoles:  ["validator"],
    reason: "Structured JSON output required → Mistral strict mode",
  },
  // 2. Planning / reasoning-heavy + no code → architect
  {
    condition: (flags) => f.requires_reasoning_depth && !f.has_code_request,
    primaryRole:   "architect",
    supportRoles:  ["validator"],
    reason: "Deep reasoning without code → architect (ChatGPT)",
  },
  // 3. High-risk anything → engineer + validator mandatory
  {
    condition: (flags) => f.high_risk,
    primaryRole:   "engineer",
    supportRoles:  ["validator"],
    reason: "High-risk task → engineer executes + validator reviews",
  },
  // 4. Code generation → engineer
  {
    condition: (flags) => f.has_code_request && !f.requires_reasoning_depth,
    primaryRole:   "engineer",
    supportRoles:  ["validator"],
    reason: "Code task → engineer (Claude Sonnet)",
  },
  // 5. Reasoning + code → architect plans, engineer builds
  {
    condition: (flags) => f.requires_reasoning_depth && f.has_code_request,
    primaryRole:   "architect",
    supportRoles:  ["engineer", "validator"],
    reason: "Design+code → architect plans, engineer builds, validator reviews",
  },
  // 6. Validation task → validator directly
  {
    condition: (flags) => f.task_type === "validation",
    primaryRole:   "validator",
    reason: "Validation task type → validator",
  },
  // 7. Bulk (summarize/extract/classify) → bulk_worker
  {
    condition: (flags) => f.is_bulk_task && !f.high_risk,
    primaryRole:   "bulk_worker",
    reason: "Bulk task → Groq Llama (free tier)",
  },
  // 8. Default → bulk_worker (fast + free)
  {
    condition: () => true,
    primaryRole:   "bulk_worker",
    reason: "Default → bulk worker (speed + cost)",
  },
];

// ── determineAgentForTask — public API ────────────────────────────────────────

export interface AgentAssignment {
  primaryRole:   AgentRole;
  supportRoles:  AgentRole[];
  reason:        string;
  primaryAgent:  AgentDefinition;
  supportAgents: AgentDefinition[];
}

export function determineAgentForTask(flags: TaskFlags): AgentAssignment {
  for (const rule of DELEGATION_RULES) {
    if (rule.condition(flags)) {
      const primaryAgent  = AGENT_ROLES[rule.primaryRole];
      const supportRoles  = rule.supportRoles ?? [];
      const supportAgents = supportRoles.map((r) => AGENT_ROLES[r]);

      return {
        primaryRole:  rule.primaryRole,
        supportRoles,
        reason:       rule.reason,
        primaryAgent,
        supportAgents,
      };
    }
  }
  // Should never reach here (last rule is always true)
  return {
    primaryRole:   "bulk_worker",
    supportRoles:  [],
    reason:        "Fallback default",
    primaryAgent:  AGENT_ROLES.bulk_worker,
    supportAgents: [],
  };
}

/**
 * DELEGATION RULE TABLE (text summary)
 *
 * Condition                        Primary        Support              Notes
 * ─────────────────────────────────────────────────────────────────────────────
 * requires_json                  │ json_specialist│ validator          │ Mistral strict
 * reasoning + no code            │ architect      │ validator          │ GPT-4.1
 * high_risk                      │ engineer       │ validator          │ mandatory validation
 * has_code                       │ engineer       │ validator?         │ Claude Sonnet
 * reasoning + code               │ architect      │ engineer+validator │ full pipeline
 * task_type = validation         │ validator      │ —                  │ direct
 * bulk_task + !high_risk         │ bulk_worker    │ —                  │ Llama free tier
 * default                        │ bulk_worker    │ —                  │ speed/cost
 */
