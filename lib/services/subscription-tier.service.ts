```typescript
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Subscription tier configuration interface
 */
export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  stripe_price_id_monthly: string;
  stripe_price_id_yearly: string;
  features: TierFeature[];
  limits: TierLimits;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Feature configuration within a tier
 */
export interface TierFeature {
  feature_key: string;
  feature_name: string;
  enabled: boolean;
  limit?: number;
  overage_rate?: number;
}

/**
 * Usage limits for a subscription tier
 */
export interface TierLimits {
  audio_processing_minutes: number;
  visualizations_per_month: number;
  export_count: number;
  storage_gb: number;
  api_requests_per_hour: number;
  concurrent_sessions: number;
}

/**
 * User subscription information
 */
export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  stripe_subscription_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Usage tracking record
 */
export interface UsageRecord {
  id: string;
  user_id: string;
  feature_key: string;
  usage_count: number;
  usage_date: string;
  metadata?: Record<string, any>;
}

/**
 * Tier recommendation result
 */
export interface TierRecommendation {
  current_tier_id: string;
  recommended_tier_id: string;
  reason: string;
  potential_savings?: number;
  additional_cost?: number;
  confidence_score: number;
  usage_analysis: UsageAnalysis;
}

/**
 * Usage analysis data
 */
export interface UsageAnalysis {
  period_days: number;
  features_over_limit: string[];
  features_under_utilized: string[];
  average_usage_percentage: number;
  projected_monthly_usage: Record<string, number>;
}

/**
 * Billing calculation result
 */
export interface BillingCalculation {
  base_amount: number;
  overage_amount: number;
  total_amount: number;
  overage_details: OverageDetail[];
  billing_period: {
    start: string;
    end: string;
  };
}

/**
 * Overage billing detail
 */
export interface OverageDetail {
  feature_key: string;
  limit: number;
  usage: number;
  overage: number;
  rate: number;
  amount: number;
}

/**
 * Feature gate validation result
 */
export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
  current_usage?: number;
  limit?: number;
  remaining?: number;
  reset_time?: string;
}

/**
 * Service configuration interface
 */
export interface SubscriptionTierServiceConfig {
  supabase: {
    url: string;
    key: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  billing: {
    currency: string;
    tax_rate?: number;
  };
}

/**
 * Core subscription tier manager handling tier validation and feature gates
 */
export class SubscriptionTierManager extends EventEmitter {
  private tiers: Map<string, SubscriptionTier> = new Map();
  private lastTierUpdate: number = 0;
  private readonly TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private supabase: ReturnType<typeof createClient>,
    private redis: Redis
  ) {
    super();
    this.loadTiers();
  }

  /**
   * Load subscription tiers from database with caching
   */
  private async loadTiers(): Promise<void> {
    try {
      if (Date.now() - this.lastTierUpdate < this.TIER_CACHE_TTL) {
        return;
      }

      const { data: tiers, error } = await this.supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      this.tiers.clear();
      tiers.forEach(tier => {
        this.tiers.set(tier.id, tier);
      });

      this.lastTierUpdate = Date.now();
      await this.redis.setex('subscription_tiers', 300, JSON.stringify(tiers));

      this.emit('tiersLoaded', tiers);
    } catch (error) {
      console.error('Failed to load subscription tiers:', error);
      throw new Error('Failed to load subscription tiers');
    }
  }

  /**
   * Get subscription tier by ID
   */
  public async getTier(tierId: string): Promise<SubscriptionTier | null> {
    await this.loadTiers();
    return this.tiers.get(tierId) || null;
  }

  /**
   * Get all active subscription tiers
   */
  public async getAllTiers(): Promise<SubscriptionTier[]> {
    await this.loadTiers();
    return Array.from(this.tiers.values()).sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Check if feature is enabled for tier
   */
  public async isFeatureEnabled(tierId: string, featureKey: string): Promise<boolean> {
    const tier = await this.getTier(tierId);
    if (!tier) return false;

    const feature = tier.features.find(f => f.feature_key === featureKey);
    return feature?.enabled || false;
  }

  /**
   * Get feature limit for tier
   */
  public async getFeatureLimit(tierId: string, featureKey: string): Promise<number | null> {
    const tier = await this.getTier(tierId);
    if (!tier) return null;

    const feature = tier.features.find(f => f.feature_key === featureKey);
    return feature?.limit || null;
  }
}

/**
 * Usage tracking service for monitoring feature consumption
 */
export class UsageTracker {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private redis: Redis
  ) {}

  /**
   * Record feature usage for user
   */
  public async recordUsage(
    userId: string,
    featureKey: string,
    count: number = 1,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `usage:${userId}:${featureKey}:${today}`;

      // Update Redis counter
      await this.redis.incrby(cacheKey, count);
      await this.redis.expire(cacheKey, 24 * 60 * 60); // 24 hours

      // Update database (upsert)
      const { error } = await this.supabase
        .from('usage_tracking')
        .upsert({
          user_id: userId,
          feature_key: featureKey,
          usage_count: count,
          usage_date: today,
          metadata
        }, {
          onConflict: 'user_id,feature_key,usage_date'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to record usage:', error);
      throw new Error('Failed to record usage');
    }
  }

  /**
   * Get current usage for user and feature
   */
  public async getCurrentUsage(
    userId: string,
    featureKey: string,
    period: 'daily' | 'monthly' = 'monthly'
  ): Promise<number> {
    try {
      const today = new Date();
      let startDate: string;

      if (period === 'daily') {
        startDate = today.toISOString().split('T')[0];
        const cacheKey = `usage:${userId}:${featureKey}:${startDate}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return parseInt(cached);
      } else {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      }

      const { data, error } = await this.supabase
        .from('usage_tracking')
        .select('usage_count')
        .eq('user_id', userId)
        .eq('feature_key', featureKey)
        .gte('usage_date', startDate);

      if (error) throw error;

      return data.reduce((sum, record) => sum + record.usage_count, 0);
    } catch (error) {
      console.error('Failed to get current usage:', error);
      return 0;
    }
  }

  /**
   * Get usage summary for user across all features
   */
  public async getUsageSummary(
    userId: string,
    days: number = 30
  ): Promise<Record<string, number>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('usage_tracking')
        .select('feature_key, usage_count')
        .eq('user_id', userId)
        .gte('usage_date', startDate.toISOString().split('T')[0]);

      if (error) throw error;

      const summary: Record<string, number> = {};
      data.forEach(record => {
        summary[record.feature_key] = (summary[record.feature_key] || 0) + record.usage_count;
      });

      return summary;
    } catch (error) {
      console.error('Failed to get usage summary:', error);
      return {};
    }
  }
}

/**
 * Billing calculator for usage-based pricing
 */
export class BillingCalculator {
  constructor(
    private tierManager: SubscriptionTierManager,
    private usageTracker: UsageTracker
  ) {}

  /**
   * Calculate billing amount for user's usage
   */
  public async calculateBilling(
    userId: string,
    tierId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<BillingCalculation> {
    try {
      const tier = await this.tierManager.getTier(tierId);
      if (!tier) throw new Error('Tier not found');

      const usage = await this.getUsageForPeriod(userId, periodStart, periodEnd);
      const overageDetails: OverageDetail[] = [];
      let overageAmount = 0;

      // Calculate overage charges
      for (const feature of tier.features) {
        if (!feature.limit || !feature.overage_rate) continue;

        const featureUsage = usage[feature.feature_key] || 0;
        if (featureUsage > feature.limit) {
          const overage = featureUsage - feature.limit;
          const amount = overage * feature.overage_rate;

          overageDetails.push({
            feature_key: feature.feature_key,
            limit: feature.limit,
            usage: featureUsage,
            overage,
            rate: feature.overage_rate,
            amount
          });

          overageAmount += amount;
        }
      }

      return {
        base_amount: tier.price_monthly,
        overage_amount: overageAmount,
        total_amount: tier.price_monthly + overageAmount,
        overage_details: overageDetails,
        billing_period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString()
        }
      };
    } catch (error) {
      console.error('Failed to calculate billing:', error);
      throw new Error('Failed to calculate billing');
    }
  }

