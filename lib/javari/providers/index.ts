// lib/javari/providers/index.ts
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GroqProvider } from './GroqProvider';
import { AIProvider } from '../router/types';

export { BaseProvider, OpenAIProvider, AnthropicProvider, GroqProvider };

export function getProvider(provider: AIProvider, apiKey: string): BaseProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    default:
      throw new Error(`Provider ${provider} not yet implemented`);
  }
}

export function getProviderApiKey(provider: AIProvider): string {
  const keyMap: Record<string, string> = {
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'groq': 'GROQ_API_KEY',
  };

  const envKey = keyMap[provider];
  const key = process.env[envKey];
  
  if (!key) {
    throw new Error(`Missing ${envKey} for ${provider}`);
  }
  
  return key;
}
