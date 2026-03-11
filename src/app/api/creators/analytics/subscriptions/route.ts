```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Redis } from 'ioredis';
import Stripe from 'stripe';

// Initialize services
const redis = new Redis(process.env.REDIS_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

// Validation schemas
const analyticsQuerySchema = z.object({
  creatorId: z.string().uuid(),
  timeRange: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  segment: z.enum(['all', 'new', 'active', 'at_risk', 'churned']).default('all'),
  metrics: z.array(z.enum(['revenue', 'churn', 'ltv', 'growth', 'segments'])).default(['revenue', 'churn', 'ltv']),
});

const refreshRequestSchema = z.object({
  creatorId: z.string().uuid(),
  forceRefresh: z.boolean().default(false),
});

interface SubscriptionMetrics {
  totalSubscribers: number;
  activeSubscribers: number;
  newSubscribers: number;
  churnedSubscribers: number;
  churnRate: number;
  averageRevenue: number;
  totalRevenue: number;
  lifetimeValue: number;
  growthRate: number;
  retentionRate: number;
}

interface ChurnPrediction {
  subscriberId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  predictedChurnDate: string;
  factors: string[];
  confidence: number;
}

interface SegmentAnalysis {
  segmentId: string;
  segmentName: string;
  subscriberCount: number;
  averageRevenue: number;
  churnRate: number;
  lifetimeValue: number;
  characteristics: Record<string, any>;
}

class SubscriptionAnalyticsService {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async getSubscriptionMetrics(creatorId: string, timeRange: string): Promise<SubscriptionMetrics> {
    const cacheKey = `analytics:subscriptions:${creatorId}:${timeRange}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const daysAgo = this.getDaysFromTimeRange(timeRange);
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    const { data: subscriptions, error } = await this.supabase
      .from('creator_subscriptions')
      .select(`
        *,
        subscription_events(*)
      `)
      .eq('creator_id', creatorId)
      .gte('created_at', startDate);

    if (error) throw error;

    const metrics = this.calculateMetrics(subscriptions, timeRange);
    
    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(metrics));
    
    return metrics;
  }

  private calculateMetrics(subscriptions: any[], timeRange: string): SubscriptionMetrics {
    const now = new Date();
    const daysAgo = this.getDaysFromTimeRange(timeRange);
    const periodStart = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const activeSubscriptions = subscriptions.filter(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );

    const newSubscriptions = subscriptions.filter(sub =>
      new Date(sub.created_at) >= periodStart
    );

    const churnedSubscriptions = subscriptions.filter(sub =>
      sub.status === 'canceled' && 
      new Date(sub.canceled_at) >= periodStart
    );

    const totalRevenue = subscriptions.reduce((sum, sub) => {
      return sum + (sub.subscription_events
        ?.filter((event: any) => 
          event.event_type === 'payment_succeeded' &&
          new Date(event.created_at) >= periodStart
        )
        ?.reduce((eventSum: number, event: any) => eventSum + (event.amount || 0), 0) || 0);
    }, 0);

    const averageRevenue = activeSubscriptions.length > 0 
      ? totalRevenue / activeSubscriptions.length 
      : 0;

    const churnRate = subscriptions.length > 0 
      ? (churnedSubscriptions.length / subscriptions.length) * 100 
      : 0;

    const lifetimeValue = this.calculateLifetimeValue(subscriptions);
    const growthRate = this.calculateGrowthRate(subscriptions, timeRange);
    const retentionRate = 100 - churnRate;

    return {
      totalSubscribers: subscriptions.length,
      activeSubscribers: activeSubscriptions.length,
      newSubscribers: newSubscriptions.length,
      churnedSubscribers: churnedSubscriptions.length,
      churnRate,
      averageRevenue,
      totalRevenue,
      lifetimeValue,
      growthRate,
      retentionRate,
    };
  }

  private calculateLifetimeValue(subscriptions: any[]): number {
    const activeSubscriptions = subscriptions.filter(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );

    if (activeSubscriptions.length === 0) return 0;

    const averageMonthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
      return sum + (sub.amount || 0);
    }, 0) / activeSubscriptions.length;

    const averageLifetimeMonths = this.calculateAverageLifetime(subscriptions);
    
    return averageMonthlyRevenue * averageLifetimeMonths;
  }

  private calculateAverageLifetime(subscriptions: any[]): number {
    const completedSubscriptions = subscriptions.filter(sub => 
      sub.status === 'canceled' && sub.canceled_at
    );

    if (completedSubscriptions.length === 0) return 12; // Default to 12 months

    const totalLifetimeMonths = completedSubscriptions.reduce((sum, sub) => {
      const start = new Date(sub.created_at);
      const end = new Date(sub.canceled_at);
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return sum + Math.max(1, months);
    }, 0);

    return totalLifetimeMonths / completedSubscriptions.length;
  }

  private calculateGrowthRate(subscriptions: any[], timeRange: string): number {
    const daysAgo = this.getDaysFromTimeRange(timeRange);
    const periodStart = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(Date.now() - (daysAgo * 2) * 24 * 60 * 60 * 1000);

    const currentPeriodSubs = subscriptions.filter(sub =>
      new Date(sub.created_at) >= periodStart
    ).length;

    const previousPeriodSubs = subscriptions.filter(sub =>
      new Date(sub.created_at) >= previousPeriodStart &&
      new Date(sub.created_at) < periodStart
    ).length;

    if (previousPeriodSubs === 0) return currentPeriodSubs > 0 ? 100 : 0;

    return ((currentPeriodSubs - previousPeriodSubs) / previousPeriodSubs) * 100;
  }

  private getDaysFromTimeRange(timeRange: string): number {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case '1y': return 365;
      default: return 30;
    }
  }
}

