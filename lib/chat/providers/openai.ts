// lib/chat/providers/openai.ts
// Purpose: OpenAI provider for Multi-AI Chat Router
// Supports: streaming, tool hooks, cost estimation
// Date: 2026-03-07

import { ChatMessage, ProviderResponse, StreamChunk, ProviderConfig } from "../types";

export const OPENAI_MODELS = {
  GPT4O:       "gpt-4o",
  GPT4O_MINI:  "gpt-4o-mini",
  O3_MINI:     "o3-mini",
} as const;

export type OpenAIModel = typeof OPENAI_MODELS[keyof typeof OPENAI_MODELS];

// Cost per 1K tokens (USD)
const COST_PER_1K: Record<OpenAIModel, { input: number; output: number }> = {
  [OPENAI_MODELS.GPT4O_MINI]: { input: 0.00015, output: 0.0006 },
  [OPENAI_MODELS.GPT4O]:      { input: 0.005,   output: 0.015  },
  [OPENAI_MODELS.O3_MINI]:    { input: 0.0011,  output: 0.0044 },
};

export function estimateOpenAICost(
  model: OpenAIModel,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = COST_PER_1K[model] ?? COST_PER_1K[OPENAI_MODELS.GPT4O_MINI];
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

export async function callOpenAI(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<ProviderResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const model = (config.model as OpenAIModel) ?? OPENAI_MODELS.GPT4O_MINI;
  const maxTokens = config.maxTokens ?? 2048;

  const startTime = Date.now();

  const apiMessages = [
    ...(config.systemPrompt
      ? [{ role: "system" as const, content: config.systemPrompt }]
      : []),
    ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: apiMessages,
  };

  if (config.tools && config.tools.length > 0) {
    body.tools = config.tools;
    body.tool_choice = "auto";
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string | null }; finish_reason: string }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const latencyMs = Date.now() - startTime;
  const content = data.choices[0]?.message?.content ?? "";
  const cost = estimateOpenAICost(model, data.usage.prompt_tokens, data.usage.completion_tokens);

  return {
    provider: "openai",
    model,
    content,
    tokensIn: data.usage.prompt_tokens,
    tokensOut: data.usage.completion_tokens,
    estimatedCost: cost,
    latencyMs,
    stopReason: data.choices[0]?.finish_reason ?? "stop",
  };
}

export async function* streamOpenAI(
  messages: ChatMessage[],
  config: ProviderConfig
): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const model = (config.model as OpenAIModel) ?? OPENAI_MODELS.GPT4O_MINI;
  const maxTokens = config.maxTokens ?? 2048;

  const apiMessages = [
    ...(config.systemPrompt
      ? [{ role: "system" as const, content: config.systemPrompt }]
      : []),
    ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: apiMessages,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 30000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenAI stream error ${response.status}`);
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
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
            usage?: { prompt_tokens: number; completion_tokens: number } | null;
          };

          const delta = event.choices?.[0]?.delta?.content;
          if (delta) yield { type: "text", content: delta };

          if (event.usage) {
            inputTokens = event.usage.prompt_tokens;
            outputTokens = event.usage.completion_tokens;
          }

          if (event.choices?.[0]?.finish_reason) {
            const cost = estimateOpenAICost(model, inputTokens, outputTokens);
            yield {
              type: "done",
              tokensIn: inputTokens,
              tokensOut: outputTokens,
              estimatedCost: cost,
              provider: "openai",
              model,
            };
          }
        } catch {
          // Malformed SSE — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
