// lib/types.ts
// Canonical type barrel for the Javari AI engine
// 2026-02-20 — STEP 1: Added routing types

// ── Conversation / Message (from DB schema) ───────────────────────────────────
export type { Message, Conversation, ConversationStatus } from "@/types/conversation";

// ── JavariMessage — UI message type used in chat components ──────────────────
export interface JavariMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  metadata?: {
    provider?: string;
    mode?: string;
    reasoning?: string;
    steps?: Array<{ step: number; action: string; result: string }>;
    sources?: Array<{ source: string; similarity: number }>;
    audio?: { transcript?: string; audioUrl?: string };
    autonomous?: boolean;
    files?: Array<{ name: string; content: string }>;
    executionSteps?: unknown[];
    councilVotes?: Array<{
      provider: string;
      vote: string;
      confidence: number;
      reasoning: string;
    }>;
  };
}

// ── Streaming chunk payload ───────────────────────────────────────────────────
export interface StreamChunk {
  type: "delta" | "done" | "error" | "routing" | "fallback";
  content?: string;
  error?: string;
  provider?: string;
  routing?: RoutingMetadata;
}

// ── Chat action types for useReducer ─────────────────────────────────────────
export type ChatAction =
  | { type: "ADD_USER"; id: string; content: string }
  | { type: "ADD_ASSISTANT_PLACEHOLDER"; id: string }
  | { type: "STREAM_DELTA"; id: string; delta: string }
  | { type: "FINALIZE"; id: string; content: string }
  | { type: "ERROR"; id: string; error: string }
  | { type: "CLEAR" };

// ── Routing types (Step 1) ────────────────────────────────────────────────────

export type CostSensitivity = "free" | "low" | "moderate" | "expensive";

/** Full routing context produced by analyzeRoutingContext() */
export interface RoutingMetadata {
  requires_reasoning_depth: boolean;
  requires_json: boolean;
  requires_validation: boolean;
  high_risk: boolean;
  cost_sensitivity: CostSensitivity;
  complexity_score: number;
  primary_provider_hint: string;
  primary_model_hint: string;
  fallback_chain: string[];
  estimated_cost_usd: number;
}

/** Validation result from the validator stage */
export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
  corrected?: string;
  model: string;
  durationMs: number;
  skipped: boolean;
  skipReason?: string;
}

/** What the router attaches to every response envelope */
export interface ResponseRoutingMeta {
  requires_reasoning_depth: boolean;
  requires_json: boolean;
  requires_validation: boolean;
  high_risk: boolean;
  complexity_score: number;
  validation: {
    passed: boolean;
    score: number;
    skipped: boolean;
    model: string;
    durationMs: number;
  } | null;
}
