/**
 * @fileoverview Payment Fraud Prevention AI Module
 * Advanced ML-powered fraud prevention with adaptive learning and cross-merchant intelligence
 * @version 1.0.0
 * @author CR AudioViz AI Platform
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * Transaction data structure for fraud analysis
 */
export interface TransactionData {
  id: string;
  merchantId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  metadata?: Record<string, unknown>;
}

/**
 * Address information for transaction analysis
 */
export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

/**
 * Fraud risk assessment result
 */
export interface FraudRiskAssessment {
  transactionId: string;
  riskScore: number;
  confidence: number;
  riskFactors: RiskFactor[];
  recommendation: FraudRecommendation;
  processingTime: number;
}

/**
 * Individual risk factor contributing to fraud score
 */
export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
}

/**
 * Fraud prevention recommendation
 */
export interface FraudRecommendation {
  action: 'approve' | 'review' | 'decline' | 'challenge';
  reason: string;
  requiredActions?: string[];
}

/**
 * Fraud pattern data structure
 */
export interface FraudPattern {
  id: string;
  patternType: string;
  features: number[];
  embedding: number[];
  confidence: number;
  lastSeen: Date;
  frequency: number;
  merchantIds: string[];
}

/**
 * Fraud alert configuration
 */
export interface FraudAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  transactionId: string;
  merchantId: string;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Model training configuration
 */
export interface ModelConfig {
  modelType: 'ensemble' | 'neural' | 'gradient_boosting';
  features: string[];
  hyperparameters: Record<string, unknown>;
  validationSplit: number;
  epochs?: number;
  batchSize?: number;
}

/**
 * Cross-merchant intelligence data
 */
export interface CrossMerchantIntelligence {
  fraudPatterns: FraudPattern[];
  blacklistedEntities: BlacklistEntry[];
  riskMetrics: MerchantRiskMetrics;
  lastUpdated: Date;
}

/**
 * Blacklist entry for known fraud entities
 */
export interface BlacklistEntry {
  type: 'ip' | 'email' | 'device' | 'card';
  value: string;
  reason: string;
  confidence: number;
  addedAt: Date;
  expiresAt?: Date;
}

/**
 * Merchant risk metrics
 */
export interface MerchantRiskMetrics {
  fraudRate: number;
  avgTransactionAmount: number;
  suspiciousPatterns: number;
  falsePositiveRate: number;
}

/**
 * Feature extraction result
 */
export interface ExtractedFeatures {
  transactionId: string;
  features: Record<string, number>;
  vectorEmbedding: number[];
  timestamp: Date;
}

/**
 * Core fraud detection engine with ensemble ML models
 */
export class FraudDetectionEngine extends EventEmitter {
  private models: Map<string, tf.LayersModel> = new Map();
  private isInitialized = false;
  private readonly modelPath = '/models/fraud-detection/';

  /**
   * Initialize the fraud detection engine
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadModels();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      throw new Error(`Failed to initialize fraud detection engine: ${error}`);
    }
  }

  /**
   * Load ML models for fraud detection
   */
  private async loadModels(): Promise<void> {
    const modelTypes = ['primary', 'anomaly', 'pattern', 'behavioral'];
    
    for (const modelType of modelTypes) {
      try {
        const model = await tf.loadLayersModel(`${this.modelPath}${modelType}/model.json`);
        this.models.set(modelType, model);
      } catch (error) {
        console.warn(`Failed to load model ${modelType}:`, error);
      }
    }

    if (this.models.size === 0) {
      throw new Error('No fraud detection models could be loaded');
    }
  }

  /**
   * Predict fraud probability using ensemble models
   */
  public async predictFraud(features: number[]): Promise<{ score: number; confidence: number }> {
    if (!this.isInitialized) {
      throw new Error('Fraud detection engine not initialized');
    }

    const predictions: number[] = [];
    const featureTensor = tf.tensor2d([features]);

    try {
      for (const [modelType, model] of this.models) {
        const prediction = model.predict(featureTensor) as tf.Tensor;
        const score = await prediction.data();
        predictions.push(score[0]);
        prediction.dispose();
      }

      const ensembleScore = this.calculateEnsembleScore(predictions);
      const confidence = this.calculateConfidence(predictions);

      return { score: ensembleScore, confidence };
    } finally {
      featureTensor.dispose();
    }
  }

  /**
   * Calculate ensemble score from multiple model predictions
   */
  private calculateEnsembleScore(predictions: number[]): number {
    const weights = [0.4, 0.3, 0.2, 0.1]; // Weighted average
    let weightedSum = 0;
    let totalWeight = 0;

    predictions.forEach((prediction, index) => {
      const weight = weights[index] || 0.1;
      weightedSum += prediction * weight;
      totalWeight += weight;
    });

    return Math.min(Math.max(weightedSum / totalWeight, 0), 1);
  }

  /**
   * Calculate confidence based on prediction variance
   */
  private calculateConfidence(predictions: number[]): number {
    if (predictions.length < 2) return 0.5;

    const mean = predictions.reduce((sum, pred) => sum + pred, 0) / predictions.length;
    const variance = predictions.reduce((sum, pred) => sum + Math.pow(pred - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher confidence
    return Math.max(0, 1 - (stdDev * 2));
  }

  /**
   * Update models with new training data
   */
  public async updateModels(trainingData: { features: number[][]; labels: number[] }): Promise<void> {
    // Implementation for online learning would go here
    this.emit('models-updated');
  }
}

/**
 * Real-time transaction pattern analysis and anomaly detection
 */
export class PatternAnalyzer {
  private redis: Redis;
  private patternCache: Map<string, FraudPattern> = new Map();

  constructor(redisConfig: { host: string; port: number; password?: string }) {
    this.redis = new Redis(redisConfig);
  }

  /**
   * Analyze transaction patterns for anomalies
   */
  public async analyzePattern(transaction: TransactionData, userHistory: TransactionData[]): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Velocity check
    const velocityRisk = await this.checkVelocity(transaction, userHistory);
    if (velocityRisk) riskFactors.push(velocityRisk);

    // Amount anomaly check
    const amountRisk = this.checkAmountAnomaly(transaction, userHistory);
    if (amountRisk) riskFactors.push(amountRisk);

    // Geographic anomaly check
    const geoRisk = await this.checkGeographicAnomaly(transaction);
    if (geoRisk) riskFactors.push(geoRisk);

    // Time-based anomaly check
    const timeRisk = this.checkTimeAnomaly(transaction, userHistory);
    if (timeRisk) riskFactors.push(timeRisk);

    // Device fingerprint check
    const deviceRisk = await this.checkDeviceAnomaly(transaction);
    if (deviceRisk) riskFactors.push(deviceRisk);

    return riskFactors;
  }

  /**
   * Check for suspicious transaction velocity
   */
  private async checkVelocity(transaction: TransactionData, userHistory: TransactionData[]): Promise<RiskFactor | null> {
    const timeWindow = 3600000; // 1 hour in milliseconds
    const currentTime = transaction.timestamp.getTime();
    
    const recentTransactions = userHistory.filter(
      tx => currentTime - tx.timestamp.getTime() < timeWindow
    );

    if (recentTransactions.length >= 5) {
      return {
        type: 'velocity',
        severity: 'high',
        score: 0.8,
        description: `${recentTransactions.length} transactions in the last hour`
      };
    }

    if (recentTransactions.length >= 3) {
      return {
        type: 'velocity',
        severity: 'medium',
        score: 0.5,
        description: `${recentTransactions.length} transactions in the last hour`
      };
    }

    return null;
  }

  /**
   * Check for amount-based anomalies
   */
  private checkAmountAnomaly(transaction: TransactionData, userHistory: TransactionData[]): RiskFactor | null {
    if (userHistory.length < 3) return null;

    const amounts = userHistory.map(tx => tx.amount);
    const avgAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((sum, amount) => sum + Math.pow(amount - avgAmount, 2), 0) / amounts.length);

    const zScore = Math.abs((transaction.amount - avgAmount) / stdDev);

    if (zScore > 3) {
      return {
        type: 'amount_anomaly',
        severity: 'high',
        score: Math.min(zScore / 10, 0.9),
        description: `Transaction amount ${transaction.amount} deviates significantly from user pattern`
      };
    }

    if (zScore > 2) {
      return {
        type: 'amount_anomaly',
        severity: 'medium',
        score: Math.min(zScore / 15, 0.6),
        description: `Transaction amount ${transaction.amount} is unusual for this user`
      };
    }

    return null;
  }

  /**
   * Check for geographic anomalies
   */
  private async checkGeographicAnomaly(transaction: TransactionData): Promise<RiskFactor | null> {
    const cacheKey = `geo:${transaction.ipAddress}`;
    let location = await this.redis.get(cacheKey);

    if (!location) {
      // In production, integrate with IP geolocation service
      location = await this.getLocationFromIP(transaction.ipAddress);
      await this.redis.setex(cacheKey, 3600, location);
    }

    const locationData = JSON.parse(location);
    
    // Check against user's typical locations
    const userLocationKey = `user_locations:${transaction.userId}`;
    const userLocations = await this.redis.smembers(userLocationKey);

    if (userLocations.length > 0 && !userLocations.includes(locationData.country)) {
      return {
        type: 'geographic_anomaly',
        severity: 'medium',
        score: 0.6,
        description: `Transaction from unusual location: ${locationData.country}`
      };
    }

    // Add current location to user's typical locations
    await this.redis.sadd(userLocationKey, locationData.country);
    await this.redis.expire(userLocationKey, 7776000); // 90 days

    return null;
  }

  /**
   * Get location information from IP address
   */
  private async getLocationFromIP(ipAddress: string): Promise<string> {
    // Mock implementation - in production, integrate with IP geolocation service
    return JSON.stringify({
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194
    });
  }

  /**
   * Check for time-based anomalies
   */
  private checkTimeAnomaly(transaction: TransactionData, userHistory: TransactionData[]): RiskFactor | null {
    if (userHistory.length < 5) return null;

    const hour = transaction.timestamp.getHours();
    const userHours = userHistory.map(tx => tx.timestamp.getHours());
    const hourCounts = new Map<number, number>();

    userHours.forEach(h => {
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    });

    const currentHourCount = hourCounts.get(hour) || 0;
    const totalTransactions = userHistory.length;
    const probability = currentHourCount / totalTransactions;

    if (probability < 0.1 && currentHourCount === 0) {
      return {
        type: 'time_anomaly',
        severity: 'medium',
        score: 0.4,
        description: `Transaction at unusual hour: ${hour}:00`
      };
    }

    return null;
  }

  /**
   * Check for device-based anomalies
   */
  private async checkDeviceAnomaly(transaction: TransactionData): Promise<RiskFactor | null> {
    if (!transaction.deviceFingerprint) return null;

    const userDeviceKey = `user_devices:${transaction.userId}`;
    const userDevices = await this.redis.smembers(userDeviceKey);

    if (userDevices.length > 0 && !userDevices.includes(transaction.deviceFingerprint)) {
      return {
        type: 'device_anomaly',
        severity: 'medium',
        score: 0.5,
        description: 'Transaction from unrecognized device'
      };
    }

    // Add device to user's known devices
    await this.redis.sadd(userDeviceKey, transaction.deviceFingerprint);
    await this.redis.expire(userDeviceKey, 7776000); // 90 days

    return null;
  }
}

/**
 * Adaptive learning system for continuous model improvement
 */
export class AdaptiveLearningSystem {
  private supabase: SupabaseClient;
  private learningQueue: Array<{ transaction: TransactionData; label: number }> = [];
  private readonly batchSize = 100;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Add labeled transaction data for learning
   */
  public async addLabeledData(transaction: TransactionData, isFraud: boolean): Promise<void> {
    this.learningQueue.push({ transaction, label: isFraud ? 1 : 0 });

    if (this.learningQueue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  /**
   * Process batch of labeled data for model updates
   */
  private async processBatch(): Promise<void> {
    if (this.learningQueue.length === 0) return;

    const batch = [...this.learningQueue];
    this.learningQueue = [];

    try {
      // Store training data in database
      const trainingData = batch.map(item => ({
        transaction_id: item.transaction.id,
        transaction_data: item.transaction,
        label: item.label,
        created_at: new Date().toISOString()
      }));

      await this.supabase
        .from('fraud_training_data')
        .insert(trainingData);

      // Trigger model retraining if we have enough new data
      await this.checkRetrainingThreshold();
    } catch (error) {
      console.error('Failed to process learning batch:', error);
      // Re-add failed items to queue
      this.learningQueue.unshift(...batch);
    }
  }

  /**
   * Check if model retraining threshold is met
   */
  private async checkRetrainingThreshold(): Promise<void> {
    const { count } = await this.supabase
      .from('fraud_training_data')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (count && count >= 1000) {
      await this.triggerModelRetraining();
    }
  }

  /**
   * Trigger model retraining process
   */
  private async triggerModelRetraining(): Promise<void> {
    try {
      await this.supabase.functions.invoke('retrain-fraud-models', {
        body: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Failed to trigger model retraining:', error);
    }
  }

  /**
   * Get learning statistics
   */
  public async getLearningStats(): Promise<{
    totalSamples: number;
    fraudSamples: number;
    legitSamples: number;
    lastRetraining: Date | null;
  }> {
    const { data, error } = await this.supabase
      .from('fraud_training_data')
      .select('label, created_at');

    if (error) throw error;

    const totalSamples = data?.length || 0;
    const fraudSamples = data?.filter(item => item.label === 1).length || 0;
    const legitSamples = totalSamples - fraudSamples;

    // Get last retraining date
    const { data: retrainingData } = await this.supabase
      .from('model_retraining_log')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const lastRetraining = retrainingData?.[0]?.created_at 
      ? new Date(retrainingData[0].created_at) 
      : null;

    return {
      totalSamples,
      fraudSamples,
      legitSamples,
      lastRetraining
    };
  }
}

/**
 * Cross-merchant intelligence sharing system
 */
export class CrossMerchantIntelligence {
  private supabase: SupabaseClient;
  private redis: Redis;

  constructor(supabaseUrl: string, supabaseKey: string, redisConfig: { host: string; port: number; password?: string }) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisConfig);
  }

  /**
   * Share fraud pattern with merchant network
   */
  public async sharePattern(pattern: FraudPattern): Promise<void> {
    try {
      await this.supabase
        .from('shared_fraud_patterns')
        .insert({
          pattern_id: pattern.id,
          pattern_type: pattern.patternType,
          features: pattern.features,
          embedding: pattern.embedding,
          confidence: pattern.confidence,
          merchant_ids: pattern.merchantIds
        });

      // Cache pattern for quick access
      await this.redis.setex(`pattern:${pattern.id}`, 3600, JSON.stringify(pattern));
    } catch (error) {
      console.error('Failed to share fraud pattern:', error);
    }
  }

  /**
   * Get relevant fraud patterns for a transaction
   */
  public async getRelevantPatterns(transaction: TransactionData): Promise<FraudPattern[]> {
    const cacheKey = `patterns:${transaction.merchantId}`;
    let patterns = await this.redis.get(cacheKey);

    if (!patterns) {
      const { data, error } = await this.supabase
        .from('shared_fraud_patterns')
        .select('*')
        .or(`merchant_ids.cs.{${transaction.merchantId}},merchant_ids.cs.{all}`)
        .gte('confidence', 0.7)
        .order('confidence', { ascending: false })
        .limit(50);

      if (error) throw error;

      patterns = JSON.stringify(data || []);
      await this.redis.setex(cacheKey, 300, patterns);
    }

    return JSON.parse(patterns);
  }

  /**
   * Add entity to blacklist
   */
  public async addToBlacklist(entry: BlacklistEntry): Promise<void> {
    await this.supabase
      .from('fraud_blacklist')
      .insert({
        type: entry.type,
        value: entry.value,
        reason: entry.reason,
        confidence: entry.confidence,
        expires_at: entry.expiresAt?.toISOString()
      });

    // Cache blacklist entry
    await this.redis.setex(`blacklist:${entry.type}:${entry.value}`, 3600, JSON.stringify(entry));
  }

  /**
   * Check if entity is blacklisted
   */
  public async isBlacklisted(type: string, value: string): Promise<BlacklistEntry | null> {
    const cacheKey = `blacklist:${type}:${value}`;
    let entry = await this.redis.get(cacheKey);

    if (!entry) {
      const { data, error } = await this.supabase
        .from('fraud_blacklist')
        .select('*')
        .eq('type', type)
        .eq('value', value)
        .or('expires_at.is.null,expires_at.gte.now()')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return null;

      entry = JSON.stringify(data);
      await this.redis.setex(cacheKey, 3600, entry);
    }

    const blacklistEntry = JSON.parse(entry);
    return {
      type: blacklistEntry.type,
      value: blacklistEntry.value,
      reason: blacklistEntry.reason,
      confidence: blacklistEntry.confidence,
      addedAt: new Date(blacklistEntry.created_at),
      expiresAt: blacklistEntry.expires_at ? new Date(blacklistEntry.expires_at) : undefined
    };