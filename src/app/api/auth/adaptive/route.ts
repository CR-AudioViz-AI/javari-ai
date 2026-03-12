```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { ratelimit } from '@/lib/ratelimit';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schemas
const AdaptiveAuthRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().min(1),
  deviceFingerprint: z.object({
    userAgent: z.string(),
    screenResolution: z.string(),
    timezone: z.string(),
    language: z.string(),
    platform: z.string(),
    webglRenderer: z.string().optional(),
    canvasFingerprint: z.string().optional(),
    audioFingerprint: z.string().optional(),
  }),
  networkInfo: z.object({
    ipAddress: z.string().ip(),
    userAgent: z.string(),
    acceptLanguage: z.string(),
  }),
  authContext: z.object({
    loginAttempt: z.boolean().default(false),
    accessResource: z.string().optional(),
    previousAuthTime: z.number().optional(),
    authMethod: z.enum(['password', 'oauth', 'sso', 'biometric']).optional(),
  }),
});

// Risk assessment interfaces
interface RiskFactors {
  deviceTrust: number;
  behaviorScore: number;
  locationRisk: number;
  timeRisk: number;
  velocityRisk: number;
  networkRisk: number;
}

interface AuthRequirement {
  level: 'low' | 'medium' | 'high' | 'critical';
  methods: string[];
  additionalVerification: boolean;
  sessionDuration: number;
  monitoringLevel: 'basic' | 'enhanced' | 'strict';
}

interface AdaptiveAuthResponse {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  authRequirement: AuthRequirement;
  requiredSteps: string[];
  sessionToken?: string;
  expiresAt: string;
  challengeId?: string;
  metadata: {
    factors: RiskFactors;
    deviceId: string;
    trustScore: number;
    behaviorConfidence: number;
  };
}

class RiskAssessmentEngine {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async assessRisk(request: z.infer<typeof AdaptiveAuthRequestSchema>): Promise<RiskFactors> {
    const [
      deviceTrust,
      behaviorScore,
      locationRisk,
      timeRisk,
      velocityRisk,
      networkRisk
    ] = await Promise.all([
      this.assessDeviceTrust(request.deviceFingerprint, request.userId),
      this.analyzeBehavior(request.userId, request.authContext),
      this.assessLocationRisk(request.networkInfo.ipAddress, request.userId),
      this.assessTimeRisk(request.userId),
      this.assessVelocityRisk(request.userId, request.networkInfo.ipAddress),
      this.assessNetworkRisk(request.networkInfo)
    ]);

    return {
      deviceTrust,
      behaviorScore,
      locationRisk,
      timeRisk,
      velocityRisk,
      networkRisk
    };
  }

  private async assessDeviceTrust(
    fingerprint: z.infer<typeof AdaptiveAuthRequestSchema>['deviceFingerprint'],
    userId?: string
  ): Promise<number> {
    const deviceId = this.generateDeviceId(fingerprint);
    
    if (!userId) return 0.3; // Unknown user, low trust

    const { data: deviceHistory } = await this.supabase
      .from('user_devices')
      .select('trust_score, last_seen, usage_count, created_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .single();

    if (!deviceHistory) {
      // New device
      await this.supabase
        .from('user_devices')
        .insert({
          user_id: userId,
          device_id: deviceId,
          fingerprint: JSON.stringify(fingerprint),
          trust_score: 0.3,
          usage_count: 1,
          last_seen: new Date().toISOString()
        });
      return 0.3;
    }

    // Calculate trust based on device history
    const daysSinceFirstSeen = Math.floor(
      (Date.now() - new Date(deviceHistory.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const usageFrequency = deviceHistory.usage_count / Math.max(daysSinceFirstSeen, 1);
    
    let trustScore = Math.min(0.9, 0.3 + (daysSinceFirstSeen * 0.02) + (usageFrequency * 0.1));

    // Update device usage
    await this.supabase
      .from('user_devices')
      .update({
        trust_score: trustScore,
        usage_count: deviceHistory.usage_count + 1,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('device_id', deviceId);

    return trustScore;
  }

  private async analyzeBehavior(
    userId?: string,
    authContext?: z.infer<typeof AdaptiveAuthRequestSchema>['authContext']
  ): Promise<number> {
    if (!userId) return 0.2;

    const { data: behaviorHistory } = await this.supabase
      .from('user_behavior_patterns')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!behaviorHistory || behaviorHistory.length < 10) {
      return 0.4; // Insufficient data
    }

    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // Analyze typical login hours
    const hourPatterns = behaviorHistory.reduce((acc, entry) => {
      const hour = new Date(entry.created_at).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const hourScore = hourPatterns[currentHour] ? 
      Math.min(1, hourPatterns[currentHour] / (behaviorHistory.length * 0.1)) : 0.1;

    // Analyze day patterns
    const dayPatterns = behaviorHistory.reduce((acc, entry) => {
      const day = new Date(entry.created_at).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const dayScore = dayPatterns[currentDay] ? 
      Math.min(1, dayPatterns[currentDay] / (behaviorHistory.length * 0.2)) : 0.1;

    // Analyze authentication method patterns
    let methodScore = 0.5;
    if (authContext?.authMethod) {
      const methodUsage = behaviorHistory.filter(
        entry => entry.auth_method === authContext.authMethod
      ).length;
      methodScore = Math.min(1, methodUsage / (behaviorHistory.length * 0.3));
    }

    return (hourScore + dayScore + methodScore) / 3;
  }

  private async assessLocationRisk(ipAddress: string, userId?: string): Promise<number> {
    try {
      // Get IP geolocation (mock implementation)
      const geoData = await this.getIPGeolocation(ipAddress);
      
      if (!userId) {
        return geoData.isKnownThreat ? 0.9 : 0.3;
      }

      const { data: locationHistory } = await this.supabase
        .from('user_locations')
        .select('country, city, latitude, longitude')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!locationHistory?.length) {
        // Record new location
        await this.recordUserLocation(userId, geoData);
        return 0.4;
      }

      // Check if location is familiar
      const isFamiliarLocation = locationHistory.some(loc => 
        loc.country === geoData.country && 
        this.calculateDistance(loc, geoData) < 100 // within 100km
      );

      if (isFamiliarLocation) {
        return 0.1;
      }

      // Check for impossible travel
      const lastLocation = locationHistory[0];
      const distance = this.calculateDistance(lastLocation, geoData);
      const timeWindow = 2; // 2 hours
      const impossibleTravel = distance > (timeWindow * 500); // 500km/h max

      await this.recordUserLocation(userId, geoData);

      if (impossibleTravel) return 0.9;
      if (geoData.isKnownThreat) return 0.8;
      if (distance > 1000) return 0.6; // New country/region
      
      return 0.3;
    } catch (error) {
      console.error('Location risk assessment failed:', error);
      return 0.5;
    }
  }

  private async assessTimeRisk(userId?: string): Promise<number> {
    if (!userId) return 0.3;

    const currentHour = new Date().getHours();
    
    // High risk hours (typically 2-6 AM)
    if (currentHour >= 2 && currentHour <= 6) {
      return 0.7;
    }
    
    // Business hours are generally safer
    if (currentHour >= 9 && currentHour <= 17) {
      return 0.1;
    }
    
    return 0.3;
  }

  private async assessVelocityRisk(userId?: string, ipAddress?: string): Promise<number> {
    if (!userId) return 0.3;

    const { data: recentAttempts } = await this.supabase
      .from('auth_attempts')
      .select('created_at, ip_address, success')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .order('created_at', { ascending: false });

    if (!recentAttempts?.length) return 0.1;

    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);
    const rapidAttempts = recentAttempts.filter(attempt => 
      Date.now() - new Date(attempt.created_at).getTime() < 300000 // Last 5 minutes
    );

    if (failedAttempts.length > 3) return 0.8;
    if (rapidAttempts.length > 5) return 0.7;
    if (recentAttempts.length > 10) return 0.6;

    return 0.2;
  }

  private async assessNetworkRisk(networkInfo: z.infer<typeof AdaptiveAuthRequestSchema>['networkInfo']): Promise<number> {
    const riskFactors = [];

    // Check for VPN/Proxy indicators
    if (await this.isVPNOrProxy(networkInfo.ipAddress)) {
      riskFactors.push(0.4);
    }

    // Check User-Agent anomalies
    if (this.isAnomalousUserAgent(networkInfo.userAgent)) {
      riskFactors.push(0.3);
    }

    // Check for bot-like behavior
    if (this.detectBotBehavior(networkInfo)) {
      riskFactors.push(0.6);
    }

    return riskFactors.length > 0 ? Math.max(...riskFactors) : 0.1;
  }

  private generateDeviceId(fingerprint: z.infer<typeof AdaptiveAuthRequestSchema>['deviceFingerprint']): string {
    const combined = [
      fingerprint.userAgent,
      fingerprint.screenResolution,
      fingerprint.timezone,
      fingerprint.language,
      fingerprint.platform,
      fingerprint.webglRenderer,
      fingerprint.canvasFingerprint,
      fingerprint.audioFingerprint
    ].filter(Boolean).join('|');

    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  private async getIPGeolocation(ipAddress: string) {
    // Mock implementation - replace with actual geolocation service
    return {
      country: 'US',
      city: 'New York',
      latitude: 40.7128,
      longitude: -74.0060,
      isKnownThreat: false
    };
  }

  private calculateDistance(point1: any, point2: any): number {
    // Haversine formula implementation
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private async recordUserLocation(userId: string, geoData: any): Promise<void> {
    await this.supabase
      .from('user_locations')
      .insert({
        user_id: userId,
        ip_address: geoData.ipAddress,
        country: geoData.country,
        city: geoData.city,
        latitude: geoData.latitude,
        longitude: geoData.longitude
      });
  }

  private async isVPNOrProxy(ipAddress: string): Promise<boolean> {
    // Mock implementation - integrate with IP reputation service
    return false;
  }

  private isAnomalousUserAgent(userAgent: string): boolean {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /curl/i,
      /wget/i,
      /python/i,
      /bot/i,
      /crawler/i,
      /spider/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private detectBotBehavior(networkInfo: any): boolean {
    // Simple bot detection logic
    return this.isAnomalousUserAgent(networkInfo.userAgent) || 
           !networkInfo.acceptLanguage;
  }
}

class AuthenticationStepResolver {
  static resolveRequirements(riskScore: number, factors: RiskFactors): AuthRequirement {
    if (riskScore >= 0.8) {
      return {
        level: 'critical',
        methods: ['password', 'mfa', 'biometric', 'admin_approval'],
        additionalVerification: true,
        sessionDuration: 3600, // 1 hour
        monitoringLevel: 'strict'
      };
    } else if (riskScore >= 0.6) {
      return {
        level: 'high',
        methods: ['password', 'mfa', 'device_verification'],
        additionalVerification: true,
        sessionDuration: 7200, // 2 hours
        monitoringLevel: 'enhanced'
      };
    } else if (riskScore >= 0.4) {
      return {
        level: 'medium',
        methods: ['password', 'mfa'],
        additionalVerification: false,
        sessionDuration: 14400, // 4 hours
        monitoringLevel: 'enhanced'
      };
    } else {
      return {
        level: 'low',
        methods: ['password'],
        additionalVerification: false,
        sessionDuration: 28800, // 8 hours
        monitoringLevel: 'basic'
      };
    }
  }

  static generateRequiredSteps(requirement: AuthRequirement): string[] {
    const steps = [];
    
    if (requirement.methods.includes('password')) {
      steps.push('verify_password');
    }
    if (requirement.methods.includes('mfa')) {
      steps.push('verify_mfa');
    }
    if (requirement.methods.includes('biometric')) {
      steps.push('verify_biometric');
    }
    if (requirement.methods.includes('device_verification')) {
      steps.push('verify_device');
    }
    if (requirement.methods.includes('admin_approval')) {
      steps.push('admin_approval');
    }
    if (requirement.additionalVerification) {
      steps.push('additional_verification');
    }
    
    return steps;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const rateLimitResult = await ratelimit.limit(identifier);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = AdaptiveAuthRequestSchema.parse(body);

    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Initialize risk assessment engine
    const riskEngine = new RiskAssessmentEngine(supabase);

    // Perform risk assessment
    const riskFactors = await riskEngine.assessRisk(validatedData);

    // Calculate overall risk score
    const weights = {
      deviceTrust: 0.25,
      behaviorScore: 0.20,
      locationRisk: 0.20,
      timeRisk: 0.10,
      velocityRisk: 0.15,
      networkRisk: 0.10
    };

    const riskScore = Math.min(1, Math.max(0,
      (1 - riskFactors.deviceTrust) * weights.deviceTrust +
      (1 - riskFactors.behaviorScore) * weights.behaviorScore +
      riskFactors.locationRisk * weights.locationRisk +
      riskFactors.timeRisk * weights.timeRisk +
      riskFactors.velocityRisk * weights.velocityRisk +
      riskFactors.networkRisk * weights.networkRisk
    ));

    // Determine risk level
    const riskLevel = riskScore >= 0.8 ? 'critical' :
                     riskScore >= 0.6 ? 'high' :
                     riskScore >= 0.4 ? 'medium' : 'low';

    // Resolve authentication requirements
    const authRequirement = AuthenticationStepResolver.resolveRequirements(riskScore, riskFactors);
    const requiredSteps = AuthenticationStepResolver.generateRequiredSteps(authRequirement);

    // Generate device ID and challenge ID
    const deviceId = crypto.createHash('sha256')
      .update(JSON.stringify(validatedData.deviceFingerprint))
      .digest('hex');
    
    const challengeId = crypto.randomBytes(32).toString('hex');

    // Calculate trust score and behavior confidence
    const trustScore = (riskFactors.deviceTrust + riskFactors.behaviorScore) / 2;
    const behaviorConfidence = Math.min(1, riskFactors.behaviorScore + 0.2);

    // Log authentication attempt
    if (validatedData.userId) {
      await supabase
        .from('auth_attempts')
        .insert({
          user_id: validatedData.userId,
          session_id: validatedData.sessionId,
          ip_address: validatedData.networkInfo.ipAddress,
          user_agent: validatedData.networkInfo.userAgent,
          device_id: deviceId,
          risk_score: riskScore,
          risk_level: riskLevel,
          auth_requirement: JSON.stringify(authRequirement),
          success: false, // Will be updated after successful authentication
          challenge_id: challengeId
        });

      // Update behavior patterns
      await supabase
        .from('user_behavior_patterns')
        .insert({
          user_id: validatedData.userId,
          session_id: validatedData.sessionId,
          device_id: deviceId,
          auth_method: validatedData.authContext.authMethod,
          risk_score: riskScore,
          hour_of_day: new Date().getHours(),
          day_of_week: new Date().getDay(),
          ip_address: validatedData.networkInfo.ipAddress
        });
    }

    // Prepare response
    const response: AdaptiveAuthResponse = {
      riskScore: Math.round(riskScore * 1000) / 1000,
      riskLevel,
      authRequirement,
      requiredSteps,
      expiresAt: new Date(Date.now() + authRequirement.sessionDuration * 1000).toISOString(),
      challengeId,
      metadata: {
        factors: riskFactors,
        deviceId,
        trustScore: Math.round(trustScore * 1000) / 1000,
        behaviorConfidence: Math.round(behaviorConfidence * 1000) / 1000
      }
    };

    // Generate session token for low-risk scenarios
    if (riskLevel === 'low' && validatedData.userId) {
      const sessionToken = crypto.randomBytes(48).toString('hex');
      
      await supabase
        .from('adaptive_sessions')
        .insert({
          user_id: validatedData.userId,
          session_token: sessionToken,
          device_id: deviceId,
          risk_level: riskLevel,
          monitoring_level: authRequirement.monitoringLevel,
          expires_at: response.expiresAt
        });

      response.sessionToken = sessionToken;
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Risk-Score': riskScore.toString(),
        'X-Risk-Level': riskLevel,
        'X-Device-Trust': riskFactors.deviceTrust.toString()
      }
    });

  } catch (error) {
    console.error('Adaptive authentication error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }