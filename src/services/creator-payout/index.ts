import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import Redis from 'ioredis';
import { Queue, Worker, Job } from 'bullmq';
import { createHash, randomUUID } from 'crypto';
import { EventEmitter } from 'events';

/**
 * Creator Payout Service
 * 
 * Automated creator payout service that processes revenue sharing agreements,
 * handles multi-currency payments, manages scheduling, and implements fraud detection
 */

// Core Types and Interfaces
export interface PayoutRequest {
  creatorId: string;
  amount: number;
  currency: string;
  type: 'revenue_share' | 'bonus' | 'milestone';
  metadata?: Record<string, any>;
}

export interface RevenueShare {
  id: string;
  creatorId: string;
  agreementId: string;
  percentage: number;
  minThreshold: number;
  maxAmount?: number;
  currency: string;
  isActive: boolean;
  validFrom: Date;
  validTo?: Date;
}

export interface PayoutRecord {
  id: string;
  creatorId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduledAt: Date;
  processedAt?: Date;
  paymentId?: string;
  failureReason?: string;
  fraudScore?: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutSchedule {
  id: string;
  creatorId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek?: number;
  dayOfMonth?: number;
  customCron?: string;
  minAmount: number;
  currency: string;
  isActive: boolean;
}

export interface FraudAlert {
  id: string;
  creatorId: string;
  payoutId: string;
  alertType: 'velocity' | 'amount' | 'pattern' | 'geographic';
  riskScore: number;
  details: Record<string, any>;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
}

export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
}

// Configuration Interface
export interface CreatorPayoutConfig {
  supabaseUrl: string;
  supabaseKey: string;
  stripeSecretKey: string;
  wiseApiKey: string;
  redisUrl: string;
  maxPayoutAmount: number;
  minPayoutAmount: number;
  fraudThreshold: number;
  retryAttempts: number;
  batchSize: number;
}

/**
 * Revenue Calculator Service
 * Calculates creator payouts based on revenue sharing agreements
 */
