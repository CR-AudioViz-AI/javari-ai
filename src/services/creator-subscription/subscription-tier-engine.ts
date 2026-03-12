```typescript
/**
 * Creator Subscription Tier Engine
 * 
 * Multi-tier creator subscription engine with dynamic pricing, feature access control,
 * and automated billing cycles supporting freemium to enterprise tiers.
 * 
 * Features:
 * - Dynamic tier pricing and feature management
 * - Automated billing cycle processing
 * - Real-time feature access control with caching
 * - Prorated upgrades/downgrades
 * - Usage tracking and analytics
 * - Stripe integration for payment processing
 * 
 * @fileoverview Creator Subscription Tier Engine Service
 * @version 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/**
 * Subscription tier configuration
 */
export interface SubscriptionTier {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'one-time';
  features: TierFeature[];
  limits: TierLimits;
  isActive: boolean;
  stripeProductId?: string;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tier feature configuration
 */
export interface TierFeature {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  limits?: {
    max?: number;
    daily?: number;
    monthly?: number;
  };
}

/**
 * Tier usage limits
 */
export interface TierLimits {
  maxUploads: number;
  maxStorage: number; // in bytes
  maxBandwidth: number; // in bytes per month
  maxCollaborators: number;
  maxProjects: number;
  apiCallsPerMonth: number;
  customDomain: boolean;
  analytics: boolean;
  priority: 'low' | 'normal' | 'high' | 'premium';
}

/**
 * User subscription record
 */
export interface UserSubscription {
  id: string;
  userId: string;
  creatorId: string;
  tierId: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  usage: UsageMetrics;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Usage metrics tracking
 */
export interface UsageMetrics {
  uploads: number;
  storageUsed: number;
  bandwidthUsed: number;
  apiCalls: number;
  collaborators: number;
  projects: number;
  lastResetDate: Date;
}

/**
 * Billing cycle information
 */
export interface BillingCycle {
  id: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  stripeInvoiceId?: string;
  paidAt?: Date;
  createdAt: Date;
}

/**
 * Tier upgrade/downgrade request
 */
export interface TierChangeRequest {
  subscriptionId: string;
  newTierId: string;
  effectiveDate?: Date;
  prorationBehavior: 'create_prorations' | 'none' | 'always_invoice';
}

/**
 * Feature access result
 */
export interface FeatureAccessResult {
  hasAccess: boolean;
  tier: SubscriptionTier | null;
  subscription: UserSubscription | null;
  limits?: TierLimits;
  usage?: UsageMetrics;
  remainingQuota?: Record<string, number>;
}

/**
 * Subscription analytics data
 */
export interface SubscriptionAnalytics {
  creatorId: string;
  totalSubscribers: number;
  activeSubscribers: number;
  monthlyRecurringRevenue: number;
  churnRate: number;
  averageRevenuePerUser: number;
  tierDistribution: Record<string, number>;
  conversionRates: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Service configuration
 */
export interface SubscriptionTierEngineConfig {
  supabase: {
    url: string;
    key: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
  redis: {
    url: string;
  };
  caching: {
    featureAccessTtl: number;
    subscriptionTtl: number;
  };
  billing: {
    gracePeriodDays: number;
    retryAttempts: number;
  };
}

// =============================================================================
// MAIN SERVICE CLASS
// =============================================================================

/**
 * Creator Subscription Tier Engine
 * 
 * Main service class managing multi-tier creator subscriptions with dynamic
 * pricing, feature access control, and automated billing cycles.
 */
export class SubscriptionTierEngine extends EventEmitter {
  private supabase: SupabaseClient;
  private stripe: Stripe;
  private redis: Redis;
  private config: SubscriptionTierEngineConfig;
  
  private pricingCalculator: PricingCalculator;
  private featureAccessController: FeatureAccessController;
  private billingCycleManager: BillingCycleManager;
  private tierUpgradeHandler: TierUpgradeHandler;
  private usageMeter: UsageMeter;
  private prorationCalculator: ProrationCalculator;
  private subscriptionAnalytics: SubscriptionAnalytics;

  constructor(config: SubscriptionTierEngineConfig) {
    super();
    this.config = config;
    this.initializeClients();
    this.initializeComponents();
  }

  /**
   * Initialize external service clients
   */
  private initializeClients(): void {
    this.supabase = createClient(
      this.config.supabase.url,
      this.config.supabase.key
    );

    this.stripe = new Stripe(this.config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });

    this.redis = new Redis(this.config.redis.url);
  }

  /**
   * Initialize service components
   */
  private initializeComponents(): void {
    this.pricingCalculator = new PricingCalculator(this.supabase);
    this.featureAccessController = new FeatureAccessController(
      this.supabase,
      this.redis,
      this.config.caching.featureAccessTtl
    );
    this.billingCycleManager = new BillingCycleManager(
      this.supabase,
      this.stripe,
      this.config.billing
    );
    this.tierUpgradeHandler = new TierUpgradeHandler(
      this.supabase,
      this.stripe
    );
    this.usageMeter = new UsageMeter(this.supabase, this.redis);
    this.prorationCalculator = new ProrationCalculator();
    this.subscriptionAnalytics = new SubscriptionAnalyticsService(this.supabase);
  }

  // =============================================================================
  // SUBSCRIPTION TIER MANAGEMENT
  // =============================================================================

  /**
   * Create a new subscription tier
   */
  async createTier(tierData: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionTier> {
    try {
      // Create Stripe product and price
      const stripeProduct = await this.stripe.products.create({
        name: tierData.name,
        description: tierData.description,
        metadata: {
          creatorId: tierData.creatorId,
        },
      });

      const stripePrice = await this.stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(tierData.price * 100), // Convert to cents
        currency: tierData.currency,
        recurring: tierData.billingCycle !== 'one-time' ? {
          interval: tierData.billingCycle === 'yearly' ? 'year' : 'month',
        } : undefined,
      });

      // Store in database
      const { data, error } = await this.supabase
        .from('subscription_tiers')
        .insert([{
          ...tierData,
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice.id,
        }])
        .select()
        .single();

      if (error) throw error;

      this.emit('tierCreated', data);
      return data;
    } catch (error) {
      this.emit('error', { operation: 'createTier', error });
      throw new Error(`Failed to create subscription tier: ${error.message}`);
    }
  }

  /**
   * Update subscription tier
   */
  async updateTier(tierId: string, updates: Partial<SubscriptionTier>): Promise<SubscriptionTier> {
    try {
      // Get existing tier
      const { data: existingTier, error: fetchError } = await this.supabase
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (fetchError) throw fetchError;

      // Update Stripe product if needed
      if (updates.name || updates.description) {
        await this.stripe.products.update(existingTier.stripeProductId, {
          name: updates.name || existingTier.name,
          description: updates.description || existingTier.description,
        });
      }

      // Create new price if price changed
      if (updates.price && updates.price !== existingTier.price) {
        const newPrice = await this.stripe.prices.create({
          product: existingTier.stripeProductId,
          unit_amount: Math.round(updates.price * 100),
          currency: updates.currency || existingTier.currency,
          recurring: existingTier.billingCycle !== 'one-time' ? {
            interval: existingTier.billingCycle === 'yearly' ? 'year' : 'month',
          } : undefined,
        });

        // Deactivate old price
        await this.stripe.prices.update(existingTier.stripePriceId, {
          active: false,
        });

        updates.stripePriceId = newPrice.id;
      }

      // Update database
      const { data, error } = await this.supabase
        .from('subscription_tiers')
        .update(updates)
        .eq('id', tierId)
        .select()
        .single();

      if (error) throw error;

      // Clear cache
      await this.featureAccessController.clearTierCache(tierId);

      this.emit('tierUpdated', data);
      return data;
    } catch (error) {
      this.emit('error', { operation: 'updateTier', error });
      throw new Error(`Failed to update subscription tier: ${error.message}`);
    }
  }

  /**
   * Get subscription tiers for a creator
   */
  async getCreatorTiers(creatorId: string): Promise<SubscriptionTier[]> {
    try {
      const { data, error } = await this.supabase
        .from('subscription_tiers')
        .select('*')
        .eq('creatorId', creatorId)
        .eq('isActive', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(`Failed to get creator tiers: ${error.message}`);
    }
  }

  // =============================================================================
  // SUBSCRIPTION MANAGEMENT
  // =============================================================================

  /**
   * Create user subscription
   */
  async createSubscription(
    userId: string,
    creatorId: string,
    tierId: string,
    paymentMethodId?: string
  ): Promise<UserSubscription> {
    try {
      const tier = await this.getTier(tierId);
      if (!tier) {
        throw new Error('Subscription tier not found');
      }

      // Create or get Stripe customer
      let stripeCustomer = await this.getOrCreateStripeCustomer(userId);

      // Attach payment method if provided
      if (paymentMethodId) {
        await this.stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomer.id,
        });

        await this.stripe.customers.update(stripeCustomer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // Create Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: stripeCustomer.id,
        items: [{
          price: tier.stripePriceId,
        }],
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          creatorId,
          tierId,
        },
      });

      // Store subscription in database
      const subscriptionData: Omit<UserSubscription, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        creatorId,
        tierId,
        status: stripeSubscription.status as any,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeCustomer.id,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        usage: this.initializeUsageMetrics(),
      };

      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .insert([subscriptionData])
        .select()
        .single();

      if (error) throw error;

      this.emit('subscriptionCreated', data);
      return data;
    } catch (error) {
      this.emit('error', { operation: 'createSubscription', error });
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Change subscription tier
   */
  async changeTier(changeRequest: TierChangeRequest): Promise<UserSubscription> {
    try {
      return await this.tierUpgradeHandler.processTierChange(changeRequest);
    } catch (error) {
      this.emit('error', { operation: 'changeTier', error });
      throw new Error(`Failed to change tier: ${error.message}`);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<UserSubscription> {
    try {
      // Get subscription
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Cancel in Stripe
      if (subscription.stripeSubscriptionId) {
        if (cancelAtPeriodEnd) {
          await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } else {
          await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
      }

      // Update database
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .update({
          status: cancelAtPeriodEnd ? subscription.status : 'cancelled',
          cancelAtPeriodEnd,
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) throw error;

      // Clear cache
      await this.featureAccessController.clearUserCache(subscription.userId);

      this.emit('subscriptionCancelled', data);
      return data;
    } catch (error) {
      this.emit('error', { operation: 'cancelSubscription', error });
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  // =============================================================================
  // FEATURE ACCESS CONTROL
  // =============================================================================

  /**
   * Check feature access for user
   */
  async checkFeatureAccess(userId: string, creatorId: string, featureKey: string): Promise<FeatureAccessResult> {
    try {
      return await this.featureAccessController.checkAccess(userId, creatorId, featureKey);
    } catch (error) {
      this.emit('error', { operation: 'checkFeatureAccess', error });
      throw new Error(`Failed to check feature access: ${error.message}`);
    }
  }

  /**
   * Track feature usage
   */
  async trackUsage(
    userId: string,
    creatorId: string,
    usageType: keyof UsageMetrics,
    amount: number = 1
  ): Promise<void> {
    try {
      await this.usageMeter.trackUsage(userId, creatorId, usageType, amount);
    } catch (error) {
      this.emit('error', { operation: 'trackUsage', error });
      throw new Error(`Failed to track usage: ${error.message}`);
    }
  }

  // =============================================================================
  // BILLING AND ANALYTICS
  // =============================================================================

  /**
   * Process billing cycles
   */
  async processBillingCycles(): Promise<void> {
    try {
      await this.billingCycleManager.processUpcomingBills();
    } catch (error) {
      this.emit('error', { operation: 'processBillingCycles', error });
      throw new Error(`Failed to process billing cycles: ${error.message}`);
    }
  }

  /**
   * Get subscription analytics for creator
   */
  async getAnalytics(creatorId: string, startDate: Date, endDate: Date): Promise<SubscriptionAnalytics> {
    try {
      return await this.subscriptionAnalytics.generateAnalytics(creatorId, startDate, endDate);
    } catch (error) {
      this.emit('error', { operation: 'getAnalytics', error });
      throw new Error(`Failed to get analytics: ${error.message}`);
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Get subscription tier by ID
   */
  private async getTier(tierId: string): Promise<SubscriptionTier | null> {
    const { data } = await this.supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', tierId)
      .single();

    return data;
  }

  /**
   * Get subscription by ID
   */
  private async getSubscription(subscriptionId: string): Promise<UserSubscription | null> {
    const { data } = await this.supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single();

    return data;
  }

  /**
   * Get or create Stripe customer
   */
  private async getOrCreateStripeCustomer(userId: string): Promise<Stripe.Customer> {
    // Check if customer exists
    const { data: existingSubscription } = await this.supabase
      .from('user_subscriptions')
      .select('stripeCustomerId')
      .eq('userId', userId)
      .not('stripeCustomerId', 'is', null)
      .limit(1)
      .single();

    if (existingSubscription?.stripeCustomerId) {
      return await this.stripe.customers.retrieve(existingSubscription.stripeCustomerId) as Stripe.Customer;
    }

    // Create new customer
    return await this.stripe.customers.create({
      metadata: { userId },
    });
  }

  /**
   * Initialize usage metrics
   */
  private initializeUsageMetrics(): UsageMetrics {
    return {
      uploads: 0,
      storageUsed: 0,
      bandwidthUsed: 0,
      apiCalls: 0,
      collaborators: 0,
      projects: 0,
      lastResetDate: new Date(),
    };
  }
}

// =============================================================================
// COMPONENT CLASSES
// =============================================================================

/**
 * Pricing Calculator Component
 */
class PricingCalculator {
  constructor(private supabase: SupabaseClient) {}

  async calculatePrice(tierId: string, quantity: number = 1): Promise<number> {
    const { data: tier } = await this.supabase
      .from('subscription_tiers')
      .select('price')
      .eq('id', tierId)
      .single();

    return tier?.price * quantity || 0;
  }

  async calculateAnnualDiscount(monthlyPrice: number, annualPrice: number): Promise<number> {
    const annualFromMonthly = monthlyPrice * 12;
    return ((annualFromMonthly - annualPrice) / annualFromMonthly) * 100;
  }
}

/**
 * Feature Access Controller Component
 */
class FeatureAccessController {
  constructor(
    private supabase: SupabaseClient,
    private redis: Redis,
    private cacheTtl: number
  ) {}

  async checkAccess(userId: string, creatorId: string, featureKey: string): Promise<FeatureAccessResult> {
    const cacheKey = `feature_access:${userId}:${creatorId}:${featureKey}`;
    
    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get user subscription
    const { data: subscription } = await this.supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_tiers (*)
      `)
      .eq('userId', userId)
      .eq('creatorId', creatorId)
      .eq('status', 'active')
      .single();

    let result: FeatureAccessResult;

    if (!subscription || !subscription.subscription_tiers) {
      result = {
        hasAccess: false,
        tier: null,
        subscription: null,
      };
    } else {
      const tier = subscription.subscription_tiers as SubscriptionTier;
      const feature = tier.features.find(f => f.key === featureKey);
      
      result = {
        hasAccess: feature?.enabled || false,
        tier,
        subscription: subscription as UserSubscription,
        limits: tier.limits,
        usage: subscription.usage,
        remainingQuota: this.calculateRemainingQuota(tier.limits, subscription.usage),
      };
    }

    // Cache result