import express, { Application, Request, Response, NextFunction } from 'express';
import Bull, { Queue, Job, JobOptions } from 'bull';
import Redis from 'ioredis';
import Stripe from 'stripe';
import axios, { AxiosInstance } from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/node';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { z } from 'zod';

/**
 * @fileoverview Automated Creator Payout Microservice
 * Handles creator payouts with multiple payment methods, tax calculations,
 * compliance reporting, retry logic, and fraud detection.
 */

// ===== INTERFACES & TYPES =====

interface PayoutRequest {
  creatorId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  taxInfo: TaxInfo;
  metadata?: Record<string, any>;
}

interface PaymentMethod {
  type: 'stripe' | 'paypal' | 'wise';
  accountId: string;
  details: StripeAccount | PayPalAccount | WiseAccount;
}

interface StripeAccount {
  accountId: string;
  country: string;
  currency: string;
}

interface PayPalAccount {
  email: string;
  country: string;
}

interface WiseAccount {
  profileId: string;
  accountId: string;
  currency: string;
  country: string;
}

interface TaxInfo {
  country: string;
  taxId?: string;
  withholdingRate: number;
  exemptionStatus: boolean;
  w9Filed: boolean;
}

interface PayoutResult {
  transactionId: string;
  status: PayoutStatus;
  amount: number;
  netAmount: number;
  taxDeducted: number;
  fees: number;
  paymentMethodUsed: string;
  processedAt: Date;
  estimatedDelivery?: Date;
}

interface FraudCheck {
  riskScore: number;
  flags: string[];
  approved: boolean;
  reason?: string;
}

interface ComplianceReport {
  reportId: string;
  period: { start: Date; end: Date };
  totalPayouts: number;
  totalTaxWithheld: number;
  creatorCount: number;
  byCountry: Record<string, { amount: number; tax: number; count: number }>;
  generatedAt: Date;
}

interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'fraud_hold';

// ===== VALIDATION SCHEMAS =====

const PayoutRequestSchema = z.object({
  creatorId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  paymentMethod: z.object({
    type: z.enum(['stripe', 'paypal', 'wise']),
    accountId: z.string(),
    details: z.record(z.any())
  }),
  taxInfo: z.object({
    country: z.string().length(2),
    taxId: z.string().optional(),
    withholdingRate: z.number().min(0).max(1),
    exemptionStatus: z.boolean(),
    w9Filed: z.boolean()
  }),
  metadata: z.record(z.any()).optional()
});

// ===== ERROR CLASSES =====

class PayoutError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'PayoutError';
  }
}

class FraudDetectionError extends PayoutError {
  constructor(message: string, public riskScore: number) {
    super(message, 'FRAUD_DETECTED', 403, false);
  }
}

class PaymentProviderError extends PayoutError {
  constructor(message: string, public provider: string, retryable: boolean = true) {
    super(message, 'PAYMENT_PROVIDER_ERROR', 502, retryable);
  }
}

// ===== PAYMENT METHOD ADAPTERS =====

/**
 * Abstract base class for payment method adapters
 */
abstract class PaymentMethodAdapter {
  abstract processPayout(request: PayoutRequest): Promise<PayoutResult>;
  abstract validateAccount(accountDetails: any): Promise<boolean>;
  abstract getEstimatedDelivery(country: string, currency: string): Promise<Date>;
}

/**
 * Stripe Connect adapter for creator payouts
 */
class StripeAdapter extends PaymentMethodAdapter {
  private stripe: Stripe;

  constructor(secretKey: string) {
    super();
    this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  }

  async processPayout(request: PayoutRequest): Promise<PayoutResult> {
    try {
      const account = request.paymentMethod.details as StripeAccount;
      
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(request.amount * 100), // Convert to cents
        currency: request.currency.toLowerCase(),
        destination: account.accountId,
        metadata: {
          creatorId: request.creatorId,
          ...request.metadata
        }
      });

      return {
        transactionId: transfer.id,
        status: 'completed',
        amount: request.amount,
        netAmount: request.amount,
        taxDeducted: 0,
        fees: 0,
        paymentMethodUsed: 'stripe',
        processedAt: new Date(),
        estimatedDelivery: await this.getEstimatedDelivery(account.country, request.currency)
      };
    } catch (error: any) {
      throw new PaymentProviderError(
        `Stripe payout failed: ${error.message}`,
        'stripe',
        error.type === 'StripeConnectionError'
      );
    }
  }

  async validateAccount(accountDetails: StripeAccount): Promise<boolean> {
    try {
      const account = await this.stripe.accounts.retrieve(accountDetails.accountId);
      return account.charges_enabled && account.payouts_enabled;
    } catch (error) {
      return false;
    }
  }

  async getEstimatedDelivery(country: string, currency: string): Promise<Date> {
    const deliveryDays = this.getDeliveryDays(country);
    const delivery = new Date();
    delivery.setDate(delivery.getDate() + deliveryDays);
    return delivery;
  }

  private getDeliveryDays(country: string): number {
    const deliveryMap: Record<string, number> = {
      'US': 1,
      'GB': 1,
      'CA': 2,
      'AU': 2,
      'DE': 1,
      'FR': 1,
      'ES': 1,
      'IT': 1,
      'NL': 1
    };
    return deliveryMap[country] || 3;
  }
}

/**
 * PayPal Payouts adapter for creator payments
 */
class PayPalAdapter extends PaymentMethodAdapter {
  private client: AxiosInstance;

  constructor(clientId: string, clientSecret: string, sandbox: boolean = false) {
    super();
    const baseURL = sandbox 
      ? 'https://api.sandbox.paypal.com'
      : 'https://api.paypal.com';
    
    this.client = axios.create({ baseURL });
  }

  async processPayout(request: PayoutRequest): Promise<PayoutResult> {
    try {
      const accessToken = await this.getAccessToken();
      const account = request.paymentMethod.details as PayPalAccount;

      const payoutResponse = await this.client.post('/v1/payments/payouts', {
        sender_batch_header: {
          sender_batch_id: `payout_${Date.now()}_${request.creatorId}`,
          email_subject: 'You have a payout!',
          email_message: 'You have received a payout from CR AudioViz AI!'
        },
        items: [{
          recipient_type: 'EMAIL',
          amount: {
            value: request.amount.toFixed(2),
            currency: request.currency
          },
          receiver: account.email,
          note: `Payout for creator ${request.creatorId}`,
          sender_item_id: `item_${Date.now()}`
        }]
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const batchId = payoutResponse.data.batch_header.payout_batch_id;

      return {
        transactionId: batchId,
        status: 'processing',
        amount: request.amount,
        netAmount: request.amount,
        taxDeducted: 0,
        fees: 0,
        paymentMethodUsed: 'paypal',
        processedAt: new Date(),
        estimatedDelivery: await this.getEstimatedDelivery(account.country, request.currency)
      };
    } catch (error: any) {
      throw new PaymentProviderError(
        `PayPal payout failed: ${error.response?.data?.message || error.message}`,
        'paypal',
        error.response?.status >= 500
      );
    }
  }

  async validateAccount(accountDetails: PayPalAccount): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(accountDetails.email);
  }

  async getEstimatedDelivery(country: string, currency: string): Promise<Date> {
    const delivery = new Date();
    delivery.setDate(delivery.getDate() + 1); // PayPal is typically 1 business day
    return delivery;
  }

  private async getAccessToken(): Promise<string> {
    const response = await this.client.post('/v1/oauth2/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        auth: {
          username: process.env.PAYPAL_CLIENT_ID!,
          password: process.env.PAYPAL_CLIENT_SECRET!
        }
      }
    );
    return response.data.access_token;
  }
}

/**
 * Wise (formerly TransferWise) adapter for international payouts
 */
class WiseAdapter extends PaymentMethodAdapter {
  private client: AxiosInstance;