class RevenueCalculator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calculate payout amount based on revenue and agreements
   */
  async calculatePayout(
    creatorId: string,
    revenue: number,
    currency: string = 'USD'
  ): Promise<{ amount: number; agreementId: string } | null> {
    try {
      const { data: agreement, error } = await this.supabase
        .from('revenue_shares')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('currency', currency)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString())
        .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString()}`)
        .single();

      if (error || !agreement) return null;

      const amount = revenue * (agreement.percentage / 100);

      // Check minimum threshold
      if (amount < agreement.min_threshold) return null;

      // Check maximum amount
      if (agreement.max_amount && amount > agreement.max_amount) {
        return { amount: agreement.max_amount, agreementId: agreement.id };
      }

      return { amount, agreementId: agreement.id };
    } catch (error) {
      console.error('Revenue calculation error:', error);
      return null;
    }
  }

  /**
   * Get pending revenue for creator
   */
  async getPendingRevenue(creatorId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_pending_creator_revenue', { creator_id: creatorId });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Get pending revenue error:', error);
      return 0;
    }
  }
}

/**
 * Currency Converter Service
 * Handles multi-currency conversion using Wise API
 */
class CurrencyConverter {
  private rates: Map<string, CurrencyRate> = new Map();
  private wiseApiKey: string;

  constructor(wiseApiKey: string) {
    this.wiseApiKey = wiseApiKey;
  }

  /**
   * Convert amount between currencies
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) return amount;

    const rate = await this.getRate(fromCurrency, toCurrency);
    return amount * rate.rate;
  }

  /**
   * Get exchange rate
   */
  private async getRate(from: string, to: string): Promise<CurrencyRate> {
    const key = `${from}-${to}`;
    const cached = this.rates.get(key);

    if (cached && Date.now() - cached.timestamp.getTime() < 300000) { // 5 minutes
      return cached;
    }

    try {
      const response = await fetch(
        `https://api.wise.com/v1/rates?source=${from}&target=${to}`,
        {
          headers: {
            'Authorization': `Bearer ${this.wiseApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      const rate: CurrencyRate = {
        from,
        to,
        rate: data.rate,
        timestamp: new Date()
      };

      this.rates.set(key, rate);
      return rate;
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error(`Failed to get exchange rate for ${from} to ${to}`);
    }
  }
}

/**
 * Fraud Detection Service
 * Implements fraud detection and prevention mechanisms
 */
class FraudDetector {
  constructor(
    private supabase: SupabaseClient,
    private redis: Redis,
    private threshold: number = 80
  ) {}

  /**
   * Analyze payout for fraud indicators
   */
  async analyzePayout(payout: PayoutRequest, creatorId: string): Promise<{
    riskScore: number;
    alerts: string[];
    shouldBlock: boolean;
  }> {
    const checks = await Promise.all([
      this.checkVelocity(creatorId),
      this.checkAmountPattern(creatorId, payout.amount),
      this.checkGeographicRisk(creatorId),
      this.checkAccountAge(creatorId)
    ]);

    const riskScore = checks.reduce((sum, check) => sum + check.score, 0);
    const alerts = checks.flatMap(check => check.alerts);

    return {
      riskScore,
      alerts,
      shouldBlock: riskScore >= this.threshold
    };
  }

  /**
   * Check payout velocity (frequency and amount)
   */
  private async checkVelocity(creatorId: string): Promise<{
    score: number;
    alerts: string[];
  }> {
    const key = `payout_velocity:${creatorId}`;
    const velocity = await this.redis.get(key);
    
    if (!velocity) return { score: 0, alerts: [] };

    const data = JSON.parse(velocity);
    const score = Math.min((data.count * 10) + (data.amount / 1000), 50);

    return {
      score,
      alerts: score > 30 ? ['High payout velocity detected'] : []
    };
  }

  /**
   * Check for unusual amount patterns
   */
  private async checkAmountPattern(creatorId: string, amount: number): Promise<{
    score: number;
    alerts: string[];
  }> {
    try {
      const { data: recentPayouts } = await this.supabase
        .from('creator_payouts')
        .select('amount')
        .eq('creator_id', creatorId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (!recentPayouts || recentPayouts.length === 0) return { score: 0, alerts: [] };

      const avgAmount = recentPayouts.reduce((sum, p) => sum + p.amount, 0) / recentPayouts.length;
      const deviation = Math.abs(amount - avgAmount) / avgAmount;

      const score = Math.min(deviation * 30, 40);
      const alerts = deviation > 2 ? ['Unusual payout amount pattern'] : [];

      return { score, alerts };
    } catch (error) {
      console.error('Amount pattern check error:', error);
      return { score: 0, alerts: [] };
    }
  }

  /**
   * Check geographic risk factors
   */
  private async checkGeographicRisk(creatorId: string): Promise<{
    score: number;
    alerts: string[];
  }> {
    // Implementation would check creator's location against high-risk countries
    // For now, return minimal risk
    return { score: 0, alerts: [] };
  }

  /**
   * Check account age and history
   */
  private async checkAccountAge(creatorId: string): Promise<{
    score: number;
    alerts: string[];
  }> {
    try {
      const { data: creator } = await this.supabase
        .from('creators')
        .select('created_at')
        .eq('id', creatorId)
        .single();

      if (!creator) return { score: 20, alerts: ['Creator not found'] };

      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(creator.created_at).getTime()) / (24 * 60 * 60 * 1000)
      );

      const score = daysSinceCreation < 30 ? 20 : 0;
      const alerts = score > 0 ? ['New account - higher risk'] : [];

      return { score, alerts };
    } catch (error) {
      console.error('Account age check error:', error);
      return { score: 10, alerts: ['Unable to verify account age'] };
    }
  }

  /**
   * Log fraud alert
   */
  async logAlert(
    creatorId: string,
    payoutId: string,
    alertType: string,
    riskScore: number,
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('fraud_logs')
        .insert({
          id: randomUUID(),
          creator_id: creatorId,
          payout_id: payoutId,
          alert_type: alertType,
          risk_score: riskScore,
          details,
          status: 'pending',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log fraud alert:', error);
    }
  }
}

/**
 * Payment Gateway Service
 * Handles integration with payment providers (Stripe, Wise)
 */
class PaymentGateway {
  private stripe: Stripe;

  constructor(stripeSecretKey: string, private wiseApiKey: string) {
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    });
  }

  /**
   * Process payout via Stripe Connect
   */
  async processStripePayout(
    creatorId: string,
    amount: number,
    currency: string,
    metadata: Record<string, any>
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      // Get creator's Stripe account ID
      const stripeAccountId = await this.getCreatorStripeAccount(creatorId);
      if (!stripeAccountId) {
        return { success: false, error: 'Creator Stripe account not found' };
      }

      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        destination: stripeAccountId,
        metadata
      });

      return {
        success: true,
        paymentId: transfer.id
      };
    } catch (error) {
      console.error('Stripe payout error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process international payout via Wise
   */
  async processWisePayout(
    creatorId: string,
    amount: number,
    currency: string,
    metadata: Record<string, any>
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      // Implementation for Wise API integration
      // This would require creator's banking details and Wise recipient setup
      const response = await fetch('https://api.wise.com/v1/transfers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.wiseApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetAccount: await this.getCreatorWiseAccount(creatorId),
          amount,
          currency,
          reference: `Payout-${creatorId}-${Date.now()}`,
          metadata
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message };
      }

      return {
        success: true,
        paymentId: data.id
      };
    } catch (error) {
      console.error('Wise payout error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async getCreatorStripeAccount(creatorId: string): Promise<string | null> {
    // Implementation to get creator's Stripe Connect account ID
    return null;
  }

  private async getCreatorWiseAccount(creatorId: string): Promise<string | null> {
    // Implementation to get creator's Wise recipient ID
    return null;
  }
}

/**
 * Payout Scheduler Service
 * Manages automated payout scheduling
 */
class PayoutScheduler {
  constructor(private supabase: SupabaseClient, private redis: Redis) {}

  /**
   * Create payout schedule for creator
   */
  async createSchedule(schedule: Omit<PayoutSchedule, 'id'>): Promise<string> {
    const id = randomUUID();
    
    try {
      await this.supabase
        .from('payout_schedules')
        .insert({
          ...schedule,
          id,
          created_at: new Date().toISOString()
        });

      // Schedule in Redis for processing
      await this.scheduleNextPayout(id, schedule);

      return id;
    } catch (error) {
      console.error('Create schedule error:', error);
      throw new Error('Failed to create payout schedule');
    }
  }

  /**
   * Get due payouts
   */
  async getDuePayouts(): Promise<PayoutSchedule[]> {
    try {
      const { data, error } = await this.supabase
        .from('payout_schedules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      const now = new Date();
      return (data || []).filter(schedule => this.isScheduleDue(schedule, now));
    } catch (error) {
      console.error('Get due payouts error:', error);
      return [];
    }
  }

  private async scheduleNextPayout(scheduleId: string, schedule: PayoutSchedule): Promise<void> {
    const nextRun = this.calculateNextRun(schedule);
    const key = `schedule:${scheduleId}`;
    
    await this.redis.zadd('payout_schedules', nextRun.getTime(), key);
  }

  private calculateNextRun(schedule: PayoutSchedule): Date {
    const now = new Date();
    
    switch (schedule.frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        if (schedule.dayOfWeek !== undefined) {
          nextWeek.setDate(nextWeek.getDate() + (schedule.dayOfWeek - nextWeek.getDay()));
        }
        return nextWeek;
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(now.getMonth() + 1);
        if (schedule.dayOfMonth) {
          nextMonth.setDate(schedule.dayOfMonth);
        }
        return nextMonth;
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private isScheduleDue(schedule: PayoutSchedule, now: Date): boolean {
    // Implementation to check if schedule is due for execution
    return true; // Simplified for demo
  }
}

/**
 * Payout Queue Service
 * Manages payout processing queue with Bull
 */
class PayoutQueue {
  private queue: Queue;
  private worker: Worker;

  constructor(
    redisConnection: Redis,
    private processor: (job: Job) => Promise<any>
  ) {
    this.queue = new Queue('creator-payouts', {
      connection: redisConnection
    });

    this.worker = new Worker('creator-payouts', this.processor, {
      connection: redisConnection,
      concurrency: 5
    });
  }

  /**
   * Add payout to queue
   */
  async addPayout(
    payoutData: PayoutRequest & { payoutId: string },
    priority: number = 0,
    delay?: number
  ): Promise<Job> {
    return await this.queue.add(
      'process-payout',
      payoutData,
      {
        priority,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}

/**
 * Notification Service
 * Handles payout status notifications
 */
class NotificationService extends EventEmitter {
  constructor(private supabase: SupabaseClient) {
    super();
  }

  /**
   * Send payout notification
   */
  async sendNotification(
    type: 'success' | 'failed' | 'pending',
    creatorId: string,
    payoutData: Partial<PayoutRecord>
  ): Promise<void> {
    try {
      // Get creator's notification preferences
      const { data: creator } = await this.supabase
        .from('creators')
        .select('email, notification_preferences')
        .eq('id', creatorId)
        .single();

      if (!creator) return;

      const message = this.formatNotificationMessage(type, payoutData);
      
      // Emit event for external notification handlers
      this.emit('notification', {
        type,
        creatorId,
        email: creator.email,
        message,
        payoutData
      });

      // Log notification
      await this.supabase
        .from('notification_logs')
        .insert({
          id: randomUUID(),
          creator_id: creatorId,
          type: 'payout',
          status: type,
          message,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Notification error:', error);
    }
  }

  private formatNotificationMessage(
    type: 'success' | 'failed' | 'pending',
    payoutData: Partial<PayoutRecord>
  ): string {
    switch (type) {
      case 'success':
        return `Your payout of ${payoutData.amount} ${payoutData.currency} has been processed successfully.`;
      case 'failed':
        return `Your payout of ${payoutData.amount} ${payoutData.currency} failed: ${payoutData.failureReason}`;
      case 'pending':
        return `Your payout of ${payoutData.amount} ${payoutData.currency} is being processed.`;
      default:
        return 'Payout status update';
    }
  }
}

/**
 * Audit Logger Service
 * Comprehensive audit trail for all payout operations
 */
class AuditLogger {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Log payout operation
   */
  async logOperation(
    operation: string,
    creatorId: string,
    payoutId: string,
    details: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('payout_audit_log')
        .insert({
          id: randomUUID(),
          operation,
          creator_id: creatorId,
          payout_id: payoutId,
          user_id: userId,
          details,
          ip_address: details.ipAddress,
          user_agent: details.userAgent,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Audit log error:', error);
    }
  }

  /**
   * Get audit trail for payout
   */
  async getAuditTrail(payoutId: string): Promise<any[]> {
    try {