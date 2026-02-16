// lib/javari/providers/AnthropicProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

/**
 * Anthropic Claude Provider - HARDENED FOR PRODUCTION
 * 
 * MODEL: claude-3-5-sonnet-20241022 (explicitly set)
 * TIMEOUT CHAIN: provider(20s) < router(23s) < chat(25s)
 * 
 * Features:
 * - Streaming responses via Server-Sent Events (SSE)
 * - ExtendedRouterOptions with rolePrompt and preferredModel
 * - Automatic timeout handling with 20s provider-level timeout
 * - Cost estimation for Sonnet 3.5
 * - Enhanced error handling and fallback support
 * - 5xx error detection for failover
 */
export class AnthropicProvider extends BaseProvider {
  private model: string = 'claude-3-5-sonnet-20241022';
  protected timeout: number = 20000; // 20s provider timeout < 23s router < 25s chat

  getName(): AIProvider {
    return 'anthropic';
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Check if error is a 5xx server error requiring fallback
   */
  private is5xxError(error: any): boolean {
    if (error instanceof Error) {
      const status = error.message.match(/HTTP (\d{3})/);
      if (status && status[1]) {
        const code = parseInt(status[1]);
        return code >= 500 && code < 600;
      }
    }
    return false;
  }

  async *generateStream(
    message: string, 
    options?: ExtendedRouterOptions
  ): AsyncIterator<string> {
    // Apply timeout from options or use provider default (20s)
    const timeoutMs = options?.timeout || this.timeout;
    
    // Build messages array for Anthropic API
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Anthropic doesn't support system messages in messages array
    // We include rolePrompt as part of the user message
    if (options?.rolePrompt) {
      messages.push({ 
        role: 'user', 
        content: `${options.rolePrompt}\n\n${message}` 
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Use preferredModel if provided, otherwise use default (claude-3-5-sonnet-20241022)
    const modelToUse = options?.preferredModel || this.model;

    try {
      const response = await this.withTimeout(
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
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
        let errorMessage = `Anthropic API error: HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = `Anthropic: ${errorJson.error?.message || errorJson.error?.type || errorText}`;
        } catch {
          errorMessage = `Anthropic: HTTP ${response.status} - ${errorText.substring(0, 100)}`;
        }
        
        // Create error with status code for 5xx detection
        const error = new Error(errorMessage);
        (error as any).statusCode = response.status;
        throw error;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Anthropic: No response body received');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            // Parse SSE format: "event: content_block_delta\ndata: {...}"
            const eventMatch = line.match(/^event: (.+)$/m);
            const dataMatch = line.match(/^data: (.+)$/m);
            
            if (eventMatch && dataMatch) {
              const event = eventMatch[1];
              const data = dataMatch[1];
              
              // Extract text from content_block_delta events
              if (event === 'content_block_delta') {
                try {
                  const json = JSON.parse(data);
                  const content = json.delta?.text;
                  if (content) {
                    yield content;
                  }
                } catch (parseError) {
                  // Log but continue - don't break stream for parse errors
                  console.error('[Anthropic] Failed to parse delta:', parseError);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (error instanceof Error) {
        // Check for timeout
        if (error.message === 'Provider timeout') {
          throw new Error(`Anthropic provider timeout after ${timeoutMs}ms`);
        }
        
        // Check for 5xx errors - mark for fallback
        if (this.is5xxError(error)) {
          const wrappedError: any = new Error(error.message);
          wrappedError.requiresFallback = true;
          wrappedError.statusCode = (error as any).statusCode;
          throw wrappedError;
        }
        
        // Re-throw other errors as-is
        throw error;
      }
      
      throw new Error(`Anthropic provider error: ${String(error)}`);
    }
  }

  /**
   * Estimate cost for Claude 3.5 Sonnet
   * Pricing: $3 per 1M input tokens, $15 per 1M output tokens
   */
  async estimateCost(inputTokens: number, outputTokens: number): Promise<number> {
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    return inputCost + outputCost;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): string[] {
    return [
      'chat',
      'streaming',
      'long-context',  // 200K tokens
      'analysis',
      'code-review',
      'validation',
    ];
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ];
  }
}
