// lib/javari/providers/BaseProvider.ts
// Self-healing base provider — never throws on missing key at construction.
// Missing keys are caught at first generateStream() call, enabling graceful
// fallback in the provider chain.
// Timestamp: 2026-02-19 09:40 EST

import { AIProvider, RouterOptions } from '../router/types';

export interface ExtendedRouterOptions extends RouterOptions {
  rolePrompt?: string;      // System prompt for role-based council execution
  preferredModel?: string;  // Model selection from preprocessPrompt
}

// Legacy alias — some files import this name
export type ExtendedExtendedRouterOptions = ExtendedRouterOptions;

export abstract class BaseProvider {
  protected apiKey: string;
  protected timeout: number = 30000;
  protected maxRetries: number = 2;

  constructor(apiKey: string) {
    // Graceful degradation: store key even if empty.
    // generateStream() will throw with a clear message if key is missing,
    // allowing the router fallback chain to try the next provider.
    this.apiKey = apiKey ?? '';
    if (!apiKey) {
      console.warn(
        `[BaseProvider] ${this.constructor.name} initialised with empty API key. ` +
        `Provider will fail at runtime and trigger fallback.`
      );
    }
  }

  abstract getName(): AIProvider;
  abstract getModel(): string;
  abstract generateStream(
    message: string,
    options?: ExtendedRouterOptions
  ): AsyncIterator<string>;
  abstract estimateCost(inputTokens: number, outputTokens: number): number | Promise<number>;

  /**
   * Call this at the top of generateStream() to fail fast with a clear error
   * before making any network request.
   */
  protected requireApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        `[${this.getName()}] API key not configured. ` +
        `Set the corresponding env var in Vercel and redeploy.`
      );
    }
  }

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
