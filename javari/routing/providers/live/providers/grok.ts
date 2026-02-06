// TEMPORARILY DISABLED - Missing grok-beta package
import type {
  ProviderAdapter,
  LiveProviderExecuteOptions,
  LiveProviderResult,
} from "../types";

// Lazy-load Grok client only when needed
let GrokClient: any = null;

async function loadClient() {
  if (GrokClient) return GrokClient;
  const mod = await import("grok-beta");
  GrokClient = mod.Grok;
  return GrokClient;
}

// export const grokAdapter: ProviderAdapter = {
  id: "xai-grok-beta",
  name: "xAI Grok Beta",
  capabilities: {
    chat: true,
    json: true,
    stream: false, // Will be enabled in Step 87
    embed: false,
  },

  async executeLive(opts: LiveProviderExecuteOptions): Promise<LiveProviderResult> {
    // Safety mode (must explicitly enable)
    if (process.env.JAVARI_LIVE_PROVIDERS_ENABLED !== "true") {
      return {
        ok: false,
        rawOutput: "Live provider calls disabled (safe mode)",
        tokensUsed: 0,
      };
    }

    // API Key guard
    if (!process.env.GROK_API_KEY) {
      return {
        ok: false,
        rawOutput: "Missing GROK_API_KEY",
        tokensUsed: 0,
      };
    }

    const inputText =
      typeof opts.input === "string"
        ? opts.input
        : JSON.stringify(opts.input, null, 2);

    const maxTokens = opts.tokens ?? 500;

    try {
      const t0 = Date.now();

      // Lazy-load xAI Grok client
      const Client = await loadClient();
      const client = new Client({
        apiKey: process.env.GROK_API_KEY,
      });

      const response = await client.chat.completions.create({
        model: "grok-beta",
        messages: [{ role: "user", content: inputText }],
        max_tokens: maxTokens,
      });

      const t1 = Date.now();

      const output =
        response.output_text ||
        response.choices?.[0]?.message?.content ||
        "";

      const tokens = response.usage?.total_tokens || maxTokens;

      return {
        ok: true,
        rawOutput: output,
        tokensUsed: tokens,
        model: "grok-beta",
        finishReason: response.choices?.[0]?.finish_reason ?? "stop",
        latencyMs: t1 - t0,
      };
    } catch (err: any) {
      return {
        ok: false,
        rawOutput: `Grok provider error: ${err?.message || err}`,
        tokensUsed: 0,
      };
    }
  },
};
