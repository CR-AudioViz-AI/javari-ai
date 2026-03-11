import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import * as tf from '@tensorflow/tfjs-node';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

interface TransactionData {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  timestamp: number;
  ipAddress: string;
  deviceFingerprint: string;
  location?: {
    latitude: number;
    longitude: number;
    country: string;
  };
  paymentMethod: {
    type: 'card' | 'bank' | 'digital_wallet';
    lastFour?: string;
    issuer?: string;
  };
}

interface BehaviorProfile {
  userId: string;
  avgTransactionAmount: number;
  transactionFrequency: number;
  commonMerchants: string[];
  typicalLocations: { lat: number; lng: number }[];
  deviceHistory: string[];
  riskHistory: number[];
  accountAge: number;
}

interface RiskFactors {
  velocityRisk: number;
  locationRisk: number;
  deviceRisk: number;
  amountRisk: number;
  behaviorRisk: number;
  networkRisk: number;
}

interface FraudAlert {
  id: string;
  transactionId: string;
  riskScore: number;
  riskFactors: RiskFactors;
  timestamp: number;
  status: 'active' | 'resolved' | 'false_positive';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class FraudDetectionEngine {
  private model: tf.LayersModel | null = null;

  async initialize() {
    try {
      // Load pre-trained fraud detection model
      this.model = await tf.loadLayersModel('/models/fraud-detection/model.json');
    } catch (error) {
      console.warn('ML model not available, using rule-based detection');
    }
  }

  async analyzeTransaction(transaction: TransactionData): Promise<{
    riskScore: number;
    riskFactors: RiskFactors;
    recommendation: 'approve' | 'review' | 'decline';
  }> {
    const behaviorProfile = await this.getUserBehaviorProfile(transaction.userId);
    const riskFactors = await this.calculateRiskFactors(transaction, behaviorProfile);
    
    let riskScore = 0;

    if (this.model) {
      riskScore = await this.mlPredict(transaction, behaviorProfile);
    } else {
      riskScore = this.ruleBasedScore(riskFactors);
    }

    const recommendation = this.determineRecommendation(riskScore, riskFactors);

    return { riskScore, riskFactors, recommendation };
  }

  private async getUserBehaviorProfile(userId: string): Promise<BehaviorProfile> {
    const cached = await redis.get(`behavior:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    const profile = this.buildBehaviorProfile(userId, transactions || []);
    
    await redis.setex(`behavior:${userId}`, 3600, JSON.stringify(profile));
    return profile;
  }

  private buildBehaviorProfile(userId: string, transactions: any[]): BehaviorProfile {
    const amounts = transactions.map(t => t.amount);
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length || 0;
    
    const merchantCounts = transactions.reduce((acc, t) => {
      acc[t.merchant_id] = (acc[t.merchant_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const commonMerchants = Object.entries(merchantCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([merchant]) => merchant);

    return {
      userId,
      avgTransactionAmount: avgAmount,
      transactionFrequency: transactions.length,
      commonMerchants,
      typicalLocations: this.extractTypicalLocations(transactions),
      deviceHistory: [...new Set(transactions.map(t => t.device_fingerprint))],
      riskHistory: transactions.map(t => t.risk_score || 0),
      accountAge: this.calculateAccountAge(userId)
    };
  }

  private extractTypicalLocations(transactions: any[]) {
    const locations = transactions
      .filter(t => t.location)
      .map(t => ({ lat: t.location.latitude, lng: t.location.longitude }));
    
    // Simple clustering - in production, use proper clustering algorithm
    return locations.slice(0, 5);
  }

  private calculateAccountAge(userId: string): number {
    // Simplified - get from user creation date
    return 365; // days
  }

  private async calculateRiskFactors(
    transaction: TransactionData,
    profile: BehaviorProfile
  ): Promise<RiskFactors> {
    const velocityRisk = await this.calculateVelocityRisk(transaction.userId);
    const locationRisk = this.calculateLocationRisk(transaction, profile);
    const deviceRisk = this.calculateDeviceRisk(transaction, profile);
    const amountRisk = this.calculateAmountRisk(transaction, profile);
    const behaviorRisk = this.calculateBehaviorRisk(transaction, profile);
    const networkRisk = await this.calculateNetworkRisk(transaction.ipAddress);

    return {
      velocityRisk,
      locationRisk,
      deviceRisk,
      amountRisk,
      behaviorRisk,
      networkRisk
    };
  }

  private async calculateVelocityRisk(userId: string): Promise<number> {
    const recentTransactions = await redis.llen(`velocity:${userId}`);
    const threshold = 10; // max transactions per hour
    return Math.min(recentTransactions / threshold, 1.0);
  }

  private calculateLocationRisk(transaction: TransactionData, profile: BehaviorProfile): number {
    if (!transaction.location || profile.typicalLocations.length === 0) {
      return 0.3; // moderate risk for unknown location
    }

    const distances = profile.typicalLocations.map(loc => 
      this.calculateDistance(
        transaction.location!.latitude,
        transaction.location!.longitude,
        loc.lat,
        loc.lng
      )
    );

    const minDistance = Math.min(...distances);
    return Math.min(minDistance / 1000, 1.0); // normalize by 1000km
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  private calculateDeviceRisk(transaction: TransactionData, profile: BehaviorProfile): number {
    return profile.deviceHistory.includes(transaction.deviceFingerprint) ? 0.1 : 0.7;
  }

  private calculateAmountRisk(transaction: TransactionData, profile: BehaviorProfile): number {
    if (profile.avgTransactionAmount === 0) return 0.5;
    const ratio = transaction.amount / profile.avgTransactionAmount;
    return Math.min(Math.abs(Math.log10(ratio)) / 2, 1.0);
  }

  private calculateBehaviorRisk(transaction: TransactionData, profile: BehaviorProfile): number {
    const isFamiliarMerchant = profile.commonMerchants.includes(transaction.merchantId);
    return isFamiliarMerchant ? 0.1 : 0.4;
  }

  private async calculateNetworkRisk(ipAddress: string): Promise<number> {
    try {
      const response = await fetch(`http://ip-api.com/json/${ipAddress}`);
      const data = await response.json();
      
      if (data.proxy || data.hosting) return 0.8;
      if (data.country === 'CN' || data.country === 'RU') return 0.6; // High-risk countries
      return 0.1;
    } catch {
      return 0.5; // moderate risk if can't determine
    }
  }

  private async mlPredict(transaction: TransactionData, profile: BehaviorProfile): Promise<number> {
    if (!this.model) return 0.5;

    const features = this.extractFeatures(transaction, profile);
    const tensor = tf.tensor2d([features]);
    const prediction = this.model.predict(tensor) as tf.Tensor;
    const score = await prediction.data();
    
    tensor.dispose();
    prediction.dispose();
    
    return score[0];
  }

  private extractFeatures(transaction: TransactionData, profile: BehaviorProfile): number[] {
    return [
      Math.log10(transaction.amount + 1),
      transaction.timestamp % (24 * 3600), // time of day
      profile.avgTransactionAmount > 0 ? transaction.amount / profile.avgTransactionAmount : 1,
      profile.transactionFrequency,
      profile.accountAge,
      transaction.location?.latitude || 0,
      transaction.location?.longitude || 0,
      profile.riskHistory.reduce((sum, r) => sum + r, 0) / profile.riskHistory.length || 0
    ];
  }

  private ruleBasedScore(riskFactors: RiskFactors): number {
    const weights = {
      velocityRisk: 0.25,
      locationRisk: 0.20,
      deviceRisk: 0.15,
      amountRisk: 0.15,
      behaviorRisk: 0.15,
      networkRisk: 0.10
    };

    return Object.entries(riskFactors).reduce(
      (score, [factor, value]) => score + value * weights[factor as keyof RiskFactors],
      0
    );
  }

  private determineRecommendation(
    riskScore: number, 
    riskFactors: RiskFactors
  ): 'approve' | 'review' | 'decline' {
    if (riskScore > 0.8 || riskFactors.networkRisk > 0.9) return 'decline';
    if (riskScore > 0.5 || riskFactors.velocityRisk > 0.7) return 'review';
    return 'approve';
  }
}

const fraudDetection = new FraudDetectionEngine();

export async function POST(request: NextRequest) {
  try {
    await fraudDetection.initialize();
    
    const url = new URL(request.url);
    const pathname = url.pathname.split('/').pop();

    switch (pathname) {
      case 'analyze':
        return await handleAnalyze(request);
      case 'profile':
        return await handleProfile(request);
      case 'feedback':
        return await handleFeedback(request);
      case 'whitelist':
        return await handleWhitelist(request);
      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }
  } catch (error) {
    console.error('Fraud detection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname.split('/');
    const endpoint = pathname[pathname.length - 2];
    const param = pathname[pathname.length - 1];

    switch (endpoint) {
      case 'risk-score':
        return await handleGetRiskScore(param);
      case 'alerts':
        return await handleGetAlerts(request);
      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }
  } catch (error) {
    console.error('Fraud detection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleAnalyze(request: NextRequest) {
  const transaction: TransactionData = await request.json();

  // Validate input
  if (!transaction.id || !transaction.userId || !transaction.amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Rate limiting
  await redis.lpush(`velocity:${transaction.userId}`, Date.now());
  await redis.expire(`velocity:${transaction.userId}`, 3600);
  await redis.ltrim(`velocity:${transaction.userId}`, 0, 99);

  const analysis = await fraudDetection.analyzeTransaction(transaction);

  // Store analysis results
  await supabase.from('fraud_analysis').insert({
    transaction_id: transaction.id,
    user_id: transaction.userId,
    risk_score: analysis.riskScore,
    risk_factors: analysis.riskFactors,
    recommendation: analysis.recommendation,
    created_at: new Date().toISOString()
  });

  // Create alert if high risk
  if (analysis.riskScore > 0.7) {
    const alert: FraudAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId: transaction.id,
      riskScore: analysis.riskScore,
      riskFactors: analysis.riskFactors,
      timestamp: Date.now(),
      status: 'active',
      severity: analysis.riskScore > 0.9 ? 'critical' : 'high'
    };

    await redis.lpush('fraud_alerts', JSON.stringify(alert));
    await redis.ltrim('fraud_alerts', 0, 999);

    // Real-time notification via Supabase
    await supabase
      .channel('fraud-alerts')
      .send({
        type: 'broadcast',
        event: 'new-alert',
        payload: alert
      });
  }

  return NextResponse.json(analysis);
}

async function handleProfile(request: NextRequest) {
  const { userId, transactions } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  // Update behavior profile
  const engine = new FraudDetectionEngine();
  const profile = engine['buildBehaviorProfile'](userId, transactions || []);

  await redis.setex(`behavior:${userId}`, 3600, JSON.stringify(profile));

  return NextResponse.json({ success: true, profile });
}

async function handleGetRiskScore(transactionId: string) {
  const { data } = await supabase
    .from('fraud_analysis')
    .select('*')
    .eq('transaction_id', transactionId)
    .single();

  if (!data) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

async function handleGetAlerts(request: NextRequest) {
  const alerts = await redis.lrange('fraud_alerts', 0, 99);
  const parsedAlerts = alerts.map(alert => JSON.parse(alert));

  return NextResponse.json({ alerts: parsedAlerts });
}

async function handleFeedback(request: NextRequest) {
  const { transactionId, actualFraud } = await request.json();

  // Update training data for ML model improvement
  await supabase.from('fraud_feedback').insert({
    transaction_id: transactionId,
    actual_fraud: actualFraud,
    created_at: new Date().toISOString()
  });

  return NextResponse.json({ success: true });
}

async function handleWhitelist(request: NextRequest) {
  const { type, value, userId } = await request.json();

  if (!['ip', 'device', 'merchant'].includes(type)) {
    return NextResponse.json({ error: 'Invalid whitelist type' }, { status: 400 });
  }

  await supabase.from('fraud_whitelist').insert({
    type,
    value,
    user_id: userId,
    created_at: new Date().toISOString()
  });

  // Cache whitelist entry
  await redis.sadd(`whitelist:${type}:${userId}`, value);

  return NextResponse.json({ success: true });
}