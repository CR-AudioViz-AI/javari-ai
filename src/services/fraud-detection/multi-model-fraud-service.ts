import { 
  createClient, 
  SupabaseClient, 
  RealtimeChannel 
} from '@supabase/supabase-js';
import Redis from 'ioredis';
import * as tf from '@tensorflow/tfjs';
import { WebSocket } from 'ws';

/**
 * Transaction data structure for fraud analysis
 */
export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  timestamp: Date;
  location: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
  paymentMethod: {
    type: 'card' | 'bank' | 'wallet' | 'crypto';
    last4: string;
    issuer?: string;
  };
  deviceInfo: {
    fingerprint: string;
    ip: string;
    userAgent: string;
  };
  metadata: Record<string, any>;
}

/**
 * User behavioral profile
 */
export interface BehavioralProfile {
  userId: string;
  averageTransaction: number;
  commonMerchants: string[];
  usualLocations: string[];
  timePatterns: number[];
  velocityMetrics: {
    transactionsPerHour: number;
    averageTimeBetweenTransactions: number;
  };
  riskFactors: string[];
  lastUpdated: Date;
}

/**
 * Network connection in transaction graph
 */
export interface NetworkConnection {
  sourceId: string;
  targetId: string;
  connectionType: 'device' | 'location' | 'merchant' | 'payment_method';
  strength: number;
  riskScore: number;
  firstSeen: Date;
  lastSeen: Date;
}

/**
 * ML model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  version: string;
  type: 'neural_network' | 'random_forest' | 'gradient_boosting' | 'isolation_forest';
  features: string[];
  weight: number;
  threshold: number;
  accuracy: number;
  lastTrained: Date;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  transactionId: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  modelScores: Record<string, number>;
  behavioralScore: number;
  networkScore: number;
  features: Record<string, number>;
  decision: 'approve' | 'review' | 'decline';
  confidence: number;
  explanation: string[];
  processingTime: number;
}

/**
 * Fraud alert configuration
 */
export interface FraudAlert {
  id: string;
  transactionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'pattern_anomaly' | 'velocity_spike' | 'network_risk' | 'model_consensus';
  message: string;
  evidence: string[];
  timestamp: Date;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  assignedTo?: string;
}

/**
 * Adaptive threshold configuration
 */
export interface AdaptiveThreshold {
  modelId: string;
  baseThreshold: number;
  currentThreshold: number;
  adjustmentFactor: number;
  performanceMetrics: {
    precision: number;
    recall: number;
    falsePositiveRate: number;
  };
  lastAdjusted: Date;
}

/**
 * Feature extraction result
 */
export interface ExtractedFeatures {
  transactionId: string;
  features: Record<string, number>;
  categoricalFeatures: Record<string, string>;
  temporalFeatures: Record<string, number>;
  networkFeatures: Record<string, number>;
  behavioralFeatures: Record<string, number>;
  extractedAt: Date;
}

/**
 * Model training configuration
 */
export interface TrainingConfig {
  modelId: string;
  datasetSize: number;
  features: string[];
  hyperparameters: Record<string, any>;
  validationSplit: number;
  epochs?: number;
  batchSize?: number;
  earlyStoppingPatience?: number;
}

/**
 * Service configuration interface
 */
export interface MultiModelFraudServiceConfig {
  supabase: {
    url: string;
    key: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  models: {
    registryUrl: string;
    cacheTtl: number;
    ensembleMethod: 'voting' | 'weighted' | 'stacking';
  };
  thresholds: {
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
    adaptiveEnabled: boolean;
  };
  realtime: {
    websocketUrl: string;
    alertChannels: string[];
  };
  features: {
    maxHistoryDays: number;
    networkDepth: number;
    behavioralWindowHours: number;
  };
}

/**
 * Multi-Model Fraud Detection Service
 * 
 * Sophisticated fraud detection service combining multiple ML models,
 * behavioral analysis, and network analysis for real-time transaction screening
 */
export class MultiModelFraudDetectionService {
  private supabase: SupabaseClient;
  private redis: Redis;
  private models: Map<string, tf.LayersModel> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private behavioralProfiles: Map<string, BehavioralProfile> = new Map();
  private adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private realtimeChannel?: RealtimeChannel;
  private websocket?: WebSocket;
  private alertSubscribers: Set<(alert: FraudAlert) => void> = new Set();

  constructor(private config: MultiModelFraudServiceConfig) {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.initializeService();
  }

