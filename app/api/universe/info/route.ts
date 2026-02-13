/**
 * Universe Info API Endpoint
 * GET /api/universe/info
 * 
 * Returns comprehensive summary of Universe:
 * - 200+ models across 13 providers
 * - Provider health status
 * - Model statistics by category
 * - Registry version and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSE_MODELS, UNIVERSE_STATS } from '@/lib/javari/multi-ai/model-registry-universe';
import { getUniverseHealth } from '@/lib/javari/multi-ai/universe-health';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get health status for all providers
    const health = await getUniverseHealth();

    // Build comprehensive response
    const response = {
      version: '2.7.0',
      timestamp: new Date().toISOString(),
      
      // Summary statistics
      summary: {
        totalModels: UNIVERSE_STATS.totalModels,
        totalProviders: UNIVERSE_STATS.providers.length,
        healthyProviders: health.healthyProviders,
        degradedProviders: health.degradedProviders,
        offlineProviders: health.offlineProviders,
        availableModels: health.availableModels,
        overallStatus: health.overallStatus,
      },

      // Models by provider
      byProvider: Object.entries(UNIVERSE_STATS.byProvider).map(([provider, count]) => {
        const providerHealth = health.providers.find(p => p.provider === provider);
        return {
          provider,
          totalModels: count,
          availableModels: providerHealth?.modelsAvailable || 0,
          status: providerHealth?.status || 'unknown',
          latencyMs: providerHealth?.latencyMs || null,
        };
      }),

      // Models by category
      byCategory: Object.entries(UNIVERSE_STATS.byCategory).map(([category, count]) => ({
        category,
        modelCount: count,
        availableModels: UNIVERSE_MODELS.filter(m => {
          const providerHealth = health.providers.find(p => p.provider === m.provider);
          return m.category === category && providerHealth?.status === 'healthy';
        }).length,
      })),

      // Provider details
      providers: health.providers.map(p => ({
        name: p.provider,
        status: p.status,
        latencyMs: p.latencyMs,
        modelsAvailable: p.modelsAvailable,
        modelsDisabled: p.modelsDisabled,
        lastChecked: p.lastChecked,
        errorMessage: p.errorMessage,
      })),

      // Featured models (fastest, most capable)
      featured: {
        fastest: UNIVERSE_MODELS.filter(m => 
          m.provider === 'groq' || m.tags.includes('fast') || m.tags.includes('turbo')
        ).slice(0, 5).map(formatModelInfo),

        mostCapable: UNIVERSE_MODELS.filter(m =>
          m.tags.includes('large') || m.tags.includes('powerful') || m.name.includes('70B')
        ).slice(0, 5).map(formatModelInfo),

        coding: UNIVERSE_MODELS.filter(m => m.category === 'code')
          .slice(0, 5)
          .map(formatModelInfo),

        embeddings: UNIVERSE_MODELS.filter(m => m.category === 'embedding')
          .slice(0, 5)
          .map(formatModelInfo),

        images: UNIVERSE_MODELS.filter(m => m.category === 'image')
          .slice(0, 3)
          .map(formatModelInfo),
      },

      // Categories available
      categories: UNIVERSE_STATS.categories,

      // Capabilities summary
      capabilities: {
        streaming: UNIVERSE_MODELS.filter(m => m.capabilities.streaming).length,
        functionCalling: UNIVERSE_MODELS.filter(m => m.capabilities.functionCalling).length,
        vision: UNIVERSE_MODELS.filter(m => m.capabilities.vision).length,
        audio: UNIVERSE_MODELS.filter(m => m.capabilities.audio).length,
      },

      // Context windows
      contextWindows: {
        ultraLong: UNIVERSE_MODELS.filter(m => m.contextWindow >= 100000).length,
        long: UNIVERSE_MODELS.filter(m => m.contextWindow >= 32000 && m.contextWindow < 100000).length,
        medium: UNIVERSE_MODELS.filter(m => m.contextWindow >= 8000 && m.contextWindow < 32000).length,
        short: UNIVERSE_MODELS.filter(m => m.contextWindow < 8000).length,
      },

      // All models (optional - can be large)
      allModels: UNIVERSE_MODELS.map(formatModelInfo),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('Universe info error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to retrieve Universe information',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Format model information for API response
 */
function formatModelInfo(model: typeof UNIVERSE_MODELS[0]) {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    category: model.category,
    tags: model.tags,
    contextWindow: model.contextWindow,
    capabilities: model.capabilities,
    cost: model.cost,
  };
}

/**
 * Health check endpoint
 * GET /api/universe/info?healthOnly=true
 */
export async function HEAD(request: NextRequest) {
  try {
    const health = await getUniverseHealth();
    
    const status = health.overallStatus === 'healthy' ? 200 :
                   health.overallStatus === 'degraded' ? 207 : 503;

    return new NextResponse(null, {
      status,
      headers: {
        'X-Universe-Status': health.overallStatus,
        'X-Universe-Healthy-Providers': health.healthyProviders.toString(),
        'X-Universe-Total-Providers': health.totalProviders.toString(),
        'X-Universe-Available-Models': health.availableModels.toString(),
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
