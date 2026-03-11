import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import crypto from 'crypto';

// Environment variables validation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = Redis.fromEnv();

// Request validation schemas
const contentRequestSchema = z.object({
  action: z.enum(['route', 'upload', 'invalidate', 'optimize', 'analytics']),
  content: z.object({
    url: z.string().url().optional(),
    type: z.enum(['image', 'video', 'audio', 'document', 'static']).optional(),
    size: z.number().positive().optional(),
    metadata: z.record(z.any()).optional()
  }).optional(),
  geographic: z.object({
    region: z.string().optional(),
    country: z.string().optional(),
    clientIp: z.string().ip().optional()
  }).optional(),
  optimization: z.object({
    quality: z.number().min(1).max(100).optional(),
    format: z.string().optional(),
    compression: z.enum(['lossless', 'lossy', 'auto']).optional()
  }).optional(),
  cacheControl: z.object({
    ttl: z.number().positive().optional(),
    tags: z.array(z.string()).optional(),
    priority: z.enum(['low', 'normal', 'high', 'critical']).optional()
  }).optional()
});

// CDN Provider interfaces
interface CDNProvider {
  id: string;
  name: string;
  endpoints: string[];
  regions: string[];
  capabilities: string[];
  healthScore: number;
  lastHealthCheck: Date;
  rateLimits: {
    requestsPerSecond: number;
    bandwidthMbps: number;
  };
}

interface ProviderResponse {
  provider: string;
  url: string;
  latency: number;
  success: boolean;
  error?: string;
}

// Circuit breaker pattern
class CircuitBreaker {
  private failures: Map<string, number> = new Map();
  private lastFailTime: Map<string, Date> = new Map();
  private readonly threshold = 5;
  private readonly timeout = 30000; // 30 seconds

  isOpen(providerId: string): boolean {
    const failures = this.failures.get(providerId) || 0;
    const lastFail = this.lastFailTime.get(providerId);
    
    if (failures >= this.threshold && lastFail) {
      const timeSinceLastFail = Date.now() - lastFail.getTime();
      return timeSinceLastFail < this.timeout;
    }
    
    return false;
  }

  recordFailure(providerId: string): void {
    const current = this.failures.get(providerId) || 0;
    this.failures.set(providerId, current + 1);
    this.lastFailTime.set(providerId, new Date());
  }

  recordSuccess(providerId: string): void {
    this.failures.delete(providerId);
    this.lastFailTime.delete(providerId);
  }
}

const circuitBreaker = new CircuitBreaker();

// CDN Orchestration Service
class CDNOrchestrationService {
  private providers: Map<string, CDNProvider> = new Map();
  
  constructor() {
    this.initializeProviders();
  }

  private async initializeProviders(): Promise<void> {
    try {
      const { data: providers, error } = await supabase
        .from('cdn_providers')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      providers?.forEach(provider => {
        this.providers.set(provider.id, {
          ...provider,
          lastHealthCheck: new Date(provider.last_health_check),
          healthScore: provider.health_score || 100
        });
      });
    } catch (error) {
      console.error('Failed to initialize CDN providers:', error);
    }
  }

  async routeContent(request: {
    content: any;
    geographic?: any;
    clientIp?: string;
  }): Promise<ProviderResponse> {
    const startTime = Date.now();
    
    try {
      // Get optimal provider based on geography and health
      const optimalProvider = await this.selectOptimalProvider(
        request.geographic?.region,
        request.clientIp
      );

      if (!optimalProvider) {
        throw new Error('No healthy providers available');
      }

      // Route through selected provider
      const response = await this.routeThroughProvider(
        optimalProvider,
        request.content
      );

      // Log performance metrics
      await this.logPerformanceMetrics({
        provider: optimalProvider.id,
        latency: Date.now() - startTime,
        success: true,
        region: request.geographic?.region
      });

      return response;
    } catch (error) {
      // Implement failover logic
      return await this.handleFailover(request, error);
    }
  }

