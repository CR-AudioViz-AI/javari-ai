import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import { Redis } from 'ioredis';

/**
 * Transaction data interface for fraud analysis
 */
export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantCategory: string;
  timestamp: Date;
  ipAddress: string;
  deviceFingerprint: string;
  geolocation?: {
    latitude: number;
    longitude: number;
    country: string;
    city: string;
  };
  paymentMethod: {
    type: 'card' | 'bank' | 'wallet';
    lastFour: string;
    brand?: string;
  };
  billingAddress?: {
    country: string;
    postalCode: string;
  };
}

/**
 * Risk assessment result interface
 */
export interface RiskAssessment {
  transactionId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  recommendation: 'approve' | 'review' | 'decline';
  confidence: number;
  mlPrediction?: number;
  timestamp: Date;
}

/**
 * Individual risk factor interface
 */
export interface RiskFactor {
  type: string;
  description: string;
  score: number;
  weight: number;
  details?: Record<string, any>;
}

/**
 * Fraud rule configuration interface
 */
export interface FraudRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: 'flag' | 'block' | 'review';
  weight: number;
  isActive: boolean;
  threshold?: number;
  parameters?: Record<string, any>;
}

/**
 * Velocity tracking data interface
 */
export interface VelocityData {
  userId: string;
  timeWindow: string;
  transactionCount: number;
  totalAmount: number;
  uniqueLocations: number;
  uniqueDevices: number;
  lastTransaction: Date;
}

/**
 * Device fingerprint interface
 */
export interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  hash: string;
}

/**
 * Fraud alert interface
 */
export interface FraudAlert {
  id: string;
  transactionId: string;
  userId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, any>;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
}

/**
 * Service configuration interface
 */
export interface FraudPreventionConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  mlModelUrl?: string;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  velocityLimits: {
    hourly: { count: number; amount: number };
    daily: { count: number; amount: number };
    weekly: { count: number; amount: number };
  };
  geofencing: {
    enabled: boolean;
    allowedCountries?: string[];
    blockedCountries?: string[];
  };
}

/**
 * Pattern recognition result interface
 */
export interface PatternAnalysis {
  isAnomalous: boolean;
  anomalyScore: number;
  patterns: {
    temporal: number;
    geographical: number;
    behavioral: number;
    transactional: number;
  };
  clusters: string[];
}

/**
 * Transaction analyzer for pattern recognition and anomaly detection
 */
class TransactionAnalyzer {
  private readonly redis: Redis;
  private readonly supabase: SupabaseClient;

  constructor(redis: Redis, supabase: SupabaseClient) {
    this.redis = redis;
    this.supabase = supabase;
  }

  /**
   * Analyzes transaction patterns for anomalies
   * @param transaction - Transaction to analyze
   * @param userHistory - Historical transactions for comparison
   * @returns Pattern analysis result
   */
  async analyzePatterns(
    transaction: Transaction,
    userHistory: Transaction[]
  ): Promise<PatternAnalysis> {
    try {
      const temporal = await this.analyzeTemporalPatterns(transaction, userHistory);
      const geographical = await this.analyzeGeographicalPatterns(transaction, userHistory);
      const behavioral = await this.analyzeBehavioralPatterns(transaction, userHistory);
      const transactional = await this.analyzeTransactionalPatterns(transaction, userHistory);

      const overallScore = (temporal + geographical + behavioral + transactional) / 4;
      const isAnomalous = overallScore > 0.7;

      return {
        isAnomalous,
        anomalyScore: overallScore,
        patterns: {
          temporal,
          geographical,
          behavioral,
          transactional
        },
        clusters: await this.identifyClusters(transaction, userHistory)
      };
    } catch (error) {
      throw new Error(`Pattern analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyzes temporal transaction patterns
   */
  private async analyzeTemporalPatterns(
    transaction: Transaction,
    history: Transaction[]
  ): Promise<number> {
    if (history.length === 0) return 0.5;

    const hour = transaction.timestamp.getHours();
    const dayOfWeek = transaction.timestamp.getDay();

    const hourlyDistribution = new Array(24).fill(0);
    const weeklyDistribution = new Array(7).fill(0);

    history.forEach(tx => {
      hourlyDistribution[tx.timestamp.getHours()]++;
      weeklyDistribution[tx.timestamp.getDay()]++;
    });

    const hourlyFreq = hourlyDistribution[hour] / history.length;
    const weeklyFreq = weeklyDistribution[dayOfWeek] / history.length;

    return 1 - Math.max(hourlyFreq, weeklyFreq);
  }

  /**
   * Analyzes geographical transaction patterns
   */
  private async analyzeGeographicalPatterns(
    transaction: Transaction,
    history: Transaction[]
  ): Promise<number> {
    if (!transaction.geolocation || history.length === 0) return 0.5;

    const locations = history
      .filter(tx => tx.geolocation)
      .map(tx => tx.geolocation!);

    if (locations.length === 0) return 0.8;

    const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
    const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;

    const distance = this.calculateDistance(
      transaction.geolocation.latitude,
      transaction.geolocation.longitude,
      avgLat,
      avgLng
    );

    return Math.min(distance / 1000, 1); // Normalize to 0-1 based on km
  }

  /**
   * Analyzes behavioral transaction patterns
   */
  private async analyzeBehavioralPatterns(
    transaction: Transaction,
    history: Transaction[]
  ): Promise<number> {
    if (history.length === 0) return 0.5;

    const avgAmount = history.reduce((sum, tx) => sum + tx.amount, 0) / history.length;
    const amountDeviation = Math.abs(transaction.amount - avgAmount) / avgAmount;

    const merchantFreq = history.filter(tx => 
      tx.merchantId === transaction.merchantId
    ).length / history.length;

    const categoryFreq = history.filter(tx => 
      tx.merchantCategory === transaction.merchantCategory
    ).length / history.length;

    return Math.max(
      Math.min(amountDeviation, 1),
      1 - merchantFreq,
      1 - categoryFreq
    );
  }

  /**
   * Analyzes transactional patterns
   */
  private async analyzeTransactionalPatterns(
    transaction: Transaction,
    history: Transaction[]
  ): Promise<number> {
    if (history.length === 0) return 0.5;

    const paymentMethodFreq = history.filter(tx => 
      tx.paymentMethod.type === transaction.paymentMethod.type
    ).length / history.length;

    const currencyFreq = history.filter(tx => 
      tx.currency === transaction.currency
    ).length / history.length;

    return 1 - Math.max(paymentMethodFreq, currencyFreq);
  }

  /**
   * Identifies transaction clusters
   */
  private async identifyClusters(
    transaction: Transaction,
    history: Transaction[]
  ): Promise<string[]> {
    const clusters: string[] = [];

    // Amount-based clustering
    const similarAmounts = history.filter(tx => 
      Math.abs(tx.amount - transaction.amount) / transaction.amount < 0.1
    );
    if (similarAmounts.length > 2) clusters.push('amount_cluster');

    // Merchant-based clustering
    const sameMerchant = history.filter(tx => 
      tx.merchantId === transaction.merchantId
    );
    if (sameMerchant.length > 5) clusters.push('merchant_cluster');

    // Time-based clustering
    const recentTransactions = history.filter(tx => 
      Date.now() - tx.timestamp.getTime() < 3600000 // 1 hour
    );
    if (recentTransactions.length > 3) clusters.push('time_cluster');

    return clusters;
  }

  /**
   * Calculates distance between two coordinates
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Risk score calculator with multi-factor analysis
 */
class RiskScoreCalculator {
  private readonly weights = {
    velocity: 0.25,
    geolocation: 0.20,
    device: 0.15,
    pattern: 0.20,
    rules: 0.20
  };

  /**
   * Calculates comprehensive risk score
   * @param factors - Risk factors to consider
   * @returns Calculated risk score (0-1)
   */
  calculateRiskScore(factors: RiskFactor[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    factors.forEach(factor => {
      totalScore += factor.score * factor.weight;
      totalWeight += factor.weight;
    });

    return totalWeight > 0 ? Math.min(totalScore / totalWeight, 1) : 0;
  }

  /**
   * Determines risk level based on score
   * @param score - Risk score (0-1)
   * @param thresholds - Risk level thresholds
   * @returns Risk level classification
   */
  getRiskLevel(
    score: number,
    thresholds: { low: number; medium: number; high: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.9) return 'critical';
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Provides recommendation based on risk level
   * @param riskLevel - Calculated risk level
   * @returns Action recommendation
   */
  getRecommendation(riskLevel: string): 'approve' | 'review' | 'decline' {
    switch (riskLevel) {
      case 'critical':
        return 'decline';
      case 'high':
        return 'review';
      case 'medium':
        return 'review';
      default:
        return 'approve';
    }
  }
}

/**
 * Fraud rule engine for configurable business rules
 */
class FraudRuleEngine {
  private rules: FraudRule[] = [];

  /**
   * Loads fraud rules from database
   * @param supabase - Supabase client
   */
  async loadRules(supabase: SupabaseClient): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('fraud_rules')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      this.rules = data || [];
    } catch (error) {
      throw new Error(`Failed to load fraud rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Evaluates transaction against fraud rules
   * @param transaction - Transaction to evaluate
   * @param context - Additional context data
   * @returns Array of triggered rule factors
   */
  async evaluateRules(
    transaction: Transaction,
    context: Record<string, any>
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    for (const rule of this.rules) {
      try {
        const triggered = await this.evaluateRule(rule, transaction, context);
        if (triggered) {
          factors.push({
            type: 'rule',
            description: rule.description,
            score: rule.threshold || 0.8,
            weight: rule.weight,
            details: { ruleId: rule.id, ruleName: rule.name }
          });
        }
      } catch (error) {
        console.warn(`Rule evaluation failed for rule ${rule.id}:`, error);
      }
    }

    return factors;
  }

  /**
   * Evaluates a single fraud rule
   */
  private async evaluateRule(
    rule: FraudRule,
    transaction: Transaction,
    context: Record<string, any>
  ): Promise<boolean> {
    // Simple rule evaluation - in production, use a proper rule engine
    const ruleFunction = new Function('transaction', 'context', `return ${rule.condition}`);
    return ruleFunction(transaction, context);
  }
}

/**
 * Velocity tracker for transaction frequency monitoring
 */
class VelocityTracker {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Tracks transaction velocity for user
   * @param userId - User identifier
   * @param transaction - Current transaction
   * @param limits - Velocity limits configuration
   * @returns Velocity risk factors
   */
  async trackVelocity(
    userId: string,
    transaction: Transaction,
    limits: FraudPreventionConfig['velocityLimits']
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      // Track hourly velocity
      const hourlyKey = `velocity:${userId}:hourly:${Date.now().toString().slice(0, -7)}`;
      const hourlyCount = await this.incrementCounter(hourlyKey, 3600);
      const hourlyAmount = await this.addAmount(hourlyKey + ':amount', transaction.amount, 3600);

      if (hourlyCount > limits.hourly.count) {
        factors.push({
          type: 'velocity',
          description: 'Hourly transaction count exceeded',
          score: Math.min(hourlyCount / limits.hourly.count - 1, 1),
          weight: 0.8,
          details: { count: hourlyCount, limit: limits.hourly.count }
        });
      }

      if (hourlyAmount > limits.hourly.amount) {
        factors.push({
          type: 'velocity',
          description: 'Hourly transaction amount exceeded',
          score: Math.min(hourlyAmount / limits.hourly.amount - 1, 1),
          weight: 0.9,
          details: { amount: hourlyAmount, limit: limits.hourly.amount }
        });
      }

      // Track daily velocity
      const dailyKey = `velocity:${userId}:daily:${new Date().toISOString().slice(0, 10)}`;
      const dailyCount = await this.incrementCounter(dailyKey, 86400);
      const dailyAmount = await this.addAmount(dailyKey + ':amount', transaction.amount, 86400);

      if (dailyCount > limits.daily.count) {
        factors.push({
          type: 'velocity',
          description: 'Daily transaction count exceeded',
          score: Math.min(dailyCount / limits.daily.count - 1, 1),
          weight: 0.7,
          details: { count: dailyCount, limit: limits.daily.count }
        });
      }

      if (dailyAmount > limits.daily.amount) {
        factors.push({
          type: 'velocity',
          description: 'Daily transaction amount exceeded',
          score: Math.min(dailyAmount / limits.daily.amount - 1, 1),
          weight: 0.8,
          details: { amount: dailyAmount, limit: limits.daily.amount }
        });
      }

    } catch (error) {
      console.warn('Velocity tracking failed:', error);
    }

    return factors;
  }

  /**
   * Increments counter with expiration
   */
  private async incrementCounter(key: string, expireSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, expireSeconds);
    }
    return count;
  }