  constructor(apiToken: string, sandbox: boolean = false) {
    super();
    const baseURL = sandbox 
      ? 'https://api.sandbox.transferwise.tech'
      : 'https://api.transferwise.tech';
    
    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async processPayout(request: PayoutRequest): Promise<PayoutResult> {
    try {
      const account = request.paymentMethod.details as WiseAccount;
      
      // Create quote
      const quote = await this.client.post('/v1/quotes', {
        profile: account.profileId,
        source: request.currency,
        target: account.currency,
        sourceAmount: request.amount
      });

      // Create transfer
      const transfer = await this.client.post('/v1/transfers', {
        targetAccount: account.accountId,
        quote: quote.data.id,
        customerTransactionId: `${request.creatorId}_${Date.now()}`
      });

      // Fund transfer
      await this.client.post(`/v1/transfers/${transfer.data.id}/payments`, {
        type: 'BALANCE'
      });

      return {
        transactionId: transfer.data.id,
        status: 'processing',
        amount: request.amount,
        netAmount: quote.data.targetAmount,
        taxDeducted: 0,
        fees: quote.data.fee,
        paymentMethodUsed: 'wise',
        processedAt: new Date(),
        estimatedDelivery: await this.getEstimatedDelivery(account.country, account.currency)
      };
    } catch (error: any) {
      throw new PaymentProviderError(
        `Wise payout failed: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        'wise',
        error.response?.status >= 500
      );
    }
  }

  async validateAccount(accountDetails: WiseAccount): Promise<boolean> {
    try {
      const response = await this.client.get(`/v1/accounts/${accountDetails.accountId}`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getEstimatedDelivery(country: string, currency: string): Promise<Date> {
    const deliveryDays = this.getDeliveryDays(country);
    const delivery = new Date();
    delivery.setDate(delivery.getDate() + deliveryDays);
    return delivery;
  }

  private getDeliveryDays(country: string): number {
    const deliveryMap: Record<string, number> = {
      'GB': 0, // Same day for GBP
      'EUR': 1, // Next day for EUR
      'US': 1,
      'CA': 1,
      'AU': 1
    };
    return deliveryMap[country] || 2;
  }
}

// ===== TAX CALCULATION ENGINE =====

/**
 * Handles tax calculations and withholdings for creator payouts
 */
class TaxCalculationEngine {
  private taxJarClient: AxiosInstance;

  constructor(apiToken: string) {
    this.taxJarClient = axios.create({
      baseURL: 'https://api.taxjar.com/v2',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Calculate tax withholding for a payout
   */
  async calculateTaxWithholding(
    amount: number,
    taxInfo: TaxInfo,
    creatorCountry: string
  ): Promise<{ taxAmount: number; netAmount: number; taxRate: number }> {
    try {
      if (taxInfo.exemptionStatus) {
        return { taxAmount: 0, netAmount: amount, taxRate: 0 };
      }

      const taxRate = await this.getTaxRate(creatorCountry, taxInfo);
      const taxAmount = amount * taxRate;
      const netAmount = amount - taxAmount;

      return { taxAmount, netAmount, taxRate };
    } catch (error: any) {
      console.error('Tax calculation error:', error);
      // Fallback to configured withholding rate
      const taxAmount = amount * taxInfo.withholdingRate;
      return {
        taxAmount,
        netAmount: amount - taxAmount,
        taxRate: taxInfo.withholdingRate
      };
    }
  }

  /**
   * Get applicable tax rate for creator
   */
  private async getTaxRate(country: string, taxInfo: TaxInfo): Promise<number> {
    // US creators
    if (country === 'US') {
      if (taxInfo.w9Filed) {
        return 0; // No withholding for US creators with W-9
      }
      return 0.24; // Backup withholding rate
    }

    // International creators
    const treatyRates: Record<string, number> = {
      'GB': 0.0,  // No withholding under treaty
      'CA': 0.05, // 5% under treaty
      'AU': 0.05,
      'DE': 0.05,
      'FR': 0.05,
      'JP': 0.05,
      'KR': 0.10
    };

    return treatyRates[country] || 0.30; // Default 30% for non-treaty countries
  }

  /**
   * Generate tax documents for compliance
   */
  async generateTaxDocument(
    creatorId: string,
    year: number,
    totalPayouts: number,
    totalTaxWithheld: number
  ): Promise<{ documentType: string; data: Record<string, any> }> {
    const isUS = await this.isUSCreator(creatorId);
    
    if (isUS) {
      return {
        documentType: '1099-NEC',
        data: {
          year,
          payerTin: process.env.COMPANY_TIN,
          recipientTin: await this.getCreatorTIN(creatorId),
          nonemployeeCompensation: totalPayouts,
          federalIncomeTaxWithheld: totalTaxWithheld
        }
      };
    } else {
      return {
        documentType: '1042-S',
        data: {
          year,
          incomeCode: '06', // Royalties
          grossIncome: totalPayouts,
          taxWithheld: totalTaxWithheld,
          recipientCountry: await this.getCreatorCountry(creatorId)
        }
      };
    }
  }

  private async isUSCreator(creatorId: string): Promise<boolean> {
    // Implementation would check creator's country in database
    return false; // Placeholder
  }

  private async getCreatorTIN(creatorId: string): Promise<string> {
    // Implementation would fetch creator's TIN from database
    return ''; // Placeholder
  }

  private async getCreatorCountry(creatorId: string): Promise<string> {
    // Implementation would fetch creator's country from database
    return ''; // Placeholder
  }
}

// ===== FRAUD DETECTION SYSTEM =====

/**
 * ML-based fraud detection for creator payouts
 */
class FraudDetector {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * Analyze payout request for fraud indicators
   */
  async analyzePayout(request: PayoutRequest, creatorHistory: any[]): Promise<FraudCheck> {
    const flags: string[] = [];
    let riskScore = 0;

    // Check payout amount patterns
    const amountRisk = this.analyzeAmountPattern(request.amount, creatorHistory);
    riskScore += amountRisk.score;
    flags.push(...amountRisk.flags);

    // Check frequency patterns
    const frequencyRisk = await this.analyzeFrequencyPattern(request.creatorId);
    riskScore += frequencyRisk.score;
    flags.push(...frequencyRisk.flags);

    // Check payment method changes
    const paymentMethodRisk = await this.analyzePaymentMethodChanges(
      request.creatorId, 
      request.paymentMethod
    );
    riskScore += paymentMethodRisk.score;
    flags.push(...paymentMethodRisk.flags);

    // Check geographic anomalies
    const geoRisk = this.analyzeGeographicAnomaly(request, creatorHistory);
    riskScore += geoRisk.score;
    flags.push(...geoRisk.flags);

    const approved = riskScore < 70; // Threshold for approval

    return {
      riskScore,
      flags: flags.filter(Boolean),
      approved,
      reason: approved ? undefined : 'High risk score detected'
    };
  }

  private analyzeAmountPattern(
    amount: number, 
    history: any[]
  ): { score: number; flags: string[] } {
    if (history.length === 0) return { score: 10, flags: ['NEW_CREATOR'] };

    const avgAmount = history.reduce((sum, h) => sum + h.amount, 0) / history.length;
    const ratio = amount / avgAmount;

    const flags: string[] = [];
    let score = 0;

    if (ratio > 5) {
      flags.push('UNUSUAL_AMOUNT_SPIKE');
      score += 30;
    } else if (ratio > 2) {
      flags.push('MODERATE_AMOUNT_INCREASE');
      score += 15;
    }

    if (amount > 50000) {
      flags.push('HIGH_VALUE_PAYOUT');
      score += 20;
    }

    return { score, flags };
  }

  private async analyzeFrequencyPattern(
    creatorId: string
  ): Promise<{ score: number; flags: string[] }> {
    const key = `payout_frequency:${creatorId}`;
    const recentPayouts = await this.redis.llen(key);
    
    const flags: string[] = [];
    let score = 0;

    if (recentPayouts > 10) {
      flags.push('HIGH_FREQUENCY_PAYOUTS');
      score += 25;
    }

    return { score, flags };
  }

  private async analyzePaymentMethodChanges(
    creatorId: string,
    currentMethod: PaymentMethod
  ): Promise<{ score: number; flags: string[] }> {
    const key = `payment_methods:${creatorId}`;
    const methodHistory = await this.redis.lrange(key, 0, -1);
    
    const flags: string[] = [];
    let score = 0;

    if (methodHistory.length > 0) {
      const lastMethod = JSON.parse(methodHistory[0]);
      if (lastMethod.type !== currentMethod.type) {
        flags.push('PAYMENT_METHOD_CHANGED');
        score += 15;
      }
      
      if (methodHistory.length > 3) {
        flags.push('FREQUENT_METHOD_CHANGES');
        score += 20;
      }
    }

    // Store current method
    await this.redis.lpush(key, JSON.stringify(currentMethod));
    await this.redis.ltrim(key, 0, 9); // Keep last 10
    await this.redis.expire(key, 86400 * 30); // 30 days

    return { score, flags };
  }

  private analyzeGeographicAnomaly(
    request: PayoutRequest,
    history: any[]
  ): { score: number; flags: string[] } {
    // This would typically check for VPN usage, unusual location changes, etc.
    // Placeholder implementation
    return { score: 0, flags: [] };
  }
}

// ===== RETRY HANDLER =====

/**
 * Handles failed payout retries with exponential backoff
 */
class RetryHandler {
  private queue: Queue;
  private config: RetryConfig;

  constructor(redis: Redis, config: RetryConfig) {
    this.queue = new Bull('payout-retry', { redis });
    this.config = config;
  }

  /**
   * Add failed payout to retry queue
   */
  async scheduleRetry(
    payoutRequest: PayoutRequest,
    error: PayoutError,
    attempt: number
  ): Promise