import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Redis } from 'ioredis';

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL!);

// Validation schemas
const analyticsQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d', '90d', '1y']).default('24h'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  timezone: z.string().default('UTC'),
  currency: z.string().optional(),
  country: z.string().optional(),
  payment_method: z.string().optional(),
  include_realtime: z.boolean().default(false),
});

const specificAnalyticsSchema = z.object({
  metric: z.enum(['volume', 'success-rates', 'geographic', 'revenue', 'realtime']),
  granularity: z.enum(['minute', 'hour', 'day', 'week', 'month']).default('hour'),
  limit: z.number().min(1).max(1000).default(100),
});

interface PaymentAnalytics {
  overview: {
    total_transactions: number;
    total_revenue: number;
    success_rate: number;
    average_transaction_value: number;
    growth_rate: number;
  };
  volume: {
    timestamp: string;
    transaction_count: number;
    revenue: number;
  }[];
  success_rates: {
    period: string;
    successful: number;
    failed: number;
    rate: number;
    failure_reasons: Record<string, number>;
  }[];
  geographic: {
    country: string;
    country_code: string;
    transaction_count: number;
    revenue: number;
    success_rate: number;
  }[];
  revenue: {
    period: string;
    gross_revenue: number;
    net_revenue: number;
    fees: number;
    refunds: number;
    currency_breakdown: Record<string, number>;
  }[];
}

class PaymentAnalyticsService {
  constructor(private supabase: any, private redis: Redis) {}

