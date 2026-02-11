// lib/javari/council/weights.ts
import { AIProvider } from '../router/types';

export interface ProviderWeights {
  quality: number;      // 0-1: Expected output quality
  speed: number;        // 0-1: Typical response speed
  reliability: number;  // 0-1: Uptime/availability
  cost: number;        // 0-1: Cost efficiency (inverse)
}

export const PROVIDER_WEIGHTS: Record<AIProvider, ProviderWeights> = {
  'openai': {
    quality: 0.95,
    speed: 0.7,
    reliability: 0.9,
    cost: 0.3
  },
  'anthropic': {
    quality: 0.98,
    speed: 0.75,
    reliability: 0.85,
    cost: 0.3
  },
  'groq': {
    quality: 0.85,
    speed: 0.98,
    reliability: 0.8,
    cost: 0.95
  },
  'mistral': {
    quality: 0.88,
    speed: 0.85,
    reliability: 0.82,
    cost: 0.7
  },
  'xai': {
    quality: 0.82,
    speed: 0.75,
    reliability: 0.75,
    cost: 0.4
  },
  'deepseek': {
    quality: 0.8,
    speed: 0.88,
    reliability: 0.78,
    cost: 0.98
  },
  'cohere': {
    quality: 0.83,
    speed: 0.8,
    reliability: 0.8,
    cost: 0.5
  }
};

export function calculateProviderScore(
  provider: AIProvider,
  latency: number,
  responseLength: number
): number {
  const weights = PROVIDER_WEIGHTS[provider];
  
  // Base score from quality weight
  let score = weights.quality * 0.5;
  
  // Speed bonus (inverse latency)
  const speedBonus = Math.max(0, 1 - (latency / 5000)) * weights.speed * 0.2;
  score += speedBonus;
  
  // Length bonus (substantial responses score higher)
  const lengthBonus = Math.min(0.2, responseLength / 1000) * 0.2;
  score += lengthBonus;
  
  // Reliability factor
  score += weights.reliability * 0.1;
  
  return Math.min(1, score);
}

export interface ProviderReliability {
  successes: number;
  failures: number;
  averageLatency: number;
}

export class ReliabilityTracker {
  private stats: Map<AIProvider, ProviderReliability> = new Map();

  record(provider: AIProvider, success: boolean, latency: number) {
    const current = this.stats.get(provider) || {
      successes: 0,
      failures: 0,
      averageLatency: 0
    };

    if (success) {
      current.successes++;
      current.averageLatency = 
        (current.averageLatency * (current.successes - 1) + latency) / current.successes;
    } else {
      current.failures++;
    }

    this.stats.set(provider, current);
  }

  getReliabilityScore(provider: AIProvider): number {
    const stats = this.stats.get(provider);
    if (!stats || (stats.successes + stats.failures) === 0) {
      return PROVIDER_WEIGHTS[provider].reliability;
    }

    return stats.successes / (stats.successes + stats.failures);
  }
}
