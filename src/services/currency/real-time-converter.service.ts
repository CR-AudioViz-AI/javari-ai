import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import WebSocket from 'ws';
import axios, { AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

/**
 * Currency pair representation
 */
export interface CurrencyPair {
  from: string;
  to: string;
}

/**
 * Exchange rate data from external provider
 */
export interface ExchangeRate {
  provider: string;
  pair: CurrencyPair;
  rate: number;
  bid?: number;
  ask?: number;
  timestamp: Date;
  confidence: number;
  spread?: number;
}

/**
 * Aggregated competitive rate
 */
export interface CompetitiveRate {
  pair: CurrencyPair;
  rate: number;
  spread: number;
  margin: number;
  sources: string[];
  confidence: number;
  timestamp: Date;
  validity: number; // seconds
}

/**
 * Currency conversion request
 */
export interface ConversionRequest {
  from: string;
  to: string;
  amount: number;
  userId?: string;
  priority: 'standard' | 'premium' | 'institutional';
  hedgeRequired?: boolean;
}

/**
 * Currency conversion result
 */
export interface ConversionResult {
  requestId: string;
  from: string;
  to: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  margin: number;
  fees: number;
  totalCost: number;
  timestamp: Date;
  hedgeInfo?: HedgeInfo;
  riskAssessment: RiskAssessment;
}

/**
 * Risk assessment for conversion
 */
export interface RiskAssessment {
  volatilityScore: number;
  liquidityScore: number;
  exposureLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedHedge: boolean;
  timeToHedge?: number; // minutes
}

/**
 * Hedging strategy information
 */
export interface HedgeInfo {
  strategy: 'forward' | 'option' | 'swap' | 'natural';
  coverage: number; // percentage
  cost: number;
  maturity?: Date;
  instrumentId?: string;
}

/**
 * Rate provider configuration
 */
export interface RateProvider {
  name: string;
  url: string;
  apiKey?: string;
  weight: number;
  reliability: number;
  latency: number;
  active: boolean;
}

/**
 * Hedging strategy configuration
 */
export interface HedgingStrategy {
  name: string;
  threshold: number; // USD amount
  coverage: number; // percentage
  maxCost: number; // percentage of transaction
  instruments: string[];
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ratesTTL: number; // seconds
  aggregatedTTL: number; // seconds
  historicalTTL: number; // seconds
  maxMemoryUsage: number; // MB
}

/**
 * Service configuration
 */
export interface CurrencyConverterConfig {
  providers: RateProvider[];
  hedgingStrategies: HedgingStrategy[];
  cache: CacheConfig;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  margins: {
    standard: number;
    premium: number;
    institutional: number;
  };
  websocket: {
    port: number;
    heartbeat: number;
  };
}

/**
 * Rate aggregation engine for combining multiple data sources
 */
class RateAggregatorEngine extends EventEmitter {
  private providers: Map<string, RateProvider> = new Map();
  private rates: Map<string, ExchangeRate[]> = new Map();
  private aggregatedRates: Map<string, CompetitiveRate> = new Map();

  constructor(private config: CurrencyConverterConfig, private redis: Redis) {
    super();
    this.initializeProviders();
  }

  /**
   * Initialize rate providers
   */
  private initializeProviders(): void {
    this.config.providers.forEach(provider => {
      if (provider.active) {
        this.providers.set(provider.name, provider);
      }
    });
  }

  /**
   * Fetch rates from all active providers
   */
  async fetchAllRates(pairs: CurrencyPair[]): Promise<void> {
    const promises = Array.from(this.providers.values()).map(provider =>
      this.fetchProviderRates(provider, pairs).catch(error => {
        console.error(`Failed to fetch rates from ${provider.name}:`, error);
        return [];
      })
    );

    const results = await Promise.all(promises);
    
    // Group rates by currency pair
    pairs.forEach(pair => {
      const pairKey = `${pair.from}-${pair.to}`;
      const pairRates: ExchangeRate[] = [];

      results.forEach(providerRates => {
        const pairRate = providerRates.find(rate => 
          rate.pair.from === pair.from && rate.pair.to === pair.to
        );
        if (pairRate) {
          pairRates.push(pairRate);
        }
      });

      if (pairRates.length > 0) {
        this.rates.set(pairKey, pairRates);
        this.aggregateRates(pair, pairRates);
      }
    });
  }

  /**
   * Fetch rates from specific provider
   */
  private async fetchProviderRates(
    provider: RateProvider, 
    pairs: CurrencyPair[]
  ): Promise<ExchangeRate[]> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(provider.url, {
        headers: provider.apiKey ? { 'X-API-Key': provider.apiKey } : {},
        timeout: 5000
      });

      const latency = Date.now() - startTime;
      this.updateProviderLatency(provider.name, latency);

      return this.parseProviderResponse(provider.name, response, pairs);
    } catch (error) {
      this.updateProviderReliability(provider.name, false);
      throw error;
    }
  }

  /**
   * Parse provider response to standard format
   */
  private parseProviderResponse(
    providerName: string,
    response: AxiosResponse,
    pairs: CurrencyPair[]
  ): ExchangeRate[] {
    const rates: ExchangeRate[] = [];
    
    // This would be implemented based on each provider's API format
    pairs.forEach(pair => {
      const rate = this.extractRateFromResponse(providerName, response.data, pair);
      if (rate) {
        rates.push({
          provider: providerName,
          pair,
          rate: rate.rate,
          bid: rate.bid,
          ask: rate.ask,
          timestamp: new Date(),
          confidence: this.calculateConfidence(providerName, rate),
          spread: rate.ask && rate.bid ? rate.ask - rate.bid : undefined
        });
      }
    });

    return rates;
  }

  /**
   * Extract rate from provider-specific response format
   */
  private extractRateFromResponse(
    providerName: string,
    data: any,
    pair: CurrencyPair
  ): { rate: number; bid?: number; ask?: number } | null {
    // Implementation would vary by provider
    // This is a simplified example
    const pairKey = `${pair.from}${pair.to}`;
    
    switch (providerName) {
      case 'xe':
        return data.rates?.[pairKey] ? { rate: data.rates[pairKey] } : null;
      case 'fixer':
        return data.rates?.[pair.to] ? { rate: data.rates[pair.to] } : null;
      default:
        return null;
    }
  }

  /**
   * Calculate confidence score for rate
   */
  private calculateConfidence(providerName: string, rate: any): number {
    const provider = this.providers.get(providerName);
    if (!provider) return 0.5;

    let confidence = provider.reliability * provider.weight;
    
    // Adjust based on spread
    if (rate.bid && rate.ask) {
      const spread = (rate.ask - rate.bid) / rate.rate;
      confidence *= Math.max(0.1, 1 - spread * 10);
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Aggregate rates from multiple providers
   */
  private aggregateRates(pair: CurrencyPair, rates: ExchangeRate[]): void {
    if (rates.length === 0) return;

    // Weighted average based on provider confidence and reliability
    const totalWeight = rates.reduce((sum, rate) => sum + rate.confidence, 0);
    const weightedRate = rates.reduce((sum, rate) => 
      sum + (rate.rate * rate.confidence), 0
    ) / totalWeight;

    const spread = this.calculateOptimalSpread(rates);
    const margin = this.calculateDynamicMargin(pair, rates);

    const competitiveRate: CompetitiveRate = {
      pair,
      rate: weightedRate,
      spread,
      margin,
      sources: rates.map(r => r.provider),
      confidence: totalWeight / rates.length,
      timestamp: new Date(),
      validity: 30 // 30 seconds
    };

    const pairKey = `${pair.from}-${pair.to}`;
    this.aggregatedRates.set(pairKey, competitiveRate);

    // Cache the rate
    this.cacheRate(pairKey, competitiveRate);

    // Emit rate update event
    this.emit('rateUpdated', competitiveRate);
  }

  /**
   * Calculate optimal spread
   */
  private calculateOptimalSpread(rates: ExchangeRate[]): number {
    const spreads = rates
      .filter(r => r.spread !== undefined)
      .map(r => r.spread!);
    
    if (spreads.length === 0) return 0.001; // Default 0.1%

    // Use median spread to avoid outliers
    spreads.sort((a, b) => a - b);
    const median = spreads[Math.floor(spreads.length / 2)];
    
    return Math.max(0.0005, Math.min(0.01, median)); // Between 0.05% and 1%
  }

  /**
   * Calculate dynamic margin based on market conditions
   */
  private calculateDynamicMargin(pair: CurrencyPair, rates: ExchangeRate[]): number {
    const baseMargin = 0.002; // 0.2% base margin
    
    // Adjust based on volatility
    const rateVariance = this.calculateRateVariance(rates);
    const volatilityAdjustment = rateVariance * 0.5;
    
    // Adjust based on liquidity (approximated by number of sources)
    const liquidityAdjustment = Math.max(0, (3 - rates.length) * 0.001);
    
    return baseMargin + volatilityAdjustment + liquidityAdjustment;
  }

  /**
   * Calculate rate variance across providers
   */
  private calculateRateVariance(rates: ExchangeRate[]): number {
    if (rates.length < 2) return 0;

    const mean = rates.reduce((sum, rate) => sum + rate.rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => 
      sum + Math.pow(rate.rate - mean, 2), 0
    ) / rates.length;

    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  /**
   * Cache rate in Redis
   */
  private async cacheRate(pairKey: string, rate: CompetitiveRate): Promise<void> {
    try {
      await this.redis.setex(
        `rate:${pairKey}`,
        this.config.cache.aggregatedTTL,
        JSON.stringify(rate)
      );
    } catch (error) {
      console.error('Failed to cache rate:', error);
    }
  }

  /**
   * Update provider latency metrics
   */
  private updateProviderLatency(providerName: string, latency: number): void {
    const provider = this.providers.get(providerName);
    if (provider) {
      provider.latency = (provider.latency * 0.8) + (latency * 0.2); // EMA
    }
  }

  /**
   * Update provider reliability metrics
   */
  private updateProviderReliability(providerName: string, success: boolean): void {
    const provider = this.providers.get(providerName);
    if (provider) {
      const adjustment = success ? 0.1 : -0.2;
      provider.reliability = Math.max(0, Math.min(1, provider.reliability + adjustment));
    }
  }

  /**
   * Get aggregated rate for currency pair
   */
  getRate(pair: CurrencyPair): CompetitiveRate | null {
    const pairKey = `${pair.from}-${pair.to}`;
    return this.aggregatedRates.get(pairKey) || null;
  }
}

/**
 * Hedging strategy manager for FX risk mitigation
 */
class HedgingStrategyManager {
  private strategies: Map<string, HedgingStrategy> = new Map();
  private exposures: Map<string, number> = new Map(); // Currency -> net exposure

  constructor(
    private config: CurrencyConverterConfig,
    private supabase: SupabaseClient
  ) {
    this.initializeStrategies();
  }

  /**
   * Initialize hedging strategies
   */
  private initializeStrategies(): void {
    this.config.hedgingStrategies.forEach(strategy => {
      this.strategies.set(strategy.name, strategy);
    });
  }

  /**
   * Assess hedging requirements for conversion
   */
  async assessHedgingRequirement(request: ConversionRequest): Promise<{
    required: boolean;
    strategy?: HedgingStrategy;
    coverage: number;
    cost: number;
  }> {
    const exposure = await this.calculateExposure(request);
    const volatility = await this.getVolatility(request.from, request.to);
    
    const riskScore = this.calculateRiskScore(exposure, volatility, request.amount);
    
    if (riskScore < 0.3) {
      return { required: false, coverage: 0, cost: 0 };
    }

    const strategy = this.selectOptimalStrategy(request, riskScore);
    const coverage = this.calculateOptimalCoverage(riskScore, request.amount);
    const cost = this.estimateHedgeCost(strategy, coverage, request.amount);

    return {
      required: true,
      strategy,
      coverage,
      cost
    };
  }

  /**
   * Execute hedging strategy
   */
  async executeHedge(
    request: ConversionRequest,
    strategy: HedgingStrategy,
    coverage: number
  ): Promise<HedgeInfo> {
    const hedgeAmount = request.amount * (coverage / 100);
    
    // This would integrate with actual treasury/derivative systems
    const instrumentId = await this.createHedgeInstrument(
      strategy,
      request.from,
      request.to,
      hedgeAmount
    );

    const cost = this.estimateHedgeCost(strategy, coverage, request.amount);

    // Record hedge in database
    await this.recordHedge(request, strategy, coverage, instrumentId, cost);

    // Update exposure tracking
    this.updateExposure(request.from, -hedgeAmount);
    this.updateExposure(request.to, hedgeAmount);

    return {
      strategy: strategy.name as any,
      coverage,
      cost,
      maturity: this.calculateMaturity(strategy),
      instrumentId
    };
  }

  /**
   * Calculate current exposure for currency pair
   */
  private async calculateExposure(request: ConversionRequest): Promise<number> {
    const fromExposure = this.exposures.get(request.from) || 0;
    const toExposure = this.exposures.get(request.to) || 0;
    
    return Math.abs(fromExposure - toExposure);
  }

  /**
   * Get currency pair volatility
   */
  private async getVolatility(from: string, to: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('currency_volatility')
        .select('volatility_30d')
        .eq('from_currency', from)
        .eq('to_currency', to)
        .single();

      if (error || !data) return 0.15; // Default 15% volatility

      return data.volatility_30d;
    } catch (error) {
      console.error('Failed to get volatility:', error);
      return 0.15;
    }
  }

  /**
   * Calculate risk score for hedging decision
   */
  private calculateRiskScore(
    exposure: number,
    volatility: number,
    amount: number
  ): number {
    const exposureScore = Math.min(1, exposure / 1000000); // Normalize to $1M
    const volatilityScore = Math.min(1, volatility / 0.5); // Normalize to 50%
    const amountScore = Math.min(1, amount / 100000); // Normalize to $100K

    return (exposureScore * 0.4) + (volatilityScore * 0.4) + (amountScore * 0.2);
  }

  /**
   * Select optimal hedging strategy
   */
  private selectOptimalStrategy(
    request: ConversionRequest,
    riskScore: number
  ): HedgingStrategy {
    const strategies = Array.from(this.strategies.values());
    
    // Filter strategies by amount threshold
    const eligibleStrategies = strategies.filter(s => 
      request.amount >= s.threshold
    );

    if (eligibleStrategies.length === 0) {
      return strategies[0]; // Fallback to first strategy
    }

    // Select based on risk score and cost
    return eligibleStrategies.reduce((best, current) => {
      const bestScore = this.scoreStrategy(best, riskScore, request.amount);
      const currentScore = this.scoreStrategy(current, riskScore, request.amount);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Score hedging strategy
   */
  private scoreStrategy(
    strategy: HedgingStrategy,
    riskScore: number,
    amount: number
  ): number {
    const coverageScore = strategy.coverage / 100;
    const costScore = 1 - (strategy.maxCost / 10); // Invert cost (lower is better)
    const riskFitScore = Math.abs(riskScore - (strategy.coverage / 100));

    return (coverageScore * 0.4) + (costScore * 0.4) + (1 - riskFitScore) * 0.2;
  }

  /**
   * Calculate optimal coverage percentage
   */
  private calculateOptimalCoverage(riskScore: number, amount: number): number {
    const baseCoverage = riskScore * 100;
    
    // Adjust based on amount
    const amountAdjustment = Math.min(20, amount / 50000); // Up to 20% more for large amounts
    
    return Math.min(100, Math.max(10, baseCoverage + amountAdjustment));
  }

  /**
   * Estimate hedge cost
   */
  private estimateHedgeCost(
    strategy: HedgingStrategy,
    coverage: number,
    amount: number
  ): number {
    const baseCost = strategy.maxCost / 100;
    const coverageMultiplier = coverage / 100;
    
    return amount * baseCost * coverageMultiplier;
  }

  /**
   * Create hedge instrument (simplified)
   */
  private async createHedgeInstrument(
    strategy: HedgingStrategy,
    from: string,
    to: string,
    amount: number
  ): Promise<string> {
    // This would integrate with actual derivative trading systems
    const instrumentId = `HEDGE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate instrument creation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return instrumentId;
  }

  /**
   * Record hedge in database
   */
  private async recordHedge(
    request: ConversionRequest,
    strategy: HedgingStrategy,
    coverage: number,
    instrumentId: string,
    cost: number
  ): Promise<void> {
    try {
      await this.supabase.from('hedge_records').insert({
        user_id: request.userId,
        from_currency: request.from,
        to_currency: request.to,
        amount: request.amount,
        strategy: strategy.name,
        coverage,
        instrument_id: instrumentId,
        cost,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to record hedge:', error);
    }
  }

  /**
   * Calculate hedge maturity
   */
  private calculateMaturity(strategy: HedgingStrategy): Date {
    const days = strategy.name === 'forward' ? 30 : 
                 strategy.name === 'option' ? 90 : 180;
    
    const maturity = new Date();
    maturity.setDate(maturity.getDate() + days);
    return maturity;
  }

  /**
   * Update currency exposure tracking
   */
  private updateExposure(currency: string, amount: number): void {
    const current = this.exposures.get(currency) || 0;
    this.exposures.set(currency, current + amount);
  }
}

/**
 * Risk calculator module for conversion risk assessment
 */
class RiskCalculatorModule {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calculate comprehensive risk assessment
   */
  async calculateRisk(request: ConversionRequest): Promise<RiskAssessment> {
    const [volatility, liquidity, marketImpact] = await Promise.all([
      this.calculateVolatilityScore(request.from, request.to),
      this.calculateLiquidityScore(request.from, request.to, request.amount),
      this.calculateMarketImpact(request.from, request.to, request.amount)
    ]);

    const overallScore = (volatility * 0.4) + (liquidity * 0.3) + (marketImpact * 0.3);
    
    const exposureLevel = this.determineExposureLevel(overallScore);
    const recommendedHedge = this.shouldRecommendHedge(request, overallScore);

    return {
      volatilityScore: volatility,
      liquidityScore