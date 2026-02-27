// lib/javari/ingest/utils.ts
// Javari OS Memory Ingestion — Utility Functions
// 2026-02-27 — Stage 2 Build

import crypto from 'crypto';

/**
 * Generate SHA-256 hash of content
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Estimate token count (rough approximation: 4 chars = 1 token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate embedding cost based on provider and token count
 */
export function calculateEmbeddingCost(
  provider: 'openai' | 'mistral' | 'voyage',
  tokens: number
): number {
  const costPer1MTokens = {
    openai: 0.13,   // text-embedding-3-small
    mistral: 0.10,  // mistral-embed
    voyage: 0.12    // voyage-2
  };
  
  const rate = costPer1MTokens[provider] || 0.13;
  return (tokens / 1_000_000) * rate;
}

/**
 * Sleep for specified milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxAttempts) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        await sleep(backoff);
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Batch array into chunks of specified size
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Extract heading from markdown chunk
 */
export function extractHeading(content: string): string | undefined {
  const match = content.match(/^#+\s+(.+)/m);
  return match ? match[1].trim() : undefined;
}

/**
 * Detect content type
 */
export function detectContentType(content: string): 'prose' | 'code' | 'data' | 'diagram' | 'metadata' {
  const codeBlockRatio = (content.match(/```/g) || []).length / Math.max(content.length / 1000, 1);
  const listRatio = (content.match(/^[\*\-\+]\s/gm) || []).length / Math.max(content.length / 100, 1);
  const tableRatio = (content.match(/\|/g) || []).length / Math.max(content.length / 100, 1);
  
  if (codeBlockRatio > 0.5) return 'code';
  if (tableRatio > 2) return 'data';
  if (listRatio > 3) return 'metadata';
  if (content.includes('```mermaid') || content.includes('```dot')) return 'diagram';
  
  return 'prose';
}

/**
 * Sanitize content for storage (remove excess whitespace, normalize)
 */
export function sanitizeContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .replace(/[ \t]+$/gm, '')         // Remove trailing whitespace
    .trim();
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'mem'): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format cost in USD
 */
export function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}
