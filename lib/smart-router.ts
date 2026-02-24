// =============================================================================
// JAVARI AI - SMART MULTI-AI ROUTER
// =============================================================================
// Routes requests to the optimal AI provider based on task, cost, and availability
// Updated: Saturday, December 20, 2025 - 4:50 PM EST
// =============================================================================

import { AI_PROVIDERS, ROUTING_RULES, BLOCKED_PROVIDERS } from './ai-providers-enhanced';

interface RouterConfig {
  preferFree: boolean;
  preferQuality: boolean;
  preferSpeed: boolean;
  maxCostPer1M?: number;
  allowedProviders?: string[];
  blockedProviders?: string[];
}

interface RoutingResult {
  provider: string;
  model: string;
  reason: string;
  estimatedCost: number;
  fallbacks: string[];
}

interface AIRequest {
  task: string;
  complexity: 'simple' | 'medium' | 'complex';
  hasImages?: boolean;
  hasDocuments?: boolean;
  needsRealTime?: boolean;
  tokenEstimate?: number;
  userTier?: 'free' | 'pro' | 'enterprise';
}

// =============================================================================
// SMART ROUTER CLASS
// =============================================================================

export class JavariSmartRouter {
  private providers = AI_PROVIDERS;
  private blockedIds = BLOCKED_PROVIDERS.map(p => p.id);
  private usageTracker: Map<string, number> = new Map();
  
  constructor(private config: RouterConfig = { preferFree: true, preferQuality: true, preferSpeed: false }) {}

  /**
   * Route a request to the optimal AI provider
   */
  route(request: AIRequest): RoutingResult {
    const candidates = this.getCandidates(request);
    const ranked = this.rankCandidates(candidates, request);
    
    if (ranked.length === 0) {
      // Fallback to Claude (always works)
      return {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        reason: 'Fallback to reliable Claude Haiku',
        estimatedCost: 0.80,
        fallbacks: ['openai:gpt-4o-mini', 'groq:llama-3.3-70b-versatile']
      };
    }
    
    const best = ranked[0];
    const fallbacks = ranked.slice(1, 4).map(c => `${c.provider}:${c.model}`);
    
    return {
      provider: best.provider,
      model: best.model,
      reason: best.reason,
      estimatedCost: best.cost,
      fallbacks
    };
  }

  /**
   * Get candidate providers for a request
   */
  private getCandidates(request: AIRequest) {
    const candidates: Array<{
      provider: string;
      model: string;
      cost: number;
      speed: string;
      score: number;
      reason: string;
    }> = [];

    for (const provider of this.providers) {
      // Skip blocked providers
      if (this.blockedIds.includes(provider.id)) continue;
      if (provider.status === 'inactive') continue;
      if (this.config.blockedProviders?.includes(provider.id)) continue;
      if (this.config.allowedProviders && !this.config.allowedProviders.includes(provider.id)) continue;

      for (const model of provider.models) {
        // Skip models with "DISABLED" in bestFor
        if (model.bestFor.some(b => b.includes('DISABLED'))) continue;
        
        const cost = (model.inputCostPer1M || 0) + (model.outputCostPer1M || 0);
        
        // Skip if over max cost
        if (this.config.maxCostPer1M && cost > this.config.maxCostPer1M) continue;

        let score = 0;
        let reason = '';

        // Score based on task match
        if (this.matchesTask(model, request)) {
          score += 50;
          reason = `Best for ${request.task}`;
        }

        // Score based on complexity
        if (request.complexity === 'simple' && model.speed === 'ultra-fast') {
          score += 30;
        } else if (request.complexity === 'complex' && provider.category === 'premium') {
          score += 40;
        }

        // Score based on config preferences
        if (this.config.preferFree && cost === 0) {
          score += 60;
          reason = 'FREE provider';
        }
        if (this.config.preferSpeed && (model.speed === 'ultra-fast' || model.speed === 'fast')) {
          score += 25;
        }
        if (this.config.preferQuality && provider.priority <= 3) {
          score += 35;
        }

        // Bonus for vision capability
        if (request.hasImages && model.bestFor.includes('vision')) {
          score += 50;
          reason = 'Vision capable';
        }

        // Bonus for long context
        if (request.hasDocuments && model.contextWindow >= 100000) {
          score += 40;
          reason = 'Long context for documents';
        }

        // Bonus for real-time
        if (request.needsRealTime && provider.id === 'perplexity') {
          score += 60;
          reason = 'Real-time web search';
        }

        candidates.push({
          provider: provider.id,
          model: model.id,
          cost,
          speed: model.speed,
          score,
          reason: reason || `${provider.name} - ${model.name}`
        });
      }
    }

    return candidates;
  }

