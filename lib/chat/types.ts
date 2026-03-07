// lib/chat/types.ts
// Purpose: Shared types for Multi-AI Chat Router
// Date: 2026-03-07

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderConfig {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  timeoutMs?: number;
  tools?: unknown[];
  temperature?: number;
}

export interface ProviderResponse {
  provider: string;
  model: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  latencyMs: number;
  stopReason?: string;
  toolCalls?: unknown[];
}

export interface StreamChunk {
  type: "text" | "done" | "error" | "tool_use";
  content?: string;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCost?: number;
  provider?: string;
  model?: string;
  error?: string;
  toolCall?: unknown;
}

export type ChatMode = "single" | "multi" | "auto";
export type RoutingStrategy = "fastest" | "cheapest" | "highest_quality" | "balanced";

export interface RouterConfig {
  mode: ChatMode;
  strategy?: RoutingStrategy;
  primaryProvider?: string;
  fallbackProviders?: string[];
  maxCost?: number;
  timeoutMs?: number;
  stream?: boolean;
  guardrailsEnabled?: boolean;
}

export interface MultiAIResult {
  mode: ChatMode;
  responses: ProviderResponse[];
  synthesized?: string;
  totalCost: number;
  totalLatencyMs: number;
  providersUsed: string[];
  guardrailsPassed: boolean;
}
