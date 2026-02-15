// lib/javari/providers/AnthropicProvider.ts
// FIXED: Extended timeout and improved error handling
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class AnthropicProvider extends BaseProvider {
  getName(): AIProvider {
    return 'anthropic';
  }

  getModel(): string {
    return 'claude-sonnet-4-5-20250929';
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = 20000 // FIXED: Increased from default to 20s
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`TIMEOUT: Anthropic request exceeded ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    const modelToUse = options?.preferredModel || 'claude-sonnet-4-5-20250929';
    
    console.log('[Anthropic] Starting stream:', {
      model: modelToUse,
      messageLength: message.length
    });

    const messages: Array<{role: string; content: string}> = [];

    if (options?.rolePrompt) {
      messages.push({ role: 'user', content: `System: ${options.rolePrompt}\n\nUser: ${message}` });
    } else {
      messages.push({ role: 'user', content: message });
    }

    try {
      const response = await this.fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
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
        },
        20000 // FIXED: 20s timeout
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        console.error('[Anthropic] API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody.substring(0, 200)
        });
        throw new Error(`Anthropic API error: ${response.status} - ${errorBody.substring(0, 100)}`);
      }

      yield* this.processStream(response, modelToUse);

    } catch (error: any) {
      console.error('[Anthropic] Generation error:', {
        model: modelToUse,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  private async *processStream(
    response: Response,
    modelUsed: string
  ): AsyncIterator<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('[Anthropic] No response body available');
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const streamStartTime = Date.now();
    let tokenCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const elapsed = Date.now() - streamStartTime;
          console.log(`[Anthropic] Stream complete:`, {
            model: modelUsed,
            duration: `${elapsed}ms`,
            tokens: tokenCount
          });
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const json = JSON.parse(data);

              // Handle different event types
              if (json.type === 'content_block_delta') {
                const content = json.delta?.text;
                if (content) {
                  tokenCount++;
                  yield content;
                }
              } else if (json.type === 'message_stop') {
                return;
              } else if (json.type === 'error') {
                console.error('[Anthropic] Stream error event:', json);
                throw new Error(json.error?.message || 'Stream error');
              }
            } catch (parseError) {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } catch (streamError: any) {
      console.error('[Anthropic] Stream processing error:', {
        error: streamError.message,
        tokensSoFar: tokenCount
      });
      throw streamError;
    } finally {
      reader.releaseLock();
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude Sonnet 4.5 pricing: $3/1M input, $15/1M output
    return (inputTokens * 0.000003) + (outputTokens * 0.000015);
  }
}
