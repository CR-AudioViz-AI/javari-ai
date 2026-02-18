// lib/javari/multi-ai/model-registry.ts
// Comprehensive model registry for Multi-AI Council

export interface ModelMetadata {
  id: string;
  provider: string;
  name: string;
  speed: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  cost: 'free' | 'low' | 'medium' | 'high' | 'premium';
  reliability: number; // 0-1 score
  capabilities: {
    reasoning: number; // 0-10
    coding: number; // 0-10
    analysis: number; // 0-10
    speed: number; // 0-10 (requests/sec)
  };
  limits: {
    rpm: number; // requests per minute
    tpm: number; // tokens per minute
    contextWindow: number;
  };
  pricing: {
    inputPerMillion: number; // USD
    outputPerMillion: number; // USD
  };
  available: boolean;
  fallbackPriority: number; // Lower = higher priority
}

export const MODEL_REGISTRY: Record<string, ModelMetadata> = {
  // OpenAI - o-series (Reasoning)
  'o1': {
    id: 'o1',
    provider: 'openai',
    name: 'GPT-o1',
    speed: 'slow',
    cost: 'premium',
    reliability: 0.98,
    capabilities: { reasoning: 10, coding: 9, analysis: 10, speed: 3 },
    limits: { rpm: 500, tpm: 150000, contextWindow: 128000 },
    pricing: { inputPerMillion: 15.00, outputPerMillion: 60.00 },
    available: true,
    fallbackPriority: 10
  },
  'o1-mini': {
    id: 'o1-mini',
    provider: 'openai',
    name: 'GPT-o1-mini',
    speed: 'medium',
    cost: 'high',
    reliability: 0.97,
    capabilities: { reasoning: 9, coding: 8, analysis: 9, speed: 5 },
    limits: { rpm: 500, tpm: 150000, contextWindow: 128000 },
    pricing: { inputPerMillion: 3.00, outputPerMillion: 12.00 },
    available: true,
    fallbackPriority: 8
  },
  
  // OpenAI - GPT-4 series
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    speed: 'fast',
    cost: 'high',
    reliability: 0.96,
    capabilities: { reasoning: 8, coding: 9, analysis: 8, speed: 7 },
    limits: { rpm: 5000, tpm: 800000, contextWindow: 128000 },
    pricing: { inputPerMillion: 2.50, outputPerMillion: 10.00 },
    available: true,
    fallbackPriority: 5
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o-mini',
    speed: 'fast',
    cost: 'low',
    reliability: 0.95,
    capabilities: { reasoning: 7, coding: 8, analysis: 7, speed: 8 },
    limits: { rpm: 10000, tpm: 2000000, contextWindow: 128000 },
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.60 },
    available: true,
    fallbackPriority: 3
  },
  
  // Anthropic - Claude series
  'claude-sonnet-4': {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    name: 'Claude Sonnet 4',
    speed: 'medium',
    cost: 'medium',
    reliability: 0.97,
    capabilities: { reasoning: 9, coding: 10, analysis: 9, speed: 6 },
    limits: { rpm: 4000, tpm: 400000, contextWindow: 200000 },
    pricing: { inputPerMillion: 3.00, outputPerMillion: 15.00 },
    available: true,
    fallbackPriority: 4
  },
  'claude-haiku-4': {
    id: 'claude-haiku-4-20250101',
    provider: 'anthropic',
    name: 'Claude Haiku 4',
    speed: 'fast',
    cost: 'low',
    reliability: 0.94,
    capabilities: { reasoning: 7, coding: 8, analysis: 7, speed: 9 },
    limits: { rpm: 5000, tpm: 500000, contextWindow: 200000 },
    pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25 },
    available: true,
    fallbackPriority: 2
  },
  
  // Google -series
  '-2-flash': {
    id: '-2.0-flash-exp',
    provider: 'google',
    name: '2.0 Flash',
    speed: 'ultra-fast',
    cost: 'free',
    reliability: 0.92,
    capabilities: { reasoning: 7, coding: 7, analysis: 8, speed: 10 },
    limits: { rpm: 15, tpm: 1000000, contextWindow: 1000000 },
    pricing: { inputPerMillion: 0.00, outputPerMillion: 0.00 },
    available: false, // provider not implemented
    fallbackPriority: 1
  },
  '-pro': {
    id: '-1.5-pro',
    provider: 'google',
    name: '1.5 Pro',
    speed: 'medium',
    cost: 'low',
    reliability: 0.93,
    capabilities: { reasoning: 8, coding: 7, analysis: 8, speed: 6 },
    limits: { rpm: 360, tpm: 4000000, contextWindow: 2000000 },
    pricing: { inputPerMillion: 1.25, outputPerMillion: 5.00 },
    available: false, // provider not implemented
    fallbackPriority: 6
  },
  
  // Groq - Ultra-fast inference
  'groq-llama': {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B (Groq)',
    speed: 'ultra-fast',
    cost: 'free',
    reliability: 0.90,
    capabilities: { reasoning: 6, coding: 7, analysis: 6, speed: 10 },
    limits: { rpm: 30, tpm: 20000, contextWindow: 128000 },
    pricing: { inputPerMillion: 0.00, outputPerMillion: 0.00 },
    available: true,
    fallbackPriority: 1
  },
  
  // DeepSeek - Low cost
  'deepseek': {
    id: 'deepseek-chat',
    provider: 'deepseek',
    name: 'DeepSeek Chat',
    speed: 'medium',
    cost: 'free',
    reliability: 0.88,
    capabilities: { reasoning: 7, coding: 8, analysis: 7, speed: 5 },
    limits: { rpm: 60, tpm: 10000000, contextWindow: 64000 },
    pricing: { inputPerMillion: 0.00, outputPerMillion: 0.00 },
    available: true,
    fallbackPriority: 1
  },
  
  // Mistral
  'mistral-large': {
    id: 'mistral-large-latest',
    provider: 'mistral',
    name: 'Mistral Large',
    speed: 'fast',
    cost: 'medium',
    reliability: 0.93,
    capabilities: { reasoning: 8, coding: 8, analysis: 8, speed: 7 },
    limits: { rpm: 1, tpm: 1000000, contextWindow: 128000 },
    pricing: { inputPerMillion: 2.00, outputPerMillion: 6.00 },
    available: true,
    fallbackPriority: 7
  }
};

