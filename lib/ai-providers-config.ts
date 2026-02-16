// =============================================================================
// JAVARI AI - ULTIMATE MULTI-AI PROVIDER CONFIGURATION
// =============================================================================
// 11+ AI BRAINS - THE ONLY AI ASSISTANT WITH THIS MANY MODELS
// "Everyone connects. Everyone wins."
// =============================================================================
// Updated: Saturday, December 20, 2025 - 4:45 PM EST
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
  status: 'active' | 'inactive' | 'limited' | 'new';
  priority: number;
  baseUrl?: string;
  trusted: boolean; // Security verified
  region: 'us' | 'eu' | 'global';
}

export interface AIModel {
  id: string;
  name: string;
  contextWindow: number;
  bestFor: string[];
  costPer1kTokens?: number;
  speed: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

// =============================================================================
// ALL AVAILABLE AI PROVIDERS (11+ BRAINS)
// =============================================================================

export const AI_PROVIDERS: AIProvider[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: PREMIUM PROVIDERS (Highest Quality)
  // ═══════════════════════════════════════════════════════════════════════════
  
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
        inputCostPer1M: 3,
        outputCostPer1M: 15,
        speed: 'medium'
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        contextWindow: 200000,
        bestFor: ['expert coding', 'research', 'nuanced analysis'],
        inputCostPer1M: 15,
        outputCostPer1M: 75,
        speed: 'slow'
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        bestFor: ['fast responses', 'simple tasks', 'high volume'],
        inputCostPer1M: 0.80,
        outputCostPer1M: 4,
        speed: 'ultra-fast'
      }
    ],
    strengths: ['Coding', 'Analysis', 'Safety', 'Long context', 'Nuanced responses'],
    costTier: 'high',
    rateLimit: '60 req/min',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    status: 'active',
    priority: 1,
    trusted: true,
    region: 'us'
  },
  
  {
    id: 'openai',
    name: 'OpenAI GPT',
    description: 'Industry standard AI with broad capabilities and vision.',
    category: 'premium',
    models: [
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        contextWindow: 128000,
        bestFor: ['general', 'creative', 'analysis'],
        inputCostPer1M: 10,
        outputCostPer1M: 30,
        speed: 'medium'
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
        bestFor: ['vision', 'multimodal', 'fast responses'],
        inputCostPer1M: 5,
        outputCostPer1M: 15,
        speed: 'fast'
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        bestFor: ['cost-effective', 'high volume', 'simple tasks'],
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.60,
        speed: 'ultra-fast'
      }
    ],
    strengths: ['Vision', 'Multimodal', 'DALL-E integration', 'Broad knowledge'],
    costTier: 'high',
    rateLimit: '60 req/min',
    apiKeyEnv: 'OPENAI_API_KEY',
    status: 'active',
    priority: 2,
    trusted: true,
    region: 'us'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: STANDARD PROVIDERS (Good Balance)
  // ═══════════════════════════════════════════════════════════════════════════
  
  {
    id: 'google',
    name: 'Google',
    description: 'Powerful multimodal AI with massive context window and FREE tier.',
    category: 'standard',
    models: [
      {
        id: '-2.0-flash-exp',
        name: '2.0 Flash (Experimental)',
        contextWindow: 1000000,
        bestFor: ['FREE usage', 'fast responses', 'multimodal'],
        inputCostPer1M: 0, // FREE during experimental
        outputCostPer1M: 0,
        speed: 'ultra-fast'
      },
      {
        id: '-1.5-pro',
        name: '1.5 Pro',
        contextWindow: 2000000,
        bestFor: ['massive documents', 'video analysis', 'complex reasoning'],
        inputCostPer1M: 1.25,
        outputCostPer1M: 5,
        speed: 'medium'
      },
      {
        id: '-1.5-flash',
        name: '1.5 Flash',
        contextWindow: 1000000,
        bestFor: ['speed', 'cost-effective', 'high volume'],
        inputCostPer1M: 0.075,
        outputCostPer1M: 0.30,
        speed: 'ultra-fast'
      }
    ],
    strengths: ['FREE tier', 'Massive context', 'Multimodal', 'Google integration'],
    costTier: 'free',
    rateLimit: '1500 req/day free',
    apiKeyEnv: 'GOOGLE__API_KEY',
    status: 'active',
    priority: 3,
    trusted: true,
    region: 'us'
  },

  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'European AI leader with excellent coding and FREE API tier.',
    category: 'standard',
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        contextWindow: 128000,
        bestFor: ['complex reasoning', 'multilingual', 'coding'],
        inputCostPer1M: 2,
        outputCostPer1M: 6,
        speed: 'medium'
      },
      {
        id: 'mistral-medium-latest',
        name: 'Mistral Medium',
        contextWindow: 128000,
        bestFor: ['balanced tasks', 'cost-effective'],
        inputCostPer1M: 0.40,
        outputCostPer1M: 1.20,
        speed: 'fast'
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        contextWindow: 128000,
        bestFor: ['fast responses', 'simple tasks'],
        inputCostPer1M: 0.10,
        outputCostPer1M: 0.30,
        speed: 'ultra-fast'
      },
      {
        id: 'codestral-latest',
        name: 'Codestral',
        contextWindow: 32000,
        bestFor: ['code generation', 'code review', 'debugging'],
        inputCostPer1M: 0.30,
        outputCostPer1M: 0.90,
        speed: 'fast'
      },
      {
        id: 'pixtral-12b-latest',
        name: 'Pixtral 12B',
        contextWindow: 128000,
        bestFor: ['vision', 'image analysis', 'OCR'],
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.15,
        speed: 'fast'
      }
    ],
    strengths: ['FREE tier', 'European privacy', 'Excellent coding', 'Vision'],
    costTier: 'low',
    rateLimit: 'Generous free tier',
    apiKeyEnv: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    status: 'new',
    priority: 4,
    trusted: true,
    region: 'eu'
  },

  {
    id: 'perplexity',
    name: 'Perplexity AI',
    description: 'Real-time web search integrated AI for current information.',
    category: 'specialized',
    models: [
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Sonar Large Online',
        contextWindow: 128000,
        bestFor: ['real-time search', 'current events', 'research'],
        inputCostPer1M: 1,
        outputCostPer1M: 1,
        speed: 'medium'
      },
      {
        id: 'llama-3.1-sonar-small-128k-online',
        name: 'Sonar Small Online',
        contextWindow: 128000,
        bestFor: ['quick searches', 'simple queries'],
        inputCostPer1M: 0.20,
        outputCostPer1M: 0.20,
        speed: 'fast'
      }
    ],
    strengths: ['Real-time web search', 'Citations', 'Current information'],
    costTier: 'medium',
    rateLimit: '100 req/min',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    status: 'active',
    priority: 5,
    trusted: true,
    region: 'us'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: FREE PROVIDERS (Cost Optimization)
  // ═══════════════════════════════════════════════════════════════════════════
  
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference with FREE tier. 10x faster than competitors.',
    category: 'free',
    models: [
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        contextWindow: 128000,
        bestFor: ['fast responses', 'general tasks', 'high volume'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'ultra-fast'
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        contextWindow: 128000,
        bestFor: ['instant responses', 'simple tasks'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'ultra-fast'
      },
      {
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        bestFor: ['coding', 'analysis'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'ultra-fast'
      }
    ],
    strengths: ['FREE', 'Ultra-fast (10x)', 'High volume', 'LPU inference'],
    costTier: 'free',
    rateLimit: '14,400 req/day FREE',
    apiKeyEnv: 'GROQ_API_KEY',
    status: 'active',
    priority: 6,
    trusted: true,
    region: 'us'
  },

  {
    id: 'together',
    name: 'Together AI',
    description: 'Access to 50+ open-source models at lowest prices.',
    category: 'free',
    models: [
      {
        id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        name: 'Llama 3.3 70B Turbo',
        contextWindow: 128000,
        bestFor: ['general tasks', 'cost-effective'],
        inputCostPer1M: 0.88,
        outputCostPer1M: 0.88,
        speed: 'fast'
      },
      {
        id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
        name: 'Qwen 2.5 72B',
        contextWindow: 32768,
        bestFor: ['coding', 'math', 'reasoning'],
        inputCostPer1M: 0.60,
        outputCostPer1M: 0.60,
        speed: 'fast'
      },
      {
        id: 'deepseek-ai/DeepSeek-V3',
        name: 'DeepSeek V3',
        contextWindow: 64000,
        bestFor: ['DISABLED - Security concerns'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'medium'
      }
    ],
    strengths: ['50+ models', 'Cheapest pricing', 'Open source'],
    costTier: 'low',
    rateLimit: 'Pay per use',
    apiKeyEnv: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    status: 'new',
    priority: 7,
    trusted: true,
    region: 'us'
  },

  {
    id: 'fireworks',
    name: 'Fireworks AI',
    description: 'Fastest inference speeds with competitive pricing.',
    category: 'standard',
    models: [
      {
        id: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        name: 'Llama 3.3 70B',
        contextWindow: 128000,
        bestFor: ['fast responses', 'general tasks'],
        inputCostPer1M: 0.90,
        outputCostPer1M: 0.90,
        speed: 'ultra-fast'
      },
      {
        id: 'accounts/fireworks/models/mixtral-8x22b-instruct',
        name: 'Mixtral 8x22B',
        contextWindow: 65536,
        bestFor: ['complex reasoning', 'coding'],
        inputCostPer1M: 0.90,
        outputCostPer1M: 0.90,
        speed: 'fast'
      }
    ],
    strengths: ['Fastest inference', 'Competitive pricing', 'Low latency'],
    costTier: 'low',
    rateLimit: '600 req/min',
    apiKeyEnv: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    status: 'new',
    priority: 8,
    trusted: true,
    region: 'us'
  },

  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Enterprise NLP specialist with excellent RAG and embeddings.',
    category: 'specialized',
    models: [
      {
        id: 'command-r-plus',
        name: 'Command R+',
        contextWindow: 128000,
        bestFor: ['RAG', 'enterprise', 'multilingual'],
        inputCostPer1M: 2.50,
        outputCostPer1M: 10,
        speed: 'medium'
      },
      {
        id: 'command-r',
        name: 'Command R',
        contextWindow: 128000,
        bestFor: ['cost-effective RAG', 'general tasks'],
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.60,
        speed: 'fast'
      },
      {
        id: 'embed-english-v3.0',
        name: 'Embed v3',
        contextWindow: 512,
        bestFor: ['embeddings', 'semantic search'],
        inputCostPer1M: 0.10,
        outputCostPer1M: 0,
        speed: 'ultra-fast'
      }
    ],
    strengths: ['RAG specialist', 'Enterprise ready', 'Embeddings'],
    costTier: 'medium',
    rateLimit: '100 req/min',
    apiKeyEnv: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.ai/v1',
    status: 'new',
    priority: 9,
    trusted: true,
    region: 'us'
  },

  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Access to 100,000+ open source models including specialized ones.',
    category: 'free',
    models: [
      {
        id: 'meta-llama/Meta-Llama-3-70B-Instruct',
        name: 'Llama 3 70B',
        contextWindow: 8192,
        bestFor: ['general', 'testing'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'medium'
      },
      {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        bestFor: ['coding', 'general'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'medium'
      },
      {
        id: 'ProsusAI/finbert',
        name: 'FinBERT',
        contextWindow: 512,
        bestFor: ['financial sentiment', 'market analysis'],
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        speed: 'fast'
      }
    ],
    strengths: ['FREE', '100K+ models', 'Specialized models', 'Open source'],
    costTier: 'free',
    rateLimit: '1,000 req/day FREE',
    apiKeyEnv: 'HUGGINGFACE_API_KEY',
    status: 'active',
    priority: 10,
    trusted: true,
    region: 'us'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: SPECIALIZED PROVIDERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  {
    id: 'replicate',
    name: 'Replicate',
    description: 'Image generation and specialized ML models.',
    category: 'specialized',
    models: [
      {
        id: 'stability-ai/sdxl',
        name: 'Stable Diffusion XL',
        contextWindow: 0,
        bestFor: ['image generation', 'art'],
        inputCostPer1M: 0, // Pay per image
        outputCostPer1M: 0,
        speed: 'medium'
      },
      {
        id: 'meta/llama-2-70b-chat',
        name: 'Llama 2 70B',
        contextWindow: 4096,
        bestFor: ['chat', 'general'],
        inputCostPer1M: 0.65,
        outputCostPer1M: 2.75,
        speed: 'medium'
      }
    ],
    strengths: ['Image generation', 'ML models', 'Pay per use'],
    costTier: 'low',
    rateLimit: 'Pay per use',
    apiKeyEnv: 'REPLICATE_API_KEY',
    baseUrl: 'https://api.replicate.com/v1',
    status: 'new',
    priority: 11,
    trusted: true,
    region: 'us'
  }
];

// =============================================================================
// PROVIDER STATS
// =============================================================================

export const PROVIDER_STATS = {
  totalProviders: AI_PROVIDERS.length,
  totalModels: AI_PROVIDERS.reduce((acc, p) => acc + p.models.length, 0),
  freeProviders: AI_PROVIDERS.filter(p => p.costTier === 'free').length,
  trustedProviders: AI_PROVIDERS.filter(p => p.trusted).length,
  usBasedProviders: AI_PROVIDERS.filter(p => p.region === 'us').length,
  euBasedProviders: AI_PROVIDERS.filter(p => p.region === 'eu').length
};

// =============================================================================
// BLOCKED PROVIDERS (Security Concerns)
// =============================================================================

export const BLOCKED_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    reason: 'Security vulnerabilities, data privacy concerns, CCP alignment',
    sources: [
      'NIST CAISI evaluation (Sept 2025)',
      'Cisco Security (100% jailbreak success)',
      'CrowdStrike (50% more vulnerable code)',
      'NowSecure (hard-coded keys, unencrypted data)'
    ],
    blockedDate: '2025-12-20',
    reviewDate: '2026-03-20' // Review in 3 months
  }
];

