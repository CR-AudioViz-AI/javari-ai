```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Redis } from 'ioredis';

// Environment variables validation
const requiredEnvVars = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  REDIS_URL: process.env.REDIS_URL!,
  ML_PREDICTION_API_KEY: process.env.ML_PREDICTION_API_KEY!,
  ML_PREDICTION_URL: process.env.ML_PREDICTION_URL!,
};

// Validation schemas
const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  format: z.enum(['chart', 'table', 'summary']).default('chart'),
  metrics: z.array(z.enum(['revenue', 'transactions', 'customers', 'avg_order'])).optional(),
  timezone: z.string().default('UTC'),
});

const segmentationQuerySchema = z.object({
  method: z.enum(['value', 'frequency', 'recency', 'rfm']).default('rfm'),
  segments: z.number().min(2).max(10).default(5),
});

const predictionQuerySchema = z.object({
  horizon: z.enum(['30d', '60d', '90d', '180d']).default('90d'),
  confidence: z.number().min(0.8).max(0.99).default(0.95),
  include_scenarios: z.boolean().default(false),
});

const exportSchema = z.object({
  format: z.enum(['csv', 'pdf', 'xlsx']),
  data_type: z.enum(['analytics', 'segments', 'predictions', 'all']),
  period: z.string().optional(),
});

// Types
interface RevenueDataPoint {
  date: string;
  revenue: number;
  transactions: number;
  customers: number;
  avg_order_value: number;
}

interface CustomerSegment {
  segment_id: string;
  name: string;
  customer_count: number;
  revenue_contribution: number;
  avg_lifetime_value: number;
  characteristics: Record<string, any>;
}

interface PredictionResult {
  horizon: string;
  predicted_revenue: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  scenarios?: {
    pessimistic: number;
    optimistic: number;
    realistic: number;
  };
}

class RevenueAnalyticsService {
  private supabase;
  private redis;

  constructor() {
    this.supabase = createClient(requiredEnvVars.SUPABASE_URL, requiredEnvVars.SUPABASE_ANON_KEY);
    this.redis = new Redis(requiredEnvVars.REDIS_URL);
  }

  async getRevenueAnalytics(
    creatorId: string,
    params: z.infer<typeof analyticsQuerySchema>
  ): Promise<{
    data: RevenueDataPoint[];
    summary: {
      total_revenue: number;
      total_transactions: number;
      unique_customers: number;
      avg_order_value: number;
      growth_rate: number;
    };
    trends: {
      revenue_trend: number;
      transaction_trend: number;
      customer_trend: number;
    };
  }> {
    const cacheKey = `analytics:${creatorId}:${JSON.stringify(params)}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const periodDays = this.parsePeriodToDays(params.period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Fetch revenue data
    const { data: transactions, error } = await this.supabase
      .from('revenue_transactions')
      .select(`
        *,
        customer_data (
          customer_id,
          customer_type
        )
      `)
      .eq('creator_id', creatorId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Aggregate data by day
    const dailyData = this.aggregateByDay(transactions || []);
    
    // Calculate trends
    const trends = this.calculateTrends(dailyData);
    
    // Generate summary
    const summary = this.generateSummary(transactions || [], dailyData);

    const result = {
      data: dailyData,
      summary,
      trends,
    };

    // Cache for 15 minutes
    await this.redis.setex(cacheKey, 900, JSON.stringify(result));
    
    return result;
  }

  async getCustomerSegmentation(
    creatorId: string,
    params: z.infer<typeof segmentationQuerySchema>
  ): Promise<CustomerSegment[]> {
    const cacheKey = `segments:${creatorId}:${JSON.stringify(params)}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch customer transaction data
    const { data: customerTransactions, error } = await this.supabase
      .from('revenue_transactions')
      .select(`
        amount,
        created_at,
        customer_data (
          customer_id,
          customer_type,
          first_purchase_date,
          total_spent,
          transaction_count
        )
      `)
      .eq('creator_id', creatorId)
      .not('customer_data', 'is', null);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const segments = await this.performSegmentation(
      customerTransactions || [],
      params.method,
      params.segments
    );

    // Cache for 1 hour
    await this.redis.setex(cacheKey, 3600, JSON.stringify(segments));
    
    return segments;
  }

  async getRevenuePredictions(
    creatorId: string,
    params: z.infer<typeof predictionQuerySchema>
  ): Promise<PredictionResult> {
    const cacheKey = `predictions:${creatorId}:${JSON.stringify(params)}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get historical data for ML model
    const historicalData = await this.getHistoricalRevenueData(creatorId);
    
    // Call ML prediction service
    const predictions = await this.callPredictionService(historicalData, params);

    // Cache for 4 hours
    await this.redis.setex(cacheKey, 14400, JSON.stringify(predictions));
    
    return predictions;
  }

  async exportAnalytics(
    creatorId: string,
    params: z.infer<typeof exportSchema>
  ): Promise<{ download_url: string; expires_at: string }> {
    let data: any;

    switch (params.data_type) {
      case 'analytics':
        data = await this.getRevenueAnalytics(creatorId, { 
          period: (params.period as any) || '30d',
          format: 'table'
        });
        break;
      case 'segments':
        data = await this.getCustomerSegmentation(creatorId, { method: 'rfm' });
        break;
      case 'predictions':
        data = await this.getRevenuePredictions(creatorId, { horizon: '90d' });
        break;
      case 'all':
        data = {
          analytics: await this.getRevenueAnalytics(creatorId, { period: '30d', format: 'table' }),
          segments: await this.getCustomerSegmentation(creatorId, { method: 'rfm' }),
          predictions: await this.getRevenuePredictions(creatorId, { horizon: '90d' })
        };
        break;
    }

    // Generate file and upload to storage
    const exportId = crypto.randomUUID();
    const fileName = `revenue-analytics-${creatorId}-${exportId}.${params.format}`;
    
    const fileContent = await this.formatExportData(data, params.format);
    
    // Upload to Supabase Storage
    const { data: uploadData, error } = await this.supabase.storage
      .from('exports')
      .upload(fileName, fileContent, {
        contentType: this.getContentType(params.format),
      });

    if (error) {
      throw new Error(`Export error: ${error.message}`);
    }

    // Generate signed URL (expires in 24 hours)
    const { data: signedUrl } = await this.supabase.storage
      .from('exports')
      .createSignedUrl(fileName, 86400);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      download_url: signedUrl?.signedUrl || '',
      expires_at: expiresAt.toISOString(),
    };
  }

  private parsePeriodToDays(period: string): number {
    const periodMap = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    return periodMap[period as keyof typeof periodMap] || 30;
  }

  private aggregateByDay(transactions: any[]): RevenueDataPoint[] {
    const dailyMap = new Map<string, RevenueDataPoint>();

    transactions.forEach(transaction => {
      const date = new Date(transaction.created_at).toISOString().split('T')[0];
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          revenue: 0,
          transactions: 0,
          customers: new Set(),
          avg_order_value: 0,
        });
      }

      const dayData = dailyMap.get(date)!;
      dayData.revenue += transaction.amount;
      dayData.transactions += 1;
      (dayData.customers as any).add(transaction.customer_data?.customer_id);
    });

    // Convert to array and calculate averages
    return Array.from(dailyMap.values()).map(day => ({
      ...day,
      customers: (day.customers as any).size,
      avg_order_value: day.transactions > 0 ? day.revenue / day.transactions : 0,
    }));
  }

  private calculateTrends(data: RevenueDataPoint[]): {
    revenue_trend: number;
    transaction_trend: number;
    customer_trend: number;
  } {
    if (data.length < 2) {
      return { revenue_trend: 0, transaction_trend: 0, customer_trend: 0 };
    }

    const mid = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, mid);
    const secondHalf = data.slice(mid);

    const firstHalfAvg = {
      revenue: firstHalf.reduce((sum, d) => sum + d.revenue, 0) / firstHalf.length,
      transactions: firstHalf.reduce((sum, d) => sum + d.transactions, 0) / firstHalf.length,
      customers: firstHalf.reduce((sum, d) => sum + d.customers, 0) / firstHalf.length,
    };

    const secondHalfAvg = {
      revenue: secondHalf.reduce((sum, d) => sum + d.revenue, 0) / secondHalf.length,
      transactions: secondHalf.reduce((sum, d) => sum + d.transactions, 0) / secondHalf.length,
      customers: secondHalf.reduce((sum, d) => sum + d.customers, 0) / secondHalf.length,
    };

    return {
      revenue_trend: ((secondHalfAvg.revenue - firstHalfAvg.revenue) / firstHalfAvg.revenue) * 100,
      transaction_trend: ((secondHalfAvg.transactions - firstHalfAvg.transactions) / firstHalfAvg.transactions) * 100,
      customer_trend: ((secondHalfAvg.customers - firstHalfAvg.customers) / firstHalfAvg.customers) * 100,
    };
  }

  private generateSummary(transactions: any[], dailyData: RevenueDataPoint[]) {
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalTransactions = transactions.length;
    const uniqueCustomers = new Set(transactions.map(t => t.customer_data?.customer_id)).size;
    const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Calculate growth rate vs previous period
    const currentPeriodRevenue = totalRevenue;
    const growthRate = 0; // Would need previous period data to calculate

    return {
      total_revenue: totalRevenue,
      total_transactions: totalTransactions,
      unique_customers: uniqueCustomers,
      avg_order_value: avgOrderValue,
      growth_rate: growthRate,
    };
  }

  private async performSegmentation(
    customerTransactions: any[],
    method: string,
    segmentCount: number
  ): Promise<CustomerSegment[]> {
    // Group by customer
    const customerMap = new Map();
    
    customerTransactions.forEach(transaction => {
      const customerId = transaction.customer_data.customer_id;
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer_id: customerId,
          total_spent: 0,
          transaction_count: 0,
          first_purchase: null,
          last_purchase: null,
          transactions: []
        });
      }

      const customer = customerMap.get(customerId);
      customer.total_spent += transaction.amount;
      customer.transaction_count += 1;
      customer.transactions.push(transaction);
      
      const transactionDate = new Date(transaction.created_at);
      if (!customer.first_purchase || transactionDate < customer.first_purchase) {
        customer.first_purchase = transactionDate;
      }
      if (!customer.last_purchase || transactionDate > customer.last_purchase) {
        customer.last_purchase = transactionDate;
      }
    });

    const customers = Array.from(customerMap.values());

    // Perform RFM segmentation
    return this.performRFMSegmentation(customers, segmentCount);
  }

  private performRFMSegmentation(customers: any[], segmentCount: number): CustomerSegment[] {
    const now = new Date();
    
    // Calculate RFM scores
    const customersWithRFM = customers.map(customer => {
      const recency = Math.floor((now.getTime() - customer.last_purchase.getTime()) / (1000 * 60 * 60 * 24));
      const frequency = customer.transaction_count;
      const monetary = customer.total_spent;

      return {
        ...customer,
        recency,
        frequency,
        monetary,
      };
    });

    // Create quintiles for each metric
    const recencyQuintiles = this.createQuintiles(customersWithRFM.map(c => c.recency), true); // Lower is better
    const frequencyQuintiles = this.createQuintiles(customersWithRFM.map(c => c.frequency), false);
    const monetaryQuintiles = this.createQuintiles(customersWithRFM.map(c => c.monetary), false);

    // Assign RFM scores
    const customersWithScores = customersWithRFM.map(customer => {
      const rScore = this.getQuintileScore(customer.recency, recencyQuintiles, true);
      const fScore = this.getQuintileScore(customer.frequency, frequencyQuintiles, false);
      const mScore = this.getQuintileScore(customer.monetary, monetaryQuintiles, false);

      return {
        ...customer,
        rfm_score: `${rScore}${fScore}${mScore}`,
        segment: this.assignRFMSegment(rScore, fScore, mScore),
      };
    });

    // Group into segments
    const segmentMap = new Map<string, any>();
    customersWithScores.forEach(customer => {
      if (!segmentMap.has(customer.segment)) {
        segmentMap.set(customer.segment, {
          customers: [],
          total_revenue: 0,
        });
      }
      
      const segment = segmentMap.get(customer.segment);
      segment.customers.push(customer);
      segment.total_revenue += customer.monetary;
    });

    // Format segments
    return Array.from(segmentMap.entries()).map(([segmentName, data], index) => ({
      segment_id: `segment_${index}`,
      name: segmentName,
      customer_count: data.customers.length,
      revenue_contribution: data.total_revenue,
      avg_lifetime_value: data.total_revenue / data.customers.length,
      characteristics: this.calculateSegmentCharacteristics(data.customers),
    }));
  }

  private createQuintiles(values: number[], reverseOrder: boolean): number[] {
    const sorted = [...values].sort((a, b) => reverseOrder ? b - a : a - b);
    const quintileSize = Math.ceil(sorted.length / 5);
    
    return [
      sorted[quintileSize - 1] || 0,
      sorted[quintileSize * 2 - 1] || 0,
      sorted[quintileSize * 3 - 1] || 0,
      sorted[quintileSize * 4 - 1] || 0,
    ];
  }

  private getQuintileScore(value: number, quintiles: number[], reverseOrder: boolean): number {
    for (let i = 0; i < quintiles.length; i++) {
      if (reverseOrder) {
        if (value >= quintiles[i]) return i + 1;
      } else {
        if (value <= quintiles[i]) return i + 1;
      }
    }
    return 5;
  }

  private assignRFMSegment(r: number, f: number, m: number): string {
    if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
    if (r >= 3 && f >= 4 && m >= 4) return 'Loyal Customers';
    if (r >= 4 && f >= 2 && m >= 3) return 'Potential Loyalists';
    if (r >= 4 && f <= 2 && m >= 3) return 'New Customers';
    if (r >= 3 && f >= 2 && m >= 2) return 'Promising';
    if (r >= 2 && f >= 3 && m >= 3) return 'Need Attention';
    if (r >= 2 && f >= 2 && m >= 2) return 'About to Sleep';
    if (r <= 2 && f >= 4 && m >= 4) return 'Cannot Lose Them';
    if (r <= 1 && f >= 2 && m >= 2) return 'At Risk';
    return 'Lost';
  }

  private calculateSegmentCharacteristics(customers: any[]): Record<string, any> {
    return {
      avg_recency: customers.reduce((sum, c) => sum + c.recency, 0) / customers.length,
      avg_frequency: customers.reduce((sum, c) => sum + c.frequency, 0) / customers.length,
      avg_monetary: customers.reduce((sum, c) => sum + c.monetary, 0) / customers.length,
    };
  }

  private async getHistoricalRevenueData(creatorId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('revenue_transactions')
      .select('amount, created_at')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data || [];
  }

  private async callPredictionService(
    historicalData: any[],
    params: z.infer<typeof predictionQuerySchema>
  ): Promise<PredictionResult> {
    try {
      const response = await fetch(requiredEnvVars.ML_PREDICTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${requiredEnvVars.ML_PREDICTION_API_KEY}`,
        },
        body: JSON.stringify({
          data: historicalData,
          horizon: params.horizon,
          confidence: params.confidence,
          include_scenarios: params.include_scenarios,
        }),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      // Fallback to simple trend-based prediction
      return this.fallbackPrediction(historicalData, params.horizon);
    }
  }

  private fallbackPrediction(data: any[], horizon: string): PredictionResult {
    const recentRevenue = data.slice(-30).reduce((sum, d) => sum + d.amount, 0);
    const avgDaily = recentRevenue / 30;
    const horizonDays = this.parsePeriodToDays(horizon);
    
    return {
      horizon,
      predicted_revenue: avgDaily * horizonDays,
      confidence_interval: {
        lower: avgDaily * horizonDays * 0.8,
        upper: avgDaily * horizonDays * 1.2,
      },
      trend: 'stable',
    };
  }

  private async formatExportData(data: any, format: string): Promise<Buffer> {
    switch (format) {
      case 'csv':
        return Buffer.from(this.convertToCSV(data));
      case 'xlsx':
        // Would use a library like xlsx
        return Buffer.from(JSON.stringify(data));
      case 'pdf':
        // Would use a library like puppeteer or jsPDF
        return Buffer.from(JSON.stringify(data));
      default:
        throw new Error('Unsupported export format');
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - would use a proper CSV library
    if (Array.isArray(data)) {
      const headers = Object.keys(data[0] || {});
      const rows = data.map(row => headers.map(h => row[h] || '').join(','));
      return [headers.join