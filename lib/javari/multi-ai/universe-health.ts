/**
 * Universe Health Monitoring - Phase 2.7
 * Health checks and availability monitoring for all 13 providers
 * 
 * Providers: HuggingFace, Groq, OpenRouter, DeepSeek, Replicate,
 *            TogetherAI, Cohere, Voyage, Jina, Nomic, Stability,
 *            Perplexity, Local
 */

import { testHuggingFaceConnection } from '../providers/huggingface';
import { testReplicateConnection } from '../providers/replicate';
import { testTogetherConnection } from '../providers/together';
import { testCohereConnection } from '../providers/cohere';

// Helper test functions for providers without exported test methods
async function testGroqConnection(): Promise<boolean> {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return false;
    
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function testOpenRouterConnection(): Promise<boolean> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return false;
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function testDeepSeekConnection(): Promise<boolean> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return false;
    
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface ProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'offline';
  latencyMs: number | null;
  lastChecked: Date;
  errorMessage?: string;
  modelsAvailable: number;
  modelsDisabled: number;
}

export interface UniverseHealthSummary {
  timestamp: Date;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  totalProviders: number;
  healthyProviders: number;
  degradedProviders: number;
  offlineProviders: number;
  providers: ProviderHealth[];
  totalModels: number;
  availableModels: number;
}

// Cache health status (refresh every 5 minutes)
let healthCache: UniverseHealthSummary | null = null;
let lastHealthCheck: Date | null = null;
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Get comprehensive health status for all providers
 */
export async function getUniverseHealth(forceRefresh = false): Promise<UniverseHealthSummary> {
  // Return cached result if recent
  if (
    !forceRefresh &&
    healthCache &&
    lastHealthCheck &&
    Date.now() - lastHealthCheck.getTime() < HEALTH_CHECK_INTERVAL
  ) {
    return healthCache;
  }

  const startTime = Date.now();

  // Check all providers in parallel
  const providerChecks = await Promise.allSettled([
    checkHuggingFaceHealth(),
    checkGroqHealth(),
    checkOpenRouterHealth(),
    checkDeepSeekHealth(),
    checkReplicateHealth(),
    checkTogetherHealth(),
    checkCohereHealth(),
    checkVoyageHealth(),
    checkJinaHealth(),
    checkNomicHealth(),
    checkStabilityHealth(),
    checkPerplexityHealth(),
    checkLocalHealth(),
  ]);

  const providers: ProviderHealth[] = providerChecks.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      // Failed health check
      return {
        provider: getProviderNameByIndex(index),
        status: 'offline' as const,
        latencyMs: null,
        lastChecked: new Date(),
        errorMessage: result.reason?.message || 'Health check failed',
        modelsAvailable: 0,
        modelsDisabled: getModelCountByProvider(getProviderNameByIndex(index)),
      };
    }
  });

  // Calculate summary statistics
  const healthyProviders = providers.filter(p => p.status === 'healthy').length;
  const degradedProviders = providers.filter(p => p.status === 'degraded').length;
  const offlineProviders = providers.filter(p => p.status === 'offline').length;

  const availableModels = providers.reduce((sum, p) => sum + p.modelsAvailable, 0);
  const totalModels = providers.reduce(
    (sum, p) => sum + p.modelsAvailable + p.modelsDisabled,
    0
  );

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'critical';
  if (healthyProviders >= providers.length * 0.8) {
    overallStatus = 'healthy';
  } else if (healthyProviders >= providers.length * 0.5) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'critical';
  }

  const summary: UniverseHealthSummary = {
    timestamp: new Date(),
    overallStatus,
    totalProviders: providers.length,
    healthyProviders,
    degradedProviders,
    offlineProviders,
    providers,
    totalModels,
    availableModels,
  };

  // Cache result
  healthCache = summary;
  lastHealthCheck = new Date();

  return summary;
}

// Individual provider health checks

async function checkHuggingFaceHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testHuggingFaceConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'huggingface',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 23 : 0,
      modelsDisabled: isHealthy ? 0 : 23,
    };
  } catch (error) {
    return {
      provider: 'huggingface',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 23,
    };
  }
}

async function checkGroqHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testGroqConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'groq',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 11 : 0,
      modelsDisabled: isHealthy ? 0 : 11,
    };
  } catch (error) {
    return {
      provider: 'groq',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 11,
    };
  }
}

async function checkOpenRouterHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testOpenRouterConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'openrouter',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 10 : 0,
      modelsDisabled: isHealthy ? 0 : 10,
    };
  } catch (error) {
    return {
      provider: 'openrouter',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 10,
    };
  }
}

async function checkDeepSeekHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testDeepSeekConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'deepseek',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 2 : 0,
      modelsDisabled: isHealthy ? 0 : 2,
    };
  } catch (error) {
    return {
      provider: 'deepseek',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 2,
    };
  }
}

async function checkReplicateHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testReplicateConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'replicate',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 6 : 0,
      modelsDisabled: isHealthy ? 0 : 6,
    };
  } catch (error) {
    return {
      provider: 'replicate',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 6,
    };
  }
}

