// lib/javari/providers.ts
// Javari AI Provider Registry
// All API key access goes through vault — never direct process.env

import vault, { type ProviderName } from "./secrets/vault";

// ── Provider Interface ────────────────────────────────────────────────────────
export interface JavariProvider {
  name: string;
  generateStream(
    prompt: string,
    options: { rolePrompt?: string; preferredModel?: string }
  ): AsyncIterable<string> | AsyncIterator<string>;
}

// ── Provider factory ──────────────────────────────────────────────────────────
export function getProviderApiKey(
  providerName: "openai" | "anthropic" | "mistral" | "groq" | "gemini" | "openrouter"
): string {
  const vaultName = providerName as ProviderName;
  const key = vault.get(vaultName);
  if (!key) {
    throw new Error(`[Providers] API key missing for provider: ${providerName}`);
  }
  return key;
}

// ── OpenAI Provider ───────────────────────────────────────────────────────────
function createOpenAIProvider(apiKey: string): JavariProvider {
  return {
    name: "openai",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel || "gpt-4o-mini";
      const messages = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 120)}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch { /* skip malformed chunk */ }
        }
      }
    },
  };
}

// ── Anthropic Provider ────────────────────────────────────────────────────────
function createAnthropicProvider(apiKey: string): JavariProvider {
  return {
    name: "anthropic",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel || "claude-sonnet-4-20250514";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: rolePrompt || undefined,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${err.slice(0, 120)}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          try {
            const json = JSON.parse(data);
            if (json.type === "content_block_delta") {
              const text = json.delta?.text;
              if (text) yield text;
            }
          } catch { /* skip */ }
        }
      }
    },
  };
}

// ── Mistral Provider ──────────────────────────────────────────────────────────
function createMistralProvider(apiKey: string): JavariProvider {
  return {
    name: "mistral",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel || "mistral-small-latest";
      const messages = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!res.ok) throw new Error(`Mistral error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch { /* skip */ }
        }
      }
    },
  };
}

// ── OpenRouter Provider (multi-model fallback) ────────────────────────────────
function createOpenRouterProvider(apiKey: string): JavariProvider {
  return {
    name: "openrouter",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel || "meta-llama/llama-3.3-70b-instruct";
      const messages = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://javariai.com",
          "X-Title": "Javari OS",
        },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch { /* skip */ }
        }
      }
    },
  };
}

// ── Groq Provider ─────────────────────────────────────────────────────────────
function createGroqProvider(apiKey: string): JavariProvider {
  return {
    name: "groq",
    async *generateStream(prompt, { rolePrompt, preferredModel } = {}) {
      const model = preferredModel || "llama-3.1-8b-instant";
      const messages = [];
      if (rolePrompt) messages.push({ role: "system", content: rolePrompt });
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!res.ok) throw new Error(`Groq error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") return;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch { /* skip */ }
        }
      }
    },
  };
}

// ── Provider Registry ─────────────────────────────────────────────────────────
export function getProvider(
  providerName: "openai" | "anthropic" | "mistral" | "groq" | "gemini" | "openrouter",
  apiKey: string
): JavariProvider {
  switch (providerName) {
    case "openai":      return createOpenAIProvider(apiKey);
    case "anthropic":   return createAnthropicProvider(apiKey);
    case "mistral":     return createMistralProvider(apiKey);
    case "groq":        return createGroqProvider(apiKey);
    case "openrouter":  return createOpenRouterProvider(apiKey);
    default:
      // Fallback: treat as OpenAI-compatible
      return createOpenAIProvider(apiKey);
  }
}