class ChurnPredictionEngine {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async predictChurn(creatorId: string): Promise<ChurnPrediction[]> {
    const cacheKey = `churn:predictions:${creatorId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data: behaviorData, error } = await this.supabase
      .from('user_behavior_metrics')
      .select(`
        *,
        creator_subscriptions(*)
      `)
      .eq('creator_id', creatorId)
      .eq('creator_subscriptions.status', 'active');

    if (error) throw error;

    const predictions = await this.generateChurnPredictions(behaviorData);
    
    // Cache for 4 hours
    await redis.setex(cacheKey, 14400, JSON.stringify(predictions));
    
    return predictions;
  }

  private async generateChurnPredictions(behaviorData: any[]): Promise<ChurnPrediction[]> {
    const predictions: ChurnPrediction[] = [];

    for (const subscriber of behaviorData) {
      const riskScore = this.calculateRiskScore(subscriber);
      const riskLevel = this.getRiskLevel(riskScore);
      const factors = this.identifyRiskFactors(subscriber);
      
      predictions.push({
        subscriberId: subscriber.user_id,
        riskScore,
        riskLevel,
        predictedChurnDate: this.predictChurnDate(riskScore),
        factors,
        confidence: this.calculateConfidence(subscriber),
      });
    }

    return predictions.sort((a, b) => b.riskScore - a.riskScore);
  }

  private calculateRiskScore(subscriber: any): number {
    let score = 0;

    // Engagement factors
    if (subscriber.last_activity_days > 7) score += 20;
    if (subscriber.last_activity_days > 14) score += 30;
    if (subscriber.avg_session_duration < 300) score += 15; // Less than 5 minutes
    if (subscriber.monthly_active_days < 5) score += 25;

    // Payment factors
    if (subscriber.failed_payments > 0) score += 40;
    if (subscriber.payment_method_expires_soon) score += 30;
    if (subscriber.subscription_downgrades > 0) score += 20;

    // Support factors
    if (subscriber.support_tickets > 2) score += 15;
    if (subscriber.negative_feedback_score > 0.3) score += 25;

    return Math.min(100, Math.max(0, score));
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore >= 70) return 'high';
    if (riskScore >= 40) return 'medium';
    return 'low';
  }

  private identifyRiskFactors(subscriber: any): string[] {
    const factors: string[] = [];

    if (subscriber.last_activity_days > 14) factors.push('Low recent engagement');
    if (subscriber.failed_payments > 0) factors.push('Payment issues');
    if (subscriber.avg_session_duration < 300) factors.push('Short session duration');
    if (subscriber.support_tickets > 2) factors.push('Multiple support requests');
    if (subscriber.subscription_downgrades > 0) factors.push('Previous downgrades');
    if (subscriber.negative_feedback_score > 0.3) factors.push('Negative feedback');

    return factors;
  }

  private predictChurnDate(riskScore: number): string {
    const daysToChurn = Math.max(7, 90 - (riskScore * 0.8));
    const churnDate = new Date(Date.now() + daysToChurn * 24 * 60 * 60 * 1000);
    return churnDate.toISOString();
  }

  private calculateConfidence(subscriber: any): number {
    const dataPoints = [
      subscriber.last_activity_days !== null,
      subscriber.avg_session_duration !== null,
      subscriber.monthly_active_days !== null,
      subscriber.failed_payments !== null,
      subscriber.support_tickets !== null,
    ].filter(Boolean).length;

    return Math.min(100, (dataPoints / 5) * 100);
  }
}

class SubscriberSegmentationEngine {
  private supabase;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async segmentSubscribers(creatorId: string): Promise<SegmentAnalysis[]> {
    const cacheKey = `segments:${creatorId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data: subscribers, error } = await this.supabase
      .from('creator_subscriptions')
      .select(`
        *,
        user_behavior_metrics(*),
        subscription_events(*)
      `)
      .eq('creator_id', creatorId);

