export interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  models: string[];
  defaultModel: string;
}

export const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4-turbo-preview'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    enabled: true,
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-sonnet-20240229'
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    enabled: true,
    models: ['mixtral-8x7b-32768', 'llama2-70b-4096'],
    defaultModel: 'mixtral-8x7b-32768'
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    enabled: true,
    models: ['mistral-large-latest', 'mistral-medium-latest'],
    defaultModel: 'mistral-large-latest'
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    enabled: true,
    models: ['grok-1'],
    defaultModel: 'grok-1'
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    enabled: true,
    models: ['pplx-70b-online', 'pplx-7b-chat'],
    defaultModel: 'pplx-70b-online'
  },
  together: {
    id: 'together',
    name: 'Together AI',
    enabled: true,
    models: ['meta-llama/Llama-2-70b-chat-hf'],
    defaultModel: 'meta-llama/Llama-2-70b-chat-hf'
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace',
    enabled: true,
    models: ['mistralai/Mixtral-8x7B-Instruct-v0.1'],
    defaultModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1'
  }
};

export type ChatMode = 'single' | 'super' | 'advanced' | 'roadmap';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  mode?: ChatMode;
  timestamp: number;
  metadata?: {
    reasoning?: string;
    councilVotes?: CouncilVote[];
    steps?: ReasoningStep[];
  };
}

export interface CouncilVote {
  provider: string;
  response: string;
  confidence: number;
  reasoning?: string;
}

export interface ReasoningStep {
  step: number;
  action: string;
  result: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: ChatMode;
  provider: string;
  createdAt: number;
  updatedAt: number;
}
