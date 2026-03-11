import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

// Types
interface AnalyticsQuery {
  period?: '7d' | '30d' | '90d' | '1y' | 'all';
  metric?: 'earnings' | 'engagement' | 'audience' | 'predictions' | 'trends';
  contentType?: 'audio' | 'video' | 'podcast' | 'all';
  startDate?: string;
  endDate?: string;
}

interface AnalyticsResponse {
  earnings: EarningsData;
  engagement: EngagementData;
  audience: AudienceData;
  predictions: PredictionData;
  trends: TrendData;
  metadata: {
    period: string;
    lastUpdated: string;
    totalDataPoints: number;
  };
}

interface EarningsData {
  total: number;
  growth: number;
  breakdown: {
    subscriptions: number;
    tips: number;
    commissions: number;
    advertisements: number;
  };
  dailyRevenue: Array<{ date: string; amount: number }>;
  topEarningContent: Array<{
    contentId: string;
    title: string;
    revenue: number;
    views: number;
  }>;
}

interface EngagementData {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  averageEngagementRate: number;
  engagementTrend: Array<{ date: string; rate: number }>;
  contentPerformance: Array<{
    contentId: string;
    title: string;
    views: number;
    engagementRate: number;
  }>;
}

interface AudienceData {
  totalFollowers: number;
  growthRate: number;
  demographics: {
    ageGroups: Record<string, number>;
    genders: Record<string, number>;
    locations: Record<string, number>;
  };
  behaviorPatterns: {
    peakHours: Array<{ hour: number; activity: number }>;
    deviceTypes: Record<string, number>;
    contentPreferences: Record<string, number>;
  };
}

interface PredictionData {
  nextMonthRevenue: {
    predicted: number;
    confidence: number;
    range: { min: number; max: number };
  };
  growthForecast: Array<{ month: string; revenue: number; confidence: number }>;
  recommendedActions: Array<{
    action: string;
    impact: number;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface TrendData {
  contentTrends: Array<{
    category: string;
    growth: number;
    popularity: number;
  }>;
  seasonalPatterns: Array<{
    period: string;
    avgPerformance: number;
  }>;
  competitorAnalysis: {
    marketPosition: number;
    benchmarkMetrics: Record<string, number>;
  };
}

// Services
class AnalyticsService {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private redis: Redis,
    private creatorId: string
  ) {}

  async getEarningsData(period: string, startDate?: string, endDate?: string): Promise<EarningsData> {
    const cacheKey = `earnings:${this.creatorId}:${period}:${startDate || 'none'}:${endDate || 'none'}`;
    
    // Try cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached as EarningsData;
    }

    const dateFilter = this.getDateFilter(period, startDate, endDate);
    
    // Get earnings data
    const { data: earnings, error: earningsError } = await this.supabase
      .from('earnings')
      .select(`
        *,
        content_items!inner(id, title, type, views)
      `)
      .eq('creator_id', this.creatorId)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end)
      .order('created_at', { ascending: false });

    if (earningsError) throw earningsError;

    // Calculate metrics
    const total = earnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    
    // Get previous period for growth calculation
    const prevPeriodEnd = new Date(dateFilter.start);
    const prevPeriodStart = new Date(prevPeriodEnd.getTime() - (dateFilter.end.getTime() - dateFilter.start.getTime()));
    
    const { data: prevEarnings } = await this.supabase
      .from('earnings')
      .select('amount')
      .eq('creator_id', this.creatorId)
      .gte('created_at', prevPeriodStart.toISOString())
      .lt('created_at', dateFilter.start);

    const prevTotal = prevEarnings?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

    // Breakdown by type
    const breakdown = {
      subscriptions: earnings?.filter(e => e.type === 'subscription').reduce((sum, e) => sum + e.amount, 0) || 0,
      tips: earnings?.filter(e => e.type === 'tip').reduce((sum, e) => sum + e.amount, 0) || 0,
      commissions: earnings?.filter(e => e.type === 'commission').reduce((sum, e) => sum + e.amount, 0) || 0,
      advertisements: earnings?.filter(e => e.type === 'advertisement').reduce((sum, e) => sum + e.amount, 0) || 0,
    };

    // Daily revenue
    const dailyRevenue = this.aggregateByDay(earnings || [], 'amount');

    // Top earning content
    const contentRevenue = new Map();
    earnings?.forEach(e => {
      if (e.content_items) {
        const content = e.content_items;
        const current = contentRevenue.get(content.id) || {
          contentId: content.id,
          title: content.title,
          revenue: 0,
          views: content.views || 0
        };
        current.revenue += e.amount;
        contentRevenue.set(content.id, current);
      }
    });

    const topEarningContent = Array.from(contentRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const result: EarningsData = {
      total,
      growth,
      breakdown,
      dailyRevenue,
      topEarningContent
    };

    // Cache for 15 minutes
    await this.redis.setex(cacheKey, 900, JSON.stringify(result));

    return result;
  }

