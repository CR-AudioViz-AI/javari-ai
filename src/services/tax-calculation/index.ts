```typescript
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';
import axios, { AxiosInstance } from 'axios';

/**
 * Tax Calculation Microservice
 * 
 * Provides automated tax calculation across multiple jurisdictions with:
 * - Real-time rate updates
 * - Exemption handling
 * - Compliance reporting
 * - Multi-jurisdiction support
 * 
 * @author CR AudioViz AI
 * @version 1.0.0
 */

// Validation Schemas
const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  productType: z.enum(['digital', 'physical', 'service']),
  customerLocation: z.object({
    country: z.string().length(2),
    state: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
  }),
  businessLocation: z.object({
    country: z.string().length(2),
    state: z.string().optional(),
  }),
  exemptionId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const TaxRateSchema = z.object({
  jurisdiction: z.string(),
  rate: z.number().min(0).max(1),
  type: z.enum(['sales', 'vat', 'gst', 'use']),
  effectiveDate: z.date(),
  expiryDate: z.date().optional(),
});

const ExemptionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  type: z.enum(['resale', 'nonprofit', 'government', 'manufacturing']),
  jurisdiction: z.string(),
  certificateNumber: z.string(),
  validUntil: z.date(),
  status: z.enum(['active', 'expired', 'revoked']),
});

// Types
type Transaction = z.infer<typeof TransactionSchema>;
type TaxRate = z.infer<typeof TaxRateSchema>;
type Exemption = z.infer<typeof ExemptionSchema>;

interface TaxCalculationResult {
  transactionId: string;
  totalTax: number;
  breakdown: Array<{
    jurisdiction: string;
    type: string;
    rate: number;
    taxableAmount: number;
    taxAmount: number;
    exemptionApplied: boolean;
  }>;
  exemptions: string[];
  calculatedAt: Date;
  ruleVersion: string;
}

interface JurisdictionRule {
  id: string;
  jurisdiction: string;
  productTypes: string[];
  thresholds: {
    amount?: number;
    transactions?: number;
  };
  nexusRules: {
    physical: boolean;
    economic: boolean;
    marketplace: boolean;
  };
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: Date | null;
  state: 'closed' | 'open' | 'half-open';
}

interface ComplianceReport {
  period: {
    start: Date;
    end: Date;
  };
  jurisdiction: string;
  totalTransactions: number;
  totalTaxCollected: number;
  exemptTransactions: number;
  breakdown: Array<{
    taxType: string;
    count: number;
    amount: number;
  }>;
}

/**
 * Tax Rate Update Service
 * Handles real-time rate updates from external sources
 */
class RateUpdateService {
  private redis: Redis;
  private supabase: ReturnType<typeof createClient>;
  private updateQueue: Map<string, TaxRate> = new Map();

  constructor(redis: Redis, supabase: ReturnType<typeof createClient>) {
    this.redis = redis;
    this.supabase = supabase;
  }

  /**
   * Process incoming rate update webhook
   */
  async processRateUpdate(update: TaxRate): Promise<void> {
    try {
      // Validate update
      const validatedUpdate = TaxRateSchema.parse(update);
      
      // Store in database
      const { error } = await this.supabase
        .from('tax_rates')
        .upsert({
          jurisdiction: validatedUpdate.jurisdiction,
          rate: validatedUpdate.rate,
          type: validatedUpdate.type,
          effective_date: validatedUpdate.effectiveDate,
          expiry_date: validatedUpdate.expiryDate,
          updated_at: new Date(),
        });

      if (error) throw error;

      // Update cache
      const cacheKey = `tax_rate:${validatedUpdate.jurisdiction}:${validatedUpdate.type}`;
      await this.redis.setex(cacheKey, 300, JSON.stringify(validatedUpdate));

      // Log update
      await this.logRateUpdate(validatedUpdate);

    } catch (error) {
      console.error('Rate update failed:', error);
      throw new Error(`Failed to process rate update: ${error}`);
    }
  }

  /**
   * Get current tax rate with caching
   */
  async getTaxRate(jurisdiction: string, type: string): Promise<TaxRate | null> {
    try {
      // Check cache first
      const cacheKey = `tax_rate:${jurisdiction}:${type}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Fallback to database
      const { data, error } = await this.supabase
        .from('tax_rates')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .eq('type', type)
        .lte('effective_date', new Date().toISOString())
        .gte('expiry_date', new Date().toISOString())
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      const rate: TaxRate = {
        jurisdiction: data.jurisdiction,
        rate: data.rate,
        type: data.type as TaxRate['type'],
        effectiveDate: new Date(data.effective_date),
        expiryDate: data.expiry_date ? new Date(data.expiry_date) : undefined,
      };

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(rate));

      return rate;
    } catch (error) {
      console.error('Failed to get tax rate:', error);
      return null;
    }
  }

  private async logRateUpdate(update: TaxRate): Promise<void> {
    await this.supabase
      .from('tax_audit_logs')
      .insert({
        event_type: 'rate_update',
        jurisdiction: update.jurisdiction,
        details: update,
        timestamp: new Date(),
      });
  }
}

