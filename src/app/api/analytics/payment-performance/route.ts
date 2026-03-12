```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Input validation schema
const paymentAnalyticsQuerySchema = z.object({
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }).optional(),
  region: z.array(z.string()).optional(),
  paymentMethod: z.array(z.string()).optional(),
  merchantId: z.string().uuid().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day')
});

// Response types
interface SuccessRateMetrics {
  overall: number;
  byMethod: Record<string, number>;
  byRegion: Record<string, number>;
  trend: Array<{ period: string; rate: number; volume: number }>;
  confidenceInterval: [number, number];
}

interface ProcessingTimeMetrics {
  average: number;
  median: number;
  p95: number;
  p99: number;
  byMethod: Record<string, number>;
  byRegion: Record<string, number>;
}

interface FeeAnalysis {
  totalFeesCollected: number;
  averageFeePercentage: number;
  revenueImpact: number;
  feesByMethod: Record<string, { total: number; average: number; percentage: number }>;
  profitabilityScore: number;
}

interface RegionalBreakdown {
  [region: string]: {
    volume: number;
    successRate: number;
    averageProcessingTime: number;
    totalFees: number;
    topPaymentMethods: Array<{ method: string; usage: number }>;
    marketShare: number;
  };
}

interface BusinessInsight {
  type: 'success_rate' | 'processing_time' | 'fee_optimization' | 'regional_opportunity' | 'method_performance';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  impact: 'low' | 'medium' | 'high';
  metrics: Record<string, number>;
}

interface PaymentAnalyticsResponse {
  successRates: SuccessRateMetrics;
  processingTimes: ProcessingTimeMetrics;
  feeAnalysis: FeeAnalysis;
  regionalBreakdown: RegionalBreakdown;
  insights: BusinessInsight[];
  metadata: {
    totalTransactions: number;
    totalVolume: number;
    analysisDateRange: { start: string; end: string };
    cacheExpiry: string;
  };
}

class PaymentAnalyticsService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async getPaymentAnalytics(params: z.infer<typeof paymentAnalyticsQuerySchema>): Promise<PaymentAnalyticsResponse> {
    const { dateRange, region, paymentMethod, merchantId, granularity } = params;
    
    // Set default date range if not provided
    const endDate = dateRange?.end || new Date().toISOString();
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Build base query with proper joins and filters
    let query = this.supabase
      .from('payment_transactions')
      .select(`
        *,
        payment_methods(*),
        merchant_profiles(*)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (region?.length) {
      query = query.in('region', region);
    }
    if (paymentMethod?.length) {
      query = query.in('payment_method_type', paymentMethod);
    }
    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!transactions) {
      throw new Error('No transaction data available');
    }

    // Process analytics
    const successRates = this.calculateSuccessRates(transactions, granularity);
    const processingTimes = this.calculateProcessingTimes(transactions);
    const feeAnalysis = this.calculateFeeAnalysis(transactions);
    const regionalBreakdown = this.calculateRegionalBreakdown(transactions);
    const insights = this.generateInsights(transactions, {
      successRates,
      processingTimes,
      feeAnalysis,
      regionalBreakdown
    });

    return {
      successRates,
      processingTimes,
      feeAnalysis,
      regionalBreakdown,
      insights,
      metadata: {
        totalTransactions: transactions.length,
        totalVolume: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        analysisDateRange: { start: startDate, end: endDate },
        cacheExpiry: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    };
  }

  private calculateSuccessRates(transactions: any[], granularity: string): SuccessRateMetrics {
    const successful = transactions.filter(t => t.status === 'completed').length;
    const overall = successful / transactions.length;

    // Calculate confidence interval (95%)
    const z = 1.96; // 95% confidence
    const n = transactions.length;
    const se = Math.sqrt((overall * (1 - overall)) / n);
    const margin = z * se;
    const confidenceInterval: [number, number] = [
      Math.max(0, overall - margin),
      Math.min(1, overall + margin)
    ];

    // Group by method
    const byMethod: Record<string, number> = {};
    const methodGroups = this.groupBy(transactions, 'payment_method_type');
    Object.entries(methodGroups).forEach(([method, txns]) => {
      const methodSuccessful = txns.filter(t => t.status === 'completed').length;
      byMethod[method] = methodSuccessful / txns.length;
    });

    // Group by region
    const byRegion: Record<string, number> = {};
    const regionGroups = this.groupBy(transactions, 'region');
    Object.entries(regionGroups).forEach(([region, txns]) => {
      const regionSuccessful = txns.filter(t => t.status === 'completed').length;
      byRegion[region] = regionSuccessful / txns.length;
    });

    // Calculate trend over time
    const trend = this.calculateTimeTrend(transactions, granularity, 'success_rate');

    return {
      overall,
      byMethod,
      byRegion,
      trend,
      confidenceInterval
    };
  }

  private calculateProcessingTimes(transactions: any[]): ProcessingTimeMetrics {
    const completedTransactions = transactions.filter(t => 
      t.status === 'completed' && t.processing_time_ms
    );

    if (completedTransactions.length === 0) {
      return {
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        byMethod: {},
        byRegion: {}
      };
    }

    const times = completedTransactions.map(t => t.processing_time_ms).sort((a, b) => a - b);
    
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const median = this.percentile(times, 50);
    const p95 = this.percentile(times, 95);
    const p99 = this.percentile(times, 99);

    // By method
    const byMethod: Record<string, number> = {};
    const methodGroups = this.groupBy(completedTransactions, 'payment_method_type');
    Object.entries(methodGroups).forEach(([method, txns]) => {
      const methodTimes = txns.map(t => t.processing_time_ms);
      byMethod[method] = methodTimes.reduce((sum, time) => sum + time, 0) / methodTimes.length;
    });

    // By region
    const byRegion: Record<string, number> = {};
    const regionGroups = this.groupBy(completedTransactions, 'region');
    Object.entries(regionGroups).forEach(([region, txns]) => {
      const regionTimes = txns.map(t => t.processing_time_ms);
      byRegion[region] = regionTimes.reduce((sum, time) => sum + time, 0) / regionTimes.length;
    });

    return { average, median, p95, p99, byMethod, byRegion };
  }

  private calculateFeeAnalysis(transactions: any[]): FeeAnalysis {
    const completedTransactions = transactions.filter(t => t.status === 'completed');
    
    const totalFeesCollected = completedTransactions.reduce((sum, t) => sum + (t.fee_amount || 0), 0);
    const totalVolume = completedTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const averageFeePercentage = totalVolume > 0 ? (totalFeesCollected / totalVolume) * 100 : 0;

    // Calculate revenue impact (assumption: 30% of fees is profit)
    const revenueImpact = totalFeesCollected * 0.3;

    const feesByMethod: Record<string, { total: number; average: number; percentage: number }> = {};
    const methodGroups = this.groupBy(completedTransactions, 'payment_method_type');
    
    Object.entries(methodGroups).forEach(([method, txns]) => {
      const methodFees = txns.reduce((sum, t) => sum + (t.fee_amount || 0), 0);
      const methodVolume = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
      const methodAverage = methodFees / txns.length;
      const methodPercentage = methodVolume > 0 ? (methodFees / methodVolume) * 100 : 0;
      
      feesByMethod[method] = {
        total: methodFees,
        average: methodAverage,
        percentage: methodPercentage
      };
    });

    // Profitability score (0-100, higher is better)
    const profitabilityScore = Math.min(100, (revenueImpact / totalVolume) * 10000);

    return {
      totalFeesCollected,
      averageFeePercentage,
      revenueImpact,
      feesByMethod,
      profitabilityScore
    };
  }

  private calculateRegionalBreakdown(transactions: any[]): RegionalBreakdown {
    const regionGroups = this.groupBy(transactions, 'region');
    const totalVolume = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const breakdown: RegionalBreakdown = {};

    Object.entries(regionGroups).forEach(([region, txns]) => {
      const successful = txns.filter(t => t.status === 'completed');
      const successRate = successful.length / txns.length;
      const volume = txns.reduce((sum, t) => sum + (t.amount || 0), 0);
      const marketShare = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;
      
      const processingTimes = successful
        .filter(t => t.processing_time_ms)
        .map(t => t.processing_time_ms);
      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      const totalFees = successful.reduce((sum, t) => sum + (t.fee_amount || 0), 0);

      // Top payment methods by usage
      const methodCounts = this.groupBy(txns, 'payment_method_type');
      const topPaymentMethods = Object.entries(methodCounts)
        .map(([method, methodTxns]) => ({
          method,
          usage: (methodTxns.length / txns.length) * 100
        }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 5);

      breakdown[region] = {
        volume,
        successRate,
        averageProcessingTime,
        totalFees,
        topPaymentMethods,
        marketShare
      };
    });

    return breakdown;
  }

  private generateInsights(
    transactions: any[], 
    analytics: Partial<PaymentAnalyticsResponse>
  ): BusinessInsight[] {
    const insights: BusinessInsight[] = [];

    // Success rate insights
    if (analytics.successRates) {
      if (analytics.successRates.overall < 0.95) {
        insights.push({
          type: 'success_rate',
          severity: analytics.successRates.overall < 0.90 ? 'critical' : 'warning',
          title: 'Low Success Rate Detected',
          description: `Overall success rate is ${(analytics.successRates.overall * 100).toFixed(1)}%, below optimal threshold of 95%`,
          recommendation: 'Review failed transactions, optimize payment flows, and consider adding retry mechanisms',
          impact: analytics.successRates.overall < 0.90 ? 'high' : 'medium',
          metrics: { current_rate: analytics.successRates.overall, target_rate: 0.95 }
        });
      }

      // Method-specific insights
      Object.entries(analytics.successRates.byMethod).forEach(([method, rate]) => {
        if (rate < 0.90) {
          insights.push({
            type: 'method_performance',
            severity: rate < 0.85 ? 'critical' : 'warning',
            title: `${method} Payment Method Underperforming`,
            description: `${method} has a success rate of ${(rate * 100).toFixed(1)}%`,
            recommendation: `Investigate ${method} integration issues or consider alternative providers`,
            impact: 'medium',
            metrics: { method_rate: rate, benchmark: 0.90 }
          });
        }
      });
    }

    // Processing time insights
    if (analytics.processingTimes) {
      if (analytics.processingTimes.average > 5000) { // 5 seconds
        insights.push({
          type: 'processing_time',
          severity: analytics.processingTimes.average > 10000 ? 'critical' : 'warning',
          title: 'Slow Payment Processing',
          description: `Average processing time is ${(analytics.processingTimes.average / 1000).toFixed(2)} seconds`,
          recommendation: 'Optimize payment processor configuration and consider load balancing',
          impact: 'medium',
          metrics: { 
            average_time: analytics.processingTimes.average,
            target_time: 3000 
          }
        });
      }
    }

    // Fee optimization insights
    if (analytics.feeAnalysis) {
      if (analytics.feeAnalysis.profitabilityScore < 50) {
        insights.push({
          type: 'fee_optimization',
          severity: 'warning',
          title: 'Fee Structure Optimization Opportunity',
          description: `Current profitability score is ${analytics.feeAnalysis.profitabilityScore.toFixed(1)}/100`,
          recommendation: 'Review fee structure and negotiate better rates with payment processors',
          impact: 'high',
          metrics: { 
            profitability_score: analytics.feeAnalysis.profitabilityScore,
            revenue_impact: analytics.feeAnalysis.revenueImpact 
          }
        });
      }
    }

    // Regional opportunities
    if (analytics.regionalBreakdown) {
      const regions = Object.entries(analytics.regionalBreakdown)
        .sort(([,a], [,b]) => b.volume - a.volume);

      // Find underperforming regions
      regions.forEach(([region, data]) => {
        if (data.successRate < 0.90 && data.marketShare > 10) {
          insights.push({
            type: 'regional_opportunity',
            severity: 'warning',
            title: `${region} Market Underperformance`,
            description: `${region} has ${data.marketShare.toFixed(1)}% market share but ${(data.successRate * 100).toFixed(1)}% success rate`,
            recommendation: `Focus on improving payment infrastructure in ${region} to capture growth opportunity`,
            impact: 'high',
            metrics: { 
              success_rate: data.successRate,
              market_share: data.marketShare 
            }
          });
        }
      });
    }

    return insights.slice(0, 10); // Limit to top 10 insights
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private calculateTimeTrend(transactions: any[], granularity: string, metric: string): Array<{ period: string; rate: number; volume: number }> {
    const periods = this.groupByTimePeriod(transactions, granularity);
    
    return Object.entries(periods).map(([period, txns]) => {
      const volume = txns.length;
      let rate = 0;
      
      if (metric === 'success_rate') {
        const successful = txns.filter(t => t.status === 'completed').length;
        rate = volume > 0 ? successful / volume : 0;
      }
      
      return { period, rate, volume };
    }).sort((a, b) => a.period.localeCompare(b.period));
  }

  private groupByTimePeriod(transactions: any[], granularity: string): Record<string, any[]> {
    return transactions.reduce((groups, txn) => {
      const date = new Date(txn.created_at);
      let periodKey: string;
      
      switch (granularity) {
        case 'hour':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          break;
        case 'day':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate()) / 7)).padStart(2, '0')}`;
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
      
      if (!groups[periodKey]) {
        groups[periodKey] = [];
      }
      groups[periodKey].push(txn);
      return groups;
    }, {} as Record<string, any[]>);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const queryParams = {
      dateRange: searchParams.get('startDate') && searchParams.get('endDate') 
        ? { 
            start: searchParams.get('startDate')!,
            end: searchParams.get('endDate')!
          }
        : undefined,
      region: searchParams.getAll('region'),
      paymentMethod: searchParams.getAll('paymentMethod'),
      merchantId: searchParams.get('merchantId') || undefined,
      granularity: (searchParams.get('granularity') as 'hour' | 'day' | 'week' | 'month') || 'day'
    };

    // Validate input
    const validatedParams = paymentAnalyticsQuerySchema.parse(queryParams);

    // Check cache first
    const cacheKey = `payment_analytics_${JSON.stringify(validatedParams)}`;
    // Note: In production, implement Redis or similar caching

    const service = new PaymentAnalyticsService();
    const analytics = await service.getPaymentAnalytics(validatedParams);

    return NextResponse.json(analytics, {
      headers: {
        'Cache-Control': 'private, max-age=900', // 15 minutes
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Payment analytics error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to generate payment analytics' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```