  async getEngagementData(period: string, startDate?: string, endDate?: string): Promise<EngagementData> {
    const cacheKey = `engagement:${this.creatorId}:${period}:${startDate || 'none'}:${endDate || 'none'}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached as EngagementData;
    }

    const dateFilter = this.getDateFilter(period, startDate, endDate);

    const { data: engagements, error } = await this.supabase
      .from('engagement_metrics')
      .select(`
        *,
        content_items!inner(id, title, views)
      `)
      .eq('creator_id', this.creatorId)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalViews = engagements?.reduce((sum, e) => sum + (e.views || 0), 0) || 0;
    const totalLikes = engagements?.reduce((sum, e) => sum + (e.likes || 0), 0) || 0;
    const totalComments = engagements?.reduce((sum, e) => sum + (e.comments || 0), 0) || 0;
    const totalShares = engagements?.reduce((sum, e) => sum + (e.shares || 0), 0) || 0;

    const averageEngagementRate = totalViews > 0 
      ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 
      : 0;

    // Engagement trend
    const engagementTrend = this.calculateEngagementTrend(engagements || []);

    // Content performance
    const contentPerformance = engagements?.map(e => ({
      contentId: e.content_items?.id || '',
      title: e.content_items?.title || '',
      views: e.views || 0,
      engagementRate: e.views > 0 ? ((e.likes + e.comments + e.shares) / e.views) * 100 : 0
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 20) || [];

    const result: EngagementData = {
      totalViews,
      totalLikes,
      totalComments,
      totalShares,
      averageEngagementRate,
      engagementTrend,
      contentPerformance
    };

    await this.redis.setex(cacheKey, 900, JSON.stringify(result));
    return result;
  }

  async getAudienceData(period: string): Promise<AudienceData> {
    const cacheKey = `audience:${this.creatorId}:${period}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached as AudienceData;
    }

    const dateFilter = this.getDateFilter(period);

