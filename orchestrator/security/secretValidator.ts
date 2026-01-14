import {
  ThreatSeverity,
  DetectedSecret,
  SecretValidationResult
} from './types';
import crypto from 'crypto';
const REQUIRED_SECRETS = [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'JWT_SECRET'
];
const MIN_SECRET_LENGTH = 32;
export function validateSecrets(): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_SECRETS.filter(
    key => !process.env[key] || process.env[key]!.length < MIN_SECRET_LENGTH
  );
  return {
    valid: missing.length === 0,
    missing
  };
}
export function detectLeaks(content: string): DetectedSecret[] {
  const findings: DetectedSecret[] = [];
  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: 'api_key', regex: /AKIA[0-9A-Z]{16}/g },
    { type: 'jwt_token', regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g },
    { type: 'private_key', regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g }
  ];
  for (const { type, regex } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      findings.push({
        type: type as any,
        pattern: regex.source,
        matchedContent: '[REDACTED]',
        position: { start: match.index, end: match.index + match[0].length },
        severity: ThreatSeverity.CRITICAL
      });
    }
  }
  return findings;
}
export function validateSecretContent(content: string): SecretValidationResult {
  const secrets = detectLeaks(content);
  return {
    hasSecrets: secrets.length > 0,
    secrets,
    sanitizedContent: secrets.length > 0 ? '[REDACTED]' : content
  };
}
