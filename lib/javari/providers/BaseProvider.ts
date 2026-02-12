// lib/javari/providers/BaseProvider.ts
import { AIProvider, ProviderResponse, RouterOptions } from '../router/types';

// FIXED: Extended RouterOptions to include rolePrompt
export interface ExtendedRouterOptions extends RouterOptions {
  rolePrompt?: string;  // System prompt for role-based council execution
}

export abstract class BaseProvider {
  protected apiKey: string;
  protected timeout: number = 30000;
  protected maxRetries: number = 2;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error(`API key required for ${this.getName()}`);
    }
    this.apiKey = apiKey;
  }

  abstract getName(): AIProvider;
  abstract getModel(): string;
  
  // FIXED: Changed signature to accept ExtendedRouterOptions with rolePrompt
  abstract generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string>;

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.timeout;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }

  protected async withRetry<T>(fn: () => Promise<T>, retries: number = this.maxRetries): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    
    throw lastError;
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Override in subclasses with actual pricing
    return 0;
  }
}