    const { data: audienceData, error } = await this.supabase
      .from('audience_data')
      .select('*')
      .eq('creator_id', this.creatorId)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end);

    if (error) throw error;

    // Get follower count
    const { data: profile } = await this.supabase
      .from('creator_profiles')
      .select('follower_count, previous_follower_count')
      .eq('id', this.creatorId)
      .single();

    const totalFollowers = profile?.follower_count || 0;
    const previousFollowers = profile?.previous_follower_count || totalFollowers;
    const growthRate = previousFollowers > 0 
      ? ((totalFollowers - previousFollowers) / previousFollowers) * 100 
      : 0;

    // Aggregate demographics
    const demographics = this.aggregateDemographics(audienceData || []);
    const behaviorPatterns = this.analyzeBehaviorPatterns(audienceData || []);

    const result: AudienceData = {
      totalFollowers,
      growthRate,
      demographics,
      behaviorPatterns
    };

    await this.redis.setex(cacheKey, 1800, JSON.stringify(result));
    return result;
  }

  private getDateFilter(period: string, startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    let start: Date;

    if (startDate) {
      start = new Date(startDate);
    } else {
      switch (period) {
        case '7d':
          start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date('2020-01-01');
      }
    }

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  private aggregateByDay(data: any[], field: string) {
    const daily = new Map();
    
    data.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      const current = daily.get(date) || 0;
      daily.set(date, current + (item[field] || 0));
    });

    return Array.from(daily.entries())
      .map(([date, amount]) => ({ date, amount: amount as number }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateEngagementTrend(engagements: any[]) {
    const daily = new Map();
    
    engagements.forEach(e => {
      const date = new Date(e.created_at).toISOString().split('T')[0];
      const current = daily.get(date) || { totalEngagement: 0, totalViews: 0 };
      
      current.totalEngagement += (e.likes || 0) + (e.comments || 0) + (e.shares || 0);
      current.totalViews += e.views || 0;
      
      daily.set(date, current);
    });

    return Array.from(daily.entries())
      .map(([date, data]) => ({
        date,
        rate: data.totalViews > 0 ? (data.totalEngagement / data.totalViews) * 100 : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private aggregateDemographics(audienceData: any[]) {
    const ageGroups: Record<string, number> = {};
    const genders: Record<string, number> = {};
    const locations: Record<string, number> = {};

    audienceData.forEach(data => {
      // Age groups
      if (data.age_group) {
        ageGroups[data.age_group] = (ageGroups[data.age_group] || 0) + 1;
      }
      
      // Genders
      if (data.gender) {
        genders[data.gender] = (genders[data.gender] || 0) + 1;
      }
      
      // Locations
      if (data.location) {
        locations[data.location] = (locations[data.location] || 0) + 1;
      }
    });

    return { ageGroups, genders, locations };
  }

  private analyzeBehaviorPatterns(audienceData: any[]) {
    const peakHours = Array.from({ length: 24 }, (_, i) => ({ hour: i, activity: 0 }));
    const deviceTypes: Record<string, number> = {};
    const contentPreferences: Record<string, number> = {};

    audienceData.forEach(data => {
      // Peak hours
      if (data.access_time) {
        const hour = new Date(data.access_time).getHours();
        peakHours[hour].activity += 1;
      }
      
      // Device types
      if (data.device_type) {
        deviceTypes[data.device_type] = (deviceTypes[data.device_type] || 0) + 1;
      }
      
      // Content preferences
      if (data.preferred_content_type) {
        contentPreferences[data.preferred_content_type] = (contentPreferences[data.preferred_content_type] || 0) + 1;
      }
    });

    return { peakHours, deviceTypes, contentPreferences };
  }
}

class PredictiveModelService {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private creatorId: string
  ) {}

  async generateRevenuePredictions(): Promise<PredictionData> {
    // Get historical revenue data
    const { data: historicalData, error } = await this.supabase
      .from('earnings')
      .select('amount, created_at')
      .eq('creator_id', this.creatorId)
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!historicalData || historicalData.length < 30) {
      // Not enough data for prediction
      return {
        nextMonthRevenue: {
          predicted: 0,
          confidence: 0,
          range: { min: 0, max: 0 }
        },
        growthForecast: [],
        recommendedActions: []
      };
    }

    // Simple linear regression for trend
    const monthlyData = this.aggregateMonthlyRevenue(historicalData);
    const prediction = this.calculateLinearTrend(monthlyData);
    
    // Generate forecast for next 6 months
    const growthForecast = this.generateGrowthForecast(monthlyData, 6);
    
    // Generate recommendations based on trends
    const recommendedActions = this.generateRecommendations(monthlyData, prediction);

    return {
      nextMonthRevenue: prediction,
      growthForecast,
      recommendedActions
    };
  }

  private aggregateMonthlyRevenue(data: any[]) {
    const monthly = new Map();
    
    data.forEach(item => {
      const monthKey = new Date(item.created_at).toISOString().substring(0, 7);
      const current = monthly.get(monthKey) || 0;
      monthly.set(monthKey, current + item.amount);
    });

    return Array.from(monthly.entries())
      .map(([month, revenue]) => ({ month, revenue: revenue as number }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private calculateLinearTrend(monthlyData: Array<{ month: string; revenue: number }>) {
    if (monthlyData.length < 2) {
      return {
        predicted: 0,
        confidence: 0,
        range: { min: 0, max: 0 }
      };
    }

    // Simple linear regression
    const n = monthlyData.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = monthlyData.map(d => d.revenue);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const predicted = slope * n + intercept;
    
    // Calculate confidence based on variance
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));
    
    // Confidence interval (simplified)
    const stdError = Math.sqrt(residualSumSquares / (n - 2));
    const range = {
      min: Math.max(0, predicted - 1.96 * stdError),
      max: predicted + 1.96 * stdError
    };

    return {
      predicted: Math.max(0, predicted),
      confidence,
      range
    };
  }

  private generateGrowthForecast(monthlyData: Array<{ month: string; revenue: number }>, months: number) {
    const forecast = [];
    const lastMonth = new Date(monthlyData[monthlyData.length - 1].month);
    
    // Calculate growth rate
    const recentGrowth = this.calculateGrowthRate(monthlyData.slice(-6));
    
    for (let i = 1; i <= months; i++) {
      const forecastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + i, 1);
      const monthString = forecastMonth.toISOString().substring(0, 7);
      
      const baseRevenue = monthlyData[monthlyData.length - 1].revenue;
      const revenue = baseRevenue * Math.pow(1 + recentGrowth / 100, i);
      const confidence = Math.max(10, 80 - (i * 10)); // Decreasing confidence over time
      
      forecast.push({
        month: monthString,
        revenue: Math.max(0, revenue),
        confidence
      });
    }
    
    return forecast;
  }

  private calculateGrowthRate(data: Array<{ month: string; revenue: number }>) {
    if (data.length < 2) return 0;
    
    const growthRates = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1].revenue;
      const curr = data[i].revenue;
      if (prev > 0) {
        growthRates.push(((curr - prev) / prev) * 100);
      }
    }
    
    return growthRates.length > 0 ? 
      growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;
  }

  private generateRecommendations(
    monthlyData: Array<{ month: string; revenue: number }>, 
    prediction: any
  ) {
    const recommendations = [];
    const recentGrowth = this.calculateGrowthRate(monthlyData.slice(-3));
    
    if (recentGrowth < -10) {
      recommendations.push({
        action: "Focus on audience retention and engagement strategies",
        impact: 25,
        priority: 'high' as const
      });
    }
    
    if (prediction.confidence < 50) {
      recommendations.push({
        action: