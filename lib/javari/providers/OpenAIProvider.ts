// lib/javari/providers/OpenAIProvider.ts
// FIXED: Extended timeout to 20s to prevent premature failures
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class OpenAIProvider extends BaseProvider {
  getName(): AIProvider {
    return 'openai';
  }

  getModel(): string {
    return 'gpt-4o';
  }

  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeoutMs: number = 20000 // FIXED: Increased from 10s to 20s
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
        throw new Error(`TIMEOUT: OpenAI request exceeded ${timeoutMs}ms`);
      }
      throw error;
    }
  }

  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    const modelToUse = options?.preferredModel || 'gpt-4o';
    
    console.log('[OpenAI] Starting stream:', { 
      model: modelToUse, 
      messageLength: message.length 
    });
    
    const messages: Array<{role: string; content: string}> = [];
    
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    messages.push({ role: 'user', content: message });

    try {
      const response = await this.fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
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
        },
        20000 // FIXED: 20s timeout
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        console.error('[OpenAI] API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody.substring(0, 200)
        });
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody.substring(0, 100)}`);
      }

      yield* this.processStream(response, modelToUse);

    } catch (error: any) {
      console.error('[OpenAI] Generation error:', {
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
      console.error('[OpenAI] No response body available');
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
          console.log(`[OpenAI] Stream complete:`, {
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
            if (data === '[DONE]') return;

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                tokenCount++;
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON chunks
            }
          }
        }
      }
    } catch (streamError: any) {
      console.error('[OpenAI] Stream processing error:', {
        error: streamError.message,
        tokensSoFar: tokenCount
      });
      throw streamError;
    } finally {
      reader.releaseLock();
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // GPT-4o pricing: $5/1M input, $15/1M output
    return (inputTokens * 0.000005) + (outputTokens * 0.000015);
  }
}
