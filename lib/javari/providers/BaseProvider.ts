// lib/javari/providers/BaseProvider.ts
import { AIProvider, RouterOptions } from '../router/types';

// FIXED: Added preferredModel to interface
export interface ExtendedRouterOptions extends RouterOptions {
  rolePrompt?: string;  // System prompt for role-based council execution
  preferredModel?: string; // Model selection from preprocessPrompt
}

export abstract class BaseProvider {
  protected apiKey: string;
  protected timeout: number = 30000;
  protected maxRetries: number = 2;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API key required');
    }
    this.apiKey = apiKey;
  }

  abstract getName(): AIProvider;
  abstract getModel(): string;
  abstract generateStream(
    message: string,
    options?: ExtendedRouterOptions
  ): AsyncIterator<string>;
  abstract estimateCost(inputTokens: number, outputTokens: number): number;

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.timeout;
    
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Provider timeout')), timeout)
      ),
    ]);
  }
}