  /**
   * Initialize the fraud detection service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.loadModels();
      await this.loadBehavioralProfiles();
      await this.initializeAdaptiveThresholds();
      await this.setupRealtimeSubscriptions();
      await this.connectWebSocket();

      console.log('Multi-Model Fraud Detection Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize fraud detection service:', error);
      throw error;
    }
  }

  /**
   * Analyze transaction for fraud risk
   */
  public async analyzeTransaction(transaction: Transaction): Promise<RiskAssessment> {
    const startTime = Date.now();

    try {
      // Extract features from transaction
      const features = await this.extractFeatures(transaction);
      
      // Get behavioral analysis
      const behavioralScore = await this.analyzeBehavior(transaction);
      
      // Perform network analysis
      const networkScore = await this.analyzeNetwork(transaction);
      
      // Run ensemble of ML models
      const modelScores = await this.runModelEnsemble(features);
      
      // Calculate overall risk score
      const overallScore = await this.calculateRiskScore(
        modelScores,
        behavioralScore,
        networkScore,
        features
      );
      
      // Determine risk level and decision
      const riskLevel = this.determineRiskLevel(overallScore);
      const decision = await this.makeDecision(overallScore, riskLevel);
      
      // Generate explanation
      const explanation = await this.generateExplanation(
        modelScores,
        behavioralScore,
        networkScore,
        features
      );
      
      // Calculate confidence
      const confidence = this.calculateConfidence(modelScores, overallScore);
      
      const assessment: RiskAssessment = {
        transactionId: transaction.id,
        overallScore,
        riskLevel,
        modelScores,
        behavioralScore,
        networkScore,
        features: features.features,
        decision,
        confidence,
        explanation,
        processingTime: Date.now() - startTime,
      };

      // Update behavioral profile
      await this.updateBehavioralProfile(transaction, assessment);
      
      // Cache assessment
      await this.cacheAssessment(assessment);
      
      // Check for alerts
      await this.checkForAlerts(transaction, assessment);
      
      // Update adaptive thresholds if needed
      await this.updateAdaptiveThresholds(assessment);

      return assessment;
    } catch (error) {
      console.error(`Error analyzing transaction ${transaction.id}:`, error);
      throw new Error(`Fraud analysis failed: ${error.message}`);
    }
  }

