import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const InitiateVerificationSchema = z.object({
  userId: z.string().uuid(),
  verificationLevel: z.enum(['basic', 'enhanced', 'high_assurance']),
  deviceFingerprint: z.string(),
  ipAddress: z.string().ip(),
  userAgent: z.string(),
  geolocation: z.object({
    latitude: z.number(),
    longitude: z.number()
  }).optional(),
  contextData: z.record(z.any()).optional()
});

const BiometricVerificationSchema = z.object({
  sessionId: z.string().uuid(),
  biometricType: z.enum(['fingerprint', 'face', 'voice', 'iris']),
  biometricData: z.string(),
  challenge: z.string(),
  publicKeyCredential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional()
    }),
    type: z.literal('public-key')
  }).optional()
});

const HardwareTokenSchema = z.object({
  sessionId: z.string().uuid(),
  tokenType: z.enum(['yubikey', 'fido2', 'u2f', 'totp']),
  tokenResponse: z.string(),
  challenge: z.string(),
  origin: z.string().url()
});

const BehavioralAnalysisSchema = z.object({
  sessionId: z.string().uuid(),
  keystrokeDynamics: z.array(z.object({
    key: z.string(),
    pressTime: z.number(),
    releaseTime: z.number(),
    dwellTime: z.number(),
    flightTime: z.number()
  })).optional(),
  mouseMovements: z.array(z.object({
    x: z.number(),
    y: z.number(),
    timestamp: z.number(),
    velocity: z.number(),
    acceleration: z.number()
  })).optional(),
  touchGestures: z.array(z.object({
    type: z.enum(['tap', 'swipe', 'pinch', 'scroll']),
    pressure: z.number(),
    duration: z.number(),
    coordinates: z.object({ x: z.number(), y: z.number() })
  })).optional()
});

const CompleteVerificationSchema = z.object({
  sessionId: z.string().uuid(),
  adminOverride: z.boolean().optional(),
  overrideReason: z.string().optional()
});

// Interfaces
interface VerificationSession {
  id: string;
  userId: string;
  verificationLevel: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'expired';
  riskScore: number;
  factors: string[];
  deviceFingerprint: string;
  ipAddress: string;
  geolocation: any;
  createdAt: Date;
  expiresAt: Date;
}

interface RiskAssessment {
  overallScore: number;
  factors: {
    deviceTrust: number;
    locationRisk: number;
    behavioralAnomalies: number;
    velocityChecks: number;
    fraudIndicators: number;
  };
  recommendations: string[];
  requiresAdditionalFactors: boolean;
}

interface FraudDetection {
  isFraudulent: boolean;
  confidence: number;
  indicators: string[];
  ml_score: number;
}

// Services
class BiometricVerificationService {
  static async verifyBiometric(data: z.infer<typeof BiometricVerificationSchema>): Promise<{ verified: boolean; confidence: number }> {
    try {
      // WebAuthn verification for FIDO2 biometrics
      if (data.publicKeyCredential) {
        const verification = await this.verifyWebAuthn(data.publicKeyCredential, data.challenge);
        return { verified: verification.verified, confidence: verification.confidence };
      }

      // Custom biometric verification logic
      const biometricHash = crypto.createHash('sha256').update(data.biometricData).digest('hex');
      
      // Retrieve stored biometric template from Supabase
      const { data: storedTemplate, error } = await supabase
        .from('user_biometrics')
        .select('template_hash, verification_count, last_verified')
        .eq('user_id', (await this.getSessionUserId(data.sessionId)))
        .eq('biometric_type', data.biometricType)
        .single();

      if (error || !storedTemplate) {
        throw new Error('Biometric template not found');
      }

      // Simulate biometric matching (in production, use proper biometric SDK)
      const similarity = this.calculateBiometricSimilarity(biometricHash, storedTemplate.template_hash);
      const verified = similarity > 0.85;

      // Update verification stats
      if (verified) {
        await supabase
          .from('user_biometrics')
          .update({
            verification_count: storedTemplate.verification_count + 1,
            last_verified: new Date().toISOString()
          })
          .eq('user_id', (await this.getSessionUserId(data.sessionId)))
          .eq('biometric_type', data.biometricType);
      }

      return { verified, confidence: similarity };
    } catch (error) {
      console.error('Biometric verification error:', error);
      return { verified: false, confidence: 0 };
    }
  }

