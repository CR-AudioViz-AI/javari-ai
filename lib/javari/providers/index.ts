// lib/javari/providers/index.ts
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GroqProvider } from './GroqProvider';
import { MistralProvider } from './MistralProvider';
import { XAIProvider } from './XAIProvider';
import { DeepSeekProvider } from './DeepSeekProvider';
import { CohereProvider } from './CohereProvider';
import { AIProvider } from '../router/types';

export { 
  BaseProvider, 
  OpenAIProvider, 
  AnthropicProvider, 
  GroqProvider,
  MistralProvider,
  XAIProvider,
  DeepSeekProvider,
  CohereProvider
};

export function getProvider(provider: AIProvider, apiKey: string): BaseProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    case 'mistral':
      return new MistralProvider(apiKey);
    case 'xai':
      return new XAIProvider(apiKey);
    case 'deepseek':
      return new DeepSeekProvider(apiKey);
    case 'cohere':
      return new CohereProvider(apiKey);
    default:
      throw new Error(`Provider ${provider} not implemented`);
  }
}

export function getProviderApiKey(provider: AIProvider): string {
  const keyMap: Record<string, string> = {
    'openai': 'OPENAI_API_KEY',
    'anthropic': 'ANTHROPIC_API_KEY',
    'groq': 'GROQ_API_KEY',
    'mistral': 'MISTRAL_API_KEY',
    'xai': 'XAI_API_KEY',
    'deepseek': 'DEEPSEEK_API_KEY',
    'cohere': 'COHERE_API_KEY',
  };

  const envKey = keyMap[provider];
  const key = process.env[envKey];
  
  if (!key) {
    throw new Error(`Missing ${envKey} for ${provider}`);
  }
  
  return key;
}

export const ALL_PROVIDERS: AIProvider[] = [
  'openai',
  'anthropic',
  'groq',
  'mistral',
  'xai',
  'deepseek',
  'cohere'
];
