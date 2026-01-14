import { describe, it, expect } from 'vitest';
import { validateSecretContent } from '../security/secretValidator';
import { generateSignedURL, validateSignedURL } from '../security/assetGuard';
describe('Phase Ω-VI — Secrets & Assets Tests (7)', () => {
  it('detects private key leakage', () => {
    const res = validateSecretContent('-----BEGIN PRIVATE KEY-----abc');
    expect(res.hasSecrets).toBe(true);
    expect(res.secrets.length).toBeGreaterThan(0);
  });
  it('sanitizes content when secrets are detected', () => {
    const res = validateSecretContent('AKIA1234567890123456');
    expect(res.sanitizedContent).toBe('[REDACTED]');
  });
  it('allows clean content with no secrets', () => {
    const res = validateSecretContent('hello world');
    expect(res.hasSecrets).toBe(false);
    expect(res.sanitizedContent).toBe('hello world');
  });
  it('generates a signed asset URL', () => {
    const url = generateSignedURL('read/file.png', 60);
    expect(url.includes('signature=')).toBe(true);
  });
  it('validates a signed asset URL', () => {
    const url = generateSignedURL('read/file.png', 60);
    const params = new URLSearchParams(url.split('?')[1]);
    const valid = validateSignedURL(
      'read/file.png',
      Number(params.get('expires')),
      params.get('signature') || ''
    );
    expect(valid).toBe(true);
  });
  it('rejects expired signed URLs', () => {
    const url = generateSignedURL('read/file.png', -10);
    const params = new URLSearchParams(url.split('?')[1]);
    const valid = validateSignedURL(
      'read/file.png',
      Number(params.get('expires')),
      params.get('signature') || ''
    );
    expect(valid).toBe(false);
  });
  it('rejects tampered asset signatures', () => {
    const valid = validateSignedURL(
      'read/file.png',
      Math.floor(Date.now() / 1000) + 60,
      'bad-signature'
    );
    expect(valid).toBe(false);
  });
});
