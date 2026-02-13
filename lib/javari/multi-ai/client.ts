// lib/javari/multi-ai/client.ts
// Client library for Multi-AI API integration

import { MultiAIMode } from '@/components/multi/ModeSelector';

export interface MultiChatRequest {
  message: string;
  mode?: MultiAIMode;
  model?: string;
  policy?: {
    maxCostPerRequest?: number;
    preferredProviders?: string[];
  };
}

export interface MultiChatResponse {
  response: string;
  routing: {
    selectedModel: string;
    modelId: string;
    provider: string;
    reason: string;
    costEstimate: number;
    confidence: number;
    executionTime: number;
  };
  success: boolean;
}

export interface CouncilRequest {
  message: string;
  config?: {
    architect?: string;
    builder?: string;
    validator?: string;
    summarizer?: string;
  };
}

export interface CouncilStep {
  step: number;
  role: 'architect' | 'builder' | 'validator' | 'summarizer';
  model: string;
  modelId: string;
  provider: string;
  duration?: number;
  success?: boolean;
  error?: string;
  responsePreview?: string;
}

export interface CouncilResponse {
  success: boolean;
  finalOutput: string;
  steps: CouncilStep[];
  metrics: {
    totalDuration: number;
    totalCost: number;
    stepsCompleted: number;
    stepsFailed: number;
  };
}

export class MultiAIClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async chat(request: MultiChatRequest): Promise<MultiChatResponse> {
    const response = await fetch(`${this.baseUrl}/api/multi/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chat request failed');
    }

    return response.json();
  }

  async council(request: CouncilRequest): Promise<CouncilResponse> {
    const response = await fetch(`${this.baseUrl}/api/multi/council`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Council request failed');
    }

    return response.json();
  }

  async analyze(prompt: string, mode?: MultiAIMode) {
    const response = await fetch(`${this.baseUrl}/api/multi/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analyze request failed');
    }

    return response.json();
  }
}

// Singleton instance
export const multiAI = new MultiAIClient();
