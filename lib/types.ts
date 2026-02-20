// lib/types.ts
// Canonical type barrel for the Javari AI engine
// 2026-02-20 — STEP 0: Added JavariMessage + streaming types

// ── Conversation / Message (from DB schema) ───────────────────────────────────
export type { Message, Conversation, ConversationStatus } from "@/types/conversation";

// ── JavariMessage — UI message type used in chat components ──────────────────
// Distinct from Message (DB type) — carries UI state like id, streaming flag
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
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
}

// ── Chat action types for useReducer ─────────────────────────────────────────
export type ChatAction =
  | { type: "ADD_USER"; id: string; content: string }
  | { type: "ADD_ASSISTANT_PLACEHOLDER"; id: string }
  | { type: "STREAM_DELTA"; id: string; delta: string }
  | { type: "FINALIZE"; id: string; content: string }
  | { type: "ERROR"; id: string; error: string }
  | { type: "CLEAR" };
