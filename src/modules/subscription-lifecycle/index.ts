```typescript
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { EventEmitter } from 'events';

/**
 * Subscription lifecycle states
 */
export enum SubscriptionState {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  SUSPENDED = 'suspended',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired'
}

/**
 * Billing cycle types
 */
export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

/**
 * Plan change types
 */
export enum PlanChangeType {
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  LATERAL = 'lateral'
}

/**
 * Dunning campaign stages
 */
export enum DunningStage {
  SOFT_DECLINE = 'soft_decline',
  HARD_DECLINE = 'hard_decline',
  FINAL_NOTICE = 'final_notice',
  SUSPENSION = 'suspension'
}

/**
 * Subscription configuration interface
 */
interface SubscriptionConfig {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  trialDays?: number;
  promoCode?: string;
  paymentMethodId: string;
}

/**
 * Subscription data interface
 */
interface Subscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  state: SubscriptionState;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Billing history entry interface
 */
interface BillingHistory {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: string;
  invoiceId: string;
  paymentIntentId?: string;
  billingDate: Date;
  paidDate?: Date;
  createdAt: Date;
}

/**
 * Proration calculation result
 */
interface ProrationResult {
  creditAmount: number;
  chargeAmount: number;
  netAmount: number;
  prorationItems: Array<{
    description: string;
    amount: number;
    quantity: number;
    unitAmount: number;
  }>;
}

/**
 * Plan change request interface
 */
interface PlanChangeRequest {
  subscriptionId: string;
  newPlanId: string;
  effectiveDate?: Date;
  prorate: boolean;
}

/**
 * Dunning campaign configuration
 */
interface DunningConfig {
  stage: DunningStage;
  retryCount: number;
  nextRetryDate: Date;
  emailTemplate: string;
  suspensionDate?: Date;
}

/**
 * Webhook event interface
 */
interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
}

/**
 * Proration Calculator for handling plan changes and billing adjustments
 */
export class ProrationCalculator {
  private readonly stripe: Stripe;

  constructor(stripeSecretKey: string) {
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  }

  /**
   * Calculate proration for plan change
   */
  async calculateProration(
    subscriptionId: string,
    newPriceId: string,
    effectiveDate?: Date
  ): Promise<ProrationResult> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const currentItem = subscription.items.data[0];
      const currentPrice = await this.stripe.prices.retrieve(currentItem.price.id);
      const newPrice = await this.stripe.prices.retrieve(newPriceId);

      const now = effectiveDate || new Date();
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);
      
      const totalPeriodSeconds = (periodEnd.getTime() - periodStart.getTime()) / 1000;
      const usedSeconds = (now.getTime() - periodStart.getTime()) / 1000;
      const remainingSeconds = totalPeriodSeconds - usedSeconds;
      
      const usedRatio = usedSeconds / totalPeriodSeconds;
      const remainingRatio = remainingSeconds / totalPeriodSeconds;

      // Credit for unused portion of current plan
      const creditAmount = Math.round(currentPrice.unit_amount! * remainingRatio);
      
      // Charge for remaining portion of new plan
      const chargeAmount = Math.round(newPrice.unit_amount! * remainingRatio);
      
      const netAmount = chargeAmount - creditAmount;

      return {
        creditAmount,
        chargeAmount,
        netAmount,
        prorationItems: [
          {
            description: `Credit for unused ${currentPrice.nickname || 'plan'}`,
            amount: -creditAmount,
            quantity: 1,
            unitAmount: -creditAmount
          },
          {
            description: `Charge for new ${newPrice.nickname || 'plan'}`,
            amount: chargeAmount,
            quantity: 1,
            unitAmount: chargeAmount
          }
        ]
      };
    } catch (error) {
      throw new Error(`Proration calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Billing Cycle Engine for managing automated billing cycles
 */
export class BillingCycleEngine extends EventEmitter {
  private readonly supabase;
  private readonly stripe: Stripe;

