```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { z } from 'zod';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const redisUrl = process.env.REDIS_URL!;

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const redis = new Redis(redisUrl);

// Request validation schema
const AccessRequestSchema = z.object({
  user_id: z.string().uuid(),
  resource_id: z.string().min(1),
  action: z.enum(['read', 'write', 'delete', 'admin']),
  context: z.object({
    ip_address: z.string().ip(),
    user_agent: z.string(),
    location: z.object({
      country: z.string().optional(),
      city: z.string().optional(),
      timezone: z.string().optional()
    }).optional(),
    device_fingerprint: z.string().optional(),
    timestamp: z.string().datetime()
  })
});

// Response types
interface AccessDecision {
  granted: boolean;
  permission_level: 'none' | 'read' | 'write' | 'admin';
  risk_score: number;
  confidence: number;
  expiry: Date;
  restrictions?: string[];
  reason: string;
}

interface BehaviorPattern {
  user_id: string;
  pattern_type: string;
  frequency: number;
  last_occurrence: Date;
  risk_indicator: number;
}

interface SecurityEvent {
  event_id: string;
  user_id: string;
  event_type: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: Date;
}

class AdaptiveAccessController {
  private riskEngine: RiskAssessmentEngine;
  private behaviorAnalyzer: BehaviorAnalyzer;
  private contextEvaluator: ContextualFactorEvaluator;
  private permissionAdjuster: PermissionAdjuster;
  private decisionEngine: AccessDecisionEngine;
  private mlPredictor: MLModelPredictor;
  private securityLogger: SecurityEventLogger;

  constructor() {
    this.riskEngine = new RiskAssessmentEngine();
    this.behaviorAnalyzer = new BehaviorAnalyzer();
    this.contextEvaluator = new ContextualFactorEvaluator();
    this.permissionAdjuster = new PermissionAdjuster();
    this.decisionEngine = new AccessDecisionEngine();
    this.mlPredictor = new MLModelPredictor();
    this.securityLogger = new SecurityEventLogger();
  }

  async evaluateAccess(request: z.infer<typeof AccessRequestSchema>): Promise<AccessDecision> {
    try {
      // 1. Analyze behavioral patterns
      const behaviorAnalysis = await this.behaviorAnalyzer.analyzePatterns(request.user_id);
      
      // 2. Calculate risk score
      const riskScore = await this.riskEngine.calculateRisk(request, behaviorAnalysis);
      
      // 3. Evaluate contextual factors
      const contextualRisk = await this.contextEvaluator.evaluateContext(request.context);
      
      // 4. Get ML prediction
      const mlPrediction = await this.mlPredictor.predictAccess(request, behaviorAnalysis, contextualRisk);
      
      // 5. Make access decision
      const decision = await this.decisionEngine.makeDecision(riskScore, contextualRisk, mlPrediction);
      
      // 6. Adjust permissions dynamically
      await this.permissionAdjuster.adjustPermissions(request.user_id, decision);
      
      // 7. Log security event
      await this.securityLogger.logAccessEvent(request, decision);
      
      return decision;
    } catch (error) {
      await this.securityLogger.logError(request.user_id, 'access_evaluation_error', error);
      throw error;
    }
  }
}

class RiskAssessmentEngine {
  async calculateRisk(request: z.infer<typeof AccessRequestSchema>, behaviorAnalysis: BehaviorPattern[]): Promise<number> {
    let baseRisk = 0.1; // Base risk score
    
    // Check for unusual access patterns
    const unusualPatterns = behaviorAnalysis.filter(p => p.risk_indicator > 0.7);
    baseRisk += unusualPatterns.length * 0.2;
    
    // Time-based risk factors
    const hour = new Date(request.context.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      baseRisk += 0.1; // Higher risk for off-hours access
    }
    
    // Action-based risk
    const actionRisk = {
      read: 0.0,
      write: 0.1,
      delete: 0.3,
      admin: 0.5
    };
    baseRisk += actionRisk[request.action];
    
    // Check cached risk indicators
    const cachedRisk = await redis.get(`risk:${request.user_id}`);
    if (cachedRisk) {
      baseRisk += parseFloat(cachedRisk) * 0.3;
    }
    
    return Math.min(baseRisk, 1.0);
  }
}

class BehaviorAnalyzer {
  async analyzePatterns(userId: string): Promise<BehaviorPattern[]> {
    const { data: recentActivity } = await supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!recentActivity || recentActivity.length === 0) {
      return [];
    }

    const patterns: BehaviorPattern[] = [];
    
    // Analyze access frequency patterns
    const hourlyActivity = this.groupByHour(recentActivity);
    const avgHourlyAccess = Object.values(hourlyActivity).reduce((a, b) => a + b, 0) / 24;
    
    for (const [hour, count] of Object.entries(hourlyActivity)) {
      if (count > avgHourlyAccess * 2) {
        patterns.push({
          user_id: userId,
          pattern_type: 'high_frequency_access',
          frequency: count,
          last_occurrence: new Date(),
          risk_indicator: Math.min(count / (avgHourlyAccess * 3), 1.0)
        });
      }
    }
    
    // Analyze location patterns
    const locations = [...new Set(recentActivity.map(a => a.ip_address))];
    if (locations.length > 5) {
      patterns.push({
        user_id: userId,
        pattern_type: 'multiple_locations',
        frequency: locations.length,
        last_occurrence: new Date(),
        risk_indicator: Math.min(locations.length / 10, 0.8)
      });
    }
    
    return patterns;
  }

  private groupByHour(activities: any[]): Record<string, number> {
    return activities.reduce((acc, activity) => {
      const hour = new Date(activity.created_at).getHours().toString();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

class ContextualFactorEvaluator {
  async evaluateContext(context: z.infer<typeof AccessRequestSchema>['context']): Promise<number> {
    let contextRisk = 0.0;
    
    // IP reputation check
    const ipReputation = await this.checkIPReputation(context.ip_address);
    contextRisk += ipReputation;
    
    // Device fingerprint analysis
    if (context.device_fingerprint) {
      const deviceRisk = await this.analyzeDeviceFingerprint(context.device_fingerprint);
      contextRisk += deviceRisk;
    }
    
    // Geolocation risk
    if (context.location) {
      const geoRisk = await this.evaluateGeolocationRisk(context.location);
      contextRisk += geoRisk;
    }
    
    // User agent analysis
    const uaRisk = this.analyzeUserAgent(context.user_agent);
    contextRisk += uaRisk;
    
    return Math.min(contextRisk, 1.0);
  }

  private async checkIPReputation(ipAddress: string): Promise<number> {
    const cached = await redis.get(`ip_rep:${ipAddress}`);
    if (cached) {
      return parseFloat(cached);
    }
    
    // Check against known malicious IPs
    const { data: blocklist } = await supabase
      .from('ip_blocklist')
      .select('risk_score')
      .eq('ip_address', ipAddress)
      .single();
    
    const risk = blocklist?.risk_score || 0.0;
    await redis.setex(`ip_rep:${ipAddress}`, 3600, risk.toString());
    
    return risk;
  }

  private async analyzeDeviceFingerprint(fingerprint: string): Promise<number> {
    const { data: knownDevices } = await supabase
      .from('user_devices')
      .select('trust_score')
      .eq('device_fingerprint', fingerprint)
      .single();
    
    return knownDevices ? (1.0 - knownDevices.trust_score) : 0.3;
  }

  private async evaluateGeolocationRisk(location: any): Promise<number> {
    if (!location.country) return 0.0;
    
    const { data: countryRisk } = await supabase
      .from('country_risk_scores')
      .select('risk_score')
      .eq('country_code', location.country)
      .single();
    
    return countryRisk?.risk_score || 0.0;
  }

  private analyzeUserAgent(userAgent: string): Promise<number> {
    // Basic user agent analysis
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /automated/i
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    return Promise.resolve(isSuspicious ? 0.5 : 0.0);
  }
}

class PermissionAdjuster {
  async adjustPermissions(userId: string, decision: AccessDecision): Promise<void> {
    if (!decision.granted) return;
    
    // Update dynamic permissions in Supabase
    await supabase
      .from('dynamic_permissions')
      .upsert({
        user_id: userId,
        permission_level: decision.permission_level,
        risk_score: decision.risk_score,
        expiry: decision.expiry,
        restrictions: decision.restrictions,
        updated_at: new Date().toISOString()
      });
    
    // Cache permission decision
    await redis.setex(
      `perm:${userId}`,
      3600,
      JSON.stringify({
        level: decision.permission_level,
        expiry: decision.expiry,
        restrictions: decision.restrictions
      })
    );
  }
}

class AccessDecisionEngine {
  async makeDecision(riskScore: number, contextualRisk: number, mlPrediction: any): Promise<AccessDecision> {
    const totalRisk = (riskScore + contextualRisk + (1 - mlPrediction.confidence)) / 3;
    
    let granted = false;
    let permissionLevel: AccessDecision['permission_level'] = 'none';
    let restrictions: string[] = [];
    let reason = '';
    
    if (totalRisk <= 0.2) {
      granted = true;
      permissionLevel = 'admin';
      reason = 'Low risk score, full access granted';
    } else if (totalRisk <= 0.4) {
      granted = true;
      permissionLevel = 'write';
      reason = 'Medium-low risk, write access granted';
    } else if (totalRisk <= 0.6) {
      granted = true;
      permissionLevel = 'read';
      restrictions = ['time_limited', 'audit_required'];
      reason = 'Medium risk, restricted read access granted';
    } else {
      granted = false;
      reason = 'High risk score, access denied';
    }
    
    return {
      granted,
      permission_level: permissionLevel,
      risk_score: totalRisk,
      confidence: mlPrediction.confidence,
      expiry: new Date(Date.now() + (granted ? 3600000 : 0)), // 1 hour if granted
      restrictions,
      reason
    };
  }
}

class MLModelPredictor {
  private model: tf.LayersModel | null = null;
  
  async predictAccess(request: any, behaviorAnalysis: BehaviorPattern[], contextualRisk: number): Promise<any> {
    try {
      if (!this.model) {
        await this.loadModel();
      }
      
      const features = this.extractFeatures(request, behaviorAnalysis, contextualRisk);
      const tensor = tf.tensor2d([features]);
      const prediction = this.model!.predict(tensor) as tf.Tensor;
      const result = await prediction.data();
      
      tensor.dispose();
      prediction.dispose();
      
      return {
        confidence: result[0],
        anomaly_score: result[1] || 0
      };
    } catch (error) {
      // Fallback to rule-based prediction
      return {
        confidence: 0.5,
        anomaly_score: contextualRisk
      };
    }
  }
  
  private async loadModel(): Promise<void> {
    try {
      // Load pre-trained model for access prediction
      this.model = await tf.loadLayersModel('/models/access_control_model.json');
    } catch (error) {
      console.warn('Could not load ML model, using fallback logic');
    }
  }
  
  private extractFeatures(request: any, behaviorAnalysis: BehaviorPattern[], contextualRisk: number): number[] {
    return [
      new Date(request.context.timestamp).getHours() / 24, // Normalized hour
      ['read', 'write', 'delete', 'admin'].indexOf(request.action) / 4, // Action type
      behaviorAnalysis.length / 10, // Behavior pattern count
      contextualRisk, // Contextual risk
      behaviorAnalysis.reduce((sum, p) => sum + p.risk_indicator, 0) / Math.max(behaviorAnalysis.length, 1) // Avg risk indicator
    ];
  }
}

class SecurityEventLogger {
  async logAccessEvent(request: z.infer<typeof AccessRequestSchema>, decision: AccessDecision): Promise<void> {
    const event: SecurityEvent = {
      event_id: crypto.randomUUID(),
      user_id: request.user_id,
      event_type: decision.granted ? 'access_granted' : 'access_denied',
      risk_level: this.getRiskLevel(decision.risk_score),
      details: {
        resource_id: request.resource_id,
        action: request.action,
        risk_score: decision.risk_score,
        permission_level: decision.permission_level,
        context: request.context,
        reason: decision.reason
      },
      timestamp: new Date()
    };
    
    await this.logEvent(event);
  }
  
  async logError(userId: string, eventType: string, error: any): Promise<void> {
    const event: SecurityEvent = {
      event_id: crypto.randomUUID(),
      user_id: userId,
      event_type: eventType,
      risk_level: 'medium',
      details: {
        error_message: error.message,
        stack_trace: error.stack
      },
      timestamp: new Date()
    };
    
    await this.logEvent(event);
  }
  
  private async logEvent(event: SecurityEvent): Promise<void> {
    await supabase
      .from('security_events')
      .insert(event);
    
    // Also cache high-risk events
    if (event.risk_level === 'high' || event.risk_level === 'critical') {
      await redis.lpush('high_risk_events', JSON.stringify(event));
      await redis.ltrim('high_risk_events', 0, 999); // Keep last 1000 events
    }
  }
  
  private getRiskLevel(riskScore: number): SecurityEvent['risk_level'] {
    if (riskScore <= 0.2) return 'low';
    if (riskScore <= 0.5) return 'medium';
    if (riskScore <= 0.8) return 'high';
    return 'critical';
  }
}

// Initialize controller
const accessController = new AdaptiveAccessController();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validatedRequest = AccessRequestSchema.parse(body);
    
    // Rate limiting check
    const rateLimitKey = `rate_limit:${validatedRequest.user_id}`;
    const currentRequests = await redis.incr(rateLimitKey);
    
    if (currentRequests === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }
    
    if (currentRequests > 100) { // Max 100 requests per minute
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          granted: false,
          reason: 'Too many access requests'
        },
        { status: 429 }
      );
    }
    
    // Evaluate access request
    const decision = await accessController.evaluateAccess(validatedRequest);
    
    // Return decision
    return NextResponse.json(decision, {
      status: decision.granted ? 200 : 403,
      headers: {
        'X-Risk-Score': decision.risk_score.toString(),
        'X-Confidence': decision.confidence.toString(),
        'X-Permission-Level': decision.permission_level
      }
    });
    
  } catch (error) {
    console.error('Access control error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        granted: false,
        reason: 'System error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing user_id parameter' },
        { status: 400 }
      );
    }
    
    // Get current permission status
    const cachedPermissions = await redis.get(`perm:${userId}`);
    
    if (cachedPermissions) {
      const permissions = JSON.parse(cachedPermissions);
      
      // Check if permissions are still valid
      if (new Date(permissions.expiry) > new Date()) {
        return NextResponse.json({
          user_id: userId,
          current_permissions: permissions,
          status: 'active'
        });
      }
    }
    
    // Fetch from database if not cached or expired
    const { data: permissions } = await supabase
      .from('dynamic_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return NextResponse.json({
      user_id: userId,
      current_permissions: permissions,
      status: permissions ? 'active' : 'none'
    });
    
  } catch (error) {
    console.error('Get permissions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```