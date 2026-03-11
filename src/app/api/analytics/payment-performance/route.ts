```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Redis } from 'ioredis';

// Types
interface PaymentMetrics {
  successRate: number;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageProcessingTime: number;
  processingTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  totalVolume: number;
  averageTransactionValue: number;
}

interface FeeAnalysis {
  totalFees: number;
  averageFeePercentage: number;
  feesByMethod: Record<string, number>;
  feesByRegion: Record<string, number>;
  processingCosts: number;
  netRevenue: number;
}

interface FraudMetrics {
  fraudAttempts: number;
  fraudDetectionRate: number;
  falsePositiveRate: number;
  blockedTransactions: number;
  fraudLoss: number;
  preventedFraudLoss: number;
  riskScoreDistribution: Record<string, number>;
}

interface ChargebackAnalysis {
  totalChargebacks: number;
  chargebackRate: number;
  chargebacksByReason: Record<string, number>;
  chargebacksByMethod: Record<string, number>;
  averageChargebackAmount: number;
  chargebackTrends: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
}

interface RegionalPerformance {
  region: string;
  country: string;
  successRate: number;
  averageProcessingTime: number;
  totalVolume: number;
  fraudRate: number;
  chargebackRate: number;
  preferredMethods: string[];
}

interface PaymentPerformanceAnalytics {
  overview: PaymentMetrics;
  feeAnalysis: FeeAnalysis;
  fraudMetrics: FraudMetrics;
  chargebackAnalysis: ChargebackAnalysis;
  regionalPerformance: RegionalPerformance[];
  methodPerformance: Record<string, PaymentMetrics>;
  timeSeriesData: Array<{
    timestamp: string;
    successRate: number;
    volume: number;
    fraudRate: number;
  }>;
  benchmarks: {
    industryAverageSuccessRate: number;
    industryAverageProcessingTime: number;
    industryAverageFraudRate: number;
  };
}

// Validation schemas
const querySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d', '90d', '1y']).default('24h'),
  region: z.string().optional(),
  method: z.string().optional(),
  currency: z.string().optional(),
  includeDetails: z.enum(['true', 'false']).default('false'),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('hour')
});

// Services
class PaymentAnalyticsService {
  constructor(
    private supabase: any,
    private redis: Redis
  ) {}

  async getPaymentMetrics(filters: any): Promise<PaymentMetrics> {
    const cacheKey = `payment_metrics:${JSON.stringify(filters)}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data: payments, error } = await this.supabase
      .from('payments')
      .select(`
        id,
        amount,
        status,
        processing_time,
        created_at,
        payment_method,
        currency,
        region,
        country
      `)
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .eq(filters.region ? 'region' : 'id', filters.region || undefined)
      .eq(filters.method ? 'payment_method' : 'id', filters.method || undefined);

    if (error) throw error;

    const totalTransactions = payments.length;
    const successfulTransactions = payments.filter((p: any) => p.status === 'completed').length;
    const failedTransactions = totalTransactions - successfulTransactions;
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

    const processingTimes = payments
      .filter((p: any) => p.processing_time)
      .map((p: any) => p.processing_time)
      .sort((a: number, b: number) => a - b);

    const processingTimePercentiles = {
      p50: this.calculatePercentile(processingTimes, 50),
      p90: this.calculatePercentile(processingTimes, 90),
      p95: this.calculatePercentile(processingTimes, 95),
      p99: this.calculatePercentile(processingTimes, 99)
    };

    const totalVolume = payments
      .filter((p: any) => p.status === 'completed')
      .reduce((sum: number, p: any) => sum + p.amount, 0);

    const averageTransactionValue = successfulTransactions > 0 ? totalVolume / successfulTransactions : 0;
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    const metrics: PaymentMetrics = {
      successRate,
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      averageProcessingTime,
      processingTimePercentiles,
      totalVolume,
      averageTransactionValue
    };

    await this.redis.setex(cacheKey, 300, JSON.stringify(metrics));
    return metrics;
  }

  async getFeeAnalysis(filters: any): Promise<FeeAnalysis> {
    const { data: feeData, error } = await this.supabase
      .from('payment_fees')
      .select(`
        payment_id,
        fee_amount,
        fee_percentage,
        processing_cost,
        payment_method,
        region,
        payments!inner(amount, status, created_at)
      `)
      .gte('payments.created_at', filters.startDate)
      .lte('payments.created_at', filters.endDate)
      .eq('payments.status', 'completed');

    if (error) throw error;

    const totalFees = feeData.reduce((sum: number, fee: any) => sum + fee.fee_amount, 0);
    const totalVolume = feeData.reduce((sum: number, fee: any) => sum + fee.payments.amount, 0);
    const averageFeePercentage = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;

    const feesByMethod = feeData.reduce((acc: Record<string, number>, fee: any) => {
      acc[fee.payment_method] = (acc[fee.payment_method] || 0) + fee.fee_amount;
      return acc;
    }, {});

    const feesByRegion = feeData.reduce((acc: Record<string, number>, fee: any) => {
      acc[fee.region] = (acc[fee.region] || 0) + fee.fee_amount;
      return acc;
    }, {});

    const processingCosts = feeData.reduce((sum: number, fee: any) => sum + (fee.processing_cost || 0), 0);
    const netRevenue = totalVolume - totalFees - processingCosts;

    return {
      totalFees,
      averageFeePercentage,
      feesByMethod,
      feesByRegion,
      processingCosts,
      netRevenue
    };
  }

  async getFraudMetrics(filters: any): Promise<FraudMetrics> {
    const { data: fraudData, error } = await this.supabase
      .from('fraud_alerts')
      .select(`
        id,
        payment_id,
        risk_score,
        fraud_type,
        action_taken,
        amount,
        is_confirmed_fraud,
        created_at
      `)
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate);

    if (error) throw error;

    const fraudAttempts = fraudData.length;
    const confirmedFraud = fraudData.filter((f: any) => f.is_confirmed_fraud).length;
    const blockedTransactions = fraudData.filter((f: any) => f.action_taken === 'block').length;
    
    const fraudDetectionRate = fraudAttempts > 0 ? (confirmedFraud / fraudAttempts) * 100 : 0;
    const falsePositiveRate = fraudAttempts > 0 ? ((fraudAttempts - confirmedFraud) / fraudAttempts) * 100 : 0;

    const fraudLoss = fraudData
      .filter((f: any) => f.is_confirmed_fraud && f.action_taken !== 'block')
      .reduce((sum: number, f: any) => sum + f.amount, 0);

    const preventedFraudLoss = fraudData
      .filter((f: any) => f.is_confirmed_fraud && f.action_taken === 'block')
      .reduce((sum: number, f: any) => sum + f.amount, 0);

    const riskScoreDistribution = fraudData.reduce((acc: Record<string, number>, f: any) => {
      const bucket = this.getRiskScoreBucket(f.risk_score);
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});

    return {
      fraudAttempts,
      fraudDetectionRate,
      falsePositiveRate,
      blockedTransactions,
      fraudLoss,
      preventedFraudLoss,
      riskScoreDistribution
    };
  }

  async getChargebackAnalysis(filters: any): Promise<ChargebackAnalysis> {
    const { data: chargebackData, error } = await this.supabase
      .from('chargebacks')
      .select(`
        id,
        payment_id,
        amount,
        reason,
        reason_code,
        created_at,
        status,
        payments!inner(payment_method, created_at)
      `)
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate);

    if (error) throw error;

    const totalChargebacks = chargebackData.length;
    const totalChargebackAmount = chargebackData.reduce((sum: number, cb: any) => sum + cb.amount, 0);
    const averageChargebackAmount = totalChargebacks > 0 ? totalChargebackAmount / totalChargebacks : 0;

    // Get total transactions for chargeback rate calculation
    const { data: totalTransactions } = await this.supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .eq('status', 'completed');

    const chargebackRate = totalTransactions?.length > 0 
      ? (totalChargebacks / totalTransactions.length) * 100 
      : 0;

    const chargebacksByReason = chargebackData.reduce((acc: Record<string, number>, cb: any) => {
      acc[cb.reason] = (acc[cb.reason] || 0) + 1;
      return acc;
    }, {});

    const chargebacksByMethod = chargebackData.reduce((acc: Record<string, number>, cb: any) => {
      const method = cb.payments?.payment_method || 'unknown';
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    }, {});

    const chargebackTrends = await this.getChargebackTrends(filters);

    return {
      totalChargebacks,
      chargebackRate,
      chargebacksByReason,
      chargebacksByMethod,
      averageChargebackAmount,
      chargebackTrends
    };
  }

  async getRegionalPerformance(filters: any): Promise<RegionalPerformance[]> {
    const { data: regionalData, error } = await this.supabase
      .from('payments')
      .select(`
        region,
        country,
        status,
        processing_time,
        amount,
        payment_method,
        created_at
      `)
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate);

    if (error) throw error;

    const regionGroups = regionalData.reduce((acc: Record<string, any[]>, payment: any) => {
      const key = `${payment.region}_${payment.country}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(payment);
      return acc;
    }, {});

    const regionalPerformance: RegionalPerformance[] = [];

    for (const [key, payments] of Object.entries(regionGroups)) {
      const [region, country] = key.split('_');
      const successful = payments.filter((p: any) => p.status === 'completed');
      const successRate = (successful.length / payments.length) * 100;
      
      const processingTimes = payments
        .filter((p: any) => p.processing_time)
        .map((p: any) => p.processing_time);
      
      const averageProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        : 0;

      const totalVolume = successful.reduce((sum: number, p: any) => sum + p.amount, 0);

      // Get fraud and chargeback data for this region
      const fraudRate = await this.getRegionalFraudRate(region, country, filters);
      const chargebackRate = await this.getRegionalChargebackRate(region, country, filters);

      const methodCounts = payments.reduce((acc: Record<string, number>, p: any) => {
        acc[p.payment_method] = (acc[p.payment_method] || 0) + 1;
        return acc;
      }, {});

      const preferredMethods = Object.entries(methodCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([method]) => method);

      regionalPerformance.push({
        region,
        country,
        successRate,
        averageProcessingTime,
        totalVolume,
        fraudRate,
        chargebackRate,
        preferredMethods
      });
    }

    return regionalPerformance.sort((a, b) => b.totalVolume - a.totalVolume);
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private getRiskScoreBucket(score: number): string {
    if (score < 20) return 'low';
    if (score < 50) return 'medium';
    if (score < 80) return 'high';
    return 'critical';
  }

  private async getChargebackTrends(filters: any): Promise<Array<{date: string; count: number; amount: number}>> {
    const { data, error } = await this.supabase
      .from('chargebacks')
      .select('amount, created_at')
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .order('created_at');

    if (error) return [];

    // Group by day
    const trends = data.reduce((acc: Record<string, {count: number; amount: number}>, cb: any) => {
      const date = cb.created_at.split('T')[0];
      if (!acc[date]) acc[date] = { count: 0, amount: 0 };
      acc[date].count += 1;
      acc[date].amount += cb.amount;
      return acc;
    }, {});

    return Object.entries(trends).map(([date, data]) => ({
      date,
      count: data.count,
      amount: data.amount
    }));
  }

  private async getRegionalFraudRate(region: string, country: string, filters: any): Promise<number> {
    const { data: fraudData } = await this.supabase
      .from('fraud_alerts')
      .select('id', { count: 'exact' })
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .eq('region', region)
      .eq('country', country);

    const { data: totalPayments } = await this.supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .eq('region', region)
      .eq('country', country);

    if (!fraudData || !totalPayments || totalPayments.length === 0) return 0;
    return (fraudData.length / totalPayments.length) * 100;
  }

  private async getRegionalChargebackRate(region: string, country: string, filters: any): Promise<number> {
    const { data: chargebackData } = await this.supabase
      .from('chargebacks')
      .select('id', { count: 'exact' })
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .eq('region', region)
      .eq('country', country);

    const { data: totalPayments } = await this.supabase
      .from('payments')
      .select('id', { count: 'exact' })
      .gte('created_at', filters.startDate)
      .lte('created_at', filters.endDate)
      .eq('region', region)
      .eq('country', country)
      .eq('status', 'completed');

    if (!chargebackData || !totalPayments || totalPayments.length === 0) return 0;
    return (chargebackData.length / totalPayments.length) * 100;
  }
}

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      timeRange: searchParams.get('timeRange') || '24h',
      region: searchParams.get('region') || undefined,
      method: searchParams.get('method') || undefined,
      currency: searchParams.get('currency') || undefined,
      includeDetails: searchParams.get('includeDetails') || 'false',
      granularity: searchParams.get('granularity') || 'hour'
    });

    const supabase = createRouteHandlerClient({ cookies });
    const analyticsService = new PaymentAnalyticsService(supabase, redis);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (query.timeRange) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const filters = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      region: query.region,
      method: query.method,
      currency: query.currency
    };

    // Get all analytics data
    const [
      overview,
      feeAnalysis,
      fraudMetrics,
      chargebackAnalysis,
      regionalPerformance
    ] = await Promise.all([
      analyticsService.getPaymentMetrics(filters),
      analyticsService.getFeeAnalysis(filters),
      analyticsService.getFraudMetrics(filters),
      analyticsService.getChargebackAnalysis(filters),
      analyticsService.getRegionalPerformance(filters)
    ]);

    // Get method performance
    const uniqueMethods = ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer'];
    const methodPerformance: Record<string, PaymentMetrics> = {};
    
    for (const method of uniqueMethods) {
      const methodFilters = { ...filters, method };
      methodPerformance[method] = await analyticsService.getPaymentMetrics(methodFilters);
    }

    // Industry benchmarks (mock data - replace with real benchmarks)
    const benchmarks = {
      industryAverageSuccessRate: 95.5,
      industryAverageProcessingTime: 2.3,
      industryAverageFraudRate: 0.8
    };

    // Generate time series data
    const timeSeriesData = await this.generateTimeSeriesData(supabase, filters, query.granularity);

    const analytics: PaymentPerformanceAnalytics = {
      overview,
      feeAnalysis,
      fraudMetrics,
      chargebackAnalysis,
      regionalPerformance,
      methodPerformance,
      timeSeriesData,
      benchmarks
    };

    return NextResponse.json({
      success: true,
      data: analytics,
      metadata: {
        timeRange: query.timeRange,
        region: query.region,
        method: query.method,
        generatedAt: new Date().toISOString(),
        dataPoints: {
          transactions: overview.totalTransactions,
          regions: regionalPerformance.length,
          methods: Object.keys(methodPerformance).length
        }
      }
    });

  } catch (error) {
    console.error('Payment analytics error:',