// lib/javari/providers/index.ts
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { AIProvider } from '../router/types';

export { BaseProvider, OpenAIProvider, AnthropicProvider };

export function getProvider(provider: AIProvider, apiKey: string): BaseProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    default:
      throw new Error(`Provider ${provider} not yet implemented`);
  }
}

export function getProviderApiKey(provider: AIProvider): string {
  const key = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (!key) {
    throw new Error(`Missing API key for ${provider}`);
  }
  return key;
}
