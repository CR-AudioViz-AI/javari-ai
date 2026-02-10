export const KEY_MAP = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  meta: process.env.META_API_KEY,
  xai: process.env.XAI_API_KEY
};

export function resolveKey(model: string): string | undefined {
  if (model.startsWith("openai")) return KEY_MAP.openai;
  if (model.startsWith("anthropic")) return KEY_MAP.anthropic;
  if (model.startsWith("mistral")) return KEY_MAP.mistral;
  if (model.startsWith("meta")) return KEY_MAP.meta;
  if (model.startsWith("xai")) return KEY_MAP.xai;
  return undefined;
}