async function checkTogetherHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testTogetherConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'together',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 25 : 0,
      modelsDisabled: isHealthy ? 0 : 25,
    };
  } catch (error) {
    return {
      provider: 'together',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 25,
    };
  }
}

async function checkCohereHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const isHealthy = await testCohereConnection();
    const latencyMs = Date.now() - startTime;

    return {
      provider: 'cohere',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 5 : 0,
      modelsDisabled: isHealthy ? 0 : 5,
    };
  } catch (error) {
    return {
      provider: 'cohere',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 5,
    };
  }
}

async function checkVoyageHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    // Simple ping test for Voyage
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error('VOYAGE_API_KEY not configured');
    }

    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: ['test'], model: 'voyage-2' }),
    });

    const latencyMs = Date.now() - startTime;
    const isHealthy = response.ok || response.status === 400; // 400 = bad input, but service is up

    return {
      provider: 'voyage',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 2 : 0,
      modelsDisabled: isHealthy ? 0 : 2,
    };
  } catch (error) {
    return {
      provider: 'voyage',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 2,
    };
  }
}

async function checkJinaHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
      throw new Error('JINA_API_KEY not configured');
    }

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: ['test'], model: 'jina-embeddings-v2-base-en' }),
    });

    const latencyMs = Date.now() - startTime;
    const isHealthy = response.ok || response.status === 400;

    return {
      provider: 'jina',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 3 : 0,
      modelsDisabled: isHealthy ? 0 : 3,
    };
  } catch (error) {
    return {
      provider: 'jina',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 3,
    };
  }
}

async function checkNomicHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.NOMIC_API_KEY;
    if (!apiKey) {
      throw new Error('NOMIC_API_KEY not configured');
    }

    const response = await fetch('https://api-atlas.nomic.ai/v1/embedding/text', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts: ['test'], model: 'nomic-embed-text-v1' }),
    });

    const latencyMs = Date.now() - startTime;
    const isHealthy = response.ok || response.status === 400;

    return {
      provider: 'nomic',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 2 : 0,
      modelsDisabled: isHealthy ? 0 : 2,
    };
  } catch (error) {
    return {
      provider: 'nomic',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 2,
    };
  }
}

async function checkStabilityHealth(): Promise<ProviderHealth> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      throw new Error('STABILITY_API_KEY not configured');
    }

    const response = await fetch('https://api.stability.ai/v1/user/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const latencyMs = Date.now() - startTime;
    const isHealthy = response.ok;

    return {
      provider: 'stability',
      status: isHealthy ? 'healthy' : 'degraded',
      latencyMs,
      lastChecked: new Date(),
      modelsAvailable: isHealthy ? 3 : 0,
      modelsDisabled: isHealthy ? 0 : 3,
    };
  } catch (error) {
    return {
      provider: 'stability',
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      errorMessage: (error as Error).message,
      modelsAvailable: 0,
      modelsDisabled: 3,
    };
  }
}

async function checkPerplexityHealth(): Promise<ProviderHealth> {
  // Perplexity not yet implemented - placeholder
  return {
    provider: 'perplexity',
    status: 'offline',
    latencyMs: null,
    lastChecked: new Date(),
    errorMessage: 'Provider not yet implemented',
    modelsAvailable: 0,
    modelsDisabled: 0,
  };
}

async function checkLocalHealth(): Promise<ProviderHealth> {
  // Local models not yet implemented - placeholder
  return {
    provider: 'local',
    status: 'offline',
    latencyMs: null,
    lastChecked: new Date(),
    errorMessage: 'Provider not yet implemented',
    modelsAvailable: 0,
    modelsDisabled: 0,
  };
}

// Helper functions

function getProviderNameByIndex(index: number): string {
  const providers = [
    'huggingface',
    'groq',
    'openrouter',
    'deepseek',
    'replicate',
    'together',
    'cohere',
    'voyage',
    'jina',
    'nomic',
    'stability',
    'perplexity',
    'local',
  ];
  return providers[index] || 'unknown';
}

function getModelCountByProvider(provider: string): number {
  const counts: Record<string, number> = {
    huggingface: 23,
    groq: 11,
    openrouter: 10,
    deepseek: 2,
    replicate: 6,
    together: 25,
    cohere: 5,
    voyage: 2,
    jina: 3,
    nomic: 2,
    stability: 3,
    perplexity: 0,
    local: 0,
  };
  return counts[provider] || 0;
}

/**
 * Get health status for a specific provider
 */
export async function getProviderHealth(provider: string): Promise<ProviderHealth | null> {
  const health = await getUniverseHealth();
  return health.providers.find(p => p.provider === provider) || null;
}

/**
 * Get list of healthy providers
 */
export async function getHealthyProviders(): Promise<string[]> {
  const health = await getUniverseHealth();
  return health.providers
    .filter(p => p.status === 'healthy')
    .map(p => p.provider);
}

/**
 * Check if specific provider is available
 */
export async function isProviderAvailable(provider: string): Promise<boolean> {
  const providerHealth = await getProviderHealth(provider);
  return providerHealth?.status === 'healthy';
}
