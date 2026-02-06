import type {
  ProviderAdapter,
  LiveProviderExecuteOptions,
  LiveProviderResult,
} from "../types";

// Lazy-loaded Llama SDK wrapper
let MetaLlamaClient: any = null;

async function loadClient() {
  if (MetaLlamaClient) return MetaLlamaClient;
  const mod = await import("@meta-llama/llama"); 
  MetaLlamaClient = mod.Llama;
  return MetaLlamaClient;
}

export const llamaAdapter: ProviderAdapter = {
  id: "meta-llama-3-8b",
  name: "Meta Llama 3 8B",
  capabilities: {
    chat: true,
    json: true,
    stream: false, // Will be enabled in Step 87
    embed: false,
  },

  async executeLive(opts: LiveProviderExecuteOptions): Promise<LiveProviderResult> {
    // Global safety gate
    if (process.env.JAVARI_LIVE_PROVIDERS_ENABLED !== "true") {
      return {
        ok: false,
        rawOutput: "Live provider calls disabled (safe mode)",
        tokensUsed: 0,
      };
    }

    if (!process.env.META_LLAMA_API_KEY) {
      return {
        ok: false,
        rawOutput: "Missing META_LLAMA_API_KEY",
        tokensUsed: 0,
      };
    }

    const Client = await loadClient();
    const client = new Client({
      apiKey: process.env.META_LLAMA_API_KEY,
    });

    const inputText =
      typeof opts.input === "string"
        ? opts.input
        : JSON.stringify(opts.input, null, 2);

    const maxTokens = opts.tokens ?? 500;

    try {
      const t0 = Date.now();

      const response = await client.generate({
        model: "llama-3-8b-chat",
        prompt: inputText,
        max_new_tokens: maxTokens,
        temperature: 0.2,
      });

      const t1 = Date.now();

      return {
        ok: true,
        rawOutput: response?.text ?? "",
        tokensUsed: response?.usage?.total_tokens ?? maxTokens,
        model: "llama-3-8b-chat",
        latencyMs: t1 - t0,
        finishReason: response?.finish_reason ?? "end",
      };
    } catch (err: any) {
      return {
        ok: false,
        rawOutput:
          "Llama live call failed: " + (err?.message ?? "Unknown error"),
        tokensUsed: 0,
      };
    }
  },
};
