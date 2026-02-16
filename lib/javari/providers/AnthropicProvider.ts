// lib/javari/providers/AnthropicProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

/**
 * Anthropic Claude Provider
 * 
 * MODEL: claude-3-5-sonnet-20241022
 * TIMEOUT CHAIN: provider(20s) < router(23s) < chat(25s)
 * 
 * Supports:
 * - Streaming responses via Server-Sent Events (SSE)
 * - ExtendedRouterOptions with rolePrompt and preferredModel
 * - Automatic timeout handling with 20s provider-level timeout
 * - Cost estimation for Sonnet 3.5
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

  async *generateStream(
    message: string, 
    options?: ExtendedRouterOptions
  ): AsyncIterator<string> {
    // Apply timeout from options or use provider default (20s)
    const timeoutMs = options?.timeout || this.timeout;
    
    // Build system messages if rolePrompt provided
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    if (options?.rolePrompt) {
      // Anthropic doesn't support system messages in messages array
      // We prepend the role prompt to the user message
      messages.push({ 
        role: 'user', 
        content: `${options.rolePrompt}\n\n${message}` 
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Use preferredModel if provided, otherwise use default
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
          errorMessage = `Anthropic API error: ${errorJson.error?.message || errorText}`;
        } catch {
          errorMessage = `Anthropic API error: ${errorText.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body from Anthropic API');
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
                  console.error('[AnthropicProvider] Failed to parse SSE data:', parseError);
                  // Continue processing other events
                }
              }
              
              // Handle errors in stream
              if (event === 'error') {
                try {
                  const json = JSON.parse(data);
                  throw new Error(`Anthropic stream error: ${json.error?.message || 'Unknown error'}`);
                } catch (parseError) {
                  throw new Error(`Anthropic stream error: ${data}`);
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
        // Enhance timeout errors
        if (error.message === 'Provider timeout') {
          throw new Error(`Anthropic provider timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
      throw new Error(`Anthropic provider error: ${String(error)}`);
    }
  }

  /**
   * Cost estimation for Claude 3.5 Sonnet
   * Input: $3 per 1M tokens
   * Output: $15 per 1M tokens
   */
  estimateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    return inputCost + outputCost;
  }
}
