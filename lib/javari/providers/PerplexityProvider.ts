// lib/javari/providers/PerplexityProvider.ts
// Perplexity AI Provider — routed via OpenRouter
//
// WHY: Perplexity's API endpoint (api.perplexity.ai) is protected by Cloudflare
// WAF which blocks requests from Vercel serverless functions due to their
// dynamic/rotating IP pool. This is a known platform-wide issue (community.perplexity.ai/t/2591).
// OpenRouter has established Cloudflare trust and proxies Perplexity models
// with zero functionality loss. The fix is transparent — callers still request
// provider='perplexity', they get Perplexity's sonar-pro model, just via
// OpenRouter's stable IP infrastructure.
//
// KEY USED: OPENROUTER_API_KEY (already in vault, confirmed working)
// ENDPOINT: https://openrouter.ai/api/v1/chat/completions
// MODELS:   perplexity/sonar-pro (default) | perplexity/sonar (fast)
//
// 2026-02-19 — P0-003 fix

import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';
import { vault } from '@/lib/javari/secrets/vault';

export class PerplexityProvider extends BaseProvider {
  // Default to sonar-pro — full web search with citations
  private model: string = 'perplexity/sonar-pro';
  protected timeout: number = 20000;

  // OpenRouter endpoint — bypasses Cloudflare WAF that blocks Vercel IPs
  private readonly OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

  getName(): AIProvider {
    return 'perplexity';
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Resolve the API key to use.
   * Priority: vault('openrouter') → constructor apiKey → env fallback
   * The Perplexity API key itself is no longer used for direct calls.
   */
  private resolveOpenRouterKey(): string {
    // Always prefer the live OpenRouter key from vault
    const orKey = vault.get('openrouter');
    if (orKey) return orKey;
    // Fall back to whatever was passed to the constructor
    // (could be the perplexity key — won't work directly, but the caller
    //  may have already resolved openrouter key via getProviderApiKey)
    return this.apiKey || '';
  }

  async *generateStream(
    message: string,
    options?: ExtendedRouterOptions
  ): AsyncIterator<string> {
    const timeoutMs = options?.timeout || this.timeout;

    // Map bare model names (sonar, sonar-pro) to OpenRouter namespaced IDs
    let rawModel = options?.preferredModel || this.model;
    if (!rawModel.startsWith('perplexity/')) {
      // e.g. 'sonar-pro' → 'perplexity/sonar-pro'
      rawModel = `perplexity/${rawModel.replace(/^perplexity\/?/, '')}`;
    }
    const modelToUse = rawModel;

    const apiKey = this.resolveOpenRouterKey();
    if (!apiKey) {
      throw new Error('Perplexity (via OpenRouter): OPENROUTER_API_KEY not in vault');
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    messages.push({ role: 'user', content: message });

    try {
      const response = await this.withTimeout(
        fetch(this.OPENROUTER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://craudiovizai.com',
            'X-Title': 'Javari AI',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages,
            max_tokens: options?.maxTokens || 2000,
            temperature: options?.temperature || 0.7,
            stream: true,
          }),
        }),
        timeoutMs
      );

      if (!response.ok) {
        const errorText = await response.text();
        let msg = `Perplexity/OpenRouter HTTP ${response.status}`;
        try {
          const errJson = JSON.parse(errorText);
          msg = `Perplexity/OpenRouter: ${errJson.error?.message || errorText.slice(0, 150)}`;
        } catch {
          msg = `Perplexity/OpenRouter: HTTP ${response.status} — ${errorText.slice(0, 150)}`;
        }
        throw new Error(msg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Perplexity/OpenRouter: no response body');

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) yield content;
              } catch {
                // malformed chunk — skip
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Provider timeout') {
          throw new Error(`Perplexity provider timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
      throw new Error(`Perplexity provider error: ${String(error)}`);
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // sonar-pro via OpenRouter: ~$1/M input, ~$1/M output
    return ((inputTokens + outputTokens) / 1_000_000) * 1;
  }
}
