import crypto from 'crypto';
const SIGNING_SECRET = process.env.ASSET_SIGNING_SECRET || 'dev-secret';
const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 1 hour
function isSafePath(path: string): boolean {
  return !path.includes('..') && !path.startsWith('/');
}
export function generateSignedURL(
  assetPath: string,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): string {
  if (!isSafePath(assetPath)) {
    throw new Error('Invalid asset path');
  }
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = `${assetPath}:${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  return `${assetPath}?expires=${expiresAt}&signature=${signature}`;
}
export function validateSignedURL(
  assetPath: string,
  expires: number,
  signature: string
): boolean {
  if (!isSafePath(assetPath)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;
  const payload = `${assetPath}:${expires}`;
  const expected = crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
export function enforceReadOnly(path: string): boolean {
  return path.startsWith('read/');
}
export function enforceWriteOnly(path: string): boolean {
  return path.startsWith('write/');
}