  constructor(supabaseUrl: string, supabaseKey: string, stripeSecretKey: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
  }

  /**
   * Process billing cycle for all active subscriptions
   */
  async processBillingCycle(): Promise<void> {
    try {
      const { data: subscriptions, error } = await this.supabase
        .from('subscriptions')
        .select('*')
        .in('state', [SubscriptionState.ACTIVE, SubscriptionState.TRIALING])
        .lte('current_period_end', new Date().toISOString());

      if (error) throw error;

      for (const subscription of subscriptions || []) {
        await this.processSubscriptionBilling(subscription);
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process billing for individual subscription
   */
  private async processSubscriptionBilling(subscription: Subscription): Promise<void> {
    try {
      const stripeSubscription = await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      // Create invoice
      const invoice = await this.stripe.invoices.create({
        customer: stripeSubscription.customer as string,
        subscription: subscription.stripeSubscriptionId,
        auto_advance: true
      });

      // Attempt payment
      const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(invoice.id);
      
      if (finalizedInvoice.status === 'paid') {
        await this.handleSuccessfulPayment(subscription, finalizedInvoice);
      } else {
        await this.handleFailedPayment(subscription, finalizedInvoice);
      }
    } catch (error) {
      this.emit('billing-error', { subscription, error });
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private async handleSuccessfulPayment(subscription: Subscription, invoice: Stripe.Invoice): Promise<void> {
    const nextPeriodStart = new Date();
    const nextPeriodEnd = this.calculateNextBillingDate(nextPeriodStart, subscription.billingCycle);

    // Update subscription
    await this.supabase
      .from('subscriptions')
      .update({
        current_period_start: nextPeriodStart.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        state: SubscriptionState.ACTIVE,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // Record billing history
    await this.supabase
      .from('billing_history')
      .insert({
        subscription_id: subscription.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: 'paid',
        invoice_id: invoice.id,
        payment_intent_id: invoice.payment_intent,
        billing_date: new Date().toISOString(),
        paid_date: new Date().toISOString()
      });

    this.emit('payment-success', { subscription, invoice });
  }

  /**
   * Handle failed payment
   */
  private async handleFailedPayment(subscription: Subscription, invoice: Stripe.Invoice): Promise<void> {
    // Update subscription to past due
    await this.supabase
      .from('subscriptions')
      .update({
        state: SubscriptionState.PAST_DUE,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id);

    // Record failed billing
    await this.supabase
      .from('billing_history')
      .insert({
        subscription_id: subscription.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: 'failed',
        invoice_id: invoice.id,
        billing_date: new Date().toISOString()
      });

    this.emit('payment-failed', { subscription, invoice });
  }

  /**
   * Calculate next billing date based on cycle
   */
  private calculateNextBillingDate(startDate: Date, cycle: BillingCycle): Date {
    const nextDate = new Date(startDate);
    
    switch (cycle) {
      case BillingCycle.MONTHLY:
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case BillingCycle.QUARTERLY:
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case BillingCycle.YEARLY:
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    return nextDate;
  }
}

/**
 * Plan Change Handler for managing subscription upgrades and downgrades
 */
export class PlanChangeHandler {
  private readonly supabase;
  private readonly stripe: Stripe;
  private readonly prorationCalculator: ProrationCalculator;

  constructor(supabaseUrl: string, supabaseKey: string, stripeSecretKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    this.prorationCalculator = new ProrationCalculator(stripeSecretKey);
  }

  /**
   * Process plan change request
   */
  async processPlanChange(request: PlanChangeRequest): Promise<Subscription> {
    try {
      const { data: subscription, error } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('id', request.subscriptionId)
        .single();

      if (error || !subscription) {
        throw new Error('Subscription not found');
      }

      const changeType = await this.determinePlanChangeType(subscription.planId, request.newPlanId);
      
      if (request.prorate) {
        return await this.executeProratedPlanChange(subscription, request, changeType);
      } else {
        return await this.executeScheduledPlanChange(subscription, request, changeType);
      }
    } catch (error) {
      throw new Error(`Plan change failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute prorated plan change
   */
  private async executeProratedPlanChange(
    subscription: Subscription,
    request: PlanChangeRequest,
    changeType: PlanChangeType
  ): Promise<Subscription> {
    // Get new plan details
    const { data: newPlan } = await this.supabase
      .from('plans')
      .select('stripe_price_id')
      .eq('id', request.newPlanId)
      .single();

    if (!newPlan) throw new Error('New plan not found');

    // Update Stripe subscription
    const updatedStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{
          id: (await this.stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
          price: newPlan.stripe_price_id
        }],
        proration_behavior: 'always_invoice'
      }
    );

    // Update local subscription
    const { data: updatedSubscription } = await this.supabase
      .from('subscriptions')
      .update({
        plan_id: request.newPlanId,
        current_period_start: new Date(updatedStripeSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(updatedStripeSubscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscription.id)
      .select()
      .single();

    // Log plan change
    await this.supabase
      .from('subscription_changes')
      .insert({
        subscription_id: subscription.id,
        old_plan_id: subscription.planId,
        new_plan_id: request.newPlanId,
        change_type: changeType,
        effective_date: new Date().toISOString(),
        prorated: true
      });

    return updatedSubscription as Subscription;
  }

  /**
   * Execute scheduled plan change
   */
  private async executeScheduledPlanChange(
    subscription: Subscription,
    request: PlanChangeRequest,
    changeType: PlanChangeType
  ): Promise<Subscription> {
    const effectiveDate = request.effectiveDate || new Date(subscription.currentPeriodEnd);

    // Schedule the change
    await this.supabase
      .from('scheduled_plan_changes')
      .insert({
        subscription_id: subscription.id,
        new_plan_id: request.newPlanId,
        effective_date: effectiveDate.toISOString(),
        change_type: changeType,
        created_at: new Date().toISOString()
      });

    return subscription;
  }

  /**
   * Determine plan change type
   */
  private async determinePlanChangeType(currentPlanId: string, newPlanId: string): Promise<PlanChangeType> {
    const { data: plans } = await this.supabase
      .from('plans')
      .select('id, price')
      .in('id', [currentPlanId, newPlanId]);

    if (!plans || plans.length !== 2) {
      return PlanChangeType.LATERAL;
    }

    const currentPlan = plans.find(p => p.id === currentPlanId);
    const newPlan = plans.find(p => p.id === newPlanId);

    if (!currentPlan || !newPlan) return PlanChangeType.LATERAL;

    if (newPlan.price > currentPlan.price) return PlanChangeType.UPGRADE;
    if (newPlan.price < currentPlan.price) return PlanChangeType.DOWNGRADE;
    return PlanChangeType.LATERAL;
  }
}

/**
 * Dunning Manager for handling failed payments and recovery campaigns
 */
export class DunningManager extends EventEmitter {
  private readonly supabase;
  private readonly stripe: Stripe;
  private readonly resend: Resend;

  constructor(supabaseUrl: string, supabaseKey: string, stripeSecretKey: string, resendApiKey: string) {
    super();
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    this.resend = new Resend(resendApiKey);
  }

  /**
   * Start dunning campaign for failed payment
   */
  async startDunningCampaign(subscriptionId: string, invoiceId: string): Promise<void> {
    try {
      const config: DunningConfig = {
        stage: DunningStage.SOFT_DECLINE,
        retryCount: 0,
        nextRetryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        emailTemplate: 'payment-failed-soft',
        suspensionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      await this.supabase
        .from('dunning_campaigns')
        .insert({
          subscription_id: subscriptionId,
          invoice_id: invoiceId,
          stage: config.stage,
          retry_count: config.retryCount,
          next_retry_date: config.nextRetryDate.toISOString(),
          suspension_date: config.suspensionDate.toISOString(),
          created_at: new Date().toISOString()
        });

      await this.sendDunningEmail(subscriptionId, config);
      this.emit('dunning-started', { subscriptionId, config });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process dunning campaigns
   */
  async processDunningCampaigns(): Promise<void> {
    try {
      const { data: campaigns, error } = await this.supabase
        .from('dunning_campaigns')
        .select('*')
        .lte('next_retry_date', new Date().toISOString())
        .eq('status', 'active');

      if (error) throw error;

      for (const campaign of campaigns || []) {
        await this.processDunningCampaign(campaign);
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Process individual dunning campaign
   */
  private async processDunningCampaign(campaign: any): Promise<void> {
    try {
      // Attempt payment retry
      const invoice = await this.stripe.invoices.retrieve(campaign.invoice_id);
      
      if (invoice.status === 'paid') {
        await this.completeDunningCampaign(campaign.id, 'recovered');
        return;
      }

      // Retry payment
      try {
        await this.stripe.invoices.pay(campaign.invoice_id);
        await this.completeDunningCampaign(campaign.id, 'recovered');
        return;
      } catch (paymentError) {
        // Payment still failed, escalate dunning
        await this.escalateDunning(campaign);
      }
    } catch (error) {
      this.emit('dunning-error', { campaign, error });
    }
  }

  /**
   * Escalate dunning campaign to next stage
   */
  private async escalateDunning(campaign: any): Promise<void> {
    const nextStage = this.getNextDunningStage(campaign.stage);
    const nextRetryDate = this.calculateNextRetryDate(campaign.retry_count + 1);
    
    await this.supabase
      .from('dunning_campaigns')
      .update({
        stage: nextStage,
        retry_count: campaign.retry_count + 1,
        next_retry_date: nextRetryDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    if (nextStage === DunningStage.SUSPENSION) {
      await this.suspendSubscription(campaign.subscription_id);
    } else {
      const config: DunningConfig = {
        stage: nextStage,
        retryCount: campaign.retry_count + 1,
        nextRetryDate,
        emailTemplate: this.getDunningEmailTemplate(nextStage),
        suspensionDate: new Date(campaign.suspension_date)
      };
      
      await this.sendDunningEmail(campaign.subscription_id, config);
    }
  }

  /**
   * Send dunning email
   */
  private async sendDunningEmail(subscriptionId: string, config: DunningConfig): Promise<void> {
    try {
      const { data: subscription } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          users (email, name)
        `)
        .eq('id', subscriptionId)
        .single();

      if (!subscription?.users?.email) return;

      await this.resend.emails.send({
        from: 'billing@crviz.ai',
        to: subscription.users.email,
        subject: this.getDunningEmailSubject(config.stage),
        html: `
          <h2>Payment Issue - ${this.getDunningEmailSubject(config.stage)}</h2>
          <p>Hello ${subscription.users.name},</p>
          <p>We've encountered an issue processing your payment for your CR AudioViz subscription.</p>
          <p>Stage: ${config.stage}</p>
          <p>Next retry: ${config.nextRetryDate.toLocaleDateString()}</p>
          <p>Please update your payment method to continue your service.</p>
        `
      });
    } catch (error) {
      this.emit('email-error', error);
    }
  }

  /**
   * Suspend subscription
   */
  private async suspendSubscription(subscriptionId: string): Promise<void> {
    await this.supabase
      .from('subscriptions')
      .update({
        state: SubscriptionState.SUSPENDED,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    this.emit('subscription-suspended', { subscriptionId });
  }

  /**
   * Complete dunning campaign
   */
  private async completeDunningCampaign(campaignId: string, resolution: string): Promise<void> {
    await this.supabase
      .from('dunning_campaigns')
      .update({
        status: 'completed',
        resolution,
        completed_at: new Date().toISOString()
      })
      .eq('id', campaignId);
  }

  /**
   * Get next dunning stage
   */
  private getNextDunningStage(currentStage: DunningStage): DunningStage {