  /**
   * Adds amount to counter with expiration
   */
  private async addAmount(key: string, amount: number, expireSeconds: number): Promise<number> {
    const total = await this.redis.incrbyfloat(key, amount);
    const exists = await this.redis.exists(key);
    if (!exists) {
      await this.redis.expire(key, expireSeconds);
    }
    return total;
  }
}

/**
 * Geolocation analyzer for location-based risk assessment
 */
class GeolocationAnalyzer {
  /**
   * Analyzes geolocation risk factors
   * @param transaction - Transaction with location data
   * @param userHistory - Historical transactions for comparison
   * @param config - Geofencing configuration
   * @returns Geolocation risk factors
   */
  async analyzeGeolocation(
    transaction: Transaction,
    userHistory: Transaction[],
    config: FraudPreventionConfig['geofencing']
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (!transaction.geolocation) {
      factors.push({
        type: 'geolocation',
        description: 'Missing geolocation data',
        score: 0.3,
        weight: 0.5,
        details: { reason: 'no_location' }
      });
      return factors;
    }

    // Check country restrictions
    if (config.enabled) {
      if (config.blockedCountries?.includes(transaction.geolocation.country)) {
        factors.push({
          type: 'geolocation',
          description: 'Transaction from blocked country',
          score: 1.0,
          weight: 1.0,
          details: { country: transaction.geolocation.country }
        });
      }

      if (config.allowedCountries && !config.allowedCountries.includes(transaction.geolocation.country)) {
        factors.push({
          type: 'geolocation',
          description: 'Transaction from non-allowed country',
          score: 0.8,
          weight: 0.9,
          details: { country: transaction.geolocation.country }
        });
      }
    }

    // Check location velocity (impossible travel)
    const recentTransactions = userHistory
      .filter(tx => tx.geolocation && Date.now() - tx.timestamp.getTime() < 3600000)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (recentTransactions.length > 0) {
      const lastLocation = recentTransactions[0].geolocation!;
      const distance = this.calculateDistance(
        transaction.geolocation.latitude,
        transaction.geolocation.longitude,
        lastLocation.latitude,
        lastLocation.longitude
      );

      const timeElapsed = (transaction.timestamp.getTime() - recentTransactions[0].timestamp.getTime()) / 1000 / 3600; // hours
      const maxTravelSpeed = 900; // km/h (commercial aircraft)

      if (distance > maxTravelSpeed * timeElapsed) {
        factors.push({
          type: 'geolocation',
          description: 'Impossible travel detected',
          score: 0.9,
          weight: 0.9,
          details: {
            distance,
            timeElapsed,
            requiredSpeed: distance / timeElapsed
          }
        });
      }
    }

    return factors;
  }

  /**
   * Calculates distance between two coordinates
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Device fingerprint validator
 */
class DeviceFingerprintValidator {
  /**
   * Validates device fingerprint and generates risk factors
   * @param transaction - Transaction with device data
   * @param userHistory - Historical transactions for device comparison
   * @returns Device-based risk factors
   */
  async validateDevice(
    transaction: Transaction,
    userHistory: Transaction[]
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Check if device is known
    const knownDevices = new Set(userHistory