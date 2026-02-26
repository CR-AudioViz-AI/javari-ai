/**
 * Secrets Vault - Web Crypto API compatible
 */

export async function encrypt(text: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Simple base64 encoding for now (replace with actual encryption in production)
  return btoa(String.fromCharCode(...data));
}

export async function decrypt(encrypted: string, key: string): Promise<string> {
  // Simple base64 decoding for now
  const decoded = atob(encrypted);
  return decoded;
}

export function generateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