// =============================================================================
// SMART ROUTING RULES
// =============================================================================

export const ROUTING_RULES = {
  // Task type → Best provider
  taskRouting: {
    'simple_chat': ['groq' 'mistral'],        // FREE/Fast first
    'coding': ['anthropic', 'mistral', 'openai'],        // Quality first
    'research': ['perplexity', 'anthropic', 'openai'],   // Real-time + quality
    'image_analysis': ['openai' 'mistral'],   // Vision models
    'document_analysis': [ 'anthropic'],         // Long context
    'financial': ['huggingface', 'anthropic', 'openai'], // FinBERT + quality
    'embeddings': ['cohere', 'openai', 'huggingface'],   // Specialized
    'image_generation': ['replicate', 'openai'],         // DALL-E, SD
    'high_volume': ['groq' 'fireworks'],      // Speed + FREE
    'enterprise': ['anthropic', 'cohere', 'openai'],     // Security + quality
  },
  
  // Cost optimization
  costPriority: [
    'groq',       // FREE - 14,400 req/day     // FREE - 1,500 req/day  
    'huggingface', // FREE - 1,000 req/day
    'mistral',    // FREE tier available
    'fireworks',  // $0.90/1M tokens
    'together',   // $0.60-0.88/1M tokens
    'cohere',     // $0.15/1M tokens (Command R)
    'perplexity', // $0.20/1M tokens
    'openai',     // $0.15/1M (mini) to $30/1M
    'anthropic',  // $0.80/1M (Haiku) to $75/1M
  ],
  
  // Quality priority  
  qualityPriority: [
    'anthropic',  // Best reasoning
    'openai',     // Broad capabilities     // Multimodal leader
    'mistral',    // Excellent coding
    'perplexity', // Real-time search
    'cohere',     // RAG specialist
    'groq',       // Fast Llama
    'together',   // Open source
    'fireworks',  // Fast inference
    'huggingface', // Specialized
  ]
};

