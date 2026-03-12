```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Request validation schema
const OptimizeRouteSchema = z.object({
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  destination: z.string().min(2).max(50),
  priority: z.enum(['cost', 'speed', 'reliability']).default('cost'),
  metadata: z.object({
    paymentMethod: z.string().optional(),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
  }).optional()
});

interface ProviderMetrics {
  id: string;
  name: string;
  baseFee: number;
  percentageFee: number;
  successRate: number;
  avgSettlementTime: number;
  isActive: boolean;
  lastUpdated: string;
  circuitBreakerOpen: boolean;
  supportedCurrencies: string[];
  supportedDestinations: string[];
}

interface RouteScore {
  providerId: string;
  providerName: string;
  estimatedFee: number;
  successRate: number;
  settlementTime: number;
  routeScore: number;
  factors: {
    costScore: number;
    speedScore: number;
    reliabilityScore: number;
  };
}

interface OptimizedRoute {
  primary: RouteScore;
  fallbacks: RouteScore[];
  optimization: {
    priority: string;
    totalRoutes: number;
    cacheHit: boolean;
    optimizationTime: number;
  };
}

class PaymentRouteOptimizer {
  private readonly CACHE_TTL = 30; // seconds
  private readonly WEIGHT_CONFIGS = {
    cost: { fee: 0.6, speed: 0.2, reliability: 0.2 },
    speed: { fee: 0.2, speed: 0.6, reliability: 0.2 },
    reliability: { fee: 0.2, speed: 0.2, reliability: 0.6 }
  };

  async optimizeRoute(
    amount: number,
    currency: string,
    destination: string,
    priority: 'cost' | 'speed' | 'reliability'
  ): Promise<OptimizedRoute> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `route:${amount}:${currency}:${destination}:${priority}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        optimization: {
          ...cached.optimization,
          cacheHit: true,
          optimizationTime: Date.now() - startTime
        }
      };
    }

    // Fetch provider metrics
    const providers = await this.fetchProviderMetrics(currency, destination);
    
    // Calculate route scores
    const scoredRoutes = providers.map(provider => 
      this.calculateRouteScore(provider, amount, priority)
    );

    // Sort by score (descending)
    scoredRoutes.sort((a, b) => b.routeScore - a.routeScore);

    const result: OptimizedRoute = {
      primary: scoredRoutes[0],
      fallbacks: scoredRoutes.slice(1, 4), // Top 3 fallbacks
      optimization: {
        priority,
        totalRoutes: scoredRoutes.length,
        cacheHit: false,
        optimizationTime: Date.now() - startTime
      }
    };

    // Cache result
    await this.setCache(cacheKey, result);

    return result;
  }

  private async fetchProviderMetrics(
    currency: string,
    destination: string
  ): Promise<ProviderMetrics[]> {
    try {
      const { data: providers, error } = await supabase
        .from('payments_providers')
        .select(`
          *,
          payment_metrics!inner(*),
          fee_structures!inner(*)
        `)
        .eq('is_active', true)
        .eq('circuit_breaker_open', false)
        .contains('supported_currencies', [currency])
        .contains('supported_destinations', [destination])
        .gte('payment_metrics.updated_at', new Date(Date.now() - 300000).toISOString()); // 5 min freshness

      if (error) throw error;

      return providers?.map(provider => ({
        id: provider.id,
        name: provider.name,
        baseFee: provider.fee_structures?.base_fee || 0,
        percentageFee: provider.fee_structures?.percentage_fee || 0,
        successRate: provider.payment_metrics?.success_rate || 0,
        avgSettlementTime: provider.payment_metrics?.avg_settlement_time || 0,
        isActive: provider.is_active,
        lastUpdated: provider.payment_metrics?.updated_at,
        circuitBreakerOpen: provider.circuit_breaker_open,
        supportedCurrencies: provider.supported_currencies,
        supportedDestinations: provider.supported_destinations
      })) || [];
    } catch (error) {
      console.error('Error fetching provider metrics:', error);
      return [];
    }
  }

  private calculateRouteScore(
    provider: ProviderMetrics,
    amount: number,
    priority: 'cost' | 'speed' | 'reliability'
  ): RouteScore {
    const estimatedFee = provider.baseFee + (amount * provider.percentageFee / 100);
    
    // Normalize scores (0-1)
    const costScore = Math.max(0, 1 - (estimatedFee / (amount * 0.1))); // Fee shouldn't exceed 10%
    const speedScore = Math.max(0, 1 - (provider.avgSettlementTime / (24 * 3600))); // Max 24h
    const reliabilityScore = provider.successRate / 100;

    const weights = this.WEIGHT_CONFIGS[priority];
    const routeScore = 
      (costScore * weights.fee) +
      (speedScore * weights.speed) +
      (reliabilityScore * weights.reliability);

    return {
      providerId: provider.id,
      providerName: provider.name,
      estimatedFee,
      successRate: provider.successRate,
      settlementTime: provider.avgSettlementTime,
      routeScore,
      factors: {
        costScore,
        speedScore,
        reliabilityScore
      }
    };
  }

  private async getFromCache(key: string): Promise<OptimizedRoute | null> {
    try {
      // Using Supabase storage as cache (in production, use Redis)
      const { data } = await supabase
        .from('route_cache')
        .select('data, created_at')
        .eq('cache_key', key)
        .gte('created_at', new Date(Date.now() - this.CACHE_TTL * 1000).toISOString())
        .single();

      return data ? JSON.parse(data.data) : null;
    } catch {
      return null;
    }
  }

  private async setCache(key: string, data: OptimizedRoute): Promise<void> {
    try {
      await supabase
        .from('route_cache')
        .upsert({
          cache_key: key,
          data: JSON.stringify(data),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
}

class CircuitBreaker {
  private failures = new Map<string, { count: number; lastFailure: number }>();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  async execute<T>(providerId: string, operation: () => Promise<T>): Promise<T> {
    const failure = this.failures.get(providerId);
    
    if (failure && failure.count >= this.FAILURE_THRESHOLD) {
      const timeSinceLastFailure = Date.now() - failure.lastFailure;
      if (timeSinceLastFailure < this.RESET_TIMEOUT) {
        throw new Error(`Circuit breaker open for provider ${providerId}`);
      }
      // Reset circuit breaker
      this.failures.delete(providerId);
    }

    try {
      const result = await operation();
      // Reset failure count on success
      this.failures.delete(providerId);
      return result;
    } catch (error) {
      this.recordFailure(providerId);
      throw error;
    }
  }

  private recordFailure(providerId: string): void {
    const failure = this.failures.get(providerId) || { count: 0, lastFailure: 0 };
    this.failures.set(providerId, {
      count: failure.count + 1,
      lastFailure: Date.now()
    });
  }
}

const circuitBreaker = new CircuitBreaker();
const optimizer = new PaymentRouteOptimizer();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Validate request
    const validatedData = OptimizeRouteSchema.parse(body);
    const { amount, currency, destination, priority } = validatedData;

    // Rate limiting check
    const clientId = request.headers.get('x-client-id') || 'anonymous';
    const rateLimitKey = `ratelimit:${clientId}`;
    
    const { data: rateLimitData } = await supabase
      .from('rate_limits')
      .select('requests, window_start')
      .eq('client_id', clientId)
      .single();

    const now = Date.now();
    const windowStart = rateLimitData?.window_start ? new Date(rateLimitData.window_start).getTime() : now;
    const isNewWindow = now - windowStart > 60000; // 1 minute window

    if (!isNewWindow && rateLimitData?.requests >= 100) {
      return NextResponse.json(
        { 
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60 - Math.floor((now - windowStart) / 1000)
        },
        { status: 429 }
      );
    }

    // Update rate limit
    await supabase
      .from('rate_limits')
      .upsert({
        client_id: clientId,
        requests: isNewWindow ? 1 : (rateLimitData?.requests || 0) + 1,
        window_start: isNewWindow ? new Date().toISOString() : rateLimitData?.window_start
      });

    // Optimize payment route
    const optimizedRoute = await circuitBreaker.execute(
      'route-optimizer',
      () => optimizer.optimizeRoute(amount, currency, destination, priority)
    );

    if (!optimizedRoute.primary) {
      return NextResponse.json(
        {
          error: 'NO_ROUTES_AVAILABLE',
          message: 'No payment routes available for the specified criteria',
          suggestions: [
            'Try a different currency pair',
            'Check if the destination is supported',
            'Reduce the payment amount'
          ]
        },
        { status: 404 }
      );
    }

    // Log optimization request for analytics
    await supabase
      .from('payment_routes')
      .insert({
        amount,
        currency,
        destination,
        priority,
        selected_provider: optimizedRoute.primary.providerId,
        estimated_fee: optimizedRoute.primary.estimatedFee,
        route_score: optimizedRoute.primary.routeScore,
        optimization_time: optimizedRoute.optimization.optimizationTime,
        client_id: clientId,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      data: optimizedRoute,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        requestId: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Payment route optimization error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while optimizing payment route',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency');
    const destination = searchParams.get('destination');

    if (!currency || !destination) {
      return NextResponse.json(
        {
          error: 'MISSING_PARAMETERS',
          message: 'Currency and destination parameters are required'
        },
        { status: 400 }
      );
    }

    // Get available providers for the currency/destination pair
    const { data: providers, error } = await supabase
      .from('payments_providers')
      .select('id, name, supported_currencies, supported_destinations, is_active')
      .eq('is_active', true)
      .contains('supported_currencies', [currency.toUpperCase()])
      .contains('supported_destinations', [destination.toLowerCase()]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        availableProviders: providers || [],
        currency: currency.toUpperCase(),
        destination: destination.toLowerCase(),
        count: providers?.length || 0
      }
    });

  } catch (error) {
    console.error('Get providers error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch available providers'
      },
      { status: 500 }
    );
  }
}
```