import { describe, it, expect } from 'vitest';
import { validateRequest, validateFileUpload, sanitizeString } from '../security/requestGuard';
describe('Phase Ω-VI — Security Input Tests (8)', () => {
  it('blocks SQL UNION injection', () => {
    const res = validateRequest({
      method: 'POST',
      path: '/api/test',
      headers: {},
      query: {},
      body: "1 UNION SELECT password FROM users"
    });
    expect(res.allowed).toBe(false);
    expect(res.actionTaken).toBe('block');
    expect(res.scanResult.threatDetected).toBe(true);
  });
  it('blocks SQL tautology injection', () => {
    const res = validateRequest({
      method: 'POST',
      path: '/api/test',
      headers: {},
      query: {},
      body: "admin' OR '1'='1"
    });
    expect(res.allowed).toBe(false);
    expect(res.actionTaken).toBe('block');
  });
  it('blocks script-tag XSS', () => {
    const res = validateRequest({
      method: 'POST',
      path: '/api/test',
      headers: {},
      query: {},
      body: '<script>alert(1)</script>'
    });
    expect(res.allowed).toBe(false);
    expect(res.actionTaken).toBe('block');
  });
  it('blocks directory traversal patterns', () => {
    const res = validateRequest({
      method: 'GET',
      path: '/api/test',
      headers: {},
      query: { file: '../../etc/passwd' },
      body: '../../etc/passwd'
    });
    expect(res.allowed).toBe(false);
    expect(res.actionTaken).toBe('block');
  });
  it('allows clean request content', () => {
    const res = validateRequest({
      method: 'POST',
      path: '/api/test',
      headers: { 'content-type': 'application/json' },
      query: {},
      body: { ok: true, message: 'hello world' }
    });
    expect(res.allowed).toBe(true);
    expect(res.actionTaken).toBe('log');
  });
  it('blocks file upload with disallowed MIME type', () => {
    const res = validateFileUpload('file.exe', 'application/x-msdownload', 123);
    expect(res.allowed).toBe(false);
    expect(res.actionTaken).toBe('block');
  });
  it('blocks file upload exceeding max size', () => {
    const elevenMB = 11 * 1024 * 1024;
    const res = validateFileUpload('big.pdf', 'application/pdf', elevenMB);
    expect(res.allowed).toBe(false);
    expect(res.actionTaken).toBe('block');
  });
  it('sanitizes strings by escaping angle brackets and quotes', () => {
    const s = `<img src="x" onerror='alert(1)'>`;
    const out = sanitizeString(s);
    expect(out.includes('<')).toBe(false);
    expect(out.includes('>')).toBe(false);
    expect(out.includes('"')).toBe(false);
    expect(out.includes("'")).toBe(false);
  });
});