  /**
   * Get usage data for specific period
   */
  private async getUsageForPeriod(
    userId: string,
    start: Date,
    end: Date
  ): Promise<Record<string, number>> {
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return this.usageTracker.getUsageSummary(userId, days);
  }
}

/**
 * Tier recommendation engine for automatic upgrade/downgrade suggestions
 */
export class TierRecommendationEngine {
  constructor(
    private tierManager: SubscriptionTierManager,
    private usageTracker: UsageTracker
  ) {}

  /**
   * Generate tier recommendation for user
   */
  public async generateRecommendation(
    userId: string,
    currentTierId: string,
    analysisPeriodDays: number = 30
  ): Promise<TierRecommendation> {
    try {
      const currentTier = await this.tierManager.getTier(currentTierId);
      if (!currentTier) throw new Error('Current tier not found');

      const usage = await this.usageTracker.getUsageSummary(userId, analysisPeriodDays);
      const analysis = this.analyzeUsage(usage, currentTier);
      
      const allTiers = await this.tierManager.getAllTiers();
      const recommendedTier = this.findOptimalTier(analysis, allTiers, currentTier);

      let potentialSavings = 0;
      let additionalCost = 0;

      if (recommendedTier.id !== currentTier.id) {
        const priceDiff = recommendedTier.price_monthly - currentTier.price_monthly;
        if (priceDiff < 0) {
          potentialSavings = Math.abs(priceDiff);
        } else {
          additionalCost = priceDiff;
        }
      }

      return {
        current_tier_id: currentTierId,
        recommended_tier_id: recommendedTier.id,
        reason: this.generateRecommendationReason(analysis, currentTier, recommendedTier),
        potential_savings: potentialSavings || undefined,
        additional_cost: additionalCost || undefined,
        confidence_score: this.calculateConfidenceScore(analysis),
        usage_analysis: analysis
      };
    } catch (error) {
      console.error('Failed to generate recommendation:', error);
      throw new Error('Failed to generate recommendation');
    }
  }

  /**
   * Analyze usage patterns against tier limits
   */
  private analyzeUsage(usage: Record<string, number>, tier: SubscriptionTier): UsageAnalysis {
    const featuresOverLimit: string[] = [];
    const featuresUnderUtilized: string[] = [];
    const projectedMonthlyUsage: Record<string, number> = {};

    let totalUsagePercentage = 0;
    let featureCount = 0;

    tier.features.forEach(feature => {
      if (!feature.limit) return;

      const currentUsage = usage[feature.feature_key] || 0;
      const usagePercentage = (currentUsage / feature.limit) * 100;

      projectedMonthlyUsage[feature.feature_key] = currentUsage;

      if (usagePercentage > 90) {
        featuresOverLimit.push(feature.feature_key);
      } else if (usagePercentage < 25) {
        featuresUnderUtilized.push(feature.feature_key);
      }

      totalUsagePercentage += usagePercentage;
      featureCount++;
    });

    return {
      period_days: 30,
      features_over_limit: featuresOverLimit,
      features_under_utilized: featuresUnderUtilized,
      average_usage_percentage: featureCount > 0 ? totalUsagePercentage / featureCount : 0,
      projected_monthly_usage: projectedMonthlyUsage
    };
  }

