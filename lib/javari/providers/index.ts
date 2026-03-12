// lib/javari/providers/index.ts
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { PerplexityProvider } from './PerplexityProvider';
import { MistralProvider } from './MistralProvider';
import { GroqProvider } from './GroqProvider';
import { XAIProvider } from './XAIProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { CohereProvider } from './CohereProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { AIProvider } from '../router/types';
import { vault } from '@/lib/javari/secrets/vault';
// Re-export all providers
  // ── Primary: vault (handles aliases, encryption, multi-var lookup) ──
  // ── Fallback: direct process.env ──────────────────────────────────────
  // Return empty string — BaseProvider.requireApiKey() will throw a clear
  // error at stream time, enabling fallback rather than crashing the router.
export default {}
