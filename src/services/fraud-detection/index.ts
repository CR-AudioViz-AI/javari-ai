/**
 * Advanced Payment Fraud Detection Service
 * 
 * Machine learning-powered fraud detection service that analyzes transaction patterns,
 * device fingerprinting, and behavioral biometrics to prevent payment fraud in real-time.
 * 
 * @module FraudDetectionService
 * @version 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import Redis from 'ioredis';

// ==================== INTERFACES ====================

/**
 * Transaction data structure for fraud analysis
 */
export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  timestamp: Date;
  ipAddress: string;
  location?: {
    latitude: number;
    longitude: number;
    country: string;
    city: string;
  };
  paymentMethod: {
    type: 'card' | 'bank' | 'wallet';
    lastFour?: string;
    bin?: string;
    issuer?: string;
  };
  metadata: Record<string, any>;
}

/**
 * Device fingerprint data
 */
export interface DeviceFingerprint {
  id: string;
  userId: string;
  fingerprint: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  canvasFingerprint: string;
  webglFingerprint: string;
  audioFingerprint: string;
  createdAt: Date;
  lastSeen: Date;
}

/**
 * Behavioral biometric data
 */
export interface BiometricData {
  userId: string;
  sessionId: string;
  keystrokeDynamics: {
    dwellTimes: number[];
    flightTimes: number[];
    typingSpeed: number;
    rhythm: number[];
  };
  mouseMovements: {
    velocity: number[];
    acceleration: number[];
    trajectory: Array<{x: number; y: number; timestamp: number}>;
    clickPatterns: Array<{duration: number; pressure: number}>;
  };
  touchBehavior?: {
    pressure: number[];
    size: number[];
    orientation: number[];
    swipeVelocity: number[];
  };
  sessionDuration: number;
  pageInteractions: number;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  transactionId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  decision: 'approve' | 'review' | 'decline';
  confidence: number;
  mlModelVersion: string;
  processingTime: number;
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  type: 'velocity' | 'location' | 'device' | 'amount' | 'behavioral' | 'pattern';
  weight: number;
  score: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Fraud detection rule
 */
export interface FraudRule {
  id: string;
  name: string;
  condition: string;
  action: 'flag' | 'decline' | 'review';
  priority: number;
  isActive: boolean;
  thresholds: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fraud alert
 */
export interface FraudAlert {
  id: string;
  transactionId: string;
  userId: string;
  alertType: 'suspicious_transaction' | 'new_device' | 'velocity_breach' | 'high_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, any>;
  isResolved: boolean;
  createdAt: Date;
}

/**
 * ML model configuration
 */
export interface MLModelConfig {
  modelPath: string;
  version: string;
  inputFeatures: string[];
  threshold: number;
  lastTrained: Date;
  accuracy: number;
  precision: number;
  recall: number;
}

/**
 * Service configuration
 */
export interface FraudDetectionConfig {
  supabase: {
    url: string;
    key: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  ml: {
    modelsPath: string;
    retrainInterval: number; // hours
    minTrainingDataPoints: number;
  };
  thresholds: {
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
    autoDeclineScore: number;
  };
  alerts: {
    email: {
      enabled: boolean;
      recipients: string[];
    };
    sms: {
      enabled: boolean;
      recipients: string[];
    };
  };
}

// ==================== CORE SERVICE ====================

/**
 * Advanced Payment Fraud Detection Service
 */
export class FraudDetectionService {
  private supabase: SupabaseClient;
  private redis: Redis;
  private mlModel: tf.LayersModel | null = null;
  private config: FraudDetectionConfig;
  private isInitialized = false;

  constructor(config: FraudDetectionConfig) {
    this.config = config;
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
  }

  /**
   * Initialize the fraud detection service
   */
  async initialize(): Promise<void> {
    try {
      await this.loadMLModel();
      await this.redis.ping();
      this.isInitialized = true;
      console.log('Fraud Detection Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Fraud Detection Service: ${error}`);
    }
  }

  /**
   * Analyze transaction for fraud risk
   */
  async analyzeTransaction(transaction: Transaction, deviceFingerprint?: DeviceFingerprint, biometrics?: BiometricData): Promise<RiskAssessment> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }

    const startTime = Date.now();

    try {
      // Parallel analysis execution
      const [
        transactionRisk,
        velocityRisk,
        locationRisk,
        deviceRisk,
        behavioralRisk,
        ruleBasedRisk
      ] = await Promise.all([
        this.analyzeTransactionPattern(transaction),
        this.analyzeVelocity(transaction),
        this.analyzeLocation(transaction),
        this.analyzeDevice(transaction, deviceFingerprint),
        this.analyzeBehavior(transaction, biometrics),
        this.applyFraudRules(transaction)
      ]);

      // Combine risk factors
      const factors: RiskFactor[] = [
        ...transactionRisk,
        ...velocityRisk,
        ...locationRisk,
        ...deviceRisk,
        ...behavioralRisk,
        ...ruleBasedRisk
      ];

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(factors);
      const riskLevel = this.determineRiskLevel(riskScore);
      const decision = this.makeDecision(riskScore, factors);
      const confidence = this.calculateConfidence(factors);

      const assessment: RiskAssessment = {
        transactionId: transaction.id,
        riskScore,
        riskLevel,
        factors,
        decision,
        confidence,
        mlModelVersion: this.getModelVersion(),
        processingTime: Date.now() - startTime
      };

      // Cache result and trigger alerts if needed
      await this.cacheRiskAssessment(assessment);
      await this.handleHighRiskTransaction(assessment, transaction);

      return assessment;
    } catch (error) {
      throw new Error(`Transaction analysis failed: ${error}`);
    }
  }

  /**
   * Generate device fingerprint
   */
  async generateDeviceFingerprint(clientData: any): Promise<DeviceFingerprint> {
    try {
      const fingerprint = this.calculateFingerprint({
        userAgent: clientData.userAgent,
        screen: clientData.screen,
        timezone: clientData.timezone,
        language: clientData.language,
        platform: clientData.platform,
        cookies: clientData.cookiesEnabled,
        doNotTrack: clientData.doNotTrack,
        canvas: clientData.canvasData,
        webgl: clientData.webglData,
        audio: clientData.audioData
      });

      const deviceFingerprint: DeviceFingerprint = {
        id: this.generateId(),
        userId: clientData.userId,
        fingerprint,
        userAgent: clientData.userAgent,
        screenResolution: `${clientData.screen.width}x${clientData.screen.height}`,
        timezone: clientData.timezone,
        language: clientData.language,
        platform: clientData.platform,
        cookiesEnabled: clientData.cookiesEnabled,
        doNotTrack: clientData.doNotTrack,
        canvasFingerprint: clientData.canvasData,
        webglFingerprint: clientData.webglData,
        audioFingerprint: clientData.audioData,
        createdAt: new Date(),
        lastSeen: new Date()
      };

      await this.storeDeviceFingerprint(deviceFingerprint);
      return deviceFingerprint;
    } catch (error) {
      throw new Error(`Device fingerprint generation failed: ${error}`);
    }
  }

  /**
   * Train ML model with new fraud data
   */
  async trainModel(): Promise<void> {
    try {
      const trainingData = await this.getTrainingData();
      
      if (trainingData.length < this.config.ml.minTrainingDataPoints) {
        console.log('Insufficient training data for model retraining');
        return;
      }

      const model = await this.createMLModel();
      const { features, labels } = this.prepareTrainingData(trainingData);

      await model.fit(features, labels, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true
      });

      await this.saveMLModel(model);
      this.mlModel = model;

      console.log('ML model retrained successfully');
    } catch (error) {
      throw new Error(`Model training failed: ${error}`);
    }
  }

