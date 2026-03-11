import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';

/**
 * Transaction data interface
 */
interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantCategory: string;
  paymentMethod: string;
  timestamp: Date;
  ipAddress: string;
  deviceFingerprint: string;
  location: {
    latitude: number;
    longitude: number;
    country: string;
    city: string;
  };
  metadata?: Record<string, any>;
}

/**
 * User behavior profile interface
 */
interface UserBehaviorProfile {
  userId: string;
  avgTransactionAmount: number;
  typicalMerchantCategories: string[];
  commonTransactionTimes: number[];
  commonLocations: Array<{ latitude: number; longitude: number }>;
  paymentMethodPreferences: Record<string, number>;
  velocityBaseline: {
    transactionsPerHour: number;
    transactionsPerDay: number;
    amountPerDay: number;
  };
  lastUpdated: Date;
}

/**
 * Extracted features for ML model
 */
interface TransactionFeatures {
  amount: number;
  amountZScore: number;
  timeSinceLastTransaction: number;
  transactionVelocity: number;
  locationDistance: number;
  merchantRisk: number;
  deviceRisk: number;
  timeOfDayRisk: number;
  dayOfWeekRisk: number;
  behavioralDeviation: number;
  networkRisk: number;
  crossBorderFlag: number;
}

/**
 * Risk assessment result
 */
interface RiskAssessment {
  transactionId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  reasons: string[];
  features: TransactionFeatures;
  recommendedAction: 'APPROVE' | 'REVIEW' | 'DECLINE' | 'BLOCK_USER';
  timestamp: Date;
}

/**
 * Fraud alert interface
 */
interface FraudAlert {
  id: string;
  transactionId: string;
  userId: string;
  riskScore: number;
  alertType: 'VELOCITY' | 'BEHAVIORAL' | 'LOCATION' | 'DEVICE' | 'ML_SCORE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  metadata: Record<string, any>;
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * Velocity check configuration
 */
interface VelocityLimits {
  transactionsPerMinute: number;
  transactionsPerHour: number;
  transactionsPerDay: number;
  amountPerHour: number;
  amountPerDay: number;
  amountPerMonth: number;
}

/**
 * ML model configuration
 */
interface MLModelConfig {
  modelUrl: string;
  modelVersion: string;
  threshold: number;
  features: string[];
  warmupRequired: boolean;
  maxInferenceTime: number;
}

/**
 * Fraud detection configuration
 */
interface FraudDetectionConfig {
  velocityLimits: VelocityLimits;
  mlModel: MLModelConfig;
  behavioralThresholds: {
    locationDeviationKm: number;
    amountDeviationMultiplier: number;
    timeDeviationHours: number;
  };
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  realTimeEnabled: boolean;
  alertingEnabled: boolean;
}

/**
 * Feature extractor for ML model input
 */
class FeatureExtractor {
  private merchantRiskCache = new Map<string, number>();
  private deviceRiskCache = new Map<string, number>();

  /**
   * Extract features from transaction and user profile
   */
  async extractFeatures(
    transaction: Transaction,
    userProfile: UserBehaviorProfile,
    recentTransactions: Transaction[]
  ): Promise<TransactionFeatures> {
    try {
      const amount = transaction.amount;
      const amountZScore = this.calculateAmountZScore(amount, userProfile);
      const timeSinceLastTransaction = this.calculateTimeSinceLastTransaction(recentTransactions);
      const transactionVelocity = this.calculateTransactionVelocity(recentTransactions);
      const locationDistance = this.calculateLocationDistance(transaction, userProfile);
      const merchantRisk = await this.calculateMerchantRisk(transaction.merchantId);
      const deviceRisk = await this.calculateDeviceRisk(transaction.deviceFingerprint);
      const timeOfDayRisk = this.calculateTimeOfDayRisk(transaction.timestamp, userProfile);
      const dayOfWeekRisk = this.calculateDayOfWeekRisk(transaction.timestamp, userProfile);
      const behavioralDeviation = this.calculateBehavioralDeviation(transaction, userProfile);
      const networkRisk = await this.calculateNetworkRisk(transaction.ipAddress);
      const crossBorderFlag = this.calculateCrossBorderFlag(transaction, userProfile);

      return {
        amount,
        amountZScore,
        timeSinceLastTransaction,
        transactionVelocity,
        locationDistance,
        merchantRisk,
        deviceRisk,
        timeOfDayRisk,
        dayOfWeekRisk,
        behavioralDeviation,
        networkRisk,
        crossBorderFlag
      };
    } catch (error) {
      throw new Error(`Feature extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate z-score for transaction amount
   */
  private calculateAmountZScore(amount: number, profile: UserBehaviorProfile): number {
    const avgAmount = profile.avgTransactionAmount;
    const stdDev = avgAmount * 0.5; // Approximate standard deviation
    return (amount - avgAmount) / Math.max(stdDev, 1);
  }

  /**
   * Calculate time since last transaction in minutes
   */
  private calculateTimeSinceLastTransaction(recentTransactions: Transaction[]): number {
    if (recentTransactions.length === 0) return 0;
    
    const lastTransaction = recentTransactions[0];
    const timeDiff = Date.now() - lastTransaction.timestamp.getTime();
    return timeDiff / (1000 * 60); // Convert to minutes
  }

  /**
   * Calculate transaction velocity (transactions per hour)
   */
  private calculateTransactionVelocity(recentTransactions: Transaction[]): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentCount = recentTransactions.filter(
      tx => tx.timestamp.getTime() > oneHourAgo
    ).length;
    return recentCount;
  }

  /**
   * Calculate distance from typical locations
   */
  private calculateLocationDistance(transaction: Transaction, profile: UserBehaviorProfile): number {
    const { latitude: txLat, longitude: txLng } = transaction.location;
    
    if (profile.commonLocations.length === 0) return 0;

    const distances = profile.commonLocations.map(loc => {
      return this.haversineDistance(txLat, txLng, loc.latitude, loc.longitude);
    });

    return Math.min(...distances);
  }

  /**
   * Calculate haversine distance between two points
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate merchant risk score
   */
  private async calculateMerchantRisk(merchantId: string): Promise<number> {
    if (this.merchantRiskCache.has(merchantId)) {
      return this.merchantRiskCache.get(merchantId)!;
    }

    // Simulate merchant risk calculation
    const riskScore = Math.random() * 0.5; // 0-0.5 range for merchant risk
    this.merchantRiskCache.set(merchantId, riskScore);
    return riskScore;
  }

  /**
   * Calculate device risk score
   */
  private async calculateDeviceRisk(deviceFingerprint: string): Promise<number> {
    if (this.deviceRiskCache.has(deviceFingerprint)) {
      return this.deviceRiskCache.get(deviceFingerprint)!;
    }

    // Simulate device risk calculation
    const riskScore = Math.random() * 0.3; // 0-0.3 range for device risk
    this.deviceRiskCache.set(deviceFingerprint, riskScore);
    return riskScore;
  }

  /**
   * Calculate time of day risk
   */
  private calculateTimeOfDayRisk(timestamp: Date, profile: UserBehaviorProfile): number {
    const hour = timestamp.getHours();
    const commonHours = profile.commonTransactionTimes;
    
    if (commonHours.length === 0) return 0;

    const minDistance = Math.min(...commonHours.map(h => Math.abs(hour - h)));
    return Math.min(minDistance / 12, 1); // Normalize to 0-1
  }

  /**
   * Calculate day of week risk
   */
  private calculateDayOfWeekRisk(timestamp: Date, profile: UserBehaviorProfile): number {
    const dayOfWeek = timestamp.getDay();
    // Simplified: weekend transactions are slightly riskier
    return dayOfWeek === 0 || dayOfWeek === 6 ? 0.2 : 0.1;
  }

  /**
   * Calculate behavioral deviation score
   */
  private calculateBehavioralDeviation(transaction: Transaction, profile: UserBehaviorProfile): number {
    let deviation = 0;

    // Amount deviation
    const amountDeviation = Math.abs(transaction.amount - profile.avgTransactionAmount) / 
                           Math.max(profile.avgTransactionAmount, 1);
    deviation += Math.min(amountDeviation, 2) * 0.3;

    // Merchant category deviation
    if (!profile.typicalMerchantCategories.includes(transaction.merchantCategory)) {
      deviation += 0.2;
    }

    // Payment method deviation
    const methodPreference = profile.paymentMethodPreferences[transaction.paymentMethod] || 0;
    if (methodPreference < 0.1) {
      deviation += 0.1;
    }

    return Math.min(deviation, 1);
  }

  /**
   * Calculate network risk from IP address
   */
  private async calculateNetworkRisk(ipAddress: string): Promise<number> {
    // Simulate network risk calculation (VPN detection, known bad IPs, etc.)
    return Math.random() * 0.2; // 0-0.2 range for network risk
  }

  /**
   * Calculate cross-border transaction flag
   */
  private calculateCrossBorderFlag(transaction: Transaction, profile: UserBehaviorProfile): number {
    if (profile.commonLocations.length === 0) return 0;

    const userCountries = profile.commonLocations.map(loc => 
      this.getCountryFromCoordinates(loc.latitude, loc.longitude)
    );
    
    const txCountry = transaction.location.country;
    return userCountries.includes(txCountry) ? 0 : 1;
  }

  /**
   * Get country from coordinates (simplified)
   */
  private getCountryFromCoordinates(lat: number, lng: number): string {
    // Simplified country detection based on coordinates
    // In production, use a proper geocoding service
    return 'US'; // Placeholder
  }
}

/**
 * Velocity checker for transaction limits
 */
class VelocityChecker {
  private supabase: SupabaseClient;
  private limits: VelocityLimits;

  constructor(supabase: SupabaseClient, limits: VelocityLimits) {
    this.supabase = supabase;
    this.limits = limits;
  }

  /**
   * Check if transaction violates velocity limits
   */
  async checkVelocity(transaction: Transaction, userId: string): Promise<{
    violated: boolean;
    violations: string[];
    metrics: Record<string, number>;
  }> {
    try {
      const now = new Date();
      const violations: string[] = [];
      const metrics: Record<string, number> = {};

      // Get recent transactions
      const { data: recentTransactions } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('created_at', { ascending: false });

      if (!recentTransactions) {
        throw new Error('Failed to fetch recent transactions');
      }

      // Check transaction count limits
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const txLastMinute = recentTransactions.filter(tx => 
        new Date(tx.created_at) > oneMinuteAgo
      ).length;

      const txLastHour = recentTransactions.filter(tx => 
        new Date(tx.created_at) > oneHourAgo
      ).length;

      const txLastDay = recentTransactions.filter(tx => 
        new Date(tx.created_at) > oneDayAgo
      ).length;

      // Check amount limits
      const amountLastHour = recentTransactions
        .filter(tx => new Date(tx.created_at) > oneHourAgo)
        .reduce((sum, tx) => sum + tx.amount, 0) + transaction.amount;

      const amountLastDay = recentTransactions
        .filter(tx => new Date(tx.created_at) > oneDayAgo)
        .reduce((sum, tx) => sum + tx.amount, 0) + transaction.amount;

      // Update metrics
      metrics.transactionsLastMinute = txLastMinute;
      metrics.transactionsLastHour = txLastHour;
      metrics.transactionsLastDay = txLastDay;
      metrics.amountLastHour = amountLastHour;
      metrics.amountLastDay = amountLastDay;

      // Check violations
      if (txLastMinute >= this.limits.transactionsPerMinute) {
        violations.push(`Transaction count per minute exceeded: ${txLastMinute}/${this.limits.transactionsPerMinute}`);
      }

      if (txLastHour >= this.limits.transactionsPerHour) {
        violations.push(`Transaction count per hour exceeded: ${txLastHour}/${this.limits.transactionsPerHour}`);
      }

      if (txLastDay >= this.limits.transactionsPerDay) {
        violations.push(`Transaction count per day exceeded: ${txLastDay}/${this.limits.transactionsPerDay}`);
      }

      if (amountLastHour > this.limits.amountPerHour) {
        violations.push(`Amount per hour exceeded: ${amountLastHour}/${this.limits.amountPerHour}`);
      }

      if (amountLastDay > this.limits.amountPerDay) {
        violations.push(`Amount per day exceeded: ${amountLastDay}/${this.limits.amountPerDay}`);
      }

      return {
        violated: violations.length > 0,
        violations,
        metrics
      };
    } catch (error) {
      throw new Error(`Velocity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Behavioral analyzer for user patterns
 */
class BehavioralAnalyzer {
  private supabase: SupabaseClient;
  private profileCache = new Map<string, UserBehaviorProfile>();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get or create user behavior profile
   */
  async getUserProfile(userId: string): Promise<UserBehaviorProfile> {
    try {
      // Check cache first
      if (this.profileCache.has(userId)) {
        const profile = this.profileCache.get(userId)!;
        const hoursSinceUpdate = (Date.now() - profile.lastUpdated.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceUpdate < 24) {
          return profile;
        }
      }

      // Fetch from database
      const { data: profile } = await this.supabase
        .from('user_behavior_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profile) {
        const behaviorProfile: UserBehaviorProfile = {
          userId: profile.user_id,
          avgTransactionAmount: profile.avg_transaction_amount,
          typicalMerchantCategories: profile.typical_merchant_categories,
          commonTransactionTimes: profile.common_transaction_times,
          commonLocations: profile.common_locations,
          paymentMethodPreferences: profile.payment_method_preferences,
          velocityBaseline: profile.velocity_baseline,
          lastUpdated: new Date(profile.last_updated)
        };

        this.profileCache.set(userId, behaviorProfile);
        return behaviorProfile;
      }

      // Create new profile
      return await this.createUserProfile(userId);
    } catch (error) {
      throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new user behavior profile
   */
  private async createUserProfile(userId: string): Promise<UserBehaviorProfile> {
    try {
      // Fetch user's historical transactions
      const { data: transactions } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!transactions || transactions.length === 0) {
        // Create default profile for new user
        const defaultProfile: UserBehaviorProfile = {
          userId,
          avgTransactionAmount: 50,
          typicalMerchantCategories: [],
          commonTransactionTimes: [],
          commonLocations: [],
          paymentMethodPreferences: {},
          velocityBaseline: {
            transactionsPerHour: 1,
            transactionsPerDay: 5,
            amountPerDay: 250
          },
          lastUpdated: new Date()
        };

        await this.saveUserProfile(defaultProfile);
        return defaultProfile;
      }

      // Analyze transactions to build profile
      const profile = this.analyzeTransactions(userId, transactions);
      await this.saveUserProfile(profile);
      
      this.profileCache.set(userId, profile);
      return profile;
    } catch (error) {
      throw new Error(`Failed to create user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze transactions to build behavior profile
   */
  private analyzeTransactions(userId: string, transactions: any[]): UserBehaviorProfile {
    const amounts = transactions.map(tx => tx.amount);
    const avgTransactionAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;

    // Analyze merchant categories
    const categoryCount: Record<string, number> = {};
    transactions.forEach(tx => {
      categoryCount[tx.merchant_category] = (categoryCount[tx.merchant_category] || 0) + 1;
    });
    const typicalMerchantCategories = Object.entries(categoryCount)
      .filter(([, count]) => count >= transactions.length * 0.1)
      .map(([category]) => category);

    // Analyze transaction times
    const hours = transactions.map(tx => new Date(tx.created_at).getHours());
    const hourCount: Record<number, number> = {};
    hours.forEach(hour => {
      hourCount[hour] = (hourCount[hour] || 0) + 1;
    });
    const commonTransactionTimes = Object.entries(hourCount)
      .filter(([, count]) => count >= 2)
      .map(([hour]) => parseInt(hour));

    // Analyze locations
    const locations = transactions
      .filter(tx => tx.location)
      .map(tx => tx.location);
    const commonLocations = this.clusterLocations(locations);

    // Analyze payment methods
    const methodCount: Record<string, number> = {};
    transactions.forEach(tx => {
      methodCount[tx.payment_method] = (methodCount[tx.payment_method] || 0) + 1;
    });
    const paymentMethodPreferences: Record<string, number> = {};
    Object.entries(methodCount).forEach(([method, count]) => {
      paymentMethodPreferences[method] = count / transactions.length;
    });

    // Calculate velocity baseline
    const last7Days = transactions.filter(tx => {
      const txDate = new Date(tx.created_at);
      const daysDiff = (Date.now() - txDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    });

    const velocityBaseline = {
      transactionsPerHour: Math.max(1, last7Days.length / (7 * 24)),
      transactionsPerDay: Math.max(1, last7Days.length / 7),
      amountPerDay: Math.max(50, last7Days.reduce((sum, tx) => sum + tx.amount, 0) / 7)
    };

    return {
      userId,
      avgTransactionAmount,
      typicalMerchantCategories,
      commonTransactionTimes,
      commonLocations,
      paymentMethodPreferences,
      velocityBaseline,
      lastUpdated: new Date()
    };
  }

  /**
   * Cluster locations to find common areas
   */
  private clusterLocations