// lib/javari/providers.ts
// Javari Provider Registry — vault-powered, edge-safe.
// All API key access goes through vault.get() — no direct process.env calls.

import vault, { type ProviderName } from "./secrets/vault";

export interface JavariProvider {
  name: string;
  generateStream(
    prompt: string,
    options?: { rolePrompt?: string; preferredModel?: string }
  ): AsyncIterable<string> | AsyncIterator<string>;
}

/** Resolve an API key by provider name — throws if missing. */
export function getProviderApiKey(
  providerName: "openai" | "anthropic" | "mistral" | "groq" | "gemini" | "openrouter"
): string {
  const key = vault.get(providerName as ProviderName);
  if (!key) throw new Error(`[Providers] API key missing for: ${providerName}`);
  return key;
}

// ── SSE stream helpers ────────────────────────────────────────────────────────
async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content
          ?? json.delta?.text    // Anthropic streaming
          ?? null;
        if (content) yield content;
      } catch { /* skip bad chunk */ }
    }
  }
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
function createOpenAIProvider(apiKey: string): JavariProvider {
  return {
    name: "openai",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel ?? "gpt-4o-mini";
      const messages: Array<{role:string;content:string}> = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`OpenAI ${res.status}`);
      yield* parseSSEStream(res.body);
    },
  };
}

// ── Anthropic ─────────────────────────────────────────────────────────────────
function createAnthropicProvider(apiKey: string): JavariProvider {
  return {
    name: "anthropic",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel ?? "claude-sonnet-4-20250514";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: 4096,
          system: rolePrompt ?? undefined,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Anthropic ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6).trim());
            if (json.type === "content_block_delta" && json.delta?.text) yield json.delta.text;
          } catch { /* skip */ }
        }
      }
    },
  };
}

// ── Mistral ───────────────────────────────────────────────────────────────────
function createMistralProvider(apiKey: string): JavariProvider {
  return {
    name: "mistral",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel ?? "mistral-small-latest";
      const messages: Array<{role:string;content:string}> = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`Mistral ${res.status}`);
      yield* parseSSEStream(res.body);
    },
  };
}

// ── OpenRouter ────────────────────────────────────────────────────────────────
function createOpenRouterProvider(apiKey: string): JavariProvider {
  return {
    name: "openrouter",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel ?? "meta-llama/llama-3.3-70b-instruct";
      const messages: Array<{role:string;content:string}> = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://javariai.com", "X-Title": "Javari OS" },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`OpenRouter ${res.status}`);
      yield* parseSSEStream(res.body);
    },
  };
}

// ── Groq ──────────────────────────────────────────────────────────────────────
function createGroqProvider(apiKey: string): JavariProvider {
  return {
    name: "groq",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel ?? "llama-3.1-8b-instant";
      const messages: Array<{role:string;content:string}> = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`Groq ${res.status}`);
      yield* parseSSEStream(res.body);
    },
  };
}

/** Get a provider instance by name with a provided API key. */
export function getProvider(
  providerName: "openai" | "anthropic" | "mistral" | "groq" | "gemini" | "openrouter",
  apiKey: string
): JavariProvider {
  switch (providerName) {
    case "openai":     return createOpenAIProvider(apiKey);
    case "anthropic":  return createAnthropicProvider(apiKey);
    case "mistral":    return createMistralProvider(apiKey);
    case "groq":       return createGroqProvider(apiKey);
    case "openrouter": return createOpenRouterProvider(apiKey);
    default:           return createOpenAIProvider(apiKey); // OpenAI-compat fallback
  }
}