    if (error) throw error;

    const segments = await this.createSegments(subscribers);
    
    // Cache for 2 hours
    await redis.setex(cacheKey, 7200, JSON.stringify(segments));
    
    return segments;
  }

  private async createSegments(subscribers: any[]): Promise<SegmentAnalysis[]> {
    const segments: SegmentAnalysis[] = [];

    // High-value customers
    const highValue = subscribers.filter(sub => 
      this.getTotalRevenue(sub) > 500 && sub.status === 'active'
    );
    
    segments.push({
      segmentId: 'high_value',
      segmentName: 'High Value Customers',
      subscriberCount: highValue.length,
      averageRevenue: this.calculateAverageRevenue(highValue),
      churnRate: this.calculateSegmentChurnRate(highValue),
      lifetimeValue: this.calculateSegmentLTV(highValue),
      characteristics: {
        avgMonthlySpend: this.calculateAverageRevenue(highValue),
        avgTenure: this.calculateAverageTenure(highValue),
        engagementLevel: 'high',
      },
    });

    // New subscribers
    const newSubscribers = subscribers.filter(sub => {
      const createdAt = new Date(sub.created_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return createdAt >= thirtyDaysAgo;
    });

    segments.push({
      segmentId: 'new_subscribers',
      segmentName: 'New Subscribers',
      subscriberCount: newSubscribers.length,
      averageRevenue: this.calculateAverageRevenue(newSubscribers),
      churnRate: this.calculateSegmentChurnRate(newSubscribers),
      lifetimeValue: this.calculateSegmentLTV(newSubscribers),
      characteristics: {
        avgDaysSubscribed: this.calculateAverageTenure(newSubscribers),
        onboardingComplete: this.calculateOnboardingRate(newSubscribers),
        trialConversion: this.calculateTrialConversionRate(newSubscribers),
      },
    });

    // At-risk subscribers
    const atRisk = subscribers.filter(sub => {
      const behavior = sub.user_behavior_metrics?.[0];
      return behavior && (
        behavior.last_activity_days > 7 ||
        behavior.failed_payments > 0 ||
        behavior.avg_session_duration < 300
      );
    });

    segments.push({
      segmentId: 'at_risk',
      segmentName: 'At-Risk Subscribers',
      subscriberCount: atRisk.length,
      averageRevenue: this.calculateAverageRevenue(atRisk),
      churnRate: this.calculateSegmentChurnRate(atRisk),
      lifetimeValue: this.calculateSegmentLTV(atRisk),
      characteristics: {
        avgInactivityDays: this.calculateAvgInactivity(atRisk),
        paymentIssues: atRisk.filter(sub => 
          sub.user_behavior_metrics?.[0]?.failed_payments > 0
        ).length,
        lowEngagement: this.calculateLowEngagementRate(atRisk),
      },
    });

    // Loyal customers
    const loyal = subscribers.filter(sub => {
      const createdAt = new Date(sub.created_at);
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      return createdAt < sixMonthsAgo && sub.status === 'active';
    });

    segments.push({
      segmentId: 'loyal',
      segmentName: 'Loyal Customers',
      subscriberCount: loyal.length,
      averageRevenue: this.calculateAverageRevenue(loyal),
      churnRate: this.calculateSegmentChurnRate(loyal),
      lifetimeValue: this.calculateSegmentLTV(loyal),
      characteristics: {
        avgTenure: this.calculateAverageTenure(loyal),
        retentionRate: this.calculateRetentionRate(loyal),
        referralRate: this.calculateReferralRate(loyal),
      },
    });

    return segments;
  }

  private getTotalRevenue(subscriber: any): number {
    return subscriber.subscription_events
      ?.filter((event: any) => event.event_type === 'payment_succeeded')
      ?.reduce((sum: number, event: any) => sum + (event.amount || 0), 0) || 0;
  }

  private calculateAverageRevenue(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const totalRevenue = subscribers.reduce((sum, sub) => sum + this.getTotalRevenue(sub), 0);
    return totalRevenue / subscribers.length;
  }

  private calculateSegmentChurnRate(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const churned = subscribers.filter(sub => sub.status === 'canceled').length;
    return (churned / subscribers.length) * 100;
  }

  private calculateSegmentLTV(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const avgRevenue = this.calculateAverageRevenue(subscribers);
    const avgTenure = this.calculateAverageTenure(subscribers);
    return avgRevenue * (avgTenure / 30); // Convert days to months
  }

  private calculateAverageTenure(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const totalTenure = subscribers.reduce((sum, sub) => {
      const start = new Date(sub.created_at);
      const end = sub.canceled_at ? new Date(sub.canceled_at) : new Date();
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    return totalTenure / subscribers.length;
  }

  private calculateOnboardingRate(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const completed = subscribers.filter(sub => 
      sub.user_behavior_metrics?.[0]?.onboarding_completed
    ).length;
    return (completed / subscribers.length) * 100;
  }

  private calculateTrialConversionRate(subscribers: any[]): number {
    const trials = subscribers.filter(sub => sub.trial_end);
    if (trials.length === 0) return 0;
    const converted = trials.filter(sub => sub.status === 'active').length;
    return (converted / trials.length) * 100;
  }

  private calculateAvgInactivity(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const totalInactivity = subscribers.reduce((sum, sub) => {
      return sum + (sub.user_behavior_metrics?.[0]?.last_activity_days || 0);
    }, 0);
    return totalInactivity / subscribers.length;
  }

  private calculateLowEngagementRate(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const lowEngagement = subscribers.filter(sub => 
      sub.user_behavior_metrics?.[0]?.avg_session_duration < 300
    ).length;
    return (lowEngagement / subscribers.length) * 100;
  }

  private calculateRetentionRate(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const active = subscribers.filter(sub => sub.status === 'active').length;
    return (active / subscribers.length) * 100;
  }

  private calculateReferralRate(subscribers: any[]): number {
    if (subscribers.length === 0) return 0;
    const referrers = subscribers.filter(sub => 
      sub.user_behavior_metrics?.[0]?.referrals_made > 0
    ).length;
    return (referrers / subscribers.length) * 100;
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());

    // Validate query parameters
    const query = analyticsQuerySchema.parse(searchParams);

    // Verify creator authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify creator access
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', query.creatorId)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const analyticsService = new SubscriptionAnalyticsService(supabase);
    const churnEngine = new ChurnPredictionEngine(supabase);
    const segmentationEngine = new SubscriberSegmentationEngine(supabase);

    const results: any = {};

    // Get requested metrics
    if (query.metrics.includes('revenue') || query.metrics.includes('churn