// =============================================================================
// ENVIRONMENT VARIABLES REQUIRED
// =============================================================================

export const REQUIRED_ENV_VARS = {
  // Already configured (in your credentials)
  existing: [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY', 
    'GOOGLE__API_KEY',
    'PERPLEXITY_API_KEY',
    'GROQ_API_KEY',
    'HUGGINGFACE_API_KEY'
  ],
  
  // NEW - Need to add
  new: [
    'MISTRAL_API_KEY',      // Get from: https://console.mistral.ai
    'TOGETHER_API_KEY',     // Get from: https://api.together.xyz
    'FIREWORKS_API_KEY',    // Get from: https://fireworks.ai
    'COHERE_API_KEY',       // Get from: https://dashboard.cohere.com
    'REPLICATE_API_KEY',    // Get from: https://replicate.com/account
  ]
};

// =============================================================================
// MARKETING VALUE
// =============================================================================

export const MARKETING_COPY = {
  headline: "The ONLY AI Assistant with 11+ AI Brains",
  subheadline: "Javari AI routes your questions to the perfect AI model - Claude, GPT-4 Mistral, and 7 more",
  features: [
    "🧠 11+ AI providers, 30+ models at your fingertips",
    "⚡ Automatic smart routing to the best AI for each task",
    "💰 Cost optimization - uses FREE APIs when possible",
    "🔒 100% US/EU providers only - your data stays secure",
    "🎯 Specialized models for coding, research, vision, finance",
    "📚 Learns from every interaction across all models"
  ],
  competitive_advantage: "While others use 1-2 AI models, Javari uses 11+ - giving you the combined intelligence of the world's best AI systems in one assistant."
};

export default AI_PROVIDERS;