  /**
   * Extract features from transaction
   */
  private async extractFeatures(transaction: Transaction): Promise<ExtractedFeatures> {
    try {
      const features: Record<string, number> = {};
      const categoricalFeatures: Record<string, string> = {};
      const temporalFeatures: Record<string, number> = {};
      const networkFeatures: Record<string, number> = {};
      const behavioralFeatures: Record<string, number> = {};

      // Basic transaction features
      features.amount = transaction.amount;
      features.amountLog = Math.log(transaction.amount + 1);
      features.hourOfDay = transaction.timestamp.getHours();
      features.dayOfWeek = transaction.timestamp.getDay();
      features.dayOfMonth = transaction.timestamp.getDate();

      // Categorical features
      categoricalFeatures.currency = transaction.currency;
      categoricalFeatures.paymentType = transaction.paymentMethod.type;
      categoricalFeatures.merchant = transaction.merchant;
      categoricalFeatures.category = transaction.category;
      categoricalFeatures.country = transaction.location.country;

      // Temporal features
      const now = new Date();
      temporalFeatures.timeSinceLastTransaction = await this.getTimeSinceLastTransaction(transaction.userId);
      temporalFeatures.transactionVelocity = await this.getTransactionVelocity(transaction.userId);
      temporalFeatures.isWeekend = transaction.timestamp.getDay() === 0 || transaction.timestamp.getDay() === 6 ? 1 : 0;
      temporalFeatures.isNightTime = transaction.timestamp.getHours() < 6 || transaction.timestamp.getHours() > 22 ? 1 : 0;

      // Network features
      networkFeatures.deviceRisk = await this.getDeviceRiskScore(transaction.deviceInfo.fingerprint);
      networkFeatures.ipRisk = await this.getIpRiskScore(transaction.deviceInfo.ip);
      networkFeatures.merchantRisk = await this.getMerchantRiskScore(transaction.merchant);
      networkFeatures.locationRisk = await this.getLocationRiskScore(transaction.location);

      // Behavioral features
      const profile = await this.getBehavioralProfile(transaction.userId);
      if (profile) {
        behavioralFeatures.amountDeviation = Math.abs(transaction.amount - profile.averageTransaction) / profile.averageTransaction;
        behavioralFeatures.isFamiliarMerchant = profile.commonMerchants.includes(transaction.merchant) ? 1 : 0;
        behavioralFeatures.isFamiliarLocation = profile.usualLocations.includes(transaction.location.country) ? 1 : 0;
        behavioralFeatures.velocityAnomaly = await this.getVelocityAnomalyScore(transaction.userId, profile);
      }

      // Combine all features
      const allFeatures = {
        ...features,
        ...temporalFeatures,
        ...networkFeatures,
        ...behavioralFeatures,
      };

      // Encode categorical features
      const encodedCategorical = await this.encodeCategoricalFeatures(categoricalFeatures);
      Object.assign(allFeatures, encodedCategorical);

      return {
        transactionId: transaction.id,
        features: allFeatures,
        categoricalFeatures,
        temporalFeatures,
        networkFeatures,
        behavioralFeatures,
        extractedAt: new Date(),
      };
    } catch (error) {
      console.error('Error extracting features:', error);
      throw error;
    }
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzeBehavior(transaction: Transaction): Promise<number> {
    try {
      const profile = await this.getBehavioralProfile(transaction.userId);
      if (!profile) {
        return 0.5; // Neutral score for new users
      }

      let behavioralScore = 0;
      let factors = 0;

      // Amount pattern analysis
      const amountDeviation = Math.abs(transaction.amount - profile.averageTransaction) / profile.averageTransaction;
      if (amountDeviation > 2) {
        behavioralScore += 0.3;
      } else if (amountDeviation > 1) {
        behavioralScore += 0.1;
      }
      factors++;

      // Location analysis
      if (!profile.usualLocations.includes(transaction.location.country)) {
        behavioralScore += 0.2;
      }
      factors++;

      // Merchant analysis
      if (!profile.commonMerchants.includes(transaction.merchant)) {
        behavioralScore += 0.1;
      }
      factors++;

      // Time pattern analysis
      const hour = transaction.timestamp.getHours();
      const timeScore = profile.timePatterns[hour] || 0;
      if (timeScore < 0.1) {
        behavioralScore += 0.2;
      }
      factors++;

      // Velocity analysis
      const currentVelocity = await this.getCurrentVelocity(transaction.userId);
      if (currentVelocity > profile.velocityMetrics.transactionsPerHour * 3) {
        behavioralScore += 0.3;
      }
      factors++;

      return Math.min(behavioralScore / factors, 1.0);
    } catch (error) {
      console.error('Error in behavioral analysis:', error);
      return 0.5;
    }
  }

  /**
   * Analyze network connections and patterns
   */
  private async analyzeNetwork(transaction: Transaction): Promise<number> {
    try {
      let networkScore = 0;
      let factors = 0;

      // Device fingerprint analysis
      const deviceConnections = await this.getDeviceConnections(transaction.deviceInfo.fingerprint);
      if (deviceConnections.length > 10) {
        networkScore += 0.2;
      }
      factors++;

      // IP address analysis
      const ipConnections = await this.getIpConnections(transaction.deviceInfo.ip);
      if (ipConnections.length > 5) {
        networkScore += 0.3;
      }
      factors++;

      // Merchant network analysis
      const merchantRisk = await this.getMerchantNetworkRisk(transaction.merchant);
      networkScore += merchantRisk * 0.2;
      factors++;

      // Location clustering analysis
      const locationClustering = await this.getLocationClustering(transaction.location);
      if (locationClustering > 0.7) {
        networkScore += 0.2;
      }
      factors++;

      // Payment method sharing analysis
      const paymentMethodSharing = await this.getPaymentMethodSharing(transaction.paymentMethod);
      if (paymentMethodSharing > 3) {
        networkScore += 0.1;
      }
      factors++;

      return Math.min(networkScore / factors, 1.0);
    } catch (error) {
      console.error('Error in network analysis:', error);
      return 0.5;
    }
  }

  /**
   * Run ensemble of ML models
   */
  private async runModelEnsemble(features: ExtractedFeatures): Promise<Record<string, number>> {
    const modelScores: Record<string, number> = {};

    try {
      const modelPromises = Array.from(this.modelConfigs.entries()).map(async ([modelId, config]) => {
        try {
          const model = this.models.get(modelId);
          if (!model) {
            console.warn(`Model ${modelId} not loaded`);
            return;
          }

          // Prepare feature vector
          const featureVector = this.prepareFeatureVector(features, config.features);
          const tensorInput = tf.tensor2d([featureVector]);

          // Run prediction
          const prediction = model.predict(tensorInput) as tf.Tensor;
          const score = await prediction.data();

          // Clean up tensors
          tensorInput.dispose();
          prediction.dispose();

          modelScores[modelId] = score[0];
        } catch (error) {
          console.error(`Error running model ${modelId}:`, error);
          modelScores[modelId] = 0.5; // Default score on error
        }
      });

      await Promise.all(modelPromises);

      return modelScores;
    } catch (error) {
      console.error('Error in model ensemble:', error);
      throw error;
    }
  }

  /**
   * Calculate overall risk score
   */
  private async calculateRiskScore(
    modelScores: Record<string, number>,
    behavioralScore: number,
    networkScore: number,
    features: ExtractedFeatures
  ): Promise<number> {
    try {
      let weightedScore = 0;
      let totalWeight = 0;

      // Weighted model scores
      for (const [modelId, score] of Object.entries(modelScores)) {
        const config = this.modelConfigs.get(modelId);
        if (config) {
          weightedScore += score * config.weight;
          totalWeight += config.weight;
        }
      }

      const modelScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;

      // Combine with behavioral and network scores
      const finalScore = (
        modelScore * 0.6 +
        behavioralScore * 0.25 +
        networkScore * 0.15
      );

      return Math.min(Math.max(finalScore, 0), 1);
    } catch (error) {
      console.error('Error calculating risk score:', error);
      return 0.5;
    }
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.config.thresholds.highRisk) return 'critical';
    if (score >= this.config.thresholds.mediumRisk) return 'high';
    if (score >= this.config.thresholds.lowRisk) return 'medium';
    return 'low';
  }