  private async selectOptimalProvider(
    region?: string,
    clientIp?: string
  ): Promise<CDNProvider | null> {
    try {
      // Get provider health scores from cache
      const healthScores = await redis.hgetall('cdn:health');
      
      // Filter healthy providers
      const healthyProviders = Array.from(this.providers.values())
        .filter(provider => {
          const isHealthy = !circuitBreaker.isOpen(provider.id);
          const hasGoodHealth = (healthScores[provider.id] || 100) > 70;
          return isHealthy && hasGoodHealth;
        });

      if (healthyProviders.length === 0) {
        return null;
      }

      // Score providers based on multiple factors
      const scoredProviders = await Promise.all(
        healthyProviders.map(async provider => ({
          provider,
          score: await this.calculateProviderScore(provider, region, clientIp)
        }))
      );

      // Return highest scoring provider
      scoredProviders.sort((a, b) => b.score - a.score);
      return scoredProviders[0].provider;
    } catch (error) {
      console.error('Provider selection failed:', error);
      return healthyProviders[0] || null;
    }
  }

  private async calculateProviderScore(
    provider: CDNProvider,
    region?: string,
    clientIp?: string
  ): Promise<number> {
    let score = provider.healthScore;

    // Geographic proximity bonus
    if (region && provider.regions.includes(region)) {
      score += 20;
    }

    // Performance history bonus
    const performanceKey = `perf:${provider.id}:${region || 'global'}`;
    const avgLatency = await redis.get(performanceKey);
    if (avgLatency && typeof avgLatency === 'number') {
      score += Math.max(0, 50 - avgLatency / 10);
    }

    // Load balancing - reduce score for overloaded providers
    const currentLoad = await redis.get(`load:${provider.id}`);
    if (currentLoad && typeof currentLoad === 'number' && currentLoad > 80) {
      score -= 30;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async routeThroughProvider(
    provider: CDNProvider,
    content: any
  ): Promise<ProviderResponse> {
    const startTime = Date.now();
    
    try {
      // Select best endpoint from provider
      const endpoint = await this.selectBestEndpoint(provider);
      
      // Route content through provider's API
      const response = await this.makeProviderRequest(provider, endpoint, content);
      
      const latency = Date.now() - startTime;
      
      // Record success
      circuitBreaker.recordSuccess(provider.id);
      
      return {
        provider: provider.id,
        url: response.url,
        latency,
        success: true
      };
    } catch (error) {
      // Record failure
      circuitBreaker.recordFailure(provider.id);
      
      throw error;
    }
  }

  private async selectBestEndpoint(provider: CDNProvider): Promise<string> {
    // Health check endpoints and return best performing one
    const endpointHealths = await Promise.all(
      provider.endpoints.map(async endpoint => {
        try {
          const healthKey = `endpoint:health:${endpoint}`;
          const health = await redis.get(healthKey) || 100;
          return { endpoint, health: Number(health) };
        } catch {
          return { endpoint, health: 0 };
        }
      })
    );

    endpointHealths.sort((a, b) => b.health - a.health);
    return endpointHealths[0].endpoint;
  }

  private async makeProviderRequest(
    provider: CDNProvider,
    endpoint: string,
    content: any
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${endpoint}/api/v1/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env[`${provider.id.toUpperCase()}_API_KEY`]}`,
          'User-Agent': 'AudioViz-CDN-Orchestrator/1.0'
        },
        body: JSON.stringify({
          content,
          timestamp: Date.now(),
          requestId: crypto.randomUUID()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Provider ${provider.name} responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async handleFailover(
    request: any,
    originalError: any
  ): Promise<ProviderResponse> {
    console.error('Primary routing failed, initiating failover:', originalError);

    // Get all remaining healthy providers
    const fallbackProviders = Array.from(this.providers.values())
      .filter(p => !circuitBreaker.isOpen(p.id))
      .sort((a, b) => b.healthScore - a.healthScore);

    for (const provider of fallbackProviders) {
      try {
        const response = await this.routeThroughProvider(provider, request.content);
        
        // Log failover success
        await this.logFailoverEvent({
          originalError: originalError.message,
          fallbackProvider: provider.id,
          success: true
        });

        return response;
      } catch (error) {
        console.error(`Failover to ${provider.name} failed:`, error);
        continue;
      }
    }

    throw new Error('All CDN providers failed');
  }

  async optimizeContent(content: any, optimization: any): Promise<any> {
    try {
      // Content optimization pipeline
      const optimizedContent = await this.runOptimizationPipeline(content, optimization);
      
      // Store optimization results
      await supabase.from('content_optimizations').insert({
        original_size: content.size,
        optimized_size: optimizedContent.size,
        optimization_type: optimization.type,
        quality_score: optimizedContent.qualityScore,
        created_at: new Date().toISOString()
      });

      return optimizedContent;
    } catch (error) {
      console.error('Content optimization failed:', error);
      throw error;
    }
  }

  private async runOptimizationPipeline(content: any, optimization: any): Promise<any> {
    // Mock optimization pipeline - implement actual optimization logic
    const compressionRatio = optimization.compression === 'lossless' ? 0.8 : 0.6;
    
    return {
      ...content,
      size: Math.floor(content.size * compressionRatio),
      qualityScore: optimization.quality || 85,
      format: optimization.format || content.format,
      optimized: true,
      optimizedAt: new Date().toISOString()
    };
  }

  async invalidateCache(tags: string[], providers?: string[]): Promise<void> {
    const targetProviders = providers || Array.from(this.providers.keys());
    
    const invalidationPromises = targetProviders.map(async providerId => {
      const provider = this.providers.get(providerId);
      if (!provider) return;

      try {
        await this.invalidateProviderCache(provider, tags);
        
        // Log successful invalidation
        await supabase.from('cache_invalidations').insert({
          provider_id: providerId,
          tags,
          status: 'success',
          created_at: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Cache invalidation failed for ${provider.name}:`, error);
        
        // Log failed invalidation
        await supabase.from('cache_invalidations').insert({
          provider_id: providerId,
          tags,
          status: 'failed',
          error: (error as Error).message,
          created_at: new Date().toISOString()
        });
      }
    });

    await Promise.allSettled(invalidationPromises);
  }

  private async invalidateProviderCache(provider: CDNProvider, tags: string[]): Promise<void> {
    const endpoint = await this.selectBestEndpoint(provider);
    
    const response = await fetch(`${endpoint}/api/v1/cache/invalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env[`${provider.id.toUpperCase()}_API_KEY`]}`
      },
      body: JSON.stringify({ tags })
    });

    if (!response.ok) {
      throw new Error(`Invalidation failed: ${response.status}`);
    }
  }

  private async logPerformanceMetrics(metrics: {
    provider: string;
    latency: number;
    success: boolean;
    region?: string;
  }): Promise<void> {
    try {
      // Store in Supabase
      await supabase.from('cdn_performance_metrics').insert({
        provider_id: metrics.provider,
        latency: metrics.latency,
        success: metrics.success,
        region: metrics.region,
        timestamp: new Date().toISOString()
      });

      // Update Redis cache with rolling averages
      const perfKey = `perf:${metrics.provider}:${metrics.region || 'global'}`;
      const currentAvg = await redis.get(perfKey) || metrics.latency;
      const newAvg = (Number(currentAvg) * 0.9) + (metrics.latency * 0.1);
      await redis.setex(perfKey, 3600, newAvg);
    } catch (error) {
      console.error('Failed to log performance metrics:', error);
    }
  }

  private async logFailoverEvent(event: {
    originalError: string;
    fallbackProvider: string;
    success: boolean;
  }): Promise<void> {
    try {
      await supabase.from('cdn_failover_events').insert({
        original_error: event.originalError,
        fallback_provider: event.fallbackProvider,
        success: event.success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log failover event:', error);
    }
  }

  async getAnalytics(timeRange: string = '24h'): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('cdn_performance_metrics')
        .select('*')
        .gte('timestamp', new Date(Date.now() - this.parseTimeRange(timeRange)).toISOString());

      if (error) throw error;

      // Process analytics data
      const analytics = this.processAnalyticsData(data);
      return analytics;
    } catch (error) {
      console.error('Failed to get analytics:', error);
      throw error;
    }
  }

  private parseTimeRange(range: string): number {
    const multipliers: Record<string, number> = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000
    };
    return multipliers[range] || multipliers['24h'];
  }

  private processAnalyticsData(data: any[]): any {
    const providerStats: Record<string, any> = {};
    const regionStats: Record<string, any> = {};
    
    data.forEach(metric => {
      // Provider stats
      if (!providerStats[metric.provider_id]) {
        providerStats[metric.provider_id] = {
          totalRequests: 0,
          successfulRequests: 0,
          avgLatency: 0,
          latencies: []
        };
      }
      
      const providerStat = providerStats[metric.provider_id];
      providerStat.totalRequests++;
      if (metric.success) providerStat.successfulRequests++;
      providerStat.latencies.push(metric.latency);
      
      // Region stats
      if (metric.region) {
        if (!regionStats[metric.region]) {
          regionStats[metric.region] = { totalRequests: 0, avgLatency: 0, latencies: [] };
        }
        regionStats[metric.region].totalRequests++;
        regionStats[metric.region].latencies.push(metric.latency);
      }
    });

    // Calculate averages
    Object.keys(providerStats).forEach(providerId => {
      const stat = providerStats[providerId];
      stat.avgLatency = stat.latencies.reduce((a: number, b: number) => a + b, 0) / stat.latencies.length;
      stat.successRate = stat.successfulRequests / stat.totalRequests;
      delete stat.latencies;
    });

    Object.keys(regionStats).forEach(region => {
      const stat = regionStats[region];
      stat.avgLatency = stat.latencies.reduce((a: number, b: number) => a + b, 0) / stat.latencies.length;
      delete stat.latencies;
    });

    return {
      providerStats,
      regionStats,
      totalRequests: data.length,
      timeRange: data.length > 0 ? {
        start: data[0].timestamp,
        end: data[data.length - 1].timestamp
      } : null
    };
  }
}

