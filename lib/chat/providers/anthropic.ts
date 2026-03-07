// lib/chat/providers/anthropic.ts
// Purpose: Anthropic Claude provider for Multi-AI Chat Router
// Supports: streaming, tool hooks, cost estimation
// Date: 2026-03-07

import { ChatMessage, ProviderResponse, StreamChunk, ProviderConfig } from "../types";

export const ANTHROPIC_MODELS = {
  SONNET: "claude-sonnet-4-20250514",
  HAIKU:  "claude-haiku-4-5-20251001",
  OPUS:   "claude-opus-4-6",
} as const;

export type AnthropicModel = typeof ANTHROPIC_MODELS[keyof typeof ANTHROPIC_MODELS];

// Cost per 1K tokens (USD)
const COST_PER_1K: Record<AnthropicModel, { input: number; output: number }> = {
  [ANTHROPIC_MODELS.HAIKU]:  { input: 0.00025, output: 0.00125 },
  [ANTHROPIC_MODELS.SONNET]: { input: 0.003,   output: 0.015   },
  [ANTHROPIC_MODELS.OPUS]:   { input: 0.015,   output: 0.075   },
};

export function estimateAnthropicCost(
  model: AnthropicModel,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = COST_PER_1K[model] ?? COST_PER_1K[ANTHROPIC_MODELS.SONNET];
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

export async function callAnthropic(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<ProviderResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const model = (config.model as AnthropicModel) ?? ANTHROPIC_MODELS.SONNET;
  const maxTokens = config.maxTokens ?? 2048;
  const systemPrompt = config.systemPrompt ?? "You are Javari AI, a helpful assistant.";

  const startTime = Date.now();

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  if (config.tools && config.tools.length > 0) {
    body.tools = config.tools;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
    stop_reason: string;
  };

  const latencyMs = Date.now() - startTime;
  const text = data.content
    .filter(b => b.type === "text")
    .map(b => b.text ?? "")
    .join("");

  const cost = estimateAnthropicCost(model, data.usage.input_tokens, data.usage.output_tokens);

  return {
    provider: "anthropic",
    model,
    content: text,
    tokensIn: data.usage.input_tokens,
    tokensOut: data.usage.output_tokens,
    estimatedCost: cost,
    latencyMs,
    stopReason: data.stop_reason,
  };
}

export async function* streamAnthropic(
  messages: ChatMessage[],
  config: ProviderConfig
): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const model = (config.model as AnthropicModel) ?? ANTHROPIC_MODELS.SONNET;
  const maxTokens = config.maxTokens ?? 2048;
  const systemPrompt = config.systemPrompt ?? "You are Javari AI, a helpful assistant.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Anthropic stream error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const event = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text?: string };
            message?: { usage: { input_tokens: number; output_tokens: number } };
            usage?: { input_tokens: number; output_tokens: number };
          };

          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            yield { type: "text", content: event.delta.text ?? "" };
          }
          if (event.type === "message_start" && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens;
          }
          if (event.type === "message_delta" && event.usage) {
            outputTokens = event.usage.output_tokens;
          }
          if (event.type === "message_stop") {
            const cost = estimateAnthropicCost(model, inputTokens, outputTokens);
            yield {
              type: "done",
              tokensIn: inputTokens,
              tokensOut: outputTokens,
              estimatedCost: cost,
              provider: "anthropic",
              model,
            };
          }
        } catch {
          // Malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
