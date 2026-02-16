/**
 * JAVARI AI - OPTIMIZED COST-SAVING ROUTER v2.0
 * 
 * Priority: FREE providers first, expensive providers only when needed
 * 
 * Created: December 29, 2025
 * Author: Claude for CR AudioViz AI
 * 
 * ROUTING STRATEGY:
 * 1. Simple queries → Groq (FREE, ultra-fast Llama 3.3)
 * 2. Medium queries → OpenAI GPT-4o-mini (FREE with data sharing!)
 * 3. Search/research → Perplexity (real-time web access)
 * 4. Complex/code → Claude Sonnet (best quality)
 * 5. Vision/images → Claude or GPT-4o
 * 
 * COST TIERS:
 * - FREE: Groq, OpenAI (with sharing)free tier
 * - CHEAP: Mistral, Together, Claude Haiku
 * - PREMIUM: Claude Sonnet/Opus, GPT-4o
 */

// Provider costs per 1M tokens (December 2025)
export const AI_COSTS = {
  // FREE TIER
  'groq/llama-3.3-70b-versatile': { input: 0, output: 0, tier: 'free' },
  'openai/gpt-4o-mini': { input: 0, output: 0, tier: 'free' }, // FREE with sharing!
  'google/-1.5-flash': { input: 0, output: 0, tier: 'free' },
  
  // CHEAP TIER
  'mistral/mistral-small-latest': { input: 0.1, output: 0.3, tier: 'cheap' },
  'mistral/mistral-large-latest': { input: 2, output: 6, tier: 'cheap' },
  'together/llama-3.3-70b': { input: 0.88, output: 0.88, tier: 'cheap' },
  'anthropic/claude-3-5-haiku': { input: 0.8, output: 4, tier: 'cheap' },
  'perplexity/sonar-pro': { input: 3, output: 15, tier: 'cheap' },
  
  // PREMIUM TIER
  'anthropic/claude-sonnet-4': { input: 3, output: 15, tier: 'premium' },
  'anthropic/claude-opus-4': { input: 15, output: 75, tier: 'premium' },
  'openai/gpt-4o': { input: 2.5, output: 10, tier: 'premium' },
  'openai/o1': { input: 15, output: 60, tier: 'premium' }
} as const;

// Query complexity classification
type Complexity = 'simple' | 'medium' | 'complex' | 'search' | 'vision' | 'code';

interface RouterConfig {
  preferFree: boolean;
  maxCostPerRequest: number;
  allowPremium: boolean;
}

const DEFAULT_CONFIG: RouterConfig = {
  preferFree: true,        // Always try free providers first
  maxCostPerRequest: 0.01, // Max $0.01 per request default
  allowPremium: true,      // Allow premium for complex tasks
};

/**
 * Classify query complexity
 */
export function classifyQuery(message: string, hasImages: boolean = false): Complexity {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  
  // Vision tasks
  if (hasImages) {
    return 'vision';
  }
  
  // Search/research queries (need real-time data)
  if (
    lower.includes('latest') ||
    lower.includes('current') ||
    lower.includes('news') ||
    lower.includes('today') ||
    lower.includes('price of') ||
    lower.includes('weather') ||
    lower.includes('search for') ||
    lower.includes('find me') ||
    lower.includes('what happened')
  ) {
    return 'search';
  }
  
  // Code tasks
  if (
    lower.includes('code') ||
    lower.includes('function') ||
    lower.includes('implement') ||
    lower.includes('debug') ||
    lower.includes('fix this') ||
    lower.includes('write a script') ||
    lower.includes('typescript') ||
    lower.includes('javascript') ||
    lower.includes('python') ||
    lower.includes('```')
  ) {
    return 'code';
  }
  
  // Complex tasks
  if (
    lower.includes('analyze') ||
    lower.includes('compare') ||
    lower.includes('strategy') ||
    lower.includes('plan') ||
    lower.includes('design') ||
    lower.includes('architect') ||
    lower.includes('explain in detail') ||
    wordCount > 100 ||
    message.length > 500
  ) {
    return 'complex';
  }
  
  // Simple tasks
  if (
    wordCount < 10 ||
    lower.includes('hello') ||
    lower.includes('hi') ||
    lower.includes('thanks') ||
    lower.includes('yes') ||
    lower.includes('no') ||
    lower.includes('ok')
  ) {
    return 'simple';
  }
  
  // Default to medium
  return 'medium';
}

/**
 * Get the best provider for the task (cost-optimized)
 */