/**
 * Exemption Handler
 * Manages tax exemptions and certificate validation
 */
class ExemptionHandler {
  private supabase: ReturnType<typeof createClient>;
  private redis: Redis;

  constructor(redis: Redis, supabase: ReturnType<typeof createClient>) {
    this.redis = redis;
    this.supabase = supabase;
  }

  /**
   * Validate exemption for transaction
   */
  async validateExemption(exemptionId: string, transaction: Transaction): Promise<boolean> {
    try {
      const exemption = await this.getExemption(exemptionId);
      
      if (!exemption) return false;
      
      if (exemption.status !== 'active') return false;
      
      if (exemption.validUntil < new Date()) return false;
      
      // Check jurisdiction match
      const customerJurisdiction = this.buildJurisdiction(transaction.customerLocation);
      if (exemption.jurisdiction !== customerJurisdiction) return false;

      return true;
    } catch (error) {
      console.error('Exemption validation failed:', error);
      return false;
    }
  }

  /**
   * Get exemption with caching
   */
  async getExemption(exemptionId: string): Promise<Exemption | null> {
    try {
      const cacheKey = `exemption:${exemptionId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await this.supabase
        .from('tax_exemptions')
        .select('*')
        .eq('id', exemptionId)
        .single();

      if (error || !data) return null;

      const exemption: Exemption = {
        id: data.id,
        customerId: data.customer_id,
        type: data.type,
        jurisdiction: data.jurisdiction,
        certificateNumber: data.certificate_number,
        validUntil: new Date(data.valid_until),
        status: data.status,
      };

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(exemption));

      return exemption;
    } catch (error) {
      console.error('Failed to get exemption:', error);
      return null;
    }
  }

  private buildJurisdiction(location: Transaction['customerLocation']): string {
    if (location.state) {
      return `${location.country}-${location.state}`;
    }
    return location.country;
  }
}

/**
 * Jurisdiction Manager
 * Handles jurisdiction detection and nexus rules
 */
class JurisdictionManager {
  private supabase: ReturnType<typeof createClient>;
  private redis: Redis;

  constructor(redis: Redis, supabase: ReturnType<typeof createClient>) {
    this.redis = redis;
    this.supabase = supabase;
  }

  /**
   * Determine applicable jurisdictions for transaction
   */
  async getApplicableJurisdictions(transaction: Transaction): Promise<string[]> {
    try {
      const customerJurisdiction = this.buildJurisdiction(transaction.customerLocation);
      const businessJurisdiction = this.buildJurisdiction(transaction.businessLocation);

      const jurisdictions = new Set<string>();
      
      // Always include customer jurisdiction
      jurisdictions.add(customerJurisdiction);

      // Check nexus rules
      const rules = await this.getJurisdictionRules(customerJurisdiction);
      
      if (rules && await this.hasNexus(rules, transaction)) {
        jurisdictions.add(customerJurisdiction);
      }

      // Include business jurisdiction if different and has nexus
      if (businessJurisdiction !== customerJurisdiction) {
        const businessRules = await this.getJurisdictionRules(businessJurisdiction);
        if (businessRules && await this.hasNexus(businessRules, transaction)) {
          jurisdictions.add(businessJurisdiction);
        }
      }

      return Array.from(jurisdictions);
    } catch (error) {
      console.error('Failed to determine jurisdictions:', error);
      return [];
    }
  }

  private async getJurisdictionRules(jurisdiction: string): Promise<JurisdictionRule | null> {
    try {
      const cacheKey = `jurisdiction_rules:${jurisdiction}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const { data, error } = await this.supabase
        .from('tax_jurisdictions')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .single();

      if (error || !data) return null;

      const rules: JurisdictionRule = {
        id: data.id,
        jurisdiction: data.jurisdiction,
        productTypes: data.product_types,
        thresholds: data.thresholds,
        nexusRules: data.nexus_rules,
      };

      await this.redis.setex(cacheKey, 3600, JSON.stringify(rules));

      return rules;
    } catch (error) {
      console.error('Failed to get jurisdiction rules:', error);
      return null;
    }
  }