  /**
   * Rank candidates by score
   */
  private rankCandidates(candidates: any[], request: AIRequest) {
    return candidates.sort((a, b) => {
      // First by score
      if (b.score !== a.score) return b.score - a.score;
      // Then by cost (lower is better)
      if (a.cost !== b.cost) return a.cost - b.cost;
      // Then by speed
      const speedOrder = { 'ultra-fast': 0, 'fast': 1, 'medium': 2, 'slow': 3 };
      return (speedOrder[a.speed as keyof typeof speedOrder] || 2) - (speedOrder[b.speed as keyof typeof speedOrder] || 2);
    });
  }

  /**
   * Check if model matches task
   */
  private matchesTask(model: any, request: AIRequest): boolean {
    const taskKeywords: Record<string, string[]> = {
      'coding': ['coding', 'code', 'programming', 'debug'],
      'research': ['research', 'analysis', 'search'],
      'creative': ['creative', 'writing', 'story'],
      'chat': ['chat', 'conversation', 'general'],
      'math': ['math', 'reasoning', 'calculation'],
      'vision': ['vision', 'image', 'visual'],
      'document': ['document', 'long', 'context'],
    };

    const keywords = taskKeywords[request.task] || [request.task];
    return model.bestFor.some((b: string) => 
      keywords.some(k => b.toLowerCase().includes(k.toLowerCase()))
    );
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string) {
    return this.providers.find(p => p.id === id);
  }

  /**
   * Get all active providers
   */
  getActiveProviders() {
    return this.providers.filter(p => 
      p.status === 'active' && 
      p.trusted && 
      !this.blockedIds.includes(p.id)
    );
  }

  /**
   * Get FREE providers
   */
  getFreeProviders() {
    return this.providers.filter(p => p.costTier === 'free' && p.trusted);
  }

  /**
   * Get stats
   */
  getStats() {
    const active = this.getActiveProviders();
    return {
      totalProviders: active.length,
      totalModels: active.reduce((acc, p) => acc + p.models.length, 0),
      freeProviders: this.getFreeProviders().length,
      blockedProviders: this.blockedIds.length,
    };
  }
}

// =============================================================================
// QUICK ROUTING FUNCTIONS
// =============================================================================

const defaultRouter = new JavariSmartRouter();

/**
 * Quick route for simple tasks - prioritizes FREE providers
 */
export function routeSimple(task: string = 'chat'): RoutingResult {
  return defaultRouter.route({
    task,
    complexity: 'simple'
  });
}

/**
 * Quick route for complex tasks - prioritizes quality
 */
export function routeComplex(task: string = 'coding'): RoutingResult {
  const router = new JavariSmartRouter({ preferFree: false, preferQuality: true, preferSpeed: false });
  return router.route({
    task,
    complexity: 'complex'
  });
}

/**
 * Quick route for vision tasks
 */
export function routeVision(): RoutingResult {
  return defaultRouter.route({
    task: 'vision',
    complexity: 'medium',
    hasImages: true
  });
}

/**
 * Quick route for research with real-time data
 */
export function routeResearch(): RoutingResult {
  return defaultRouter.route({
    task: 'research',
    complexity: 'medium',
    needsRealTime: true
  });
}

/**
 * Quick route for document analysis
 */
export function routeDocuments(): RoutingResult {
  return defaultRouter.route({
    task: 'document',
    complexity: 'medium',
    hasDocuments: true
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export { JavariSmartRouter };
export default JavariSmartRouter;
