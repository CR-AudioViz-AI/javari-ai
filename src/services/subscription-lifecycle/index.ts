```typescript
/**
 * @fileoverview Automated Subscription Lifecycle Manager
 * Handles subscription creation, billing, renewals, cancellations, and dunning management
 * with automated email sequences and payment retry logic.
 * 
 * @version 1.0.0
 * @author CR AudioViz AI Engineering Team
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SubscriptionConfig {
  stripeSecretKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  redisUrl: string;
  redisToken: string;
  resendApiKey: string;
  webhookSecret: string;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  endedAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface BillingCycle {
  subscriptionId: string;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  prorationAmount?: number;
  retryCount: number;
  lastAttempt?: Date;
  nextRetry?: Date;
}

export interface DunningSequence {
  subscriptionId: string;
  stage: DunningStage;
  emailsSent: number;
  lastEmailSent?: Date;
  nextEmailScheduled?: Date;
  gracePeriodEnd: Date;
}

export type DunningStage = 'initial' | 'reminder_1' | 'reminder_2' | 'final_notice' | 'suspended';

export interface PaymentRetry {
  subscriptionId: string;
  invoiceId: string;
  attemptCount: number;
  maxAttempts: number;
  nextRetry: Date;
  backoffMultiplier: number;
  lastError?: string;
}

export interface EmailTemplate {
  type: EmailType;
  subject: string;
  htmlContent: string;
  textContent: string;
}

export type EmailType = 
  | 'subscription_created'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'trial_ending'
  | 'subscription_canceled'
  | 'dunning_reminder_1'
  | 'dunning_reminder_2'
  | 'dunning_final_notice'
  | 'subscription_reactivated';

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: number;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

// ============================================================================
// Subscription Lifecycle Manager
// ============================================================================

/**
 * Main service class for managing subscription lifecycles
 * Orchestrates billing, dunning, email sequences, and state management
 */
export class SubscriptionLifecycleManager {
  private stripe: Stripe;
  private supabase: SupabaseClient;
  private redis: Redis;
  private resend: Resend;
  private billingEngine: BillingEngine;
  private dunningManager: DunningManager;
  private paymentRetryHandler: PaymentRetryHandler;
  private emailSequenceManager: EmailSequenceManager;
  private subscriptionStateManager: SubscriptionStateManager;
  private proratingCalculator: ProratingCalculator;
  private webhookProcessor: WebhookProcessor;

  constructor(private config: SubscriptionConfig) {
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    this.supabase = createClient(
      config.supabaseUrl,
      config.supabaseServiceKey
    );

    this.redis = new Redis({
      url: config.redisUrl,
      token: config.redisToken,
    });

    this.resend = new Resend(config.resendApiKey);

    // Initialize components
    this.billingEngine = new BillingEngine(this.stripe, this.supabase, this.redis);
    this.dunningManager = new DunningManager(this.supabase, this.redis);
    this.paymentRetryHandler = new PaymentRetryHandler(this.stripe, this.redis);
    this.emailSequenceManager = new EmailSequenceManager(this.resend, this.supabase);
    this.subscriptionStateManager = new SubscriptionStateManager(this.supabase, this.redis);
    this.proratingCalculator = new ProratingCalculator();
    this.webhookProcessor = new WebhookProcessor(
      this.stripe,
      this.supabase,
      this.subscriptionStateManager,
      config.webhookSecret
    );
  }

  /**
   * Creates a new subscription with trial period and initial setup
   */
  async createSubscription(
    userId: string,
    priceId: string,
    paymentMethodId: string,
    trialDays?: number
  ): Promise<Subscription> {
    try {
      // Create Stripe subscription
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: await this.getOrCreateStripeCustomer(userId),
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        default_payment_method: paymentMethodId,
        trial_period_days: trialDays,
        expand: ['latest_invoice.payment_intent'],
      });

      // Save to database
      const subscription = await this.subscriptionStateManager.createSubscription({
        userId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        status: stripeSubscription.status as SubscriptionStatus,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        trialEnd: stripeSubscription.trial_end 
          ? new Date(stripeSubscription.trial_end * 1000) 
          : undefined,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        metadata: stripeSubscription.metadata,
      });

      // Send welcome email
      await this.emailSequenceManager.sendEmail(
        userId,
        'subscription_created',
        { subscription }
      );

      // Schedule trial ending reminder if applicable
      if (trialDays && trialDays > 3) {
        await this.scheduleTrialEndingReminder(subscription.id, trialDays - 3);
      }

      return subscription;
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Processes billing cycles and handles payment attempts
   */
  async processBillingCycle(subscriptionId: string): Promise<void> {
    try {
      const subscription = await this.subscriptionStateManager.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      await this.billingEngine.processBilling(subscription);
    } catch (error) {
      console.error(`Billing cycle processing failed for ${subscriptionId}:`, error);
      throw error;
    }
  }

  /**
   * Handles subscription cancellation with prorating
   */
  async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<Subscription> {
    try {
      const subscription = await this.subscriptionStateManager.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      let proratedRefund = 0;
      if (immediately) {
        proratedRefund = await this.proratingCalculator.calculateRefund(
          subscription,
          new Date()
        );
      }

      // Cancel in Stripe
      const stripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: !immediately,
          ...(immediately && { cancel_at: Math.floor(Date.now() / 1000) })
        }
      );

      // Update database
      const updatedSubscription = await this.subscriptionStateManager.updateSubscription(
        subscriptionId,
        {
          status: stripeSubscription.status as SubscriptionStatus,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at 
            ? new Date(stripeSubscription.canceled_at * 1000)
            : new Date(),
          endedAt: stripeSubscription.ended_at 
            ? new Date(stripeSubscription.ended_at * 1000)
            : undefined,
        }
      );

      // Send cancellation email
      await this.emailSequenceManager.sendEmail(
        subscription.userId,
        'subscription_canceled',
        { subscription: updatedSubscription, proratedRefund }
      );

      return updatedSubscription;
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Processes webhook events from Stripe
   */
  async processWebhook(payload: string, signature: string): Promise<void> {
    await this.webhookProcessor.processWebhook(payload, signature);
  }

  /**
   * Starts dunning process for failed payments
   */
  async startDunningProcess(subscriptionId: string): Promise<void> {
    await this.dunningManager.startDunning(subscriptionId);
  }

  /**
   * Retries failed payment with exponential backoff
   */
  async retryFailedPayment(subscriptionId: string, invoiceId: string): Promise<void> {
    await this.paymentRetryHandler.retryPayment(subscriptionId, invoiceId);
  }

  // Private helper methods
  private async getOrCreateStripeCustomer(userId: string): Promise<string> {
    const { data: user } = await this.supabase
      .from('users')
      .select('stripe_customer_id, email, full_name')
      .eq('id', userId)
      .single();

    if (user?.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    const customer = await this.stripe.customers.create({
      email: user?.email,
      name: user?.full_name,
      metadata: { userId },
    });

    await this.supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    return customer.id;
  }

  private async scheduleTrialEndingReminder(
    subscriptionId: string,
    daysBeforeEnd: number
  ): Promise<void> {
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() + daysBeforeEnd);

    await this.redis.zadd(
      'trial_ending_reminders',
      scheduleDate.getTime(),
      subscriptionId
    );
  }
}

// ============================================================================
// Billing Engine
// ============================================================================

/**
 * Handles billing operations and invoice generation
 */
export class BillingEngine {
  constructor(
    private stripe: Stripe,
    private supabase: SupabaseClient,
    private redis: Redis
  ) {}

  async processBilling(subscription: Subscription): Promise<void> {
    try {
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      // Check if billing is due
      const now = new Date();
      const periodEnd = new Date(stripeSubscription.current_period_end * 1000);

      if (now >= periodEnd && stripeSubscription.status === 'active') {
        await this.createUpcomingInvoice(subscription);
      }
    } catch (error) {
      console.error(`Billing processing error for ${subscription.id}:`, error);
      throw error;
    }
  }

  private async createUpcomingInvoice(subscription: Subscription): Promise<void> {
    try {
      // Create and finalize invoice
      const invoice = await this.stripe.invoices.create({
        customer: subscription.stripeSubscriptionId,
        subscription: subscription.stripeSubscriptionId,
      });

      await this.stripe.invoices.finalizeInvoice(invoice.id);
      
      // Attempt payment
      const paidInvoice = await this.stripe.invoices.pay(invoice.id);

      // Log billing cycle
      await this.supabase.from('billing_cycles').insert({
        subscription_id: subscription.id,
        invoice_id: invoice.id,
        amount: paidInvoice.amount_paid,
        currency: paidInvoice.currency,
        status: paidInvoice.status,
        period_start: new Date(paidInvoice.period_start * 1000),
        period_end: new Date(paidInvoice.period_end * 1000),
      });
    } catch (error) {
      console.error(`Invoice creation failed:`, error);
      throw error;
    }
  }
}

// ============================================================================
// Dunning Manager
// ============================================================================

/**
 * Manages dunning sequences for failed payments
 */
export class DunningManager {
  private dunningStages: Record<DunningStage, { daysDelay: number; emailType: EmailType }> = {
    initial: { daysDelay: 1, emailType: 'payment_failed' },
    reminder_1: { daysDelay: 3, emailType: 'dunning_reminder_1' },
    reminder_2: { daysDelay: 7, emailType: 'dunning_reminder_2' },
    final_notice: { daysDelay: 14, emailType: 'dunning_final_notice' },
    suspended: { daysDelay: 21, emailType: 'payment_failed' },
  };

  constructor(
    private supabase: SupabaseClient,
    private redis: Redis
  ) {}

  async startDunning(subscriptionId: string): Promise<void> {
    try {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 21); // 21-day grace period

      const dunningSequence: DunningSequence = {
        subscriptionId,
        stage: 'initial',
        emailsSent: 0,
        gracePeriodEnd,
      };

      await this.supabase.from('dunning_sequences').insert(dunningSequence);
      await this.scheduleNextEmail(subscriptionId, 'initial');
    } catch (error) {
      console.error(`Failed to start dunning for ${subscriptionId}:`, error);
      throw error;
    }
  }

  async processScheduledEmails(): Promise<void> {
    const now = Date.now();
    const scheduledEmails = await this.redis.zrangebyscore(
      'dunning_emails',
      0,
      now
    );

    for (const subscriptionId of scheduledEmails) {
      await this.processNextDunningStage(subscriptionId);
      await this.redis.zrem('dunning_emails', subscriptionId);
    }
  }

  private async processNextDunningStage(subscriptionId: string): Promise<void> {
    const { data: dunning } = await this.supabase
      .from('dunning_sequences')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .single();

    if (!dunning) return;

    const stages: DunningStage[] = ['initial', 'reminder_1', 'reminder_2', 'final_notice', 'suspended'];
    const currentIndex = stages.indexOf(dunning.stage);
    const nextStage = stages[currentIndex + 1];

    if (nextStage) {
      await this.scheduleNextEmail(subscriptionId, nextStage);
      
      await this.supabase
        .from('dunning_sequences')
        .update({
          stage: nextStage,
          emails_sent: dunning.emails_sent + 1,
          last_email_sent: new Date(),
        })
        .eq('subscription_id', subscriptionId);
    }

    if (nextStage === 'suspended') {
      await this.suspendSubscription(subscriptionId);
    }
  }

  private async scheduleNextEmail(subscriptionId: string, stage: DunningStage): Promise<void> {
    const stageConfig = this.dunningStages[stage];
    const scheduleTime = new Date();
    scheduleTime.setDate(scheduleTime.getDate() + stageConfig.daysDelay);

    await this.redis.zadd('dunning_emails', scheduleTime.getTime(), subscriptionId);
  }

  private async suspendSubscription(subscriptionId: string): Promise<void> {
    // Implement subscription suspension logic
    await this.supabase
      .from('subscriptions')
      .update({ status: 'unpaid' })
      .eq('id', subscriptionId);
  }
}

// ============================================================================
// Payment Retry Handler
// ============================================================================

/**
 * Handles payment retry logic with exponential backoff
 */
export class PaymentRetryHandler {
  private maxRetries = 4;
  private baseDelay = 24; // hours

  constructor(
    private stripe: Stripe,
    private redis: Redis
  ) {}

  async retryPayment(subscriptionId: string, invoiceId: string): Promise<void> {
    const retryKey = `payment_retry:${invoiceId}`;
    const existingRetry = await this.redis.get(retryKey);
    
    const retry: PaymentRetry = existingRetry 
      ? JSON.parse(existingRetry)
      : {
          subscriptionId,
          invoiceId,
          attemptCount: 0,
          maxAttempts: this.maxRetries,
          nextRetry: new Date(),
          backoffMultiplier: 2,
        };

    if (retry.attemptCount >= retry.maxAttempts) {
      throw new Error(`Maximum retry attempts reached for invoice ${invoiceId}`);
    }

    try {
      const invoice = await this.stripe.invoices.pay(invoiceId);
      
      if (invoice.status === 'paid') {
        await this.redis.del(retryKey);
        return;
      }
    } catch (error) {
      retry.attemptCount++;
      retry.lastError = error.message;
      retry.nextRetry = this.calculateNextRetry(retry.attemptCount);
      
      await this.redis.set(retryKey, JSON.stringify(retry));
      await this.redis.zadd(
        'payment_retries',
        retry.nextRetry.getTime(),
        invoiceId
      );
      
      throw error;
    }
  }

  async processScheduledRetries(): Promise<void> {
    const now = Date.now();
    const retries = await this.redis.zrangebyscore('payment_retries', 0, now);

    for (const invoiceId of retries) {
      const retryKey = `payment_retry:${invoiceId}`;
      const retryData = await this.redis.get(retryKey);
      
      if (retryData) {
        const retry: PaymentRetry = JSON.parse(retryData);
        await this.retryPayment(retry.subscriptionId, retry.invoiceId);
      }
      
      await this.redis.zrem('payment_retries', invoiceId);
    }
  }

  private calculateNextRetry(attemptCount: number): Date {
    const delay = this.baseDelay * Math.pow(2, attemptCount - 1);
    const nextRetry = new Date();
    nextRetry.setHours(nextRetry.getHours() + delay);
    return nextRetry;
  }
}

// ============================================================================
// Email Sequence Manager
// ============================================================================

/**
 * Manages automated email sequences for subscription events
 */
export class EmailSequenceManager {
  private emailTemplates: Map<EmailType, EmailTemplate> = new Map();

  constructor(
    private resend: Resend,
    private supabase: SupabaseClient
  ) {
    this.initializeEmailTemplates();
  }

  async sendEmail(
    userId: string,
    emailType: EmailType,
    templateData: Record<string, any>
  ): Promise<void> {
    try {
      const { data: user } = await this.supabase
        .from('users')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (!user?.email) {
        throw new Error(`User email not found for ID: ${userId}`);
      }

      const template = this.emailTemplates.get(emailType);
      if (!template) {
        throw new Error(`Email template not found: ${emailType}`);
      }

      const personalizedContent = this.personalizeContent(
        template,
        { ...templateData, user }
      );

      await this.resend.emails.send({
        from: 'CR AudioViz AI <noreply@craudioviz.ai>',
        to: user.email,
        subject: personalizedContent.subject,
        html: personalizedContent.htmlContent,
        text: personalizedContent.textContent,
      });

      // Log email sent
      await this.supabase.from('email_logs').insert({
        user_id: userId,
        email_type: emailType,
        recipient: user.email,
        sent_at: new Date(),
      });
    } catch (error) {
      console.error(`Failed to send email ${emailType} to user ${userId}:`, error);
      throw error;
    }
  }

  private initializeEmailTemplates(): void {
    this.emailTemplates.set('subscription_created', {
      type: 'subscription_created',
      subject: 'Welcome to CR AudioViz AI! Your subscription is active',
      htmlContent: `
        <h1>Welcome {{user.full_name}}!</h1>
        <p>Your CR AudioViz AI subscription is now active. Start creating amazing audio visualizations!</p>
        <p>Subscription ID: {{subscription.id}}</p>
        <p>Next billing date: {{subscription.currentPeriodEnd}}</p>
      `,
      textContent: `Welcome {{user.full_name}}! Your CR AudioViz AI subscription is now active.`,
    });

    this.emailTemplates.set('payment_failed', {
      type: