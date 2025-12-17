// =============================================================================
// JAVARI AI - COMPREHENSIVE AI PROVIDER CONFIGURATION
// =============================================================================
// ALL AI providers available for selection
// Production Ready - Tuesday, December 16, 2025 - 11:25 PM EST
// =============================================================================

export interface AIProvider {
  id: string;
  name: string;
  description: string;
  category: 'premium' | 'standard' | 'free' | 'specialized';
  models: AIModel[];
  strengths: string[];
  costTier: 'high' | 'medium' | 'low' | 'free';
  rateLimit: string;
  apiKeyEnv: string;
  status: 'active' | 'inactive' | 'limited';
  priority: number; // 1 = highest
}

export interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
  bestFor: string[];
  costPer1kTokens?: number;
  speed: 'fast' | 'medium' | 'slow';
}

// =============================================================================
// ALL AVAILABLE AI PROVIDERS
// =============================================================================

export const AI_PROVIDERS: AIProvider[] = [
  // ═══════════════ PREMIUM TIER ═══════════════
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'Most advanced reasoning and coding AI. Primary choice for complex tasks.',
    category: 'premium',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        contextWindow: 200000,
        bestFor: ['coding', 'analysis', 'writing', 'complex reasoning'],
        costPer1kTokens: 0.003,
        speed: 'medium'
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        bestFor: ['expert coding', 'research', 'nuanced analysis'],
        costPer1kTokens: 0.015,
        speed: 'slow'
      },
      {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude Sonnet 4.5',
        contextWindow: 200000,
        bestFor: ['balanced tasks', 'general purpose'],
        costPer1kTokens: 0.003,
        speed: 'medium'
      }
    ],
    strengths: ['Coding', 'Analysis', 'Safety', 'Long context', 'Nuanced responses'],
    costTier: 'high',
    rateLimit: '60 req/min',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    status: 'active',
    priority: 1
  },
  
  {
    id: 'openai',
    name: 'OpenAI GPT',
    description: 'Industry standard AI with broad capabilities.',
    category: 'premium',
    models: [
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        bestFor: ['general', 'creative', 'analysis'],
        costPer1kTokens: 0.01,
        speed: 'medium'
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        bestFor: ['vision', 'multimodal', 'fast responses'],
        costPer1kTokens: 0.005,
        speed: 'fast'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        bestFor: ['quick tasks', 'cost-effective'],
        costPer1kTokens: 0.00015,
        speed: 'fast'
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        contextWindow: 16385,
        bestFor: ['simple tasks', 'high volume'],
        costPer1kTokens: 0.0005,
        speed: 'fast'
      }
    ],
    strengths: ['General purpose', 'Creative writing', 'Code generation', 'Vision'],
    costTier: 'high',
    rateLimit: '500 req/min',
    apiKeyEnv: 'OPENAI_API_KEY',
    status: 'active',
    priority: 2
  },

  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Excellent for long context and multimodal tasks.',
    category: 'premium',
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        contextWindow: 2000000, // 2M tokens!
        bestFor: ['very long documents', 'multimodal', 'video analysis'],
        costPer1kTokens: 0.0025,
        speed: 'medium'
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        contextWindow: 1000000,
        bestFor: ['fast responses', 'high volume'],
        costPer1kTokens: 0.00035,
        speed: 'fast'
      }
    ],
    strengths: ['Massive context window', 'Multimodal', 'Video understanding'],
    costTier: 'medium',
    rateLimit: '60 req/min',
    apiKeyEnv: 'GOOGLE_GEMINI_API_KEY',
    status: 'active',
    priority: 3
  },

  // ═══════════════ SPECIALIZED TIER ═══════════════
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    description: 'Real-time web search + AI. Best for current information.',
    category: 'specialized',
    models: [
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Sonar Large Online',
        contextWindow: 128000,
        bestFor: ['real-time search', 'current events', 'research'],
        costPer1kTokens: 0.001,
        speed: 'medium'
      },
      {
        id: 'llama-3.1-sonar-small-128k-online',
        name: 'Sonar Small Online',
        contextWindow: 128000,
        bestFor: ['quick searches', 'fact checking'],
        costPer1kTokens: 0.0002,
        speed: 'fast'
      }
    ],
    strengths: ['Live web search', 'Citations', 'Current events', 'Research'],
    costTier: 'medium',
    rateLimit: '100 req/min',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    status: 'active',
    priority: 4
  },

  // ═══════════════ FREE TIER ═══════════════
  {
    id: 'groq',
    name: 'Groq (Ultra-Fast)',
    description: 'Blazing fast inference. 10x faster than OpenAI. FREE!',
    category: 'free',
    models: [
      {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        contextWindow: 128000,
        bestFor: ['fast responses', 'coding', 'general'],
        costPer1kTokens: 0,
        speed: 'fast'
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        contextWindow: 128000,
        bestFor: ['ultra-fast', 'simple tasks'],
        costPer1kTokens: 0,
        speed: 'fast'
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        bestFor: ['balanced', 'multilingual'],
        costPer1kTokens: 0,
        speed: 'fast'
      }
    ],
    strengths: ['Ultra-fast', 'FREE', 'High quality', 'Open source models'],
    costTier: 'free',
    rateLimit: '14,400 req/day',
    apiKeyEnv: 'GROQ_API_KEY',
    status: 'active',
    priority: 5
  },

  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Access to 100,000+ open source models. FREE!',
    category: 'free',
    models: [
      {
        id: 'meta-llama/Meta-Llama-3-70B-Instruct',
        name: 'Llama 3 70B',
        contextWindow: 8192,
        bestFor: ['general', 'coding'],
        costPer1kTokens: 0,
        speed: 'medium'
      },
      {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        bestFor: ['multilingual', 'general'],
        costPer1kTokens: 0,
        speed: 'medium'
      },
      {
        id: 'ProsusAI/finbert',
        name: 'FinBERT',
        contextWindow: 512,
        bestFor: ['financial sentiment', 'market analysis'],
        costPer1kTokens: 0,
        speed: 'fast'
      }
    ],
    strengths: ['FREE', '100K+ models', 'Specialized models', 'Open source'],
    costTier: 'free',
    rateLimit: '1,000 req/day',
    apiKeyEnv: 'HUGGINGFACE_API_KEY',
    status: 'active',
    priority: 6
  }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === id);
}

