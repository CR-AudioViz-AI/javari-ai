// lib/javari/multi-ai/universe-health-updated.ts
// Enhanced health monitoring with HuggingFace support

import { UNIVERSE_MODELS, UniversalModelMetadata } from './model-registry-universe';
import { checkModelAvailability } from '../providers/huggingface';

export interface HealthCheckResult {
  modelId: string;
  provider: string;
  status: 'healthy' | 'degraded' | 'down' | 'untested';
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

export interface UniverseHealthReport {
  timestamp: string;
  totalModels: number;
  healthy: number;
  degraded: number;
  down: number;
  untested: number;
  results: HealthCheckResult[];
}

/**
 * Check health of a single model
 */
export async function checkModelHealth(model: UniversalModelMetadata): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // HuggingFace models - actual health check
    if (model.provider === 'huggingface') {
      const result = await checkModelAvailability(model.id);
      
      return {
        modelId: model.id,
        provider: model.provider,
        status: result.available ? 'healthy' : 'down',
        responseTime: Date.now() - startTime,
        error: result.error,
        lastChecked: new Date().toISOString()
      };
    }
    
    // Other providers - assume healthy if in registry
    return {
      modelId: model.id,
      provider: model.provider,
      status: 'healthy',
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      modelId: model.id,
      provider: model.provider,
      status: 'down',
      error: error.message,
      responseTime: Date.now() - startTime,
      lastChecked: new Date().toISOString()
    };
  }
}

/**
 * Generate comprehensive health report
 */
export async function generateUniverseHealthReport(
  checkHuggingFace: boolean = true
): Promise<UniverseHealthReport> {
  const results: HealthCheckResult[] = [];
  
  // Check all models
  for (const model of UNIVERSE_MODELS) {
    // Only check HuggingFace if enabled and API key available
    if (model.provider === 'huggingface' && checkHuggingFace) {
      const result = await checkModelHealth(model);
      results.push(result);
    } else {
      // Mark as untested or assume healthy
      results.push({
        modelId: model.id,
        provider: model.provider,
        status: model.provider === 'huggingface' ? 'untested' : 'healthy',
        lastChecked: new Date().toISOString()
      });
    }
  }
  
  // Calculate stats
  const statusCount = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    timestamp: new Date().toISOString(),
    totalModels: UNIVERSE_MODELS.length,
    healthy: statusCount['healthy'] || 0,
    degraded: statusCount['degraded'] || 0,
    down: statusCount['down'] || 0,
    untested: statusCount['untested'] || 0,
    results
  };
}

/**
 * Quick health check for HuggingFace connectivity
 */
export async function checkHuggingFaceHealth(): Promise<{
  available: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const testModel = UNIVERSE_MODELS.find(m => 
      m.provider === 'huggingface' && m.type === 'chat'
    );
    
    if (!testModel) {
      return { available: false, error: 'No HuggingFace models configured' };
    }
    
    const result = await checkModelAvailability(testModel.id);
    
    return {
      available: result.available,
      latency: Date.now() - startTime,
      error: result.error
    };
  } catch (error: any) {
    return {
      available: false,
      latency: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Get models by health status
 */
export function getModelsByStatus(
  status: 'healthy' | 'degraded' | 'down' | 'untested',
  results: HealthCheckResult[]
): UniversalModelMetadata[] {
  const modelIds = results
    .filter(r => r.status === status)
    .map(r => r.modelId);
  
  return UNIVERSE_MODELS.filter(m => modelIds.includes(m.id));
}

/**
 * Get provider health summary
 */
export function getProviderHealthSummary(results: HealthCheckResult[]): Record<string, {
  total: number;
  healthy: number;
  down: number;
  untested: number;
}> {
  const summary: Record<string, any> = {};
  
  results.forEach(result => {
    if (!summary[result.provider]) {
      summary[result.provider] = { total: 0, healthy: 0, down: 0, untested: 0 };
    }
    
    summary[result.provider].total++;
    summary[result.provider][result.status]++;
  });
  
  return summary;
}

/**
 * Quick stats
 */
export function getQuickStats() {
  return {
    total: UNIVERSE_MODELS.length,
    byType: {
      chat: UNIVERSE_MODELS.filter(m => m.type === 'chat').length,
      code: UNIVERSE_MODELS.filter(m => m.type === 'code').length,
      summarize: UNIVERSE_MODELS.filter(m => m.type === 'summarize').length,
      classify: UNIVERSE_MODELS.filter(m => m.type === 'classify').length,
      embed: UNIVERSE_MODELS.filter(m => m.type === 'embed').length,
      translate: UNIVERSE_MODELS.filter(m => m.type === 'translate').length,
      math: UNIVERSE_MODELS.filter(m => m.type === 'math').length,
    },
    byProvider: {
      huggingface: UNIVERSE_MODELS.filter(m => m.provider === 'huggingface').length,
      openrouter: UNIVERSE_MODELS.filter(m => m.provider === 'openrouter').length,
      groq: UNIVERSE_MODELS.filter(m => m.provider === 'groq').length,
      deepseek: UNIVERSE_MODELS.filter(m => m.provider === 'deepseek').length,
    },
    allFree: UNIVERSE_MODELS.every(m => m.cost === 0)
  };
}
