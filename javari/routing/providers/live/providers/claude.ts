// Provider: Anthropic Claude Sonnet
import type {
  ProviderAdapter,
  LiveProviderExecuteOptions,
  LiveProviderResult,
} from "../types";

// Lazy import so build does not fail w/o SDK installed
let AnthropicClient: any = null;

async function loadClient() {
  if (AnthropicClient) return AnthropicClient;
  const mod = await import("@anthropic-ai/sdk");
  AnthropicClient = mod.Anthropic;
  return AnthropicClient;
}

export const claudeAdapter: ProviderAdapter = {
  id: "anthropic-claude-sonnet",
  name: "Anthropic Claude Sonnet",
  capabilities: {
    chat: true,
    json: true,
    stream: false, // Enable in Step 84
    embed: false,
  },

  async executeLive(opts: LiveProviderExecuteOptions): Promise<LiveProviderResult> {
    // Global safety switch
    if (process.env.JAVARI_LIVE_PROVIDERS_ENABLED !== "true") {
      return {
        ok: false,
        rawOutput: "Live provider calls disabled (safe mode)",
        tokensUsed: 0,
      };
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        ok: false,
        rawOutput: "Missing ANTHROPIC_API_KEY",
        tokensUsed: 0,
      };
    }

    // Load SDK lazily
    const Client = await loadClient();
    const client = new Client({ apiKey: process.env.ANTHROPIC_API_KEY });

    const inputText =
      typeof opts.input === "string"
        ? opts.input
        : JSON.stringify(opts.input, null, 2);

    const maxTokens = opts.tokens ?? 500;

    try {
      const t0 = Date.now();

      const response = await client.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: inputText,
          },
        ],
      });

      const t1 = Date.now();

      const text =
        response?.content?.[0]?.text ??
        "[Claude: Empty response received]";

      return {
        ok: true,
        rawOutput: text,
        tokensUsed: maxTokens,
        model: "claude-3-sonnet-20240229",
        finishReason: response.stop_reason ?? "unknown",
        latencyMs: t1 - t0,
      };
    } catch (err: any) {
      return {
        ok: false,
        rawOutput:
          "Claude Live call failed: " +
          (err?.message ?? "Unknown error"),
        tokensUsed: 0,
      };
    }
  },
};