  /**
   * Make final decision on transaction
   */
  private async makeDecision(
    score: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<'approve' | 'review' | 'decline'> {
    try {
      // Apply adaptive thresholds if enabled
      let effectiveThresholds = this.config.thresholds;
      
      if (this.config.thresholds.adaptiveEnabled) {
        effectiveThresholds = await this.getAdaptiveThresholds();
      }

      if (score >= effectiveThresholds.highRisk) return 'decline';
      if (score >= effectiveThresholds.mediumRisk) return 'review';
      return 'approve';
    } catch (error) {
      console.error('Error making decision:', error);
      return 'review'; // Default to review on error
    }
  }

  /**
   * Generate explanation for the decision
   */
  private async generateExplanation(
    modelScores: Record<string, number>,
    behavioralScore: number,
    networkScore: number,
    features: ExtractedFeatures
  ): Promise<string[]> {
    const explanation: string[] = [];

    try {
      // Model contributions
      const sortedModels = Object.entries(modelScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      for (const [modelId, score] of sortedModels) {
        if (score > 0.7) {
          explanation.push(`${modelId} model indicates high risk (${(score * 100).toFixed(1)}%)`);
        }
      }

      // Behavioral factors
      if (behavioralScore > 0.6) {
        explanation.push(`Transaction deviates significantly from user's normal behavior`);
      }

      // Network factors
      if (networkScore > 0.6) {
        explanation.push(`High-risk network connections detected`);
      }

      // Feature-specific explanations
      if (features.behavioralFeatures.amountDeviation > 2) {
        explanation.push(`Transaction amount is unusually large for this user`);
      }

      if (features.behavioralFeatures.isFamiliarMerchant === 0) {
        explanation.push(`Transaction with unfamiliar merchant`);
      }

      if (features.behavioralFeatures.isFamiliarLocation === 0) {
        explanation.push(`Transaction from unusual location`);
      }

      if (features.temporalFeatures.isNightTime === 1) {
        explanation.push(`Transaction during unusual hours`);
      }

      if (explanation.length === 0) {
        explanation.push('Transaction appears normal based on analysis');
      }

      return explanation;
    } catch (error) {
      console.error('Error generating explanation:', error);
      return ['Unable to generate explanation due to system error'];
    }
  }

  /**
   * Calculate confidence in the prediction
   */
  private calculateConfidence(modelScores: Record<string, number>, overallScore: number): number {
    try {
      const scores = Object.values(modelScores);
      if (scores.length === 0) return 0.5;

      // Calculate variance in model predictions
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
      
      // Lower variance = higher confidence
      const consensusConfidence = Math.max(0, 1 - variance * 2);
      
      // Extreme scores tend to be more confident
      const extremeConfidence = Math.abs(overallScore - 0.5) * 2;
      
      return Math.min((consensusConfidence + extremeConfidence) / 2, 1.0);
    } catch (error) {
      console.error('Error calculating confidence:', error);
      return 0.5;
    }
  }

  /**
   * Train model with new data
   */
  public async trainModel(
    modelId: string,
    trainingData: Array<{ features: number[]; label