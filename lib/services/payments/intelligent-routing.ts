```typescript
import { createClient } from '@supabase/supabase-js';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import type { StripeService } from './stripe-service';
import type { PayPalService } from './paypal-service';
import type { AdyenService } from './adyen-service';
import type { GeographicDetector } from '../utils/geographic-detector';
import type { PaymentAnalytics } from '../metrics/payment-analytics';

/**
 * Payment request interface
 */
export interface PaymentRequest {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  metadata?: Record<string, any>;
  description?: string;
  statementDescriptor?: string;
}

/**
 * Routing context for intelligent decision making
 */
export interface RoutingContext {
  customerLocation: {
    country: string;
    region: string;
    timezone: string;
  };
  paymentHistory: {
    successRate: number;
    averageProcessingTime: number;
    preferredProvider?: string;
  };
  transactionContext: {
    isHighValue: boolean;
    requiresFastProcessing: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * Payment provider interface
 */
export interface PaymentProvider {
  id: string;
  name: string;
  type: 'stripe' | 'paypal' | 'adyen';
  service: StripeService | PayPalService | AdyenService;
  isActive: boolean;
  priority: number;
}

/**
 * Provider health metrics
 */
export interface ProviderHealthMetrics {
  providerId: string;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  lastHealthCheck: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  consecutiveFailures: number;
}

/**
 * Routing rule configuration
 */
export interface RoutingRule {
  id: string;
  name: string;
  conditions: {
    countries?: string[];
    currencies?: string[];
    amountRange?: { min: number; max: number };
    riskLevels?: string[];
  };
  providerPreferences: {
    providerId: string;
    weight: number;
    costMultiplier: number;
  }[];
  isActive: boolean;
}

/**
 * Payment routing result
 */
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  providerId: string;
  amount: number;
  currency: string;
  processingTime: number;
  cost: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  failoverAttempts?: number;
  metadata?: Record<string, any>;
}

/**
 * Cost calculation result
 */
export interface CostCalculation {
  providerId: string;
  baseCost: number;
  processingFee: number;
  totalCost: number;
  costPercentage: number;
}

/**
 * Provider health monitoring service
 */
class ProviderHealthMonitor extends EventEmitter {
  private healthMetrics: Map<string, ProviderHealthMetrics> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly FAILURE_THRESHOLD = 3;

  constructor(
    private supabase: ReturnType<typeof createClient>,
    private logger: Logger
  ) {
    super();
    this.startHealthMonitoring();
  }

  /**
   * Start continuous health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      this.HEALTH_CHECK_INTERVAL
    );
  }

  /**
   * Perform health checks on all providers
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const { data: providers } = await this.supabase
        .from('payment_providers')
        .select('*')
        .eq('is_active', true);

      if (!providers) return;

      for (const provider of providers) {
        await this.checkProviderHealth(provider.id);
      }
    } catch (error) {
      this.logger.error('Failed to perform health checks:', error);
    }
  }

  /**
   * Check individual provider health
   */
  private async checkProviderHealth(providerId: string): Promise<void> {
    const startTime = Date.now();
    let isHealthy = false;

    try {
      // Simulate health check (replace with actual provider ping)
      await this.pingProvider(providerId);
      isHealthy = true;
    } catch (error) {
      this.logger.warn(`Provider ${providerId} health check failed:`, error);
    }

    const responseTime = Date.now() - startTime;
    const currentMetrics = this.healthMetrics.get(providerId);
    const consecutiveFailures = isHealthy 
      ? 0 
      : (currentMetrics?.consecutiveFailures || 0) + 1;

    const metrics: ProviderHealthMetrics = {
      providerId,
      successRate: this.calculateSuccessRate(providerId, isHealthy),
      averageResponseTime: this.updateAverageResponseTime(providerId, responseTime),
      errorRate: this.calculateErrorRate(providerId, !isHealthy),
      lastHealthCheck: new Date(),
      status: this.determineProviderStatus(consecutiveFailures, responseTime),
      consecutiveFailures
    };

    this.healthMetrics.set(providerId, metrics);
    await this.saveHealthMetrics(metrics);

    if (consecutiveFailures >= this.FAILURE_THRESHOLD) {
      this.emit('providerUnhealthy', providerId, metrics);
    }
  }

  /**
   * Ping provider for health check
   */
  private async pingProvider(providerId: string): Promise<void> {
    // Implement actual provider ping logic
    // This is a placeholder
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(providerId: string, isHealthy: boolean): number {
    // Implement rolling window success rate calculation
    return isHealthy ? 0.99 : 0.85;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(providerId: string, responseTime: number): number {
    const current = this.healthMetrics.get(providerId);
    if (!current) return responseTime;
    
    return (current.averageResponseTime * 0.8) + (responseTime * 0.2);
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(providerId: string, hasError: boolean): number {
    // Implement rolling window error rate calculation
    return hasError ? 0.15 : 0.01;
  }

  /**
   * Determine provider status based on metrics
   */
  private determineProviderStatus(failures: number, responseTime: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (failures >= this.FAILURE_THRESHOLD) return 'unhealthy';
    if (failures > 1 || responseTime > 5000) return 'degraded';
    return 'healthy';
  }

  /**
   * Save health metrics to database
   */
  private async saveHealthMetrics(metrics: ProviderHealthMetrics): Promise<void> {
    await this.supabase
      .from('provider_health_metrics')
      .upsert({
        provider_id: metrics.providerId,
        success_rate: metrics.successRate,
        average_response_time: metrics.averageResponseTime,
        error_rate: metrics.errorRate,
        status: metrics.status,
        consecutive_failures: metrics.consecutiveFailures,
        updated_at: new Date().toISOString()
      });
  }

  /**
   * Get provider health metrics
   */
  public getProviderHealth(providerId: string): ProviderHealthMetrics | null {
    return this.healthMetrics.get(providerId) || null;
  }

  /**
   * Get all healthy providers
   */
  public getHealthyProviders(): string[] {
    return Array.from(this.healthMetrics.entries())
      .filter(([_, metrics]) => metrics.status === 'healthy')
      .map(([providerId]) => providerId);
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

/**
 * Cost optimization service
 */
class CostOptimizer {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private logger: Logger
  ) {}

  /**
   * Calculate costs for all available providers
   */
  public async calculateProviderCosts(
    amount: number,
    currency: string,
    providers: PaymentProvider[]
  ): Promise<CostCalculation[]> {
    const costs: CostCalculation[] = [];

    for (const provider of providers) {
      const cost = await this.calculateProviderCost(amount, currency, provider);
      costs.push(cost);
    }

    return costs.sort((a, b) => a.totalCost - b.totalCost);
  }

  /**
   * Calculate cost for specific provider
   */
  private async calculateProviderCost(
    amount: number,
    currency: string,
    provider: PaymentProvider
  ): Promise<CostCalculation> {
    const { data: feeStructure } = await this.supabase
      .from('provider_fee_structures')
      .select('*')
      .eq('provider_id', provider.id)
      .eq('currency', currency)
      .single();

    const baseCost = feeStructure?.fixed_fee || 0.30;
    const processingFee = amount * (feeStructure?.percentage_fee || 0.029);
    const totalCost = baseCost + processingFee;
    const costPercentage = (totalCost / amount) * 100;

    return {
      providerId: provider.id,
      baseCost,
      processingFee,
      totalCost,
      costPercentage
    };
  }

  /**
   * Get most cost-effective provider
   */
  public getMostCostEffective(costs: CostCalculation[]): CostCalculation {
    return costs.reduce((lowest, current) => 
      current.totalCost < lowest.totalCost ? current : lowest
    );
  }
}

/**
 * Geographic routing service
 */
class GeographicRouter {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private geographicDetector: GeographicDetector,
    private logger: Logger
  ) {}

  /**
   * Get optimal providers for geographic location
   */
  public async getProvidersForLocation(
    country: string,
    region: string
  ): Promise<PaymentProvider[]> {
    const { data: providers } = await this.supabase
      .from('payment_providers')
      .select(`
        *,
        geographic_coverage!inner(*)
      `)
      .eq('is_active', true)
      .contains('geographic_coverage.countries', [country])
      .order('priority', { ascending: false });

    return providers || [];
  }

  /**
   * Check if provider supports geographic location
   */
  public async supportsLocation(
    providerId: string,
    country: string,
    currency: string
  ): Promise<boolean> {
    const { data: coverage } = await this.supabase
      .from('provider_geographic_coverage')
      .select('*')
      .eq('provider_id', providerId)
      .contains('supported_countries', [country])
      .contains('supported_currencies', [currency])
      .single();

    return !!coverage;
  }

  /**
   * Get region-specific routing preferences
   */
  public async getRegionPreferences(region: string): Promise<RoutingRule[]> {
    const { data: rules } = await this.supabase
      .from('payment_routing_rules')
      .select('*')
      .eq('is_active', true)
      .contains('conditions->regions', [region]);

    return rules || [];
  }
}

/**
 * Failover management service
 */
class FailoverManager {
  private readonly MAX_FAILOVER_ATTEMPTS = 3;
  private readonly BACKOFF_BASE_MS = 1000;

  constructor(
    private logger: Logger,
    private healthMonitor: ProviderHealthMonitor
  ) {}

  /**
   * Execute payment with failover
   */
  public async executeWithFailover(
    paymentRequest: PaymentRequest,
    providers: PaymentProvider[],
    context: RoutingContext
  ): Promise<PaymentResult> {
    let lastError: any = null;
    let failoverAttempts = 0;

    for (const provider of providers) {
      if (failoverAttempts >= this.MAX_FAILOVER_ATTEMPTS) {
        break;
      }

      try {
        this.logger.info(`Attempting payment with provider ${provider.id}`, {
          attempt: failoverAttempts + 1,
          providerId: provider.id
        });

        const result = await this.processPayment(paymentRequest, provider);
        
        if (result.success) {
          return {
            ...result,
            failoverAttempts
          };
        }

        lastError = result.error;
        failoverAttempts++;

        // Apply exponential backoff
        if (failoverAttempts < this.MAX_FAILOVER_ATTEMPTS) {
          const backoffMs = this.BACKOFF_BASE_MS * Math.pow(2, failoverAttempts);
          await this.delay(backoffMs);
        }

      } catch (error) {
        this.logger.error(`Payment failed with provider ${provider.id}:`, error);
        lastError = error;
        failoverAttempts++;

        // Mark provider as unhealthy if consecutive failures
        this.healthMonitor.emit('providerError', provider.id, error);
      }
    }

    return {
      success: false,
      providerId: providers[0]?.id || 'unknown',
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      processingTime: 0,
      cost: 0,
      error: {
        code: 'PAYMENT_FAILED',
        message: `Payment failed after ${failoverAttempts} attempts`,
        retryable: false
      },
      failoverAttempts
    };
  }

  /**
   * Process payment with specific provider
   */
  private async processPayment(
    request: PaymentRequest,
    provider: PaymentProvider
  ): Promise<PaymentResult> {
    const startTime = Date.now();

    try {
      // Simulate payment processing
      const result = await provider.service.processPayment(request);
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        transactionId: result.id,
        providerId: provider.id,
        amount: request.amount,
        currency: request.currency,
        processingTime,
        cost: result.fees || 0
      };
    } catch (error: any) {
      return {
        success: false,
        providerId: provider.id,
        amount: request.amount,
        currency: request.currency,
        processingTime: Date.now() - startTime,
        cost: 0,
        error: {
          code: error.code || 'PROVIDER_ERROR',
          message: error.message || 'Payment processing failed',
          retryable: error.retryable !== false
        }
      };
    }
  }

  /**
   * Delay helper for backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Routing metrics collection service
 */
class RoutingMetricsCollector {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private paymentAnalytics: PaymentAnalytics,
    private logger: Logger
  ) {}

  /**
   * Record payment attempt
   */
  public async recordPaymentAttempt(
    request: PaymentRequest,
    result: PaymentResult,
    context: RoutingContext
  ): Promise<void> {
    try {
      await this.supabase.from('payment_attempts').insert({
        customer_id: request.customerId,
        amount: request.amount,
        currency: request.currency,
        provider_id: result.providerId,
        success: result.success,
        processing_time: result.processingTime,
        cost: result.cost,
        failover_attempts: result.failoverAttempts || 0,
        error_code: result.error?.code,
        error_message: result.error?.message,
        customer_country: context.customerLocation.country,
        customer_region: context.customerLocation.region,
        risk_level: context.transactionContext.riskLevel,
        created_at: new Date().toISOString()
      });

      // Update analytics
      await this.paymentAnalytics.recordTransaction(result);

    } catch (error) {
      this.logger.error('Failed to record payment attempt:', error);
    }
  }

  /**
   * Update routing success metrics
   */
  public async updateRoutingMetrics(
    providerId: string,
    success: boolean,
    processingTime: number
  ): Promise<void> {
    try {
      const { data: current } = await this.supabase
        .from('provider_routing_metrics')
        .select('*')
        .eq('provider_id', providerId)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()) // Last 24h
        .single();

      if (current) {
        const totalAttempts = current.total_attempts + 1;
        const successfulAttempts = current.successful_attempts + (success ? 1 : 0);
        const successRate = successfulAttempts / totalAttempts;
        const avgProcessingTime = (current.average_processing_time + processingTime) / 2;

        await this.supabase
          .from('provider_routing_metrics')
          .update({
            total_attempts: totalAttempts,
            successful_attempts: successfulAttempts,
            success_rate: successRate,
            average_processing_time: avgProcessingTime,
            updated_at: new Date().toISOString()
          })
          .eq('id', current.id);
      } else {
        await this.supabase.from('provider_routing_metrics').insert({
          provider_id: providerId,
          total_attempts: 1,
          successful_attempts: success ? 1 : 0,
          success_rate: success ? 1.0 : 0.0,
          average_processing_time: processingTime,
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Failed to update routing metrics:', error);
    }
  }
}

/**
 * Provider redundancy management service
 */
class ProviderRedundancyManager {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private logger: Logger
  ) {}

  /**
   * Get redundant providers for failover
   */
  public async getRedundantProviders(
    primaryProviderId: string,
    context: RoutingContext
  ): Promise<PaymentProvider[]> {
    const { data: redundancyRules } = await this.supabase
      .from('provider_redundancy_rules')
      .select(`
        *,
        backup_providers:provider_redundancy_backups(
          backup_provider:payment_providers(*)
        )
      `)
      .eq('primary_provider_id', primaryProviderId)
      .eq('is_active', true);

    if (!redundancyRules?.length) {
      return this.getDefaultBackupProviders(context);
    }

    const backupProviders: PaymentProvider[] = [];
    
    for (const rule of redundancyRules) {
      if (rule.backup_providers) {
        backupProviders.push(...rule.backup_providers.map((bp: any) => bp.backup_provider));
      }
    }

    return backupProviders;
  }

  /**
   * Get default backup providers when no specific rules exist
   */
  private async getDefaultBackupProviders(context: RoutingContext): Promise<PaymentProvider[]> {
    const { data: providers } = await this.supabase
      .from('payment_providers')
      .select('*')
      .eq('is_active', true)
      .eq('supports_failover', true)
      .order('priority', { ascending: false });

    return providers || [];
  }

  /**
   * Update provider redundancy configuration
   */
  public async updateRedundancyConfig(
    primaryProviderId: string,
    backupProviderIds: string[]
  ): Promise<void> {
    try {
      // Remove existing backup configurations
      await this.supabase
        .from('provider_redundancy_backups')
        .delete()
        .eq('primary_provider_id', primaryProviderId);

      // Add new backup configurations
      const backupConfigs = backupProviderIds.map((backupId, index) => ({
        primary_provider_id: primaryProviderId,
        backup_provider_id: backupId,
        priority: index + 1,
        created_at: new Date().toISOString()
      }));

      await this.supabase
        .from('provider_redundancy_backups')
        .insert(backupConfigs);

    } catch (error) {
      this.logger.error('Failed to update redundancy config:', error);
      throw error;
    }
  }
}

/**
 * Main intelligent payment routing service
 */
export class IntelligentPaymentRouter extends EventEmitter {
  private healthMonitor: ProviderHealthMonitor;
  private costOptimizer: CostOptimizer;
  private geographicRouter: GeographicRouter;
  private failoverManager: FailoverManager;
  private metricsCollector: RoutingMetricsCollector;
  private redundancyManager: ProviderRedundancyManager;

  constructor(
    private supabase: ReturnType<typeof createClient>,
    private stripeService: StripeService,
    private paypalService: PayPalService,
    private adyenService: AdyenService,
    private geographicDetector: GeographicDetector,
    private paymentAnalytics: PaymentAnalytics,
    private logger: Logger
  ) {
    super();
    
    this.healthMonitor = new ProviderHealthMonitor(supabase, logger);
    this.costOptimizer = new CostOptimizer(supabase, logger);
    this.geographicRouter = new GeographicRouter(supabase, geographicDetector, logger);
    this.failoverManager = new FailoverManager(logger, this.healthMonitor);
    this.metricsCollector = new RoutingMetricsColl