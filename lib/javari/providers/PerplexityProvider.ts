// lib/javari/providers/PerplexityProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

/**
 * Perplexity AI Provider
 * 
 * MODEL: sonar-pro
 * TIMEOUT CHAIN: provider(20s) < router(23s) < chat(25s)
 * 
 * Supports:
 * - Streaming responses via OpenAI-compatible API
 * - Real-time web search capabilities
 * - ExtendedRouterOptions with rolePrompt and preferredModel
 */
export class PerplexityProvider extends BaseProvider {
  private model: string = 'sonar-pro';
  protected timeout: number = 20000; // 20s provider timeout

  getName(): AIProvider {
    return 'perplexity';
  }

  getModel(): string {
    return this.model;
  }

  async *generateStream(
    message: string,
    options?: ExtendedRouterOptions
  ): AsyncIterator<string> {
    const timeoutMs = options?.timeout || this.timeout;
    const modelToUse = options?.preferredModel || this.model;

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];
    
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    messages.push({ role: 'user', content: message });

    try {
      const response = await this.withTimeout(
        fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
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
        throw new Error(`Perplexity API error: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body from Perplexity API');
      }

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
                if (content) {
                  yield content;
                }
              } catch (parseError) {
                console.error('[PerplexityProvider] Failed to parse chunk:', parseError);
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

  /**
   * Cost estimation for Perplexity Sonar Pro
   * Approximate costs based on public pricing
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * 1;
    const outputCost = (outputTokens / 1_000_000) * 1;
    return inputCost + outputCost;
  }
}
