import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import { z } from 'zod';

// Validation schema
const PaymentAnalyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  regions: z.string().transform(val => val.split(',')).optional(),
  paymentMethods: z.string().transform(val => val.split(',')).optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  includeRevenue: z.boolean().default(true),
  includeProcessingTimes: z.boolean().default(true)
});

// Response types
interface PaymentMetrics {
  success_rate: number;
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  average_processing_time: number;
  median_processing_time: number;
  total_revenue: number;
  average_transaction_value: number;
}

interface RegionalMetrics extends PaymentMetrics {
  region: string;
  country_code: string;
}

interface PaymentMethodMetrics extends PaymentMetrics {
  payment_method: string;
  method_type: string;
}

interface TimeSeriesData {
  timestamp: string;
  metrics: PaymentMetrics;
}

interface PaymentAnalyticsResponse {
  overall_metrics: PaymentMetrics;
  regional_breakdown: RegionalMetrics[];
  payment_method_breakdown: PaymentMethodMetrics[];
  time_series: TimeSeriesData[];
  metadata: {
    date_range: {
      start: string;
      end: string;
    };
    total_records: number;
    cache_hit: boolean;
    generated_at: string;
  };
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

class PaymentAnalyticsService {
  private static async getCachedResult(cacheKey: string): Promise<PaymentAnalyticsResponse | null> {
    try {
      const cached = await redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Redis cache read error:', error);
      return null;
    }
  }

  private static async setCachedResult(cacheKey: string, data: PaymentAnalyticsResponse): Promise<void> {
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 minute TTL
    } catch (error) {
      console.warn('Redis cache write error:', error);
    }
  }

  static async getPaymentAnalytics(params: z.infer<typeof PaymentAnalyticsQuerySchema>): Promise<PaymentAnalyticsResponse> {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      regions,
      paymentMethods,
      granularity,
      includeRevenue,
      includeProcessingTimes
    } = params;

    // Generate cache key
    const cacheKey = `payment_analytics:${JSON.stringify(params)}`;
    
    // Check cache
    const cachedResult = await this.getCachedResult(cacheKey);
    if (cachedResult) {
      cachedResult.metadata.cache_hit = true;
      return cachedResult;
    }

    // Build base query conditions
    const baseConditions = [
      `created_at >= '${startDate}'`,
      `created_at <= '${endDate} 23:59:59'`
    ];

    if (regions?.length) {
      baseConditions.push(`region IN (${regions.map(r => `'${r}'`).join(',')})`);
    }

    if (paymentMethods?.length) {
      baseConditions.push(`payment_method IN (${paymentMethods.map(m => `'${m}'`).join(',')})`);
    }

    const whereClause = baseConditions.join(' AND ');

    // Execute parallel queries
    const [overallMetrics, regionalBreakdown, paymentMethodBreakdown, timeSeriesData] = await Promise.all([
      this.calculateOverallMetrics(whereClause, includeRevenue, includeProcessingTimes),
      this.calculateRegionalBreakdown(whereClause, includeRevenue, includeProcessingTimes),
      this.calculatePaymentMethodBreakdown(whereClause, includeRevenue, includeProcessingTimes),
      this.calculateTimeSeries(whereClause, granularity, includeRevenue, includeProcessingTimes)
    ]);

    const result: PaymentAnalyticsResponse = {
      overall_metrics: overallMetrics,
      regional_breakdown: regionalBreakdown,
      payment_method_breakdown: paymentMethodBreakdown,
      time_series: timeSeriesData,
      metadata: {
        date_range: { start: startDate, end: endDate },
        total_records: overallMetrics.total_transactions,
        cache_hit: false,
        generated_at: new Date().toISOString()
      }
    };

    // Cache the result
    await this.setCachedResult(cacheKey, result);