export function getOptimalProvider(
  complexity: Complexity,
  config: RouterConfig = DEFAULT_CONFIG
): { provider: string; model: string; reason: string; estimatedCost: string } {
  
  switch (complexity) {
    case 'simple':
      // FREE: Use Groq for simple tasks (ultra-fast, free)
      return {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        reason: 'Simple query → FREE Groq (ultra-fast)',
        estimatedCost: '$0.00'
      };
    
    case 'medium':
      // FREE: Use OpenAI mini (free with data sharing)
      return {
        provider: 'openai',
        model: 'gpt-4o-mini',
        reason: 'Medium query → FREE OpenAI mini (data sharing enabled)',
        estimatedCost: '$0.00'
      };
    
    case 'search':
      // Perplexity for real-time search (cheap, has web access)
      return {
        provider: 'perplexity',
        model: 'sonar-pro',
        reason: 'Search query → Perplexity (real-time web access)',
        estimatedCost: '~$0.001'
      };
    
    case 'code':
      // Claude for code (best quality)
      if (config.allowPremium) {
        return {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          reason: 'Code task → Claude Sonnet (best for code)',
          estimatedCost: '~$0.01'
        };
      }
      // Fallback to free
      return {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        reason: 'Code task → Groq Llama (free alternative)',
        estimatedCost: '$0.00'
      };
    
    case 'complex':
      // Claude for complex reasoning
      if (config.allowPremium) {
        return {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          reason: 'Complex task → Claude Sonnet (best reasoning)',
          estimatedCost: '~$0.02'
        };
      }
      // Fallback to Mistral Large (cheaper)
      return {
        provider: 'mistral',
        model: 'mistral-large-latest',
        reason: 'Complex task → Mistral Large (budget mode)',
        estimatedCost: '~$0.005'
      };
    
    case 'vision':
      // Claude or GPT-4o for vision
      if (config.allowPremium) {
        return {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          reason: 'Vision task → Claude Sonnet (excellent vision)',
          estimatedCost: '~$0.02'
        };
      }
      return {
        provider: 'openai',
        model: 'gpt-4o',
        reason: 'Vision task → GPT-4o',
        estimatedCost: '~$0.01'
      };
    
    default:
      // Default to free
      return {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        reason: 'Default → FREE Groq',
        estimatedCost: '$0.00'
      };
  }
}

/**
 * Get fallback chain for a provider
 */
export function getFallbackChain(primaryProvider: string): string[] {
  const chains: Record<string, string[]> = {
    'groq': ['openai/gpt-4o-mini', 'mistral/mistral-small-latest', 'together/llama-3.3-70b'],
    'openai': ['groq/llama-3.3-70b-versatile', 'anthropic/claude-3-5-haiku', 'mistral/mistral-large-latest'],
    'anthropic': ['openai/gpt-4o', 'mistral/mistral-large-latest', 'groq/llama-3.3-70b-versatile'],
    'perplexity': ['openai/gpt-4o-mini', 'groq/llama-3.3-70b-versatile'],
    'mistral': ['groq/llama-3.3-70b-versatile', 'openai/gpt-4o-mini', 'together/llama-3.3-70b']
  };
  
  return chains[primaryProvider] || ['groq/llama-3.3-70b-versatile', 'openai/gpt-4o-mini'];
}

/**
 * Provider API endpoints and configurations
 */
export const PROVIDER_CONFIGS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    format: 'openai'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    format: 'openai'
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY',
    format: 'anthropic'
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai',
    envKey: 'PERPLEXITY_API_KEY',
    format: 'openai'
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    envKey: 'MISTRAL_API_KEY',
    format: 'openai'
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    envKey: 'TOGETHER_API_KEY',
    format: 'openai'
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GOOGLE__API_KEY',
    format: 'google'
  }
};

/**
 * Estimate monthly cost based on usage pattern
 */
export function estimateMonthlyCost(
  dailySimple: number,
  dailyMedium: number,
  dailyComplex: number,
  dailySearch: number
): { total: number; breakdown: Record<string, number> } {
  // Average tokens per query type
  const tokensPerQuery = {
    simple: 500,
    medium: 1500,
    complex: 3000,
    search: 2000
  };
  
  // With free tiers enabled:
  // - Simple (Groq): FREE
  // - Medium (OpenAI mini with sharing): FREE
  // - Complex (Claude): ~$0.02 per query
  // - Search (Perplexity): ~$0.003 per query
  
  const dailyCost = {
    simple: 0, // FREE
    medium: 0, // FREE with sharing
    complex: dailyComplex * 0.02,
    search: dailySearch * 0.003
  };
  
  const totalDaily = Object.values(dailyCost).reduce((a, b) => a + b, 0);
  
  return {
    total: Math.round(totalDaily * 30 * 100) / 100,
    breakdown: {
      simple: 0,
      medium: 0,
      complex: Math.round(dailyCost.complex * 30 * 100) / 100,
      search: Math.round(dailyCost.search * 30 * 100) / 100
    }
  };
}

// Example usage calculator
console.log('=== MONTHLY COST ESTIMATE ===');
console.log('Assuming: 50 simple, 30 medium, 10 complex, 5 search queries/day');
const estimate = estimateMonthlyCost(50, 30, 10, 5);
console.log(`Total monthly cost: $${estimate.total}`);
console.log('Breakdown:', estimate.breakdown);
