// lib/javari/multi-ai/roles.ts
// Agent role definitions for multi-AI orchestration
// 2026-03-01 — Fixed: snake_case fields match orchestrator usage,
//              added fallbackProvider/fallbackModel + systemPromptSuffix

export type AgentRole = "architect" | "engineer" | "validator" | "bulk_worker" | "json_specialist" | "signal_reader";

export interface AgentDefinition {
  role: AgentRole;
  label: string;
  provider: string;
  model: string;
  fallbackProvider: string;
  fallbackModel: string;
  systemPrompt: string;
  systemPromptSuffix: string;
  temperature: number;
  maxTokens: number;
}

// TaskFlags — uses snake_case to match orchestrator.ts field construction
export interface TaskFlags {
  requires_reasoning_depth: boolean;
  requires_json: boolean;
  requires_validation: boolean;
  high_risk: boolean;
  is_bulk_task: boolean;
  has_code_request: boolean;
  task_type: string;
  complexity_score: number;
}

export const AGENT_ROLES: Record<AgentRole, AgentDefinition> = {
  architect: {
    role: "architect",
    label: "Architect",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    systemPrompt: "You are a senior software architect. Plan and design solutions.",
    systemPromptSuffix: "Focus on architecture, design patterns, and system structure.",
    temperature: 0.3,
    maxTokens: 4096,
  },
  engineer: {
    role: "engineer",
    label: "Engineer",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    systemPrompt: "You are a senior software engineer. Write clean, production-ready code.",
    systemPromptSuffix: "Write production-quality code with proper error handling.",
    temperature: 0.2,
    maxTokens: 8192,
  },
  validator: {
    role: "validator",
    label: "Validator",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    systemPrompt: "You are a code reviewer. Check for bugs, security issues, and correctness.",
    systemPromptSuffix: "Review for correctness, security, and best practices.",
    temperature: 0.1,
    maxTokens: 2048,
  },
  bulk_worker: {
    role: "bulk_worker",
    label: "Bulk Worker",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    systemPrompt: "Process the following batch of items efficiently.",
    systemPromptSuffix: "Process items quickly and return structured results.",
    temperature: 0.1,
    maxTokens: 4096,
  },
  json_specialist: {
    role: "json_specialist",
    label: "JSON Specialist",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    systemPrompt: "Return ONLY valid JSON. No markdown, no prose, no backticks.",
    systemPromptSuffix: "Output must be valid JSON only.",
    temperature: 0.0,
    maxTokens: 4096,
  },
  signal_reader: {
    role: "signal_reader",
    label: "Signal Reader",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    systemPrompt: "Analyze signals, metrics, and data patterns. Return structured insights.",
    systemPromptSuffix: "Analyze data and return structured insights.",
    temperature: 0.2,
    maxTokens: 2048,
  },
};

export function determineAgentForTask(flags: TaskFlags): {
  primaryRole: AgentRole;
  supportRoles: AgentRole[];
} {
  // Signal tasks → signal_reader
  if (flags.task_type === "signal" || flags.task_type === "monitor")
    return { primaryRole: "signal_reader", supportRoles: [] };

  // Pure JSON → json_specialist
  if (flags.requires_json && !flags.has_code_request && !flags.requires_reasoning_depth)
    return { primaryRole: "json_specialist", supportRoles: [] };

  // Bulk → bulk_worker
  if (flags.is_bulk_task)
    return { primaryRole: "bulk_worker", supportRoles: [] };

  // Code tasks → engineer (+ validator if validation required or high risk)
  if (flags.has_code_request)
    return {
      primaryRole: "engineer",
      supportRoles: (flags.requires_validation || flags.high_risk) ? ["validator"] : [],
    };

  // Reasoning tasks → architect (+ validator if needed)
  if (flags.requires_reasoning_depth)
    return {
      primaryRole: "architect",
      supportRoles: flags.requires_validation ? ["validator"] : [],
    };

  // Default → engineer
  return { primaryRole: "engineer", supportRoles: [] };
}

// Additional named exports
export type TaskFlags = Record<string, unknown>
