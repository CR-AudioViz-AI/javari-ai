```typescript
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Logger } from '../utils/logger';
import { EmailService } from './email.service';
import { AnalyticsService } from './analytics.service';
import { UserManagementService } from './user-management.service';
import { WebhookValidationService } from './webhook-validation.service';

/**
 * Subscription plan tier definitions
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'basic' | 'professional' | 'enterprise';
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: {
    maxProjects: number;
    maxStorage: number; // in GB
    maxProcessingTime: number; // in minutes per month
    maxTeamMembers: number;
  };
  stripeProductId: string;
  stripePriceIds: {
    monthly: string;
    yearly: string;
  };
  isActive: boolean;
  sortOrder: number;
}

/**
 * Billing cycle configurations
 */
export enum BillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  QUARTERLY = 'quarterly',
  CUSTOM = 'custom'
}

export interface CustomBillingConfig {
  interval: 'month' | 'year';
  intervalCount: number;
  description: string;
}

/**
 * Dunning management configuration
 */
export interface DunningConfig {
  maxRetries: number;
  retryIntervals: number[]; // days between retries
  emailTemplates: {
    firstRetry: string;
    secondRetry: string;
    finalNotice: string;
    cancellation: string;
  };
  gracePeriodDays: number;
  autoDowngradeToFree: boolean;
}

/**
 * Subscription state and metadata
 */
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid' | 'paused';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingCycle: BillingCycle;
  customBillingConfig?: CustomBillingConfig;
  pausedAt?: Date;
  pauseReason?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialEnd?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subscription analytics and metrics
 */
export interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  churnRate: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  planDistribution: Record<string, number>;
  upgradeDowngradeRatio: number;
  paymentFailureRate: number;
}

/**
 * Subscription change request
 */
export interface SubscriptionChangeRequest {
  newPlanId: string;
  billingCycle?: BillingCycle;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
  effectiveDate?: Date;
  customBillingConfig?: CustomBillingConfig;
}

/**
 * Pause subscription request
 */
export interface PauseSubscriptionRequest {
  reason: string;
  resumeAt?: Date;
  pauseBehavior: 'void' | 'mark_uncollectible';
  notifyCustomer: boolean;
}

/**
 * Proration calculation result
 */
export interface ProrationCalculation {
  currentPlanCredit: number;
  newPlanCharge: number;
  netAmount: number;
  effectiveDate: Date;
  nextBillingDate: Date;
  description: string;
}

/**
 * Advanced subscription lifecycle management service
 * Handles upgrades, downgrades, pauses, and custom billing cycles
 */
export class SubscriptionLifecycleService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
  });

  private logger = new Logger('SubscriptionLifecycleService');
  private emailService = new EmailService();
  private analyticsService = new AnalyticsService();
  private userManagementService = new UserManagementService();
  private webhookValidationService = new WebhookValidationService();

  private defaultDunningConfig: DunningConfig = {
    maxRetries: 3,
    retryIntervals: [3, 7, 14],
    emailTemplates: {
      firstRetry: 'payment-failed-retry-1',
      secondRetry: 'payment-failed-retry-2',
      finalNotice: 'payment-failed-final',
      cancellation: 'subscription-cancelled'
    },
    gracePeriodDays: 7,
    autoDowngradeToFree: true
  };

  /**
   * Get all available subscription plans
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      return data.map(plan => ({
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        priceMonthly: plan.price_monthly,
        priceYearly: plan.price_yearly,
        features: plan.features,
        limits: plan.limits,
        stripeProductId: plan.stripe_product_id,
        stripePriceIds: plan.stripe_price_ids,
        isActive: plan.is_active,
        sortOrder: plan.sort_order
      }));
    } catch (error) {
      this.logger.error('Error fetching subscription plans:', error);
      throw new Error('Failed to fetch subscription plans');
    }
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      return this.mapSubscriptionFromDatabase(data);
    } catch (error) {
      this.logger.error('Error fetching user subscription:', error);
      throw new Error('Failed to fetch user subscription');
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    userId: string,
    planId: string,
    billingCycle: BillingCycle = BillingCycle.MONTHLY,
    customBillingConfig?: CustomBillingConfig
  ): Promise<Subscription> {
    try {
      // Get user and plan details
      const [user, plan] = await Promise.all([
        this.userManagementService.getUser(userId),
        this.getPlanById(planId)
      ]);

      if (!user) throw new Error('User not found');
      if (!plan) throw new Error('Subscription plan not found');

      // Determine price based on billing cycle
      const priceId = billingCycle === BillingCycle.YEARLY 
        ? plan.stripePriceIds.yearly 
        : plan.stripePriceIds.monthly;

      // Create Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          planId,
          billingCycle: customBillingConfig ? BillingCycle.CUSTOM : billingCycle
        }
      });

      // Save subscription to database
      const subscription = await this.saveSubscriptionToDatabase({
        userId,
        planId,
        stripeSubscriptionId: stripeSubscription.id,
        status: stripeSubscription.status as any,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        billingCycle: customBillingConfig ? BillingCycle.CUSTOM : billingCycle,
        customBillingConfig,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        metadata: stripeSubscription.metadata
      });

      // Update user access permissions
      await this.userManagementService.updateUserPlanAccess(userId, plan);

      // Track analytics
      await this.analyticsService.trackEvent('subscription_created', {
        userId,
        planId,
        billingCycle,
        amount: billingCycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly
      });

      // Send welcome email
      await this.emailService.sendSubscriptionWelcome(user.email, plan);

      this.logger.info(`Subscription created for user ${userId}`, { subscriptionId: subscription.id });

      return subscription;
    } catch (error) {
      this.logger.error('Error creating subscription:', error);
      throw new Error('Failed to create subscription');
    }
  }

  /**
   * Upgrade or downgrade subscription
   */
  async changeSubscription(
    subscriptionId: string,
    changeRequest: SubscriptionChangeRequest
  ): Promise<{ subscription: Subscription; proration: ProrationCalculation }> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) throw new Error('Subscription not found');

      const [currentPlan, newPlan] = await Promise.all([
        this.getPlanById(subscription.planId),
        this.getPlanById(changeRequest.newPlanId)
      ]);

      if (!currentPlan || !newPlan) throw new Error('Invalid plan configuration');

      // Calculate proration
      const proration = await this.calculateProration(subscription, newPlan, changeRequest);

      // Update Stripe subscription
      const newBillingCycle = changeRequest.billingCycle || subscription.billingCycle;
      const priceId = newBillingCycle === BillingCycle.YEARLY 
        ? newPlan.stripePriceIds.yearly 
        : newPlan.stripePriceIds.monthly;

      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          items: [{
            id: (await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
            price: priceId,
          }],
          proration_behavior: changeRequest.prorationBehavior || 'create_prorations',
          metadata: {
            ...subscription.metadata,
            previousPlanId: subscription.planId,
            changeDate: new Date().toISOString()
          }
        }
      );

      // Update subscription in database
      const updatedSubscription = await this.updateSubscriptionInDatabase(subscriptionId, {
        planId: changeRequest.newPlanId,
        billingCycle: newBillingCycle,
        customBillingConfig: changeRequest.customBillingConfig,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        metadata: stripeSubscription.metadata
      });

      // Update user access permissions
      await this.userManagementService.updateUserPlanAccess(subscription.userId, newPlan);

      // Track analytics
      const isUpgrade = newPlan.priceMonthly > currentPlan.priceMonthly;
      await this.analyticsService.trackEvent(isUpgrade ? 'subscription_upgraded' : 'subscription_downgraded', {
        userId: subscription.userId,
        fromPlan: currentPlan.id,
        toPlan: newPlan.id,
        prorationAmount: proration.netAmount
      });

      // Send notification email
      await this.emailService.sendSubscriptionChange(
        subscription.userId,
        currentPlan,
        newPlan,
        proration,
        isUpgrade
      );

      this.logger.info(`Subscription ${subscriptionId} changed from ${currentPlan.name} to ${newPlan.name}`);

      return { subscription: updatedSubscription, proration };
    } catch (error) {
      this.logger.error('Error changing subscription:', error);
      throw new Error('Failed to change subscription');
    }
  }

  /**
   * Pause subscription
   */
  async pauseSubscription(
    subscriptionId: string,
    pauseRequest: PauseSubscriptionRequest
  ): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) throw new Error('Subscription not found');

      // Pause in Stripe
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: {
          behavior: pauseRequest.pauseBehavior,
          resumes_at: pauseRequest.resumeAt ? Math.floor(pauseRequest.resumeAt.getTime() / 1000) : undefined
        },
        metadata: {
          ...subscription.metadata,
          pauseReason: pauseRequest.reason,
          pausedAt: new Date().toISOString()
        }
      });

      // Update database
      const updatedSubscription = await this.updateSubscriptionInDatabase(subscriptionId, {
        status: 'paused',
        pausedAt: new Date(),
        pauseReason: pauseRequest.reason,
        metadata: {
          ...subscription.metadata,
          pauseReason: pauseRequest.reason,
          pausedAt: new Date().toISOString()
        }
      });

      // Update user access (maintain some access during pause)
      await this.userManagementService.updateUserAccessDuringPause(subscription.userId);

      // Send notification
      if (pauseRequest.notifyCustomer) {
        await this.emailService.sendSubscriptionPaused(subscription.userId, pauseRequest.reason, pauseRequest.resumeAt);
      }

      // Track analytics
      await this.analyticsService.trackEvent('subscription_paused', {
        userId: subscription.userId,
        planId: subscription.planId,
        reason: pauseRequest.reason
      });

      this.logger.info(`Subscription ${subscriptionId} paused`, { reason: pauseRequest.reason });

      return updatedSubscription;
    } catch (error) {
      this.logger.error('Error pausing subscription:', error);
      throw new Error('Failed to pause subscription');
    }
  }

  /**
   * Resume paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) throw new Error('Subscription not found');
      if (subscription.status !== 'paused') throw new Error('Subscription is not paused');

      // Resume in Stripe
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          pause_collection: undefined,
          metadata: {
            ...subscription.metadata,
            resumedAt: new Date().toISOString()
          }
        }
      );

      // Update database
      const updatedSubscription = await this.updateSubscriptionInDatabase(subscriptionId, {
        status: stripeSubscription.status as any,
        pausedAt: undefined,
        pauseReason: undefined,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
      });

      // Restore user access
      const plan = await this.getPlanById(subscription.planId);
      if (plan) {
        await this.userManagementService.updateUserPlanAccess(subscription.userId, plan);
      }

      // Send notification
      await this.emailService.sendSubscriptionResumed(subscription.userId);

      // Track analytics
      await this.analyticsService.trackEvent('subscription_resumed', {
        userId: subscription.userId,
        planId: subscription.planId
      });

      this.logger.info(`Subscription ${subscriptionId} resumed`);

      return updatedSubscription;
    } catch (error) {
      this.logger.error('Error resuming subscription:', error);
      throw new Error('Failed to resume subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
    reason?: string
  ): Promise<Subscription> {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) throw new Error('Subscription not found');

      // Cancel in Stripe
      const stripeSubscription = cancelAtPeriodEnd
        ? await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
            metadata: {
              ...subscription.metadata,
              cancellationReason: reason || 'User requested',
              cancelRequestedAt: new Date().toISOString()
            }
          })
        : await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
            invoice_now: true,
            prorate: true
          });

      // Update database
      const updatedSubscription = await this.updateSubscriptionInDatabase(subscriptionId, {
        status: stripeSubscription.status as any,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? undefined : new Date(),
        metadata: {
          ...subscription.metadata,
          cancellationReason: reason || 'User requested',
          cancelRequestedAt: new Date().toISOString()
        }
      });

      // Update user access (immediate or at period end)
      if (!cancelAtPeriodEnd) {
        await this.userManagementService.downgradeToFreeAccess(subscription.userId);
      }

      // Send notification
      await this.emailService.sendSubscriptionCancelled(
        subscription.userId,
        cancelAtPeriodEnd,
        subscription.currentPeriodEnd
      );

      // Track analytics
      await this.analyticsService.trackEvent('subscription_cancelled', {
        userId: subscription.userId,
        planId: subscription.planId,
        reason: reason || 'User requested',
        cancelAtPeriodEnd
      });

      this.logger.info(`Subscription ${subscriptionId} cancelled`, { 
        cancelAtPeriodEnd,
        reason 
      });

      return updatedSubscription;
    } catch (error) {
      this.logger.error('Error cancelling subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(payload: string, signature: string): Promise<void> {
    try {
      // Validate webhook signature
      const isValid = await this.webhookValidationService.validateStripeSignature(payload, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const event = JSON.parse(payload);

      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object);
          break;
        default:
          this.logger.info(`Unhandled webhook event: ${event.type}`);
      }
    } catch (error) {
      this.logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Get subscription metrics and analytics
   */
  async getSubscriptionMetrics(timeframe?: 'week' | 'month' | 'quarter' | 'year'): Promise<SubscriptionMetrics> {
    try {
      const { data: subscriptions, error } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans(price_monthly, price_yearly, tier)
        `);

      if (error) throw error;

      const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
      const totalSubscriptions = subscriptions.length;

      // Calculate MRR and ARR
      const monthlyRecurringRevenue = activeSubscriptions.reduce((sum, sub) => {
        const plan = sub.subscription_plans;
        const monthlyValue = sub.billing_cycle === 'yearly' 
          ? plan.price_yearly / 12 
          : plan.price_monthly;
        return sum + monthlyValue;
      }, 0);

      const annualRecurringRevenue = monthlyRecurringRevenue * 12;

      // Plan distribution
      const planDistribution: Record<string, number> = {};
      activeSubscriptions.forEach(sub => {
        const tier = sub.subscription_plans.tier;
        planDistribution[tier] = (planDistribution[tier] || 0) + 1;
      });

      // Calculate churn rate (simplified - would need historical data for accuracy)
      const churnRate = await this.calculateChurnRate(timeframe);

      return {
        totalSubscriptions,
        activeSubscriptions: activeSubscriptions.length,
        churnRate,
        monthlyRecurringRevenue,
        annualRecurringRevenue,
        averageRevenuePerUser: activeSubscriptions.length ? monthlyRecurringRevenue / activeSubscriptions.length : 0,
        lifetimeValue: this.calculateLifetimeValue(monthlyRecurringRevenue, activeSubscriptions.length, churnRate),
        planDistribution,
        upgradeDowngradeRatio: await this.calculateUpgradeDowngradeRatio(timeframe),
        paymentFailure