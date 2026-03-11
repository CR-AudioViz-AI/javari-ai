```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Geographic region for payment routing
 */
export enum GeographicRegion {
  NORTH_AMERICA = 'north_america',
  EUROPE = 'europe',
  ASIA_PACIFIC = 'asia_pacific',
  LATIN_AMERICA = 'latin_america',
  MIDDLE_EAST_AFRICA = 'middle_east_africa'
}

/**
 * Payment processor status
 */
export enum ProcessorStatus {
  ACTIVE = 'active',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline'
}

/**
 * Payment method types
 */
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTOCURRENCY = 'cryptocurrency'
}

/**
 * Payment processor configuration
 */
export interface PaymentProcessor {
  id: string;
  name: string;
  apiEndpoint: string;
  apiKey: string;
  secretKey: string;
  supportedRegions: GeographicRegion[];
  supportedMethods: PaymentMethod[];
  supportedCurrencies: string[];
  baseFeePercentage: number;
  fixedFeeAmount: number;
  maximumAmount: number;
  minimumAmount: number;
  status: ProcessorStatus;
  priority: number;
  averageResponseTime: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment routing request
 */
export interface PaymentRoutingRequest {
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  customerCountry: string;
  merchantId: string;
  metadata?: Record<string, any>;
  requiresInstantSettlement?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

/**
 * Payment routing result
 */
export interface PaymentRoutingResult {
  processorId: string;
  processorName: string;
  estimatedCost: number;
  estimatedSuccessRate: number;
  estimatedResponseTime: number;
  routingReason: string[];
  backupProcessors: string[];
  routingDecisionId: string;
}

/**
 * Routing rule configuration
 */
export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: {
    amountMin?: number;
    amountMax?: number;
    currencies?: string[];
    paymentMethods?: PaymentMethod[];
    regions?: GeographicRegion[];
    merchantIds?: string[];
    riskLevels?: string[];
  };
  actions: {
    preferredProcessors?: string[];
    excludedProcessors?: string[];
    maxCostPercentage?: number;
    minSuccessRate?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Success rate metrics
 */
export interface SuccessRateMetric {
  processorId: string;
  region: GeographicRegion;
  paymentMethod: PaymentMethod;
  currency: string;
  successRate: number;
  totalAttempts: number;
  successfulAttempts: number;
  timeWindow: '1h' | '24h' | '7d' | '30d';
  lastUpdated: Date;
}

/**
 * Cost calculation result
 */
export interface CostCalculation {
  processorId: string;
  baseFee: number;
  percentageFee: number;
  totalFee: number;
  netAmount: number;
}

/**
 * Processor registry for managing payment processors
 */
export class ProcessorRegistry {
  private processors: Map<string, PaymentProcessor> = new Map();
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Initialize processor registry
   */
  async initialize(): Promise<void> {
    try {
      const { data: processors, error } = await this.supabase
        .from('payment_processors')
        .select('*')
        .eq('is_active', true);

      if (error) {
        throw new Error(`Failed to load processors: ${error.message}`);
      }

      for (const processor of processors || []) {
        this.processors.set(processor.id, {
          ...processor,
          createdAt: new Date(processor.created_at),
          updatedAt: new Date(processor.updated_at)
        });
      }

      await this.cacheProcessors();
    } catch (error) {
      throw new Error(`Failed to initialize processor registry: ${error}`);
    }
  }

  /**
   * Get active processors for region and payment method
   */
  getAvailableProcessors(region: GeographicRegion, paymentMethod: PaymentMethod): PaymentProcessor[] {
    return Array.from(this.processors.values()).filter(processor =>
      processor.status === ProcessorStatus.ACTIVE &&
      processor.supportedRegions.includes(region) &&
      processor.supportedMethods.includes(paymentMethod)
    );
  }

  /**
   * Get processor by ID
   */
  getProcessor(processorId: string): PaymentProcessor | undefined {
    return this.processors.get(processorId);
  }

  /**
   * Update processor status
   */
  async updateProcessorStatus(processorId: string, status: ProcessorStatus): Promise<void> {
    const processor = this.processors.get(processorId);
    if (!processor) {
      throw new Error(`Processor ${processorId} not found`);
    }

    processor.status = status;
    processor.updatedAt = new Date();

    await this.supabase
      .from('payment_processors')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', processorId);

    await this.cacheProcessors();
  }

  /**
   * Cache processors in Redis
   */
  private async cacheProcessors(): Promise<void> {
    const processorsData = Array.from(this.processors.values());
    await this.redis.setex('payment_processors', 300, JSON.stringify(processorsData));
  }
}

/**
 * Cost calculator for payment processing fees
 */
export class CostCalculator {
  /**
   * Calculate processing costs for all available processors
   */
  calculateCosts(amount: number, currency: string, processors: PaymentProcessor[]): CostCalculation[] {
    return processors.map(processor => {
      const baseFee = processor.fixedFeeAmount;
      const percentageFee = amount * (processor.baseFeePercentage / 100);
      const totalFee = baseFee + percentageFee;
      const netAmount = amount - totalFee;

      return {
        processorId: processor.id,
        baseFee,
        percentageFee,
        totalFee,
        netAmount
      };
    });
  }

  /**
   * Find the most cost-effective processor
   */
  findMostCostEffective(costs: CostCalculation[]): CostCalculation {
    return costs.reduce((min, current) =>
      current.totalFee < min.totalFee ? current : min
    );
  }
}

/**
 * Success rate tracker for monitoring processor performance
 */
export class SuccessRateTracker {
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabase: SupabaseClient, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Get success rate for processor
   */
  async getSuccessRate(
    processorId: string,
    region: GeographicRegion,
    paymentMethod: PaymentMethod,
    currency: string,
    timeWindow: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<number> {
    const cacheKey = `success_rate:${processorId}:${region}:${paymentMethod}:${currency}:${timeWindow}`;
    
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return parseFloat(cached);
      }

      const timeThreshold = this.getTimeThreshold(timeWindow);
      
      const { data, error } = await this.supabase
        .from('payment_attempts')
        .select('status')
        .eq('processor_id', processorId)
        .eq('region', region)
        .eq('payment_method', paymentMethod)
        .eq('currency', currency)
        .gte('created_at', timeThreshold.toISOString());

      if (error) {
        throw new Error(`Failed to fetch success rate: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return 0.95; // Default success rate for new processors
      }

      const successfulAttempts = data.filter(attempt => attempt.status === 'success').length;
      const successRate = successfulAttempts / data.length;

      await this.redis.setex(cacheKey, 300, successRate.toString());
      return successRate;
    } catch (error) {
      console.error('Error getting success rate:', error);
      return 0.95; // Fallback success rate
    }
  }

  /**
   * Record payment attempt
   */
  async recordPaymentAttempt(
    processorId: string,
    region: GeographicRegion,
    paymentMethod: PaymentMethod,
    currency: string,
    status: 'success' | 'failure' | 'pending',
    amount: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('payment_attempts')
        .insert({
          processor_id: processorId,
          region,
          payment_method: paymentMethod,
          currency,
          status,
          amount,
          metadata: metadata || {},
          created_at: new Date().toISOString()
        });

      // Invalidate cache
      const cachePattern = `success_rate:${processorId}:${region}:${paymentMethod}:${currency}:*`;
      const keys = await this.redis.keys(cachePattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Error recording payment attempt:', error);
    }
  }

  /**
   * Get time threshold for time window
   */
  private getTimeThreshold(timeWindow: string): Date {
    const now = new Date();
    switch (timeWindow) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

/**
 * Geographic router for location-based routing
 */
export class GeographicRouter {
  private countryRegionMap: Map<string, GeographicRegion>;

  constructor() {
    this.countryRegionMap = new Map();
    this.initializeCountryRegionMap();
  }

  /**
   * Get region for country code
   */
  getRegionForCountry(countryCode: string): GeographicRegion {
    return this.countryRegionMap.get(countryCode.toUpperCase()) || GeographicRegion.NORTH_AMERICA;
  }

  /**
   * Initialize country to region mapping
   */
  private initializeCountryRegionMap(): void {
    // North America
    const northAmerica = ['US', 'CA', 'MX'];
    northAmerica.forEach(country => 
      this.countryRegionMap.set(country, GeographicRegion.NORTH_AMERICA)
    );

    // Europe
    const europe = ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI'];
    europe.forEach(country => 
      this.countryRegionMap.set(country, GeographicRegion.EUROPE)
    );

    // Asia Pacific
    const asiaPacific = ['JP', 'KR', 'CN', 'SG', 'AU', 'NZ', 'IN', 'HK'];
    asiaPacific.forEach(country => 
      this.countryRegionMap.set(country, GeographicRegion.ASIA_PACIFIC)
    );

    // Latin America
    const latinAmerica = ['BR', 'AR', 'CL', 'CO', 'PE', 'VE'];
    latinAmerica.forEach(country => 
      this.countryRegionMap.set(country, GeographicRegion.LATIN_AMERICA)
    );

    // Middle East & Africa
    const middleEastAfrica = ['AE', 'SA', 'ZA', 'EG', 'IL'];
    middleEastAfrica.forEach(country => 
      this.countryRegionMap.set(country, GeographicRegion.MIDDLE_EAST_AFRICA)
    );
  }
}

/**
 * Routing rule engine for business logic
 */
export class RoutingRuleEngine {
  private rules: RoutingRule[] = [];
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Load routing rules from database
   */
  async loadRules(): Promise<void> {
    try {
      const { data: rules, error } = await this.supabase
        .from('routing_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) {
        throw new Error(`Failed to load routing rules: ${error.message}`);
      }

      this.rules = (rules || []).map(rule => ({
        ...rule,
        createdAt: new Date(rule.created_at),
        updatedAt: new Date(rule.updated_at)
      }));
    } catch (error) {
      console.error('Error loading routing rules:', error);
      this.rules = [];
    }
  }

  /**
   * Apply routing rules to filter processors
   */
  applyRules(request: PaymentRoutingRequest, processors: PaymentProcessor[]): {
    allowedProcessors: PaymentProcessor[];
    excludedProcessors: string[];
    appliedRules: string[];
  } {
    let allowedProcessors = [...processors];
    const excludedProcessors: string[] = [];
    const appliedRules: string[] = [];

    for (const rule of this.rules) {
      if (this.matchesRule(request, rule)) {
        appliedRules.push(rule.name);

        // Apply exclusions
        if (rule.actions.excludedProcessors) {
          allowedProcessors = allowedProcessors.filter(processor => {
            if (rule.actions.excludedProcessors!.includes(processor.id)) {
              excludedProcessors.push(processor.id);
              return false;
            }
            return true;
          });
        }

        // Apply preferences
        if (rule.actions.preferredProcessors) {
          const preferred = allowedProcessors.filter(processor =>
            rule.actions.preferredProcessors!.includes(processor.id)
          );
          if (preferred.length > 0) {
            allowedProcessors = preferred;
          }
        }
      }
    }

    return { allowedProcessors, excludedProcessors, appliedRules };
  }

  /**
   * Check if request matches rule conditions
   */
  private matchesRule(request: PaymentRoutingRequest, rule: RoutingRule): boolean {
    const { conditions } = rule;

    if (conditions.amountMin && request.amount < conditions.amountMin) return false;
    if (conditions.amountMax && request.amount > conditions.amountMax) return false;
    if (conditions.currencies && !conditions.currencies.includes(request.currency)) return false;
    if (conditions.paymentMethods && !conditions.paymentMethods.includes(request.paymentMethod)) return false;
    if (conditions.merchantIds && !conditions.merchantIds.includes(request.merchantId)) return false;
    if (conditions.riskLevels && request.riskLevel && !conditions.riskLevels.includes(request.riskLevel)) return false;

    return true;
  }
}

/**
 * Failover manager for handling processor failures
 */
export class FailoverManager extends EventEmitter {
  private failoverAttempts: Map<string, number> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  /**
   * Handle payment failure and determine failover strategy
   */
  async handleFailure(
    processorId: string,
    error: Error,
    backupProcessors: string[]
  ): Promise<string | null> {
    const attempts = this.failoverAttempts.get(processorId) || 0;
    
    if (attempts >= this.maxRetries) {
      this.emit('max_retries_exceeded', { processorId, error });
      return null;
    }

    this.failoverAttempts.set(processorId, attempts + 1);

    // Select next backup processor
    if (backupProcessors.length > attempts) {
      const nextProcessor = backupProcessors[attempts];
      this.emit('failover_initiated', { 
        fromProcessor: processorId, 
        toProcessor: nextProcessor, 
        attempt: attempts + 1 
      });
      
      return nextProcessor;
    }

    return null;
  }

  /**
   * Reset failover attempts for processor
   */
  resetFailoverAttempts(processorId: string): void {
    this.failoverAttempts.delete(processorId);
  }

  /**
   * Get current failover attempt count
   */
  getFailoverAttempts(processorId: string): number {
    return this.failoverAttempts.get(processorId) || 0;
  }
}

/**
 * Main payment routing engine
 */
export class PaymentRoutingEngine extends EventEmitter {
  private processorRegistry: ProcessorRegistry;
  private costCalculator: CostCalculator;
  private successRateTracker: SuccessRateTracker;
  private geographicRouter: GeographicRouter;
  private routingRuleEngine: RoutingRuleEngine;
  private failoverManager: FailoverManager;
  private supabase: SupabaseClient;
  private redis: Redis;
  private isInitialized: boolean = false;

  constructor(supabaseUrl: string, supabaseKey: string, redisUrl?: string) {
    super();
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    
    this.processorRegistry = new ProcessorRegistry(this.supabase, this.redis);
    this.costCalculator = new CostCalculator();
    this.successRateTracker = new SuccessRateTracker(this.supabase, this.redis);
    this.geographicRouter = new GeographicRouter();
    this.routingRuleEngine = new RoutingRuleEngine(this.supabase);
    this.failoverManager = new FailoverManager();

    this.setupEventListeners();
  }

  /**
   * Initialize the payment routing engine
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.processorRegistry.initialize(),
        this.routingRuleEngine.loadRules()
      ]);

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initialization_error', error);
      throw error;
    }
  }

  /**
   * Route payment to optimal processor
   */
  async routePayment(request: PaymentRoutingRequest): Promise<PaymentRoutingResult> {
    if (!this.isInitialized) {
      throw new Error('Payment routing engine not initialized');
    }

    try {
      const routingDecisionId = this.generateDecisionId();
      const region = this.geographicRouter.getRegionForCountry(request.customerCountry);
      
      // Get available processors
      let availableProcessors = this.processorRegistry.getAvailableProcessors(
        region,
        request.paymentMethod
      );

      if (availableProcessors.length === 0) {
        throw new Error('No available processors for the requested payment method and region');
      }

      // Filter by currency support
      availableProcessors = availableProcessors.filter(processor =>
        processor.supportedCurrencies.includes(request.currency)
      );

      if (availableProcessors.length === 0) {
        throw new Error(`No processors support currency ${request.currency}`);
      }

      // Filter by amount limits
      availableProcessors = availableProcessors.filter(processor =>
        request.amount >= processor.minimumAmount &&
        request.amount <= processor.maximumAmount
      );

      // Apply routing rules
      const { allowedProcessors, excludedProcessors, appliedRules } = 
        this.routingRuleEngine.applyRules(request, availableProcessors);

      if (allowedProcessors.length === 0) {
        throw new Error('No processors available after applying routing rules');
      }

      // Calculate costs
      const costs = this.costCalculator.calculateCosts(
        request.amount,
        request.currency,
        allowedProcessors
      );

      // Get success rates
      const processorsWithMetrics = await Promise.all(
        allowedProcessors.map(async processor => {
          const successRate = await this.successRateTracker.getSuccessRate(
            processor.id,
            region,
            request.paymentMethod,
            request.currency
          );

          const cost = costs.find(c => c.processorId === processor.id)!;

          return {
            processor,
            successRate,
            cost,
            score: this.calculateScore(processor, successRate, cost.totalFee, request.amount)
          };
        })
      );

      // Sort by score (higher is better)
      processorsWithMetrics.sort((a, b) => b.score - a.score);

      const selectedProcessor = processorsWithMetrics