export function getModelById(providerId: string, modelId: string): AIModel | undefined {
  const provider = getProviderById(providerId);
  return provider?.models.find(m => m.id === modelId);
}

export function getActiveProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.status === 'active');
}

export function getFreeProviders(): AIProvider[] {
  return AI_PROVIDERS.filter(p => p.costTier === 'free');
}

export function getProviderForTask(task: string): AIProvider {
  const taskLower = task.toLowerCase();
  
  // Real-time/current info → Perplexity
  if (/\b(current|today|latest|news|search|find|lookup)\b/.test(taskLower)) {
    return AI_PROVIDERS.find(p => p.id === 'perplexity') || AI_PROVIDERS[0];
  }
  
  // Very long documents → Gemini
  if (/\b(document|pdf|long|entire|whole|full)\b/.test(taskLower)) {
    return AI_PROVIDERS.find(p => p.id === 'google') || AI_PROVIDERS[0];
  }
  
  // Quick simple tasks → Groq (free + fast)
  if (/\b(quick|simple|fast|basic)\b/.test(taskLower)) {
    return AI_PROVIDERS.find(p => p.id === 'groq') || AI_PROVIDERS[0];
  }
  
  // Coding/complex → Claude (primary)
  return AI_PROVIDERS.find(p => p.id === 'anthropic') || AI_PROVIDERS[0];
}

export function getAllModelsFlat(): { provider: string; model: AIModel }[] {
  const models: { provider: string; model: AIModel }[] = [];
  
  for (const provider of AI_PROVIDERS) {
    for (const model of provider.models) {
      models.push({ provider: provider.id, model });
    }
  }
  
  return models;
}

// =============================================================================
// FALLBACK CHAIN
// =============================================================================

export const FALLBACK_CHAIN: string[] = [
  'anthropic',  // Claude first
  'openai',     // Then OpenAI
  'groq',       // Then Groq (free)
  'google',     // Then Gemini
  'perplexity', // Then Perplexity
  'huggingface' // Finally Hugging Face
];

export function getFallbackProvider(currentProvider: string): string | null {
  const currentIndex = FALLBACK_CHAIN.indexOf(currentProvider);
  if (currentIndex === -1 || currentIndex === FALLBACK_CHAIN.length - 1) {
    return null;
  }
  return FALLBACK_CHAIN[currentIndex + 1];
}
