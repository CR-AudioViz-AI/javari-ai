```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import Stripe from 'stripe';
import Redis from 'ioredis';

// Types
interface RevenueMetrics {
  totalRevenue: number;
  netRevenue: number;
  grossRevenue: number;
  commissionRevenue: number;
  subscriptionRevenue: number;
  transactionRevenue: number;
  refundAmount: number;
  chargebackAmount: number;
  growth: {
    revenueGrowth: number;
    periodOverPeriod: number;
    trendDirection: 'up' | 'down' | 'stable';
  };
}

interface CommissionBreakdown {
  totalCommissions: number;
  platformFee: number;
  vendorEarnings: number;
  commissionRate: number;
  transactionCount: number;
  averageOrderValue: number;
}

interface RevenueStream {
  streamId: string;
  name: string;
  revenue: number;
  percentage: number;
  transactions: number;
  averageValue: number;
}

interface ForecastData {
  period: string;
  predictedRevenue: number;
  confidence: number;
  factors: string[];
  recommendations: string[];
}

// Validation schemas
const analyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional().default('month'),
  streams: z.string().optional(),
  metrics: z.string().optional(),
  forecast: z.boolean().optional().default(false),
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional().default('daily')
});

const revenueUpdateSchema = z.object({
  transactionId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  type: z.enum(['subscription', 'transaction', 'commission', 'refund', 'chargeback']),
  vendorId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Initialize services
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

const redis = new Redis(process.env.REDIS_URL!);

class RevenueAnalyticsService {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async getRevenueMetrics(
    startDate: string,
    endDate: string,
    streams?: string[]
  ): Promise<RevenueMetrics> {
    const cacheKey = `revenue:metrics:${startDate}:${endDate}:${streams?.join(',')}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    let query = this.supabase
      .from('marketplace_transactions')
      .select(`
        amount,
        currency,
        type,
        status,
        commission_rate,
        created_at,
        refund_amount,
        chargeback_amount
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'completed');

    if (streams && streams.length > 0) {
      query = query.in('type', streams);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch revenue data: ${error.message}`);
    }

    // Calculate metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const commissionRevenue = transactions.reduce((sum, t) => 
      sum + (t.amount * (t.commission_rate || 0)), 0
    );
    const refundAmount = transactions.reduce((sum, t) => sum + (t.refund_amount || 0), 0);
    const chargebackAmount = transactions.reduce((sum, t) => sum + (t.chargeback_amount || 0), 0);
    const netRevenue = totalRevenue - refundAmount - chargebackAmount;

    const subscriptionRevenue = transactions
      .filter(t => t.type === 'subscription')
      .reduce((sum, t) => sum + t.amount, 0);

    const transactionRevenue = transactions
      .filter(t => t.type === 'transaction')
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate growth
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
    const previousPeriodEnd = new Date(endDate);
    previousPeriodEnd.setMonth(previousPeriodEnd.getMonth() - 1);

    const previousMetrics = await this.getPreviousPeriodRevenue(
      previousPeriodStart.toISOString(),
      previousPeriodEnd.toISOString()
    );

    const revenueGrowth = previousMetrics.totalRevenue > 0 
      ? ((totalRevenue - previousMetrics.totalRevenue) / previousMetrics.totalRevenue) * 100
      : 0;

    const metrics: RevenueMetrics = {
      totalRevenue,
      netRevenue,
      grossRevenue: totalRevenue + refundAmount + chargebackAmount,
      commissionRevenue,
      subscriptionRevenue,
      transactionRevenue,
      refundAmount,
      chargebackAmount,
      growth: {
        revenueGrowth,
        periodOverPeriod: revenueGrowth,
        trendDirection: revenueGrowth > 5 ? 'up' : revenueGrowth < -5 ? 'down' : 'stable'
      }
    };

    await redis.setex(cacheKey, 300, JSON.stringify(metrics)); // Cache for 5 minutes
    return metrics;
  }

  private async getPreviousPeriodRevenue(startDate: string, endDate: string) {
    const { data, error } = await this.supabase
      .from('marketplace_transactions')
      .select('amount')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'completed');

    if (error) {
      return { totalRevenue: 0 };
    }

    return {
      totalRevenue: data.reduce((sum, t) => sum + t.amount, 0)
    };
  }

  async getRevenueStreams(startDate: string, endDate: string): Promise<RevenueStream[]> {
    const { data, error } = await this.supabase
      .from('marketplace_transactions')
      .select(`
        type,
        amount,
        vendor_id
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'completed');

    if (error) {
      throw new Error(`Failed to fetch revenue streams: ${error.message}`);
    }

    const totalRevenue = data.reduce((sum, t) => sum + t.amount, 0);
    const streamMap = new Map<string, { revenue: number; count: number }>();

    data.forEach(transaction => {
      const stream = transaction.type;
      if (!streamMap.has(stream)) {
        streamMap.set(stream, { revenue: 0, count: 0 });
      }
      const current = streamMap.get(stream)!;
      current.revenue += transaction.amount;
      current.count += 1;
    });

    return Array.from(streamMap.entries()).map(([streamId, data]) => ({
      streamId,
      name: this.getStreamDisplayName(streamId),
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      transactions: data.count,
      averageValue: data.count > 0 ? data.revenue / data.count : 0
    }));
  }

  private getStreamDisplayName(streamId: string): string {
    const names: Record<string, string> = {
      'subscription': 'Subscription Revenue',
      'transaction': 'Transaction Fees',
      'commission': 'Commission Revenue',
      'marketplace_fee': 'Marketplace Fees'
    };
    return names[streamId] || streamId;
  }
}

class CommissionCalculator {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async calculateCommissions(
    startDate: string,
    endDate: string
  ): Promise<CommissionBreakdown> {
    const { data: transactions, error } = await this.supabase
      .from('marketplace_transactions')
      .select(`
        amount,
        commission_rate,
        vendor_id,
        platform_fee
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'completed')
      .not('vendor_id', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch commission data: ${error.message}`);
    }

    const totalCommissions = transactions.reduce((sum, t) => 
      sum + (t.amount * (t.commission_rate || 0)), 0
    );

    const platformFee = transactions.reduce((sum, t) => 
      sum + (t.platform_fee || 0), 0
    );

    const grossRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const vendorEarnings = grossRevenue - totalCommissions - platformFee;
    
    const averageCommissionRate = transactions.length > 0
      ? transactions.reduce((sum, t) => sum + (t.commission_rate || 0), 0) / transactions.length
      : 0;

    return {
      totalCommissions,
      platformFee,
      vendorEarnings,
      commissionRate: averageCommissionRate,
      transactionCount: transactions.length,
      averageOrderValue: transactions.length > 0 ? grossRevenue / transactions.length : 0
    };
  }
}

class ForecastingEngine {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async generateForecast(
    period: string,
    months: number = 3
  ): Promise<ForecastData[]> {
    // Get historical data
    const { data: historicalData, error } = await this.supabase
      .from('marketplace_transactions')
      .select(`
        amount,
        created_at,
        type
      `)
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch historical data: ${error.message}`);
    }

    // Simple linear regression for forecasting
    const monthlyRevenue = this.aggregateByMonth(historicalData);
    const trend = this.calculateTrend(monthlyRevenue);
    
    const forecasts: ForecastData[] = [];
    const lastRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      
      const predictedRevenue = Math.max(0, lastRevenue + (trend.slope * i));
      const confidence = Math.max(0.3, Math.min(0.95, trend.rSquared));

      forecasts.push({
        period: futureDate.toISOString().slice(0, 7),
        predictedRevenue,
        confidence,
        factors: this.getGrowthFactors(trend),
        recommendations: this.generateRecommendations(trend, predictedRevenue)
      });
    }

    return forecasts;
  }

  private aggregateByMonth(data: any[]) {
    const monthlyMap = new Map<string, number>();
    
    data.forEach(transaction => {
      const month = transaction.created_at.slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + transaction.amount);
    });

    return Array.from(monthlyMap.entries()).map(([month, revenue]) => ({
      month,
      revenue
    }));
  }

  private calculateTrend(monthlyData: { month: string; revenue: number }[]) {
    if (monthlyData.length < 2) {
      return { slope: 0, rSquared: 0 };
    }

    const n = monthlyData.length;
    const sumX = n * (n - 1) / 2;
    const sumY = monthlyData.reduce((sum, d) => sum + d.revenue, 0);
    const sumXY = monthlyData.reduce((sum, d, i) => sum + (i * d.revenue), 0);
    const sumXX = n * (n - 1) * (2 * n - 1) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate R-squared
    const meanY = sumY / n;
    const totalSS = monthlyData.reduce((sum, d) => sum + Math.pow(d.revenue - meanY, 2), 0);
    const residualSS = monthlyData.reduce((sum, d, i) => {
      const predicted = slope * i + (sumY - slope * sumX) / n;
      return sum + Math.pow(d.revenue - predicted, 2);
    }, 0);
    
    const rSquared = totalSS > 0 ? 1 - (residualSS / totalSS) : 0;

    return { slope, rSquared };
  }

  private getGrowthFactors(trend: { slope: number; rSquared: number }): string[] {
    const factors = [];
    
    if (trend.slope > 0) {
      factors.push('Positive revenue trend');
    } else if (trend.slope < 0) {
      factors.push('Declining revenue trend');
    }
    
    if (trend.rSquared > 0.7) {
      factors.push('High prediction confidence');
    } else {
      factors.push('Variable revenue pattern');
    }

    return factors;
  }

  private generateRecommendations(trend: { slope: number; rSquared: number }, predictedRevenue: number): string[] {
    const recommendations = [];
    
    if (trend.slope < 0) {
      recommendations.push('Focus on customer retention strategies');
      recommendations.push('Analyze declining revenue streams');
    }
    
    if (trend.rSquared < 0.5) {
      recommendations.push('Investigate revenue volatility causes');
    }
    
    if (predictedRevenue > 0) {
      recommendations.push('Prepare for scaling infrastructure');
    }

    return recommendations;
  }
}