  private async hasNexus(rules: JurisdictionRule, transaction: Transaction): Promise<boolean> {
    // Simplified nexus determination
    // In production, this would include complex threshold calculations
    if (rules.nexusRules.physical || rules.nexusRules.economic) {
      return rules.productTypes.includes(transaction.productType);
    }
    return false;
  }

  private buildJurisdiction(location: any): string {
    if (location.state) {
      return `${location.country}-${location.state}`;
    }
    return location.country;
  }
}

/**
 * External Tax API Circuit Breaker
 * Implements circuit breaker pattern for external API calls
 */
class TaxApiCircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();
  private readonly failureThreshold = 5;
  private readonly recoveryTimeoutMs = 60000; // 1 minute

  async call<T>(
    apiName: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const state = this.getState(apiName);

    if (state.state === 'open') {
      if (this.shouldAttemptReset(state)) {
        state.state = 'half-open';
      } else {
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker open for ${apiName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess(apiName);
      return result;
    } catch (error) {
      this.onFailure(apiName);
      if (fallback) {
        return await fallback();
      }
      throw error;
    }
  }

  private getState(apiName: string): CircuitBreakerState {
    if (!this.states.has(apiName)) {
      this.states.set(apiName, {
        failures: 0,
        lastFailureTime: null,
        state: 'closed',
      });
    }
    return this.states.get(apiName)!;
  }

  private onSuccess(apiName: string): void {
    const state = this.getState(apiName);
    state.failures = 0;
    state.state = 'closed';
  }

  private onFailure(apiName: string): void {
    const state = this.getState(apiName);
    state.failures++;
    state.lastFailureTime = new Date();
    
    if (state.failures >= this.failureThreshold) {
      state.state = 'open';
    }
  }

  private shouldAttemptReset(state: CircuitBreakerState): boolean {
    if (!state.lastFailureTime) return false;
    return Date.now() - state.lastFailureTime.getTime() > this.recoveryTimeoutMs;
  }
}

/**
 * Compliance Reporter
 * Generates compliance reports and audit trails
 */
class ComplianceReporter {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * Generate compliance report for jurisdiction and period
   */
  async generateReport(
    jurisdiction: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    try {
      const { data, error } = await this.supabase
        .from('tax_audit_logs')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .eq('event_type', 'calculation');

      if (error) throw error;

      // Aggregate data
      const totalTransactions = data.length;
      let totalTaxCollected = 0;
      let exemptTransactions = 0;
      const breakdown = new Map<string, { count: number; amount: number }>();

      data.forEach((log) => {
        const details = log.details as TaxCalculationResult;
        totalTaxCollected += details.totalTax;
        
        if (details.exemptions.length > 0) {
          exemptTransactions++;
        }

        details.breakdown.forEach((item) => {
          const key = item.type;
          if (!breakdown.has(key)) {
            breakdown.set(key, { count: 0, amount: 0 });
          }
          const current = breakdown.get(key)!;
          current.count++;
          current.amount += item.taxAmount;
        });
      });

      return {
        period: { start: startDate, end: endDate },
        jurisdiction,
        totalTransactions,
        totalTaxCollected,
        exemptTransactions,
        breakdown: Array.from(breakdown.entries()).map(([taxType, data]) => ({
          taxType,
          count: data.count,
          amount: data.amount,
        })),
      };
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      throw new Error(`Compliance report generation failed: ${error}`);
    }
  }
}

/**
 * Audit Logger
 * Logs tax calculation events for compliance and debugging
 */
class AuditLogger {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async logCalculation(
    transaction: Transaction,
    result: TaxCalculationResult
  ): Promise<void> {
    try {
      await this.supabase
        .from('tax_audit_logs')
        .insert({
          transaction_id: transaction.id,
          event_type: 'calculation',
          jurisdiction: result.breakdown[0]?.jurisdiction,
          details: result,
          timestamp: new Date(),
        });
    } catch (error) {
      console.error('Failed to log calculation:', error);
    }
  }

  async logError(
    transactionId: string,
    error: Error,
    context?: any
  ): Promise<void> {
    try {
      await this.supabase
        .from('tax_audit_logs')
        .insert({
          transaction_id: transactionId,
          event_type: 'error',
          details: {
            error: error.message,
            stack: error.stack,
            context,
          },
          timestamp: new Date(),
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
}

/**
 * Main Tax Calculation Engine
 * Orchestrates all components for tax calculations
 */
export class TaxCalculationEngine {
  private rateService: RateUpdateService;
  private exemptionHandler: ExemptionHandler;
  private jurisdictionManager: JurisdictionManager;
  private complianceReporter: ComplianceReporter;
  private auditLogger: AuditLogger;
  private circuitBreaker: TaxApiCircuitBreaker;
  private redis: Redis;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    // Initialize connections
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize services
    this.rateService = new RateUpdateService(this.redis, this.supabase);
    this.exemptionHandler = new ExemptionHandler(this.redis, this.supabase);
    this.jurisdictionManager = new JurisdictionManager(this.redis, this.supabase);
    this.complianceReporter = new ComplianceReporter(this.supabase);
    this.auditLogger = new AuditLogger(this.supabase);
    this.circuitBreaker = new TaxApiCircuitBreaker();
  }

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(transaction: Transaction): Promise<TaxCalculationResult> {
    try {
      // Validate transaction
      const validatedTransaction = TransactionSchema.parse(transaction);

      // Determine applicable jurisdictions
      const jurisdictions = await this.jurisdictionManager
        .getApplicableJurisdictions(validatedTransaction);

      if (jurisdictions.length === 0) {
        throw new Error('No applicable jurisdictions found');
      }

      // Calculate tax for each jurisdiction
      const breakdown = [];
      let totalTax = 0;
      const appliedExemptions: string[] = [];

      for (const jurisdiction of jurisdictions) {
        const taxTypes = await this.getTaxTypesForJurisdiction(jurisdiction);
        
        for (const taxType of taxTypes) {
          const rate = await this.rateService.getTaxRate(jurisdiction, taxType);
          if (!rate) continue;

          let taxableAmount = validatedTransaction.amount;
          let exemptionApplied = false;

          // Check for exemptions
          if (validatedTransaction.exemptionId) {
            const isExempt = await this.exemptionHandler
              .validateExemption(validatedTransaction.exemptionId, validatedTransaction);
            
            if (isExempt) {
              taxableAmount = 0;
              exemptionApplied = true;
              appliedExemptions.push(validatedTransaction.exemptionId);
            }
          }

          const taxAmount = taxableAmount * rate.rate;
          totalTax += taxAmount;

          breakdown.push({
            jurisdiction,
            type: taxType,
            rate: rate.rate,
            taxableAmount,
            taxAmount,
            exemptionApplied,
          });
        }
      }

      const result: TaxCalculationResult = {
        transactionId: validatedTransaction.id,
        totalTax,
        breakdown,
        exemptions: appliedExemptions,
        calculatedAt: new Date(),
        ruleVersion: '1.0.0', // Version tracking for audit
      };

      // Log the calculation
      await this.auditLogger.logCalculation(validatedTransaction, result);

      return result;

    } catch (error) {
      await this.auditLogger.logError(transaction.id, error as Error, { transaction });
      throw new Error(`Tax calculation failed: ${error}`);
    }
  }

  /**
   * Process rate update webhook
   */
  async processRateUpdate(update: TaxRate): Promise<void> {
    return await this.rateService.processRateUpdate(update);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    jurisdiction: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    return await this.complianceReporter.generateReport(jurisdiction, startDate, endDate);
  }

  /**
   * Validate tax rules configuration
   */
  async validateTaxRules(jurisdiction: string): Promise<boolean> {
    try {
      // Check if jurisdiction has valid configuration
      const { data, error } =