import type {
  ProviderAdapter,
  LiveProviderExecuteOptions,
  LiveProviderResult,
} from "../types";

// Lazy-load Mistral client only when needed
let MistralClient: any = null;

async function loadClient() {
  if (MistralClient) return MistralClient;
  const mod = await import("@mistralai/mistralai");
  MistralClient = mod.MistralClient;
  return MistralClient;
}

export const mistralAdapter: ProviderAdapter = {
  id: "mistral-mixtral-8x7b",
  name: "Mistral Mixtral 8x7B",
  capabilities: {
    chat: true,
    json: true,
    stream: false, // Will be enabled in Step 87
    embed: false,
  },

  async executeLive(opts: LiveProviderExecuteOptions): Promise<LiveProviderResult> {
    // Safety gate
    if (process.env.JAVARI_LIVE_PROVIDERS_ENABLED !== "true") {
      return {
        ok: false,
        rawOutput: "Live provider calls disabled (safe mode)",
        tokensUsed: 0,
      };
    }

    if (!process.env.MISTRAL_API_KEY) {
      return {
        ok: false,
        rawOutput: "Missing MISTRAL_API_KEY",
        tokensUsed: 0,
      };
    }

    const Client = await loadClient();
    const client = new Client(process.env.MISTRAL_API_KEY);

    const inputText =
      typeof opts.input === "string"
        ? opts.input
        : JSON.stringify(opts.input, null, 2);

    const maxTokens = opts.tokens ?? 500;

    try {
      const t0 = Date.now();

      const resp = await client.chat.complete({
        model: "mixtral-8x7b",
        messages: [{ role: "user", content: inputText }],
        max_tokens: maxTokens,
        temperature: 0.2,
      });

      const t1 = Date.now();

      const output = resp?.choices?.[0]?.message?.content ?? "";
      const tokensUsed = resp?.usage?.total_tokens ?? maxTokens;

      return {
        ok: true,
        rawOutput: output,
        tokensUsed,
        model: "mixtral-8x7b",
        latencyMs: t1 - t0,
        finishReason: resp?.choices?.[0]?.finish_reason ?? "end",
      };
    } catch (err: any) {
      return {
        ok: false,
        rawOutput: "Mistral live call failed: " + (err?.message ?? "Unknown error"),
        tokensUsed: 0,
      };
    }
  },
};