export function getModel(modelId: string): ModelMetadata | null {
  return MODEL_REGISTRY[modelId] || null;
}

export function getAvailableModels(): ModelMetadata[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.available);
}

export function getModelsByProvider(provider: string): ModelMetadata[] {
  return Object.values(MODEL_REGISTRY).filter(
    m => m.provider === provider && m.available
  );
}

export function getFreeModels(): ModelMetadata[] {
  return Object.values(MODEL_REGISTRY).filter(
    m => m.cost === 'free' && m.available
  );
}

export function getFallbackModel(): ModelMetadata {
  const available = getAvailableModels();
  return available.sort((a, b) => a.fallbackPriority - b.fallbackPriority)[0];
}

export function selectModelByTask(task: {
  needsReasoning?: boolean;
  needsSpeed?: boolean;
  needsCoding?: boolean;
  maxCost?: 'free' | 'low' | 'medium' | 'high' | 'premium';
}): ModelMetadata {
  const available = getAvailableModels();
  
  // Filter by cost constraint
  const costOrder = { 'free': 0, 'low': 1, 'medium': 2, 'high': 3, 'premium': 4 };
  const maxCostLevel = task.maxCost ? costOrder[task.maxCost] : 4;
  const affordable = available.filter(m => costOrder[m.cost] <= maxCostLevel);
  
  if (affordable.length === 0) return getFallbackModel();
  
  // Score each model
  const scored = affordable.map(model => {
    let score = 0;
    
    if (task.needsReasoning) {
      score += model.capabilities.reasoning * 2;
    }
    if (task.needsSpeed) {
      score += model.capabilities.speed * 2;
    }
    if (task.needsCoding) {
      score += model.capabilities.coding * 2;
    }
    
    // Reliability bonus
    score += model.reliability * 10;
    
    // Cost penalty (prefer cheaper when equal capability)
    score -= costOrder[model.cost] * 0.5;
    
    return { model, score };
  });
  
  // Return highest scoring model
  scored.sort((a, b) => b.score - a.score);
  return scored[0].model;
}