  /**
   * Find optimal tier based on usage analysis
   */
  private findOptimalTier(
    analysis: UsageAnalysis,
    allTiers: SubscriptionTier[],
    currentTier: SubscriptionTier
  ): SubscriptionTier {
    if (analysis.features_over_limit.length > 0) {
      // Need upgrade
      const higherTiers = allTiers.filter(t => t.sort_order > currentTier.sort_order);
      return higherTiers.find(tier => 
        this.tierCanHandleUsage(tier, analysis.projected_monthly_usage)
      ) || currentTier;
    }

    if (analysis.average_usage_percentage < 25 && analysis.features_under_utilized.length > 2) {
      // Consider downgrade
      const lowerTiers = allTiers.filter(t => t.sort_order < currentTier.sort_order);
      const suitableTier = lowerTiers
        .reverse()
        .find(tier => this.tierCanHandleUsage(tier, analysis.projected_monthly_usage));
      return suitableTier || currentTier;
    }

    return currentTier;
  }

  /**
   * Check if tier can handle projected usage
   */
  private tierCanHandleUsage(tier: SubscriptionTier, usage: Record<string, number>): boolean {
    return tier.features.every(feature => {
      if (!feature.limit) return true;
      const requiredUsage = usage[feature.feature_key] || 0;
      return requiredUsage <= feature.limit * 0.8; // 20% buffer
    });
  }

  /**
   * Generate human-readable recommendation reason
   */
  private generateRecommendationReason(
    analysis: UsageAnalysis,
    currentTier: SubscriptionTier,
    recommendedTier: SubscriptionTier
  ): string {
    if (recommendedTier.id === currentTier.id) {
      return 'Your current tier is optimal for your usage patterns.';
    }

    if (recommendedTier.sort_order > currentTier.sort_order) {
      return `Consider upgrading to ${recommendedTier.display_name} as you're approaching limits in: ${analysis.features_over_limit.join(', ')}.`;
    }

    return `You could save money by downgrading to ${recommendedTier.display_name} as you're only using ${Math.round(analysis.average_usage_percentage)}% of your current tier's features.`;
  }

  /**
   * Calculate confidence score for recommendation
   */
  private calculateConfidenceScore(analysis: UsageAnalysis): number {
    let score = 50; // Base score

    // High confidence if clearly over/under utilized
    if (analysis.features_over_limit.length > 0) {
      score += 30;
    }
    if (analysis.average_usage_percentage < 20) {
      score += 25;
    }
    if (analysis.average_usage_percentage > 80) {
      score += 20;
    }

    // Factor in data quality (more days = higher confidence)
    if (analysis.period_days >= 30) {
      score += 15;
    }

    return Math.min(score, 100);
  }
}

/**
 * Stripe payment processor for subscription lifecycle management
 */
export class StripePaymentProcessor extends EventEmitter {
  private stripe: Stripe;

  constructor(
    private supabase: ReturnType<typeof createClient>,
    stripeSecretKey: string
  ) {
    super();
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    });
  }

  /**
   * Create new subscription
   */
  public async createSubscription(
    userId: string,
    tierId: string,
    customerId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<UserSubscription> {
    try {
      // Get tier information
      const { data: tier, error: tierError } = await this.supabase
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (tierError || !tier) throw new Error('Tier not found');

      const priceId = billingCycle === 'monthly' 
        ? tier.stripe_price_id_monthly 
        : tier.stripe_price_id_yearly;

      // Create Stripe subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          user_id: userId,
          tier_id: tierId
        },
        expand: ['latest_invoice.payment_intent']
      });

      // Store subscription in database
      const { data: userSubscription, error: subError } = await this.supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier_id: tierId,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end
        })
        .select()
        .single();

      if (subError) throw subError;

      this.emit('subscriptionCreated', userSubscription);
      return userSubscription;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Update subscription tier
   */
  public async updateSubscriptionTier(
    subscriptionId: string,
    newTierId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ): Promise<void> {
    try {
      // Get current subscription
      const { data: currentSub, error: subError } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (subError || !currentSub) throw new Error('Subscription not found');

      // Get new tier information
      const { data: tier, error: tierError } = await this.supabase
        .from('subscription_tiers')
        .select('*')
        .eq('id', newTierId)
        .single();

      if (tierError || !tier) throw new Error('New tier not found');

      const newPriceId = billingCycle === 'monthly'
        ? tier.stripe_price_id_monthly
        : tier.stripe_price_