  async getComprehensiveAnalytics(filters: any): Promise<PaymentAnalytics> {
    const cacheKey = `payment_analytics:${JSON.stringify(filters)}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const [overview, volume, successRates, geographic, revenue] = await Promise.all([
      this.getOverviewMetrics(filters),
      this.getVolumeAnalytics(filters),
      this.getSuccessRateAnalytics(filters),
      this.getGeographicDistribution(filters),
      this.getRevenueInsights(filters),
    ]);

    const analytics: PaymentAnalytics = {
      overview,
      volume,
      success_rates: successRates,
      geographic,
      revenue,
    };

    // Cache for 5 minutes
    await this.redis.setex(cacheKey, 300, JSON.stringify(analytics));
    
    return analytics;
  }

  private async getOverviewMetrics(filters: any) {
    const { data, error } = await this.supabase
      .rpc('get_payment_overview_metrics', {
        p_timeframe: filters.timeframe,
        p_start_date: filters.start_date,
        p_end_date: filters.end_date,
        p_currency: filters.currency,
        p_country: filters.country,
        p_payment_method: filters.payment_method,
      });

    if (error) throw new Error(`Overview metrics error: ${error.message}`);
    
    return data[0] || {
      total_transactions: 0,
      total_revenue: 0,
      success_rate: 0,
      average_transaction_value: 0,
      growth_rate: 0,
    };
  }

  private async getVolumeAnalytics(filters: any) {
    const { data, error } = await this.supabase
      .rpc('get_transaction_volume_analytics', {
        p_timeframe: filters.timeframe,
        p_start_date: filters.start_date,
        p_end_date: filters.end_date,
        p_granularity: 'hour',
        p_currency: filters.currency,
        p_country: filters.country,
      });

    if (error) throw new Error(`Volume analytics error: ${error.message}`);
    
    return data || [];
  }

  private async getSuccessRateAnalytics(filters: any) {
    const { data, error } = await this.supabase
      .rpc('get_success_rate_analytics', {
        p_timeframe: filters.timeframe,
        p_start_date: filters.start_date,
        p_end_date: filters.end_date,
        p_granularity: 'day',
        p_include_failure_reasons: true,
      });

    if (error) throw new Error(`Success rate analytics error: ${error.message}`);
    
    return data || [];
  }

  private async getGeographicDistribution(filters: any) {
    const { data, error } = await this.supabase
      .rpc('get_geographic_payment_distribution', {
        p_timeframe: filters.timeframe,
        p_start_date: filters.start_date,
        p_end_date: filters.end_date,
        p_currency: filters.currency,
        p_limit: 50,
      });

    if (error) throw new Error(`Geographic distribution error: ${error.message}`);
    
    return data || [];
  }

  private async getRevenueInsights(filters: any) {
    const { data, error } = await this.supabase
      .rpc('get_revenue_insights', {
        p_timeframe: filters.timeframe,
        p_start_date: filters.start_date,
        p_end_date: filters.end_date,
        p_granularity: 'day',
        p_include_currency_breakdown: true,
      });

    if (error) throw new Error(`Revenue insights error: ${error.message}`);
    
    return data || [];
  }

  async getSpecificMetric(metric: string, filters: any) {
    switch (metric) {
      case 'volume':
        return this.getVolumeAnalytics(filters);
      case 'success-rates':
        return this.getSuccessRateAnalytics(filters);
      case 'geographic':
        return this.getGeographicDistribution(filters);
      case 'revenue':
        return this.getRevenueInsights(filters);
      case 'realtime':
        return this.getRealtimeMetrics(filters);
      default:
        throw new Error('Invalid metric type');
    }
  }

  private async getRealtimeMetrics(filters: any) {
    const cacheKey = 'realtime_payment_metrics';
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data, error } = await this.supabase
      .rpc('get_realtime_payment_metrics', {
        p_last_minutes: 60,
        p_include_trends: true,
      });

    if (error) throw new Error(`Realtime metrics error: ${error.message}`);

    // Cache for 30 seconds
    await this.redis.setex(cacheKey, 30, JSON.stringify(data));
    
    return data;
  }
}

class RealtimeDataProcessor {
  constructor(private supabase: any) {}

  async setupRealtimeSubscription(filters: any) {
    return this.supabase
      .channel('payment_analytics')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_transactions',
          filter: this.buildRealtimeFilter(filters),
        },
        (payload: any) => {
          this.processRealtimeUpdate(payload);
        }
      )
      .subscribe();
  }

  private buildRealtimeFilter(filters: any): string {
    const conditions = [];
    
    if (filters.currency) {
      conditions.push(`currency=eq.${filters.currency}`);
    }
    
    if (filters.country) {
      conditions.push(`country_code=eq.${filters.country}`);
    }

    return conditions.join('&');
  }

  private async processRealtimeUpdate(payload: any) {
    // Update cached metrics
    await this.updateCachedMetrics(payload);
    
    // Emit to connected clients via WebSocket (if implemented)
    // this.emitToClients('analytics_update', payload);
  }

  private async updateCachedMetrics(payload: any) {
    const keys = await redis.keys('payment_analytics:*');
    
    // Invalidate relevant cache keys
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    
    // Update realtime metrics cache
    await redis.del('realtime_payment_metrics');
  }
}

// Main route handlers
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const analyticsService = new PaymentAnalyticsService(supabase, redis);
    
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams);
    
    // Validate query parameters
    const validatedParams = analyticsQuerySchema.parse(queryParams);
    
    // Check if requesting specific metric
    const metric = searchParams.get('metric');
    if (metric) {
      const specificParams = specificAnalyticsSchema.parse({
        ...queryParams,
        metric,
      });
      
      const data = await analyticsService.getSpecificMetric(
        specificParams.metric,
        { ...validatedParams, ...specificParams }
      );
      
      return NextResponse.json({
        success: true,
        data,
        metadata: {
          metric: specificParams.metric,
          timeframe: validatedParams.timeframe,
          generated_at: new Date().toISOString(),
          cache_status: 'computed',
        },
      });
    }

    // Get comprehensive analytics
    const analytics = await analyticsService.getComprehensiveAnalytics(validatedParams);
    
    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        timeframe: validatedParams.timeframe,
        generated_at: new Date().toISOString(),
        cache_status: 'computed',
        includes_realtime: validatedParams.include_realtime,
      },
    });

  } catch (error) {
    console.error('Payment analytics error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve payment analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    
    // Handle analytics refresh requests
    if (body.action === 'refresh') {
      const keys = await redis.keys('payment_analytics:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Analytics cache refreshed',
        cleared_keys: keys.length,
      });
    }
    
    // Handle realtime subscription setup
    if (body.action === 'subscribe') {
      const processor = new RealtimeDataProcessor(supabase);
      const subscription = await processor.setupRealtimeSubscription(body.filters || {});
      
      return NextResponse.json({
        success: true,
        message: 'Realtime subscription configured',
        subscription_id: subscription?.id,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Payment analytics POST error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process analytics request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}