// Health monitoring service
class HealthMonitoringService {
  private orchestrator: CDNOrchestrationService;
  
  constructor(orchestrator: CDNOrchestrationService) {
    this.orchestrator = orchestrator;
  }

  async checkProviderHealth(): Promise<void> {
    const healthChecks = Array.from(this.orchestrator['providers'].values()).map(async provider => {
      try {
        const startTime = Date.now();
        const endpoint = await this.orchestrator['selectBestEndpoint'](provider);
        
        const response = await fetch(`${endpoint}/health`, {
          method: 'GET',
          timeout: 5000
        });

        const latency = Date.now() - startTime;
        const isHealthy = response.ok && latency < 2000;
        const healthScore = isHealthy ? Math.max(50, 100 - latency / 20) : 0;

        // Update Redis health cache
        await redis.hset('cdn:health', provider.id, healthScore);
        
        // Update database
        await supabase
          .from('cdn_providers')
          .update({
            health_score: healthScore,
            last_health_check: new Date().toISOString()
          })
          .eq('id', provider.id);

      } catch (error) {
        console.error(`Health check failed for ${provider.name}:`, error);
        await redis.hset('cdn:health', provider.id, 0);
      }
    });

    await Promise.allSettled(healthChecks);
  }
}

// Main orchestration service instance
const cdnOrchestrator = new CDNOrchestrationService();
const healthMonitor = new HealthMonitoringService(cdnOrchestrator);