  /**
   * Get fraud analytics dashboard data
   */
  async getDashboardData(timeRange: { start: Date; end: Date }): Promise<any> {
    try {
      const [
        transactionStats,
        fraudStats,
        riskDistribution,
        topRiskFactors,
        alertStats
      ] = await Promise.all([
        this.getTransactionStats(timeRange),
        this.getFraudStats(timeRange),
        this.getRiskDistribution(timeRange),
        this.getTopRiskFactors(timeRange),
        this.getAlertStats(timeRange)
      ]);

      return {
        transactionStats,
        fraudStats,
        riskDistribution,
        topRiskFactors,
        alertStats,
        generatedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Dashboard data generation failed: ${error}`);
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async loadMLModel(): Promise<void> {
    try {
      this.mlModel = await tf.loadLayersModel(this.config.ml.modelsPath);
    } catch (error) {
      console.warn('ML model not found, creating new model');
      this.mlModel = await this.createMLModel();
    }
  }

  private async createMLModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [20], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });

    return model;
  }

  private async analyzeTransactionPattern(transaction: Transaction): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Amount analysis
    const userTransactions = await this.getUserTransactionHistory(transaction.userId, 30);
    const avgAmount = userTransactions.reduce((sum, t) => sum + t.amount, 0) / userTransactions.length || 0;
    
    if (transaction.amount > avgAmount * 5) {
      factors.push({
        type: 'amount',
        weight: 0.3,
        score: Math.min(100, (transaction.amount / avgAmount) * 10),
        description: 'Transaction amount significantly higher than user average',
        severity: 'high'
      });
    }

    // Merchant analysis
    const merchantTransactions = await this.getMerchantRiskScore(transaction.merchantId);
    if (merchantTransactions > 0.7) {
      factors.push({
        type: 'pattern',
        weight: 0.2,
        score: merchantTransactions * 100,
        description: 'High-risk merchant detected',
        severity: 'medium'
      });
    }

    return factors;
  }

  private async analyzeVelocity(transaction: Transaction): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];
    const cacheKey = `velocity:${transaction.userId}`;

    try {
      const recentTransactions = await this.redis.lrange(cacheKey, 0, -1);
      const transactionCount = recentTransactions.length;
      const totalAmount = recentTransactions.reduce((sum, t) => sum + JSON.parse(t).amount, 0);

      // Transaction frequency check
      if (transactionCount > 10) {
        factors.push({
          type: 'velocity',
          weight: 0.4,
          score: Math.min(100, transactionCount * 8),
          description: `${transactionCount} transactions in the last hour`,
          severity: 'high'
        });
      }

      // Amount velocity check
      if (totalAmount > 10000) {
        factors.push({
          type: 'velocity',
          weight: 0.3,
          score: Math.min(100, (totalAmount / 10000) * 50),
          description: `High transaction amount velocity: $${totalAmount}`,
          severity: 'medium'
        });
      }

      // Update velocity tracking
      await this.redis.lpush(cacheKey, JSON.stringify({
        amount: transaction.amount,
        timestamp: transaction.timestamp
      }));
      await this.redis.expire(cacheKey, 3600); // 1 hour
    } catch (error) {
      console.error('Velocity analysis failed:', error);
    }

    return factors;
  }

  private async analyzeLocation(transaction: Transaction): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (!transaction.location) return factors;

    try {
      const userLocations = await this.getUserLocationHistory(transaction.userId);
      const isNewCountry = !userLocations.some(loc => loc.country === transaction.location!.country);

      if (isNewCountry) {
        factors.push({
          type: 'location',
          weight: 0.25,
          score: 60,
          description: `Transaction from new country: ${transaction.location.country}`,
          severity: 'medium'
        });
      }

      // High-risk country check
      const highRiskCountries = await this.getHighRiskCountries();
      if (highRiskCountries.includes(transaction.location.country)) {
        factors.push({
          type: 'location',
          weight: 0.3,
          score: 80,
          description: `Transaction from high-risk country: ${transaction.location.country}`,
          severity: 'high'
        });
      }
    } catch (error) {
      console.error('Location analysis failed:', error);
    }

    return factors;
  }

  private async analyzeDevice(transaction: Transaction, deviceFingerprint?: DeviceFingerprint): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (!deviceFingerprint) return factors;

    try {
      const knownDevices = await this.getUserDevices(transaction.userId);
      const isNewDevice = !knownDevices.some(device => device.fingerprint === deviceFingerprint.fingerprint);

      if (isNewDevice) {
        factors.push({
          type: 'device',
          weight: 0.2,
          score: 40,
          description: 'Transaction from new/unrecognized device',
          severity: 'medium'
        });
      }

      // Suspicious device characteristics
      if (deviceFingerprint.doNotTrack || !deviceFingerprint.cookiesEnabled) {
        factors.push({
          type: 'device',
          weight: 0.15,
          score: 30,
          description: 'Device has privacy settings that may indicate fraud tools',
          severity: 'low'
        });
      }
    } catch (error) {
      console.error('Device analysis failed:', error);
    }

    return factors;
  }

  private async analyzeBehavior(transaction: Transaction, biometrics?: BiometricData): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    if (!biometrics) return factors;

    try {
      const userBaseline = await this.getUserBehavioralBaseline(transaction.userId);

      // Typing pattern analysis
      if (userBaseline.keystrokeDynamics) {
        const typingDeviation = this.calculateTypingDeviation(biometrics.keystrokeDynamics, userBaseline.keystrokeDynamics);
        if (typingDeviation > 0.7) {
          factors.push({
            type: 'behavioral',
            weight: 0.25,
            score: typingDeviation * 100,
            description: 'Typing pattern significantly different from user baseline',
            severity: 'medium'
          });
        }
      }

      // Mouse movement analysis
      if (userBaseline.mouseMovements) {
        const mouseDeviation = this.calculateMouseDeviation(biometrics.mouseMovements, userBaseline.mouseMovements);
        if (mouseDeviation > 0.6) {
          factors.push({
            type: 'behavioral',
            weight: 0.2,
            score: mouseDeviation * 100,
            description: 'Mouse movement pattern anomaly detected',
            severity: 'low'
          });
        }
      }
    } catch (error) {
      console.error('Behavioral analysis failed:', error);
    }

    return factors;
  }

  private async applyFraudRules(transaction: Transaction): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    try {
      const { data: rules } = await this.supabase
        .from('fraud_rules')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false });

      for (const rule of rules || []) {
        const isTriggered = await this.evaluateRule(rule, transaction);
        if (isTriggered) {
          factors.push({
            type: 'pattern',
            weight: rule.priority / 100,
            score: 70,
            description: `Fraud rule triggered: ${rule.name}`,
            severity: rule.action === 'decline' ? 'high' : 'medium'
          });
        }
      }
    } catch (error) {
      console.error('Rule evaluation failed:', error);
    }

    return factors;
  }

  private calculateRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 0;

    const weightedSum = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);

    return Math.min(100, Math.round(weightedSum / Math.max(totalWeight, 1)));
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  private makeDecision(score: number, factors: RiskFactor[]): 'approve' | 'review' | 'decline' {
    if (score >= this.config.thresholds.autoDeclineScore) return 'decline';
    if (score >= this.config.thresholds.highRisk) return 'review';
    
    // Check for critical factors
    const hasCriticalFactors = factors.some(f => f.severity === 'high' && f.score > 80);
    if (hasCriticalFactors) return 'review';
    
    return 'approve';
  }

  private calculateConfidence(factors: RiskFactor[]): number {
    if (factors.length === 0) return 100;

    const avgScore = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;
    const scoreVariance = factors.reduce((sum, f) => sum + Math.pow(f.score - avgScore, 2), 0) / factors.length;
    
    return Math.max(20, Math.min(100, 100 - (scoreVariance / 10)));
  }

  private async handleHighRiskTransaction(assessment: RiskAssessment, transaction: Transaction): Promise<void> {
    if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
      await this.createFraudAlert({
        id: this.generateId(),
        transactionId: transaction.id,
        userId: transaction.userId,
        alertType: 'high_risk',
        severity: assessment.riskLevel === 'critical' ? 'critical' : 'high',
        message: `High risk transaction detected (Score: ${assessment.riskScore})`,
        metadata: { assessment },
        isResolved: false,
        createdAt: new Date()
      });
    }
  }

  private calculateFingerprint(data: any): string {
    const components = [
      data.userAgent,
      data.screen,
      data.timezone,
      data.language,
      data.platform,
      data.cookies,
      data.do