    return result;
  }

  private static async calculateOverallMetrics(
    whereClause: string,
    includeRevenue: boolean,
    includeProcessingTimes: boolean
  ): Promise<PaymentMetrics> {
    const { data, error } = await supabase.rpc('calculate_payment_metrics', {
      where_conditions: whereClause,
      include_revenue: includeRevenue,
      include_processing_times: includeProcessingTimes
    });

    if (error) throw new Error(`Database query error: ${error.message}`);
    if (!data || data.length === 0) {
      return this.getEmptyMetrics();
    }

    return data[0];
  }

  private static async calculateRegionalBreakdown(
    whereClause: string,
    includeRevenue: boolean,
    includeProcessingTimes: boolean
  ): Promise<RegionalMetrics[]> {
    const { data, error } = await supabase.rpc('calculate_regional_payment_metrics', {
      where_conditions: whereClause,
      include_revenue: includeRevenue,
      include_processing_times: includeProcessingTimes
    });

    if (error) throw new Error(`Regional breakdown query error: ${error.message}`);
    return data || [];
  }

  private static async calculatePaymentMethodBreakdown(
    whereClause: string,
    includeRevenue: boolean,
    includeProcessingTimes: boolean
  ): Promise<PaymentMethodMetrics[]> {
    const { data, error } = await supabase.rpc('calculate_payment_method_metrics', {
      where_conditions: whereClause,
      include_revenue: includeRevenue,
      include_processing_times: includeProcessingTimes
    });

    if (error) throw new Error(`Payment method breakdown query error: ${error.message}`);
    return data || [];
  }

  private static async calculateTimeSeries(
    whereClause: string,
    granularity: string,
    includeRevenue: boolean,
    includeProcessingTimes: boolean
  ): Promise<TimeSeriesData[]> {
    const { data, error } = await supabase.rpc('calculate_payment_time_series', {
      where_conditions: whereClause,
      time_granularity: granularity,
      include_revenue: includeRevenue,
      include_processing_times: includeProcessingTimes
    });

    if (error) throw new Error(`Time series query error: ${error.message}`);
    return data || [];
  }

  private static getEmptyMetrics(): PaymentMetrics {
    return {
      success_rate: 0,
      total_transactions: 0,
      successful_transactions: 0,
      failed_transactions: 0,
      average_processing_time: 0,
      median_processing_time: 0,
      total_revenue: 0,
      average_transaction_value: 0
    };
  }
}

class SecurityValidator {
  static validateRequest(request: NextRequest): { isValid: boolean; error?: string } {
    // Check API key
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.ANALYTICS_API_KEY) {
      return { isValid: false, error: 'Invalid or missing API key' };
    }

    // Rate limiting check (basic implementation)
    const userAgent = request.headers.get('user-agent') || 'unknown';
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      return { isValid: false, error: 'Bot requests not allowed' };
    }

    return { isValid: true };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Security validation
    const securityCheck = SecurityValidator.validateRequest(request);
    if (!securityCheck.isValid) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: securityCheck.error,
          code: 'AUTH_ERROR'
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      regions: searchParams.get('regions') || undefined,
      paymentMethods: searchParams.get('paymentMethods') || undefined,
      granularity: searchParams.get('granularity') as 'hour' | 'day' | 'week' | 'month' || 'day',
      includeRevenue: searchParams.get('includeRevenue') !== 'false',
      includeProcessingTimes: searchParams.get('includeProcessingTimes') !== 'false'
    };

    const validatedParams = PaymentAnalyticsQuerySchema.parse(queryParams);

    // Get analytics data
    const analyticsData = await PaymentAnalyticsService.getPaymentAnalytics(validatedParams);

    return NextResponse.json({
      success: true,
      data: analyticsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Payment analytics API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Don't expose internal error details
      const isInternalError = error.message.includes('Database') || 
                             error.message.includes('Redis') ||
                             error.message.includes('Supabase');

      return NextResponse.json(
        {
          error: 'Internal Server Error',
          message: isInternalError ? 'An internal error occurred' : error.message,
          code: 'INTERNAL_ERROR',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Unknown Error',
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}