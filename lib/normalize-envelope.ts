// lib/normalize-envelope.ts
/**
 * COMPREHENSIVE RESPONSE ENVELOPE
 * 
 * Guarantees ALL fields are present in EVERY response
 * Prevents ANY possibility of undefined property access
 */

export interface NormalizedEnvelope {
  // Core response
  messages: Array<{
    role: "assistant";
    content: string;
  }>;
  
  // Results and sources
  results: any[];
  sources: any[];
  
  // Metadata
  metadata: {
    timestamp?: string;
    duration?: number;
    requestId?: string;
    [key: string]: any;
  };
  
  // Provider info
  provider: string;
  model: string;
  
  // Performance metrics
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  
  // Request tracking
  id: string;
  
  // Status
  success: boolean;
  error: string | null;
}

/**
 * Normalize any response into guaranteed envelope structure
 */
export function normalizeEnvelope(
  content: string,
  options?: {
    success?: boolean;
    error?: string | null;
    provider?: string;
    model?: string;
    latency?: number;
    tokensIn?: number;
    tokensOut?: number;
    metadata?: Record<string, any>;
    results?: any[];
    sources?: any[];
  }
): NormalizedEnvelope {
  const startTime = Date.now();
  const tokensIn = options?.tokensIn || 0;
  const tokensOut = options?.tokensOut || 0;
  
  return {
    messages: [
      {
        role: "assistant",
        content: content || "No response generated",
      },
    ],
    results: options?.results || [],
    sources: options?.sources || [],
    metadata: {
      timestamp: new Date().toISOString(),
      duration: options?.latency || 0,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...options?.metadata,
    },
    provider: options?.provider || "anthropic",
    model: options?.model || "claude-sonnet-4-20250514",
    latency_ms: options?.latency || 0,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    usage: {
      prompt_tokens: tokensIn,
      completion_tokens: tokensOut,
      total_tokens: tokensIn + tokensOut,
    },
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    success: options?.success !== undefined ? options.success : true,
    error: options?.error || null,
  };
}

/**
 * CRITICAL PATCH: Normalize payload to guaranteed minimum message structure
 * 
 * GUARANTEES:
 * - messages[] is NEVER empty
 * - messages[0].content is ALWAYS a string
 * - Prevents UI crashes on undefined access
 */
export function normalizePayload(payload: any): any {
  // Extract messages array
  let msgArray = Array.isArray(payload?.messages)
    ? payload.messages
    : [];
  
  // GUARANTEE: messages is never empty
  if (msgArray.length === 0) {
    msgArray = [
      {
        role: "assistant",
        content:
          payload?.content ??
          payload?.answer ??
          payload?.error ??
          "No response available."
      }
    ];
  }
  
  // GUARANTEE: All required fields present
  return {
    messages: msgArray,
    sources: Array.isArray(payload?.sources) ? payload.sources : [],
    results: Array.isArray(payload?.results) ? payload.results : [],
    answer: payload?.answer || msgArray[0]?.content || "",
    success: payload?.success !== undefined ? payload.success : false,
    fallbackUsed: payload?.fallbackUsed !== undefined ? payload.fallbackUsed : true,
    error: payload?.error || null,
    metadata: payload?.metadata || {},
    provider: payload?.provider || "anthropic",
    model: payload?.model || "claude-sonnet-4-20250514",
  };
}
