```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Redis from 'ioredis';

// Types
interface TransactionData {
  userId: string;
  amount: number;
  currency: string;
  location: {
    lat: number;
    lng: number;
    country: string;
    city: string;
  };
  timestamp: string;
  paymentMethod: string;
  merchantId: string;
  deviceFingerprint?: string;
}

interface RiskFactors {
  velocityRisk: number;
  geographicRisk: number;
  behavioralRisk: number;
  amountRisk: number;
}

interface FraudDetectionResult {
  riskScore: number;
  decision: 'APPROVE' | 'REVIEW' | 'DECLINE';
  reasons: string[];
  confidence: number;
  factors: RiskFactors;
}

// Validation schema
const transactionSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    country: z.string().min(2).max(3),
    city: z.string().min(1).max(100)
  }),
  timestamp: z.string().datetime(),
  paymentMethod: z.enum(['CARD', 'BANK', 'WALLET', 'CRYPTO']),
  merchantId: z.string(),
  deviceFingerprint: z.string().optional()
});

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

class TransactionVelocityAnalyzer {
  private async getTransactionCount(userId: string, windowMinutes: number): Promise<number> {
    const key = `velocity:${userId}:${windowMinutes}`;
    const count = await redis.zcount(key, Date.now() - (windowMinutes * 60 * 1000), Date.now());
    return count;
  }

  private async addTransaction(userId: string, timestamp: number): Promise<void> {
    const windows = [5, 15, 60, 1440]; // 5min, 15min, 1hour, 1day
    
    for (const window of windows) {
      const key = `velocity:${userId}:${window}`;
      await redis.zadd(key, timestamp, `${timestamp}-${Math.random()}`);
      await redis.zremrangebyscore(key, 0, timestamp - (window * 60 * 1000));
      await redis.expire(key, window * 60);
    }
  }

  async analyzeVelocity(userId: string, timestamp: number): Promise<number> {
    await this.addTransaction(userId, timestamp);

    const counts = {
      last5min: await this.getTransactionCount(userId, 5),
      last15min: await this.getTransactionCount(userId, 15),
      last1hour: await this.getTransactionCount(userId, 60),
      last1day: await this.getTransactionCount(userId, 1440)
    };

    // Calculate velocity risk based on thresholds
    let velocityRisk = 0;
    
    if (counts.last5min > 3) velocityRisk += 0.4;
    if (counts.last15min > 10) velocityRisk += 0.3;
    if (counts.last1hour > 20) velocityRisk += 0.2;
    if (counts.last1day > 50) velocityRisk += 0.1;

    return Math.min(velocityRisk, 1.0);
  }
}

class GeographicPatternAnalyzer {
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async analyzeGeographic(userId: string, currentLocation: TransactionData['location']): Promise<number> {
    try {
      // Get user's recent transaction locations
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('location, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (!recentTransactions || recentTransactions.length === 0) {
        return 0.2; // Moderate risk for new users
      }

      // Calculate geographic patterns
      const locations = recentTransactions.map(t => t.location);
      const distances = locations.map(loc => 
        this.calculateDistance(currentLocation.lat, currentLocation.lng, loc.lat, loc.lng)
      );

      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      const maxDistance = Math.max(...distances);
      const countryChanges = locations.filter(loc => loc.country !== currentLocation.country).length;

      let geoRisk = 0;

      // Distance-based risk
      if (maxDistance > 5000) geoRisk += 0.4; // > 5000km
      else if (maxDistance > 1000) geoRisk += 0.2; // > 1000km
      else if (maxDistance > 500) geoRisk += 0.1; // > 500km

      // Country change frequency risk
      if (countryChanges > locations.length * 0.3) geoRisk += 0.3;

      // Impossible travel detection
      const recentTransaction = recentTransactions[0];
      if (recentTransaction) {
        const timeDiff = (Date.now() - new Date(recentTransaction.created_at).getTime()) / (1000 * 60 * 60); // hours
        const distance = this.calculateDistance(
          currentLocation.lat, currentLocation.lng,
          recentTransaction.location.lat, recentTransaction.location.lng
        );
        const maxPossibleSpeed = 1000; // km/h (commercial flight)
        
        if (distance / timeDiff > maxPossibleSpeed) {
          geoRisk += 0.6; // Impossible travel
        }
      }

      return Math.min(geoRisk, 1.0);
    } catch (error) {
      console.error('Geographic analysis error:', error);
      return 0.1; // Low default risk on error
    }
  }
}

class BehavioralAnomalyDetector {
  async analyzeBehavior(userId: string, transaction: TransactionData): Promise<number> {
    try {
      // Get user's transaction history
      const { data: userHistory } = await supabase
        .from('transactions')
        .select('amount, payment_method, merchant_id, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (!userHistory || userHistory.length < 5) {
        return 0.3; // Moderate risk for insufficient history
      }

      let behavioralRisk = 0;

      // Amount pattern analysis
      const amounts = userHistory.map(t => t.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - avgAmount, 2), 0) / amounts.length);
      
      const zScore = Math.abs((transaction.amount - avgAmount) / (stdDev || 1));
      if (zScore > 3) behavioralRisk += 0.4; // Unusual amount
      else if (zScore > 2) behavioralRisk += 0.2;

      // Payment method consistency
      const paymentMethods = userHistory.map(t => t.payment_method);
      const methodFreq = paymentMethods.reduce((acc, method) => {
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostUsedMethod = Object.keys(methodFreq).reduce((a, b) => 
        methodFreq[a] > methodFreq[b] ? a : b
      );

      if (transaction.paymentMethod !== mostUsedMethod && methodFreq[transaction.paymentMethod] === undefined) {
        behavioralRisk += 0.3; // New payment method
      }

      // Time pattern analysis
      const transactionHour = new Date(transaction.timestamp).getHours();
      const historicalHours = userHistory.map(t => new Date(t.created_at).getHours());
      const hourFreq = historicalHours.reduce((acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const avgHourlyFreq = Object.values(hourFreq).reduce((a, b) => a + b, 0) / 24;
      const currentHourFreq = hourFreq[transactionHour] || 0;
      
      if (currentHourFreq < avgHourlyFreq * 0.1) {
        behavioralRisk += 0.2; // Unusual time
      }

      return Math.min(behavioralRisk, 1.0);
    } catch (error) {
      console.error('Behavioral analysis error:', error);
      return 0.1;
    }
  }
}

class RiskScoreCalculator {
  calculateRiskScore(factors: RiskFactors): { score: number; confidence: number } {
    const weights = {
      velocity: 0.25,
      geographic: 0.30,
      behavioral: 0.25,
      amount: 0.20
    };

    const weightedScore = 
      factors.velocityRisk * weights.velocity +
      factors.geographicRisk * weights.geographic +
      factors.behavioralRisk * weights.behavioral +
      factors.amountRisk * weights.amount;

    // Calculate confidence based on factor consistency
    const factorValues = Object.values(factors);
    const mean = factorValues.reduce((a, b) => a + b, 0) / factorValues.length;
    const variance = factorValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / factorValues.length;
    const confidence = Math.max(0.5, 1 - variance); // Higher variance = lower confidence

    return { score: weightedScore, confidence };
  }

  determineDecision(riskScore: number, confidence: number): 'APPROVE' | 'REVIEW' | 'DECLINE' {
    if (confidence < 0.6) return 'REVIEW'; // Low confidence requires review
    
    if (riskScore >= 0.8) return 'DECLINE';
    if (riskScore >= 0.4) return 'REVIEW';
    return 'APPROVE';
  }

  generateReasons(factors: RiskFactors, decision: string): string[] {
    const reasons: string[] = [];
    
    if (factors.velocityRisk > 0.3) reasons.push('High transaction velocity detected');
    if (factors.geographicRisk > 0.4) reasons.push('Unusual geographic pattern');
    if (factors.behavioralRisk > 0.3) reasons.push('Behavioral anomaly detected');
    if (factors.amountRisk > 0.4) reasons.push('Transaction amount deviation');
    
    if (decision === 'DECLINE') reasons.push('Risk score exceeds threshold');
    if (decision === 'REVIEW') reasons.push('Manual review required');
    
    return reasons.length > 0 ? reasons : ['Standard risk assessment'];
  }
}

class FraudDetectionService {
  private velocityAnalyzer = new TransactionVelocityAnalyzer();
  private geoAnalyzer = new GeographicPatternAnalyzer();
  private behavioralAnalyzer = new BehavioralAnomalyDetector();
  private riskCalculator = new RiskScoreCalculator();

  async detectFraud(transaction: TransactionData): Promise<FraudDetectionResult> {
    const timestamp = new Date(transaction.timestamp).getTime();

    // Run all analyses in parallel
    const [velocityRisk, geographicRisk, behavioralRisk] = await Promise.all([
      this.velocityAnalyzer.analyzeVelocity(transaction.userId, timestamp),
      this.geoAnalyzer.analyzeGeographic(transaction.userId, transaction.location),
      this.behavioralAnalyzer.analyzeBehavior(transaction.userId, transaction)
    ]);

    // Calculate amount risk (simplified)
    const amountRisk = transaction.amount > 10000 ? 0.3 : transaction.amount > 5000 ? 0.2 : 0.1;

    const factors: RiskFactors = {
      velocityRisk,
      geographicRisk,
      behavioralRisk,
      amountRisk
    };

    const { score: riskScore, confidence } = this.riskCalculator.calculateRiskScore(factors);
    const decision = this.riskCalculator.determineDecision(riskScore, confidence);
    const reasons = this.riskCalculator.generateReasons(factors, decision);

    // Log fraud detection result
    await supabase
      .from('fraud_detections')
      .insert({
        user_id: transaction.userId,
        risk_score: riskScore,
        decision,
        factors,
        confidence,
        transaction_data: transaction
      });

    return {
      riskScore,
      decision,
      reasons,
      confidence,
      factors
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validatedData = transactionSchema.parse(body);
    
    // Initialize fraud detection service
    const fraudService = new FraudDetectionService();
    
    // Perform fraud detection
    const result = await fraudService.detectFraud(validatedData);
    
    // Real-time notification for high-risk transactions
    if (result.riskScore > 0.6) {
      await supabase
        .from('fraud_alerts')
        .insert({
          user_id: validatedData.userId,
          risk_score: result.riskScore,
          decision: result.decision,
          alert_type: result.decision === 'DECLINE' ? 'BLOCKED' : 'FLAGGED',
          transaction_amount: validatedData.amount,
          location: validatedData.location
        });
    }
    
    return NextResponse.json(result, { status: 200 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Fraud detection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Test Redis connection
    await redis.ping();
    
    // Test Supabase connection
    const { error } = await supabase.from('fraud_detections').select('id').limit(1);
    if (error) throw error;
    
    return NextResponse.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        supabase: 'connected'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Service connectivity issues' },
      { status: 503 }
    );
  }
}
```