// Health check interval (every 30 seconds)
setInterval(() => {
  healthMonitor.checkProviderHealth().catch(console.error);
}, 30000);

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = contentRequestSchema.parse(body);
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1';

    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    // Add client IP to geographic data
    if (validatedData.geographic && clientIp !== '127.0.0.1') {
      validatedData.geographic.clientIp = clientIp;
    }

    let result;

    switch (validatedData.action) {
      case 'route':
        result = await cdnOrchestrator.routeContent({
          content: validatedData.content,
          geographic: validatedData.geographic,
          clientIp
        });
        break;

      case 'upload':
        if (!validatedData.content) {
          return NextResponse.json(
            { error: 'Content required for upload action' },
            { status: 400 }
          );
        }
        
        // Route and optimize content
        const uploadResult = await cdnOrchestrator.routeContent({
          content: validatedData.content,
          geographic: validatedData.geographic,
          clientIp
        });
        
        result = {
          ...uploadResult,
          optimized: validatedData.optimization ? 
            await cdnOrchestrator.optimizeContent(
              validatedData.content,
              validatedData.optimization
            ) : null
        };
        break;

      case 'optimize':
        if (!validatedData.content || !validatedData.optimization) {
          return NextResponse.json(
            { error: 'Content and optimization parameters required' },
            { status: 400 }
          );
        }
        
        result = await cdnOrchestrator.optimizeContent(
          validatedData.content,
          validatedData.optimization
        );
        break;

      case 'invalidate':
        if (!validatedData.cacheControl?.tags?.length) {
          return NextResponse.json(
            { error: 'Cache tags required for invalidation' },
            { status: 400 }
          );
        }
        
        await cdnOrchestrator.invalidateCache(
          validatedData.cacheControl.tags,
          validatedData.geographic?.region ? [validatedData.geographic.region] : undefined
        );
        
        result = { 
          success: true, 
          invalidated: validatedData.cacheControl.tags 
        };