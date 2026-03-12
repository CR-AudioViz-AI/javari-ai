```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { ratelimit } from '@/lib/redis';
import Stripe from 'stripe';
import { z } from 'zod';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Validation schemas
const RevenueQuerySchema = z.object({
  vendor_id: z.string().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z.array(z.enum(['revenue', 'commission', 'transactions', 'avg_order_value'])).optional(),
  real_time: z.boolean().default(false),
});

const ReportRequestSchema = z.object({
  type: z.enum(['revenue_summary', 'vendor_performance', 'commission_breakdown']),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
  email: z.string().email().optional(),
  filters: z.object({
    vendor_ids: z.array(z.string()).optional(),
    product_categories: z.array(z.string()).optional(),
    date_range: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }),
  }),
});

interface RevenueMetrics {
  total_revenue: number;
  commission_earned: number;
  vendor_payout: number;
  transaction_count: number;
  avg_order_value: number;
  top_vendors: VendorPerformance[];
  revenue_trends: TimeSeriesData[];
}

interface VendorPerformance {
  vendor_id: string;
  vendor_name: string;
  total_sales: number;
  commission_rate: number;
  commission_earned: number;
  transaction_count: number;
  avg_rating: number;
  growth_rate: number;
  rank: number;
}

interface TimeSeriesData {
  timestamp: string;
  revenue: number;
  commission: number;
  transactions: number;
}

interface CommissionRule {
  vendor_id: string;
  product_category?: string;
  base_rate: number;
  tier_rules?: {
    min_revenue: number;
    rate: number;
  }[];
  fixed_fee?: number;
}

class RevenueAnalyticsController {
  async getRevenueMetrics(params: z.infer<typeof RevenueQuerySchema>): Promise<RevenueMetrics> {
    const cacheKey = `revenue_metrics:${JSON.stringify(params)}`;
    
    // Check cache for non-real-time requests
    if (!params.real_time) {
      const cached = await this.getCachedMetrics(cacheKey);
      if (cached) return cached;
    }

    const { data: transactions, error } = await supabase
      .from('marketplace_transactions')
      .select(`
        *,
        vendor:vendors(*),
        product:products(category)
      `)
      .gte('created_at', params.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', params.end_date || new Date().toISOString())
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Database query failed: ${error.message}`);

    const metrics = await this.calculateMetrics(transactions || [], params);
    
    // Cache non-real-time results
    if (!params.real_time) {
      await this.cacheMetrics(cacheKey, metrics, 300); // 5 minutes
    }

    return metrics;
  }

  private async calculateMetrics(transactions: any[], params: z.infer<typeof RevenueQuerySchema>): Promise<RevenueMetrics> {
    const commissionService = new CommissionCalculationService();
    const vendorAnalyzer = new VendorPerformanceAnalyzer();

    let filteredTransactions = transactions;
    if (params.vendor_id) {
      filteredTransactions = transactions.filter(t => t.vendor_id === params.vendor_id);
    }

    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCommission = await commissionService.calculateTotalCommission(filteredTransactions);
    const vendorPayout = totalRevenue - totalCommission;
    const transactionCount = filteredTransactions.length;
    const avgOrderValue = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    const topVendors = await vendorAnalyzer.getTopVendorPerformance(transactions, 10);
    const revenueTrends = await this.generateTimeSeries(filteredTransactions, params.granularity);

    return {
      total_revenue: totalRevenue,
      commission_earned: totalCommission,
      vendor_payout: vendorPayout,
      transaction_count: transactionCount,
      avg_order_value: avgOrderValue,
      top_vendors: topVendors,
      revenue_trends: revenueTrends,
    };
  }

  private async generateTimeSeries(transactions: any[], granularity: string): Promise<TimeSeriesData[]> {
    const groupedData = new Map<string, { revenue: number; commission: number; transactions: number }>();
    const commissionService = new CommissionCalculationService();

    for (const transaction of transactions) {
      const timestamp = this.roundToGranularity(new Date(transaction.created_at), granularity);
      const key = timestamp.toISOString();

      if (!groupedData.has(key)) {
        groupedData.set(key, { revenue: 0, commission: 0, transactions: 0 });
      }

      const data = groupedData.get(key)!;
      data.revenue += transaction.amount;
      data.commission += await commissionService.calculateCommission(transaction);
      data.transactions += 1;
    }

    return Array.from(groupedData.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        revenue: data.revenue,
        commission: data.commission,
        transactions: data.transactions,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private roundToGranularity(date: Date, granularity: string): Date {
    const rounded = new Date(date);
    
    switch (granularity) {
      case 'hour':
        rounded.setMinutes(0, 0, 0);
        break;
      case 'day':
        rounded.setHours(0, 0, 0, 0);
        break;
      case 'week':
        rounded.setDate(rounded.getDate() - rounded.getDay());
        rounded.setHours(0, 0, 0, 0);
        break;
      case 'month':
        rounded.setDate(1);
        rounded.setHours(0, 0, 0, 0);
        break;
    }
    
    return rounded;
  }

  private async getCachedMetrics(key: string): Promise<RevenueMetrics | null> {
    try {
      // Implement Redis cache retrieval
      return null; // Placeholder
    } catch (error) {
      console.error('Cache retrieval failed:', error);
      return null;
    }
  }

  private async cacheMetrics(key: string, metrics: RevenueMetrics, ttl: number): Promise<void> {
    try {
      // Implement Redis cache storage
    } catch (error) {
      console.error('Cache storage failed:', error);
    }
  }
}

class CommissionCalculationService {
  private commissionRules: Map<string, CommissionRule> = new Map();

  async calculateCommission(transaction: any): Promise<number> {
    const rule = await this.getCommissionRule(transaction.vendor_id, transaction.product?.category);
    
    if (!rule) {
      throw new Error(`No commission rule found for vendor ${transaction.vendor_id}`);
    }

    let commission = 0;

    // Apply tier-based commission if available
    if (rule.tier_rules) {
      const vendorRevenue = await this.getVendorTotalRevenue(transaction.vendor_id);
      const applicableTier = rule.tier_rules
        .filter(tier => vendorRevenue >= tier.min_revenue)
        .sort((a, b) => b.min_revenue - a.min_revenue)[0];
      
      if (applicableTier) {
        commission = transaction.amount * (applicableTier.rate / 100);
      }
    } else {
      commission = transaction.amount * (rule.base_rate / 100);
    }

    // Add fixed fee if applicable
    if (rule.fixed_fee) {
      commission += rule.fixed_fee;
    }

    return Math.round(commission * 100) / 100; // Round to 2 decimal places
  }

  async calculateTotalCommission(transactions: any[]): Promise<number> {
    let total = 0;
    for (const transaction of transactions) {
      total += await this.calculateCommission(transaction);
    }
    return total;
  }

  private async getCommissionRule(vendorId: string, category?: string): Promise<CommissionRule | null> {
    const cacheKey = `commission_rule:${vendorId}:${category || 'default'}`;
    
    if (this.commissionRules.has(cacheKey)) {
      return this.commissionRules.get(cacheKey)!;
    }

    const { data: rule, error } = await supabase
      .from('commission_rules')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('product_category', category || null)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch commission rule: ${error.message}`);
    }

    if (!rule) {
      // Fallback to default rule
      const { data: defaultRule } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('vendor_id', vendorId)
        .is('product_category', null)
        .single();

      if (defaultRule) {
        this.commissionRules.set(cacheKey, defaultRule);
        return defaultRule;
      }
    }

    if (rule) {
      this.commissionRules.set(cacheKey, rule);
    }

    return rule;
  }

  private async getVendorTotalRevenue(vendorId: string): Promise<number> {
    const { data, error } = await supabase
      .from('marketplace_transactions')
      .select('amount')
      .eq('vendor_id', vendorId)
      .eq('status', 'completed');

    if (error) throw new Error(`Failed to fetch vendor revenue: ${error.message}`);

    return (data || []).reduce((sum, t) => sum + t.amount, 0);
  }
}

class VendorPerformanceAnalyzer {
  async getTopVendorPerformance(transactions: any[], limit: number = 10): Promise<VendorPerformance[]> {
    const vendorStats = new Map<string, {
      vendor_name: string;
      total_sales: number;
      transaction_count: number;
      ratings: number[];
    }>();

    // Aggregate vendor data
    for (const transaction of transactions) {
      const vendorId = transaction.vendor_id;
      
      if (!vendorStats.has(vendorId)) {
        vendorStats.set(vendorId, {
          vendor_name: transaction.vendor?.name || 'Unknown',
          total_sales: 0,
          transaction_count: 0,
          ratings: [],
        });
      }

      const stats = vendorStats.get(vendorId)!;
      stats.total_sales += transaction.amount;
      stats.transaction_count += 1;
      
      if (transaction.rating) {
        stats.ratings.push(transaction.rating);
      }
    }

    const commissionService = new CommissionCalculationService();
    const performances: VendorPerformance[] = [];

    for (const [vendorId, stats] of vendorStats.entries()) {
      const avgRating = stats.ratings.length > 0 
        ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length 
        : 0;

      const vendorTransactions = transactions.filter(t => t.vendor_id === vendorId);
      const commissionEarned = await commissionService.calculateTotalCommission(vendorTransactions);
      const commissionRate = stats.total_sales > 0 ? (commissionEarned / stats.total_sales) * 100 : 0;

      const growthRate = await this.calculateGrowthRate(vendorId);

      performances.push({
        vendor_id: vendorId,
        vendor_name: stats.vendor_name,
        total_sales: stats.total_sales,
        commission_rate: commissionRate,
        commission_earned: commissionEarned,
        transaction_count: stats.transaction_count,
        avg_rating: Math.round(avgRating * 100) / 100,
        growth_rate: growthRate,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by total sales and assign ranks
    performances.sort((a, b) => b.total_sales - a.total_sales);
    performances.forEach((perf, index) => {
      perf.rank = index + 1;
    });

    return performances.slice(0, limit);
  }

  private async calculateGrowthRate(vendorId: string): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const { data: recentSales } = await supabase
      .from('marketplace_transactions')
      .select('amount')
      .eq('vendor_id', vendorId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'completed');

    const { data: previousSales } = await supabase
      .from('marketplace_transactions')
      .select('amount')
      .eq('vendor_id', vendorId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'completed');

    const recentTotal = (recentSales || []).reduce((sum, t) => sum + t.amount, 0);
    const previousTotal = (previousSales || []).reduce((sum, t) => sum + t.amount, 0);

    if (previousTotal === 0) return recentTotal > 0 ? 100 : 0;

    return Math.round(((recentTotal - previousTotal) / previousTotal) * 100 * 100) / 100;
  }
}

class AutomatedReportGenerator {
  async generateReport(request: z.infer<typeof ReportRequestSchema>): Promise<any> {
    const analytics = new RevenueAnalyticsController();
    
    const queryParams = {
      start_date: request.filters.date_range.start,
      end_date: request.filters.date_range.end,
      granularity: 'day' as const,
    };

    switch (request.type) {
      case 'revenue_summary':
        return await this.generateRevenueSummary(analytics, queryParams, request.format);
      case 'vendor_performance':
        return await this.generateVendorPerformanceReport(analytics, queryParams, request.format);
      case 'commission_breakdown':
        return await this.generateCommissionBreakdown(analytics, queryParams, request.format);
      default:
        throw new Error('Invalid report type');
    }
  }

  private async generateRevenueSummary(analytics: RevenueAnalyticsController, params: any, format: string) {
    const metrics = await analytics.getRevenueMetrics(params);
    
    const summary = {
      period: {
        start: params.start_date,
        end: params.end_date,
      },
      totals: {
        revenue: metrics.total_revenue,
        commission: metrics.commission_earned,
        vendor_payout: metrics.vendor_payout,
        transactions: metrics.transaction_count,
        avg_order_value: metrics.avg_order_value,
      },
      trends: metrics.revenue_trends,
      top_vendors: metrics.top_vendors.slice(0, 5),
    };

    if (format === 'csv') {
      return this.convertToCSV(summary);
    } else if (format === 'pdf') {
      return this.generatePDF(summary);
    }

    return summary;
  }

  private async generateVendorPerformanceReport(analytics: RevenueAnalyticsController, params: any, format: string) {
    const metrics = await analytics.getRevenueMetrics(params);
    
    const report = {
      period: {
        start: params.start_date,
        end: params.end_date,
      },
      vendor_performance: metrics.top_vendors,
      summary: {
        total_vendors: metrics.top_vendors.length,
        avg_commission_rate: metrics.top_vendors.reduce((sum, v) => sum + v.commission_rate, 0) / metrics.top_vendors.length,
        top_performer: metrics.top_vendors[0],
      },
    };

    if (format === 'csv') {
      return this.convertToCSV(report);
    } else if (format === 'pdf') {
      return this.generatePDF(report);
    }

    return report;
  }

  private async generateCommissionBreakdown(analytics: RevenueAnalyticsController, params: any, format: string) {
    const metrics = await analytics.getRevenueMetrics(params);
    
    const breakdown = {
      period: {
        start: params.start_date,
        end: params.end_date,
      },
      commission_summary: {
        total_commission: metrics.commission_earned,
        avg_commission_rate: (metrics.commission_earned / metrics.total_revenue) * 100,
        commission_by_vendor: metrics.top_vendors.map(v => ({
          vendor_id: v.vendor_id,
          vendor_name: v.vendor_name,
          commission_earned: v.commission_earned,
          commission_rate: v.commission_rate,
        })),
      },
    };

    if (format === 'csv') {
      return this.convertToCSV(breakdown);
    } else if (format === 'pdf') {
      return this.generatePDF(breakdown);
    }

    return breakdown;
  }

  private convertToCSV(data: any): string {
    // Simplified CSV conversion - implement proper CSV generation
    return JSON.stringify(data);
  }

  private async generatePDF(data: any): Promise<Buffer> {
    // Implement PDF generation using a library like puppeteer or jsPDF
    return Buffer.from(JSON.stringify(data));
  }
}

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Rate limiting
    const identifier = request.ip || user.id;
    const { success } = await ratelimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    // Parse and validate query parameters
    const validatedParams = RevenueQuerySchema.parse({
      vendor_id: queryParams.vendor_id,
      start_date: queryParams.start_date,
      end_date: queryParams.end_date,
      granularity: queryParams.granularity,
      metrics: queryParams.metrics ? queryParams.metrics.split(',') : undefined,
      real_time: queryParams.real_time === 'true',
    });

    const controller = new RevenueAnalyticsController();
    const metrics = await controller.getRevenueMetrics(validatedParams);

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Revenue analytics API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const authorization = headersList.get('authorization');
    
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorization.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const validatedRequest = ReportRequestSchema.parse(body);

    const reportGenerator = new AutomatedReportGenerator();
    const report = await reportGenerator.generateReport(validatedRequest);

    // If email is provided, send the report
    if (validatedRequest.email && validatedRequest.format === 'pdf') {
      // Implement email sending logic
      console.log(`Sending report to ${validatedRequest.email}`);
    }

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Report generated successfully',
    });

  } catch (error) {
    console.error('Report generation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: