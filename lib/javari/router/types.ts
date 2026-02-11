// lib/javari/router/types.ts
export type ChatMode = 'single' | 'super' | 'advanced' | 'roadmap';
export type AIProvider = 'openai' | 'anthropic' | 'groq' | 'mistral' | 'xai' | 'deepseek' | 'cohere';

export interface RouterRequest {
  message: string;
  mode: ChatMode;
  provider?: AIProvider;
  sessionId?: string;
  history?: Message[];
  options?: RouterOptions;
}

export interface RouterOptions {
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  stream?: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface ProviderResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokens: {
    input: number;
    output: number;
  };
  latency: number;
  cost: number;
}

export interface CouncilVote {
  provider: AIProvider;
  response: string;
  confidence: number;
  reasoning?: string;
  validated: boolean;
  error?: string;
}

export interface StreamEvent {
  type: 'token' | 'council' | 'final' | 'error';
  data: any;
}

export interface RoadmapStep {
  step: number;
  title: string;
  description: string;
  dependencies: number[];
  estimatedTime?: string;
}

export interface RoadmapPlan {
  title: string;
  objective: string;
  steps: RoadmapStep[];
  totalSteps: number;
  reasoning: string;
}