// GET endpoint
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const query = analyticsQuerySchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      period: searchParams.get('period'),
      streams: searchParams.get('streams'),
      metrics: searchParams.get('metrics'),
      forecast: searchParams.get('forecast') === 'true',
      granularity: searchParams.get('granularity')
    });

    // Set default date range if not provided
    const endDate = query.endDate || new Date().toISOString();
    const startDate = query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Verify user authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Initialize services
    const revenueService = new RevenueAnalyticsService(supabase);
    const commissionCalculator = new CommissionCalculator(supabase);
    const forecastingEngine = new ForecastingEngine(supabase);

    // Parse requested streams
    const streams = query.streams ? query.streams.split(',') : undefined;
    
    // Fetch analytics data
    const [metrics, commissions, revenueStreams, forecasts] = await Promise.all([
      revenueService.getRevenueMetrics(startDate, endDate, streams),
      commissionCalculator.calculateCommissions(startDate, endDate),
      revenueService.getRevenueStreams(startDate, endDate),
      query.forecast ? forecastingEngine.generateForecast(query.period, 3) : Promise.resolve([])
    ]);

    const response = {
      success: true,
      data: {
        period: {
          startDate,
          endDate,
          granularity: query.granularity
        },
        metrics,
        commissions,
        revenueStreams,
        forecasts: query.forecast ? forecasts : undefined,
        insights: {
          topRevenueStream: revenueStreams[0],
          growthTrend: metrics.growth.trendDirection,
          commissionEfficiency: commissions.commissionRate,
          recommendations: query.forecast ? forecasts[0]?.recommendations : []
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Revenue analytics error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch revenue analytics' },
      { status: 500 }
    );
  }
}

// POST endpoint for updating revenue data
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    
    // Validate request body
    const revenueData = revenueUpdateSchema.parse(body);

    // Verify user authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // Insert or update transaction record
    const { data: transaction, error: insertError } = await supabase
      .from('marketplace_transactions')
      .upsert({
        transaction_id: revenueData.transactionId,
        amount: revenueData.amount,
        currency: revenueData.currency,
        type: revenueData.type,
        vendor_id: revenueData.vendorId,
        metadata: revenueData.metadata,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to update transaction: ${insertError.message}`);
    }

    // Clear related cache entries
    const cachePattern = `revenue:metrics:*`;
    const keys = await redis.keys(cachePattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionId: transaction.transaction_id,
        status: 'updated',
        amount: transaction.amount,
        type: transaction.type
      }
    });

  } catch (error) {
    console.error('Revenue update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update revenue data' },
      { status: 500 }
    );
  }
}
```