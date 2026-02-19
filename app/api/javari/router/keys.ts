// app/api/javari/router/keys.ts
// Vault-integrated key resolver for the Javari multi-AI router.
// All keys resolved through vault (cache → encrypted env → plaintext env → alias).
// Timestamp: 2026-02-18 16:45 EST

import { vault } from "@/lib/javari/secrets/vault";

export function resolveKey(model: string): string {
  if (model.startsWith("openai")) {
    return vault.get("openai") ?? process.env.OPENAI_API_KEY ?? "";
  }
  if (model.startsWith("anthropic")) {
    return vault.get("anthropic") ?? process.env.ANTHROPIC_API_KEY ?? "";
  }
  if (model.startsWith("mistral")) {
    return vault.get("mistral") ?? process.env.MISTRAL_API_KEY ?? "";
  }
  if (model.startsWith("meta") || model.includes("llama")) {
    // META_API_KEY not in vault registry (not a primary provider) — direct env
    return process.env.META_API_KEY ?? "";
  }
  if (model.startsWith("xai") || model.includes("grok")) {
    return vault.get("xai") ?? process.env.XAI_API_KEY ?? "";
  }
  if (model.startsWith("groq")) {
    return vault.get("groq") ?? process.env.GROQ_API_KEY ?? "";
  }
  if (model.startsWith("together")) {
    return process.env.TOGETHER_API_KEY ?? "";
  }
  if (model.startsWith("perplexity")) {
    return vault.get("perplexity") ?? process.env.PERPLEXITY_API_KEY ?? "";
  }
  if (model.startsWith("cohere")) {
    return vault.get("cohere") ?? process.env.COHERE_API_KEY ?? "";
  }
  if (model.startsWith("huggingface")) {
    return process.env.HUGGINGFACE_API_KEY ?? "";
  }
  if (model.includes("openrouter") || model.includes("or/")) {
    return vault.get("openrouter") ?? process.env.OPENROUTER_API_KEY ?? "";
  }
  return "";
}
