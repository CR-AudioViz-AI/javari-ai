export function resolveKey(model: string): string {
  if (model.startsWith("openai")) {
    return process.env.OPENAI_API_KEY || "";
  }
  if (model.startsWith("anthropic")) {
    return process.env.ANTHROPIC_API_KEY || "";
  }
  if (model.startsWith("mistral")) {
    return process.env.MISTRAL_API_KEY || "";
  }
  if (model.startsWith("meta") || model.includes("llama")) {
    return process.env.META_API_KEY || "";
  }
  if (model.startsWith("xai") || model.includes("grok")) {
    return process.env.XAI_API_KEY || "";
  }
  if (model.startsWith("groq")) {
    return process.env.GROQ_API_KEY || "";
  }
  if (model.startsWith("together")) {
    return process.env.TOGETHER_API_KEY || "";
  }
  if (model.startsWith("perplexity")) {
    return process.env.PERPLEXITY_API_KEY || "";
  }
  if (model.startsWith("cohere")) {
    return process.env.COHERE_API_KEY || "";
  }
  if (model.startsWith("huggingface")) {
    return process.env.HUGGINGFACE_API_KEY || "";
  }
  return "";
}
