// lib/javari/multi-ai/roles.ts
// Agent role definitions for multi-AI orchestration
// Consolidated stub — provides types and mapping used by orchestrator.ts

export type AgentRole = "architect" | "engineer" | "validator" | "bulk_worker" | "json_specialist" | "signal_reader";

export interface AgentDefinition {
  role: AgentRole;
  label: string;
  provider: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface TaskFlags {
  requiresReasoning: boolean;
  requiresCode: boolean;
  requiresJson: boolean;
  requiresValidation: boolean;
  isBulk: boolean;
  isSignalTask: boolean;
  complexity: number;
}

export const AGENT_ROLES: Record<AgentRole, AgentDefinition> = {
  architect: {
    role: "architect",
    label: "Architect",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    systemPrompt: "You are a senior software architect. Plan and design solutions.",
    temperature: 0.3,
    maxTokens: 4096,
  },
  engineer: {
    role: "engineer",
    label: "Engineer",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    systemPrompt: "You are a senior software engineer. Write clean, production-ready code.",
    temperature: 0.2,
    maxTokens: 8192,
  },
  validator: {
    role: "validator",
    label: "Validator",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "You are a code reviewer. Check for bugs, security issues, and correctness.",
    temperature: 0.1,
    maxTokens: 2048,
  },
  bulk_worker: {
    role: "bulk_worker",
    label: "Bulk Worker",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "Process the following batch of items efficiently.",
    temperature: 0.1,
    maxTokens: 4096,
  },
  json_specialist: {
    role: "json_specialist",
    label: "JSON Specialist",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "Return ONLY valid JSON. No markdown, no prose, no backticks.",
    temperature: 0.0,
    maxTokens: 4096,
  },
  signal_reader: {
    role: "signal_reader",
    label: "Signal Reader",
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    systemPrompt: "Analyze signals, metrics, and data patterns. Return structured insights.",
    temperature: 0.2,
    maxTokens: 2048,
  },
};

export function determineAgentForTask(flags: TaskFlags): {
  primaryRole: AgentRole;
  supportRoles: AgentRole[];
} {
  if (flags.isSignalTask)       return { primaryRole: "signal_reader",    supportRoles: [] };
  if (flags.requiresJson)       return { primaryRole: "json_specialist",  supportRoles: [] };
  if (flags.isBulk)             return { primaryRole: "bulk_worker",      supportRoles: [] };
  if (flags.requiresCode)       return { primaryRole: "engineer",         supportRoles: flags.requiresValidation ? ["validator"] : [] };
  if (flags.requiresReasoning)  return { primaryRole: "architect",        supportRoles: flags.requiresValidation ? ["validator"] : [] };
  return { primaryRole: "engineer", supportRoles: [] };
}
