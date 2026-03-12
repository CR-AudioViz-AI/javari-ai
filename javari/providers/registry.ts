import type { ProviderAdapter } from "./types";
import { claudeAdapter } from "./vendor/adapterClaude";
import { openaiAdapter } from "./vendor/adapterOpenAI";
import { llamaAdapter } from "./vendor/adapterLlama";
import { mistralAdapter } from "./vendor/adapterMistral";
import { grokAdapter } from "./vendor/adapterGrok";
// Registry map
  // In future: alias resolution, version matching, fallback policies
export default {}
