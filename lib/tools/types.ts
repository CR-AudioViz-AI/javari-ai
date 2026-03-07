// lib/tools/types.ts
// Purpose: Shared types for Infrastructure Tool Layer
// Date: 2026-03-07

export const TOOL_LAYER_VERSION = "1.0.0";

// Risk levels — used to decide whether guardrail pre-approval is needed
export type RiskLevel = "read" | "write" | "destructive";

// Every tool call produces one of these
export interface ToolCallResult<T = unknown> {
  ok: boolean;
  tool: string;
  action: string;
  data?: T;
  error?: string;
  latencyMs: number;
  riskLevel: RiskLevel;
  rollbackId?: string; // present for write/destructive ops that can be undone
}

// Rollback record — stored so destructive ops can be reversed
export interface RollbackRecord {
  id: string;
  tool: string;
  action: string;
  reversalPayload: unknown;  // What to call to undo this action
  createdAt: string;
  ttlMs: number;             // How long this rollback token is valid
  used: boolean;
}

// Defines what a tool can do — exposed to the multi-AI router
export interface ToolCapability {
  tool: string;
  action: string;
  description: string;
  riskLevel: RiskLevel;
  params: Record<string, { type: string; required: boolean; description: string }>;
}

// Tool execution request (from AI model or internal caller)
export interface ToolRequest {
  tool: string;
  action: string;
  params: Record<string, unknown>;
  executionId?: string;   // links to execution_logs
  calledBy?: string;      // "ai_router" | "cron" | "user"
}

// Guardrail pre-check result
export interface ToolGuardrailResult {
  allowed: boolean;
  reason: string;
  riskLevel: RiskLevel;
}
