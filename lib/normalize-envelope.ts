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
    model: options?.model || "claude-3-5-sonnet-20241022",
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
