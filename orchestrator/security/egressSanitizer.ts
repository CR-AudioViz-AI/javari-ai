/**
 * EGRESS SANITIZATION ENGINE
 * 
 * CRITICAL SECURITY MODULE - Phase Ω-X
 * 
 * PURPOSE:
 * Prevents AI models from leaking sensitive data (API keys, credentials, PII)
 * in responses by sanitizing all outbound content.
 * 
 * BEHAVIOR:
 * - Development: Redacts secrets, logs warnings, allows response
 * - Production: BLOCKS request entirely if secrets detected (fail-closed)
 * 
 * INTEGRATION POINTS:
 * - app/api/chat/route.ts (streaming AI responses)
 * - app/api/chat/stream/route.ts (streaming chat)
 * - app/api/chat/powerhouse/route.ts (powerhouse chat)
 * - All secondary AI output endpoints
 */

import { recordThreatDetected } from './telemetry';
import { logIncident } from './incidentLogger';

// Secret detection patterns (HIGH CONFIDENCE)
const SECRET_PATTERNS = [
  // API Keys
  /\b(sk-[a-zA-Z0-9]{48,}|sk-proj-[a-zA-Z0-9_-]{48,})\b/gi, // OpenAI
  /\bsk-ant-[a-zA-Z0-9_-]{95,}\b/gi, // Anthropic
  /\b[A-Z0-9]{32,}\b/g, // Generic API keys (32+ uppercase alphanumeric)
  
  // Credentials
  /\b(password|passwd|pwd)\s*[=:]\s*['"]?[^'"\s]{8,}['"]?/gi,
  /\b(api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
  /\b(secret|token)\s*[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
  
  // Database credentials
  /postgresql:\/\/[^:]+:[^@]+@[^\/]+/gi,
  /mysql:\/\/[^:]+:[^@]+@[^\/]+/gi,
  /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^\/]+/gi,
  
  // AWS credentials
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b([A-Za-z0-9+\/]{40})\b/g, // AWS secret access key pattern
  
  // Private keys
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
  
  // Stripe keys
  /\b(sk|pk)_(test|live)_[a-zA-Z0-9]{24,}\b/gi,
  
  // JWT tokens (high entropy base64)
  /\beyJ[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{30,}\.[a-zA-Z0-9_-]{30,}\b/g,
  
  // GitHub tokens
  /\bghp_[a-zA-Z0-9]{36,}\b/gi,
  /\bgho_[a-zA-Z0-9]{36,}\b/gi,
  
  // Supabase keys
  /\beyJ[a-zA-Z0-9_-]{100,}\b/g, // Long JWTs (Supabase anon/service keys)
];

// PII patterns (context-dependent)
const PII_PATTERNS = [
  // Credit cards (Luhn algorithm check needed)
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
  
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  
  // Email (when in suspicious contexts)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
];

export interface SanitizationResult {
  sanitized: string;
  detectedThreats: Array<{
    type: 'secret' | 'pii' | 'suspicious';
    pattern: string;
    redactedValue: string;
  }>;
  blocked: boolean;
  reason?: string;
}

/**
 * Sanitize outbound AI model responses
 * 
 * @param content - Raw AI output
 * @param context - Context of the output (ai, user, system)
 * @returns Sanitization result
 */
export function sanitizeEgress(
  content: string,
  context: 'ai' | 'user' | 'system' = 'ai'
): SanitizationResult {
  const detectedThreats: SanitizationResult['detectedThreats'] = [];
  let sanitized = content;
  
  // Check for secrets
  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        detectedThreats.push({
          type: 'secret',
          pattern: pattern.source,
          redactedValue: match.slice(0, 4) + '***' + match.slice(-4),
        });
        
        // Replace with redaction marker
        sanitized = sanitized.replace(
          new RegExp(escapeRegex(match), 'g'),
          '[REDACTED]'
        );
      }
    }
  }
  
  // Check for PII (less aggressive)
  for (const pattern of PII_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 2) { // Only flag if multiple instances
      for (const match of matches) {
        detectedThreats.push({
          type: 'pii',
          pattern: pattern.source,
          redactedValue: match.slice(0, 2) + '***',
        });
        
        sanitized = sanitized.replace(
          new RegExp(escapeRegex(match), 'g'),
          '[REDACTED]'
        );
      }
    }
  }
  
  // Determine if response should be blocked
  const shouldBlock = detectedThreats.length > 0 && process.env.NODE_ENV === 'production';
  
  // Log threats
  if (detectedThreats.length > 0) {
    recordThreatDetected({
      threatType: 'egress_leak',
      severity: shouldBlock ? 'critical' : 'high',
      context: `AI output sanitization (${context})`,
      metadata: {
        threatCount: detectedThreats.length,
        blocked: shouldBlock,
        patterns: detectedThreats.map(t => t.type),
      },
    });
    
    logIncident({
      type: 'egress_leak_detected',
      severity: shouldBlock ? 'critical' : 'high',
      details: {
        context,
        detectedThreats: detectedThreats.length,
        blocked: shouldBlock,
        environment: process.env.NODE_ENV,
      },
    });
  }
  
  return {
    sanitized,
    detectedThreats,
    blocked: shouldBlock,
    reason: shouldBlock
      ? `Outbound response blocked: ${detectedThreats.length} secrets/PII detected`
      : undefined,
  };
}

/**
 * Helper: Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quick check: Does content contain ANY secrets?
 * (Faster than full sanitization for pre-checks)
 */
export function containsSecrets(content: string): boolean {
  return SECRET_PATTERNS.some(pattern => pattern.test(content));
}