  private static async verifyWebAuthn(credential: any, challenge: string): Promise<{ verified: boolean; confidence: number }> {
    try {
      // Decode and verify WebAuthn response
      const clientDataJSON = JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64').toString());
      
      if (clientDataJSON.challenge !== challenge) {
        return { verified: false, confidence: 0 };
      }

      // Additional WebAuthn verification logic would go here
      // In production, use @simplewebauthn/server or similar library
      
      return { verified: true, confidence: 0.95 };
    } catch (error) {
      return { verified: false, confidence: 0 };
    }
  }

  private static calculateBiometricSimilarity(hash1: string, hash2: string): number {
    // Simplified similarity calculation - use proper biometric matching in production
    let matches = 0;
    const minLength = Math.min(hash1.length, hash2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    
    return matches / minLength;
  }

  private static async getSessionUserId(sessionId: string): Promise<string> {
    const { data, error } = await supabase
      .from('verification_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();
    
    if (error) throw new Error('Session not found');
    return data.user_id;
  }
}

class HardwareTokenValidator {
  static async validateToken(data: z.infer<typeof HardwareTokenSchema>): Promise<{ valid: boolean; confidence: number }> {
    try {
      switch (data.tokenType) {
        case 'yubikey':
          return await this.validateYubiKey(data);
        case 'fido2':
          return await this.validateFIDO2(data);
        case 'u2f':
          return await this.validateU2F(data);
        case 'totp':
          return await this.validateTOTP(data);
        default:
          throw new Error('Unsupported token type');
      }
    } catch (error) {
      console.error('Hardware token validation error:', error);
      return { valid: false, confidence: 0 };
    }
  }

  private static async validateYubiKey(data: z.infer<typeof HardwareTokenSchema>): Promise<{ valid: boolean; confidence: number }> {
    // YubiKey OTP validation logic
    const otpRegex = /^[cbdefghijklnrtuv]{44}$/;
    if (!otpRegex.test(data.tokenResponse)) {
      return { valid: false, confidence: 0 };
    }

    // In production, validate with Yubico servers
    return { valid: true, confidence: 0.98 };
  }

  private static async validateFIDO2(data: z.infer<typeof HardwareTokenSchema>): Promise<{ valid: boolean; confidence: number }> {
    try {
      // FIDO2/WebAuthn validation
      const response = JSON.parse(data.tokenResponse);
      
      // Verify challenge
      const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64').toString());
      if (clientData.challenge !== data.challenge) {
        return { valid: false, confidence: 0 };
      }

      // Additional FIDO2 validation logic
      return { valid: true, confidence: 0.99 };
    } catch (error) {
      return { valid: false, confidence: 0 };
    }
  }

  private static async validateU2F(data: z.infer<typeof HardwareTokenSchema>): Promise<{ valid: boolean; confidence: number }> {
    // U2F validation logic
    try {
      const response = JSON.parse(data.tokenResponse);
      // Implement U2F signature verification
      return { valid: true, confidence: 0.97 };
    } catch (error) {
      return { valid: false, confidence: 0 };
    }
  }

  private static async validateTOTP(data: z.infer<typeof HardwareTokenSchema>): Promise<{ valid: boolean; confidence: number }> {
    try {
      const token = data.tokenResponse;
      const userId = await BiometricVerificationService['getSessionUserId'](data.sessionId);
      
      // Get user's TOTP secret
      const { data: totpData, error } = await supabase
        .from('user_totp_secrets')
        .select('secret')
        .eq('user_id', userId)
        .single();

      if (error || !totpData) {
        return { valid: false, confidence: 0 };
      }

      // Verify TOTP token
      const isValid = this.verifyTOTPToken(token, totpData.secret);
      return { valid: isValid, confidence: isValid ? 0.95 : 0 };
    } catch (error) {
      return { valid: false, confidence: 0 };
    }
  }

  private static verifyTOTPToken(token: string, secret: string): boolean {
    // TOTP verification implementation
    const crypto = require('crypto');
    const timeStep = Math.floor(Date.now() / 30000);
    
    for (let i = -1; i <= 1; i++) {
      const time = timeStep + i;
      const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
      hmac.update(Buffer.alloc(8));
      const hash = hmac.digest();
      
      const offset = hash[hash.length - 1] & 0x0f;
      const code = ((hash[offset] & 0x7f) << 24 |
                   (hash[offset + 1] & 0xff) << 16 |
                   (hash[offset + 2] & 0xff) << 8 |
                   (hash[offset + 3] & 0xff)) % 1000000;
      
      if (code.toString().padStart(6, '0') === token) {
        return true;
      }
    }
    
    return false;
  }
}

class BehavioralAnalysisEngine {
  static async analyzeBehavior(data: z.infer<typeof BehavioralAnalysisSchema>): Promise<{ anomalyScore: number; patterns: string[] }> {
    try {
      const userId = await BiometricVerificationService['getSessionUserId'](data.sessionId);
      
      // Get user's behavioral baseline
      const { data: baseline, error } = await supabase
        .from('user_behavioral_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // First-time analysis, create baseline
        await this.createBehavioralBaseline(userId, data);
        return { anomalyScore: 0.1, patterns: ['new_user'] };
      }

      let anomalyScore = 0;
      const patterns: string[] = [];

      // Analyze keystroke dynamics
      if (data.keystrokeDynamics && baseline.keystroke_profile) {
        const keystrokeAnomaly = this.analyzeKeystrokeDynamics(data.keystrokeDynamics, baseline.keystroke_profile);
        anomalyScore += keystrokeAnomaly * 0.4;
        if (keystrokeAnomaly > 0.5) patterns.push('keystroke_anomaly');
      }

      // Analyze mouse movements
      if (data.mouseMovements && baseline.mouse_profile) {
        const mouseAnomaly = this.analyzeMouseMovements(data.mouseMovements, baseline.mouse_profile);
        anomalyScore += mouseAnomaly * 0.3;
        if (mouseAnomaly > 0.5) patterns.push('mouse_anomaly');
      }

      // Analyze touch gestures
      if (data.touchGestures && baseline.touch_profile) {
        const touchAnomaly = this.analyzeTouchGestures(data.touchGestures, baseline.touch_profile);
        anomalyScore += touchAnomaly * 0.3;
        if (touchAnomaly > 0.5) patterns.push('touch_anomaly');
      }

      // Update behavioral profile with new data
      await this.updateBehavioralProfile(userId, data);

      return { anomalyScore: Math.min(anomalyScore, 1), patterns };
    } catch (error) {
      console.error('Behavioral analysis error:', error);
      return { anomalyScore: 0.5, patterns: ['analysis_error'] };
    }
  }

  private static analyzeKeystrokeDynamics(current: any[], baseline: any): number {
    // Keystroke dynamics analysis
    if (!baseline.avg_dwell_time || !baseline.avg_flight_time) return 0;

    let anomalySum = 0;
    let validSamples = 0;

    current.forEach(keystroke => {
      const dwellDeviation = Math.abs(keystroke.dwellTime - baseline.avg_dwell_time) / baseline.std_dwell_time;
      const flightDeviation = Math.abs(keystroke.flightTime - baseline.avg_flight_time) / baseline.std_flight_time;
      
      anomalySum += (dwellDeviation + flightDeviation) / 2;
      validSamples++;
    });

    return validSamples > 0 ? Math.min(anomalySum / validSamples, 1) : 0;
  }

  private static analyzeMouseMovements(current: any[], baseline: any): number {
    // Mouse movement analysis
    if (!baseline.avg_velocity || !baseline.avg_acceleration) return 0;

    let anomalySum = 0;
    let validSamples = 0;

    current.forEach(movement => {
      const velocityDeviation = Math.abs(movement.velocity - baseline.avg_velocity) / baseline.std_velocity;
      const accelerationDeviation = Math.abs(movement.acceleration - baseline.avg_acceleration) / baseline.std_acceleration;
      
      anomalySum += (velocityDeviation + accelerationDeviation) / 2;
      validSamples++;
    });

    return validSamples > 0 ? Math.min(anomalySum / validSamples, 1) : 0;
  }

  private static analyzeTouchGestures(current: any[], baseline: any): number {
    // Touch gesture analysis
    if (!baseline.avg_pressure || !baseline.avg_duration) return 0;

    let anomalySum = 0;
    let validSamples = 0;

    current.forEach(gesture => {
      const pressureDeviation = Math.abs(gesture.pressure - baseline.avg_pressure) / baseline.std_pressure;
      const durationDeviation = Math.abs(gesture.duration - baseline.avg_duration) / baseline.std_duration;
      
      anomalySum += (pressureDeviation + durationDeviation) / 2;
      validSamples++;
    });

    return validSamples > 0 ? Math.min(anomalySum / validSamples, 1) : 0;
  }

  private static async createBehavioralBaseline(userId: string, data: z.infer<typeof BehavioralAnalysisSchema>): Promise<void> {
    const profile: any = { user_id: userId };

    if (data.keystrokeDynamics) {
      const dwellTimes = data.keystrokeDynamics.map(k => k.dwellTime);
      const flightTimes = data.keystrokeDynamics.map(k => k.flightTime);
      
      profile.keystroke_profile = {
        avg_dwell_time: dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length,
        std_dwell_time: this.calculateStandardDeviation(dwellTimes),
        avg_flight_time: flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length,
        std_flight_time: this.calculateStandardDeviation(flightTimes)
      };
    }

    if (data.mouseMovements) {
      const velocities = data.mouseMovements.map(m => m.velocity);
      const accelerations = data.mouseMovements.map(m => m.acceleration);
      
      profile.mouse_profile = {
        avg_velocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
        std_velocity: this.calculateStandardDeviation(velocities),
        avg_acceleration: accelerations.reduce((a, b) => a + b, 0) / accelerations.length,
        std_acceleration: this.calculateStandardDeviation(accelerations)
      };
    }

    if (data.touchGestures) {
      const pressures = data.touchGestures.map(t => t.pressure);
      const durations = data.touchGestures.map(t => t.duration);
      
      profile.touch_profile = {
        avg_pressure: pressures.reduce((a, b) => a + b, 0) / pressures.length,
        std_pressure: this.calculateStandardDeviation(pressures),
        avg_duration: durations.reduce((a, b) => a + b, 0) / durations.length,
        std_duration: this.calculateStandardDeviation(durations)
      };
    }

    await supabase.from('user_behavioral_profiles').insert(profile);
  }

  private static async updateBehavioralProfile(userId: string, data: z.infer<typeof BehavioralAnalysisSchema>): Promise<void> {
    // Update behavioral profile with weighted moving average
    // Implementation would include sophisticated profile updating logic
  }

  private static calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }
}

class RiskAssessmentCalculator {
  static async calculateRiskScore(sessionId: string): Promise<RiskAssessment> {
    try {
      const { data: session, error } = await supabase
        .from('verification_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        throw new Error('Session not found');
      }

      const factors = {
        deviceTrust: await this.assessDeviceTrust(session.device_fingerprint, session.user_id),
        locationRisk: await this.assessLocationRisk(session.ip_address, session.geolocation, session.user_id),
        behavioralAnomalies: await this.getBehavioralAnomalies(sessionId),
        velocityChecks: await this.performVelocityChecks(session.user_id, session.ip_address),
        fraudIndicators: await this.getFraudIndicators(session.user_id, session.ip_address)
      };

      const overallScore = (
        factors.deviceTrust * 0.25 +
        factors.locationRisk * 0.20 +
        factors.behavioralAnomalies * 0.25 +
        factors.velocityChecks * 0.15 +
        factors.fraudIndicators * 0.15
      );

      const recommendations: string[] = [];
      let requiresAdditionalFactors = false;

      if (factors.deviceTrust > 0.7) {
        recommendations.push('Unknown or suspicious device detected');
        requiresAdditionalFactors = true;
      }
      if (factors.locationRisk > 0.6) {
        recommendations.push('High-risk location or unusual login location');
        requiresAdditionalFactors = true;
      }
      if (factors.behavioralAnomalies > 0.5) {
        recommendations.push('Behavioral patterns differ from baseline');
        requiresAdditionalFactors = true;
      }
      if (factors.velocityChecks > 0.8) {
        recommendations.push('Impossible travel or rapid login attempts detected');
        requiresAdditionalFactors = true;
      }
      if (factors.fraudIndicators > 0.7) {
        recommendations.push('Multiple fraud indicators present');
        requiresAdditionalFactors = true;
      }

      return {
        overallScore,
        factors,
        recommendations,
        requiresAdditionalFactors
      };
    } catch (error) {
      console.error('Risk assessment error:', error);
      return {
        overallScore: 0.8,
        factors: {
          deviceTrust: 0.5,
          locationRisk: 0.5,
          behavioralAnomalies: 0.5,
          velocityChecks: 0.5,
          fraudIndicators: 0.5
        },
        recommendations: ['Error during risk assessment'],
        requiresAdditionalFactors: true
      };
    }
  }

  private static async assessDeviceTrust(fingerprint: string, userId: string): Promise<number> {
    const { data: known