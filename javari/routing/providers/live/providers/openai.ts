import type {
  ProviderAdapter,
  LiveProviderExecuteOptions,
  LiveProviderResult,
} from "../types";

// Lazy-loaded OpenAI SDK wrapper
let OpenAIClient: any = null;

async function loadClient() {
  if (OpenAIClient) return OpenAIClient;
  const mod = await import("openai");
  OpenAIClient = mod.default;
  return OpenAIClient;
}

export const openaiAdapter: ProviderAdapter = {
  id: "openai-gpt4-turbo",
  name: "OpenAI GPT-4 Turbo",
  capabilities: {
    chat: true,
    json: true,
    stream: false, // Streaming enabled in Step 85
    embed: false,
  },

  async executeLive(opts: LiveProviderExecuteOptions): Promise<LiveProviderResult> {
    // Global guard
    if (process.env.JAVARI_LIVE_PROVIDERS_ENABLED !== "true") {
      return {
        ok: false,
        rawOutput: "Live provider calls disabled (safe mode)",
        tokensUsed: 0,
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        ok: false,
        rawOutput: "Missing OPENAI_API_KEY",
        tokensUsed: 0,
      };
    }

    const Client = await loadClient();
    const client = new Client({ apiKey: process.env.OPENAI_API_KEY });

    const inputText =
      typeof opts.input === "string"
        ? opts.input
        : JSON.stringify(opts.input, null, 2);

    const maxTokens = opts.tokens ?? 500;

    try {
      const t0 = Date.now();

      const response = await client.chat.completions.create({
        model: "gpt-4-turbo",
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: inputText,
          },
        ],
      });

      const t1 = Date.now();

      const text = response?.choices?.[0]?.message?.content ?? "";

      return {
        ok: true,
        rawOutput: text,
        tokensUsed: response?.usage?.total_tokens ?? maxTokens,
        model: "gpt-4-turbo",
        latencyMs: t1 - t0,
        finishReason: response?.choices?.[0]?.finish_reason ?? "unknown",
      };
    } catch (err: any) {
      return {
        ok: false,
        rawOutput:
          "OpenAI live call failed: " + (err?.message ?? "Unknown error"),
        tokensUsed: 0,
      };
    }
  },
};
