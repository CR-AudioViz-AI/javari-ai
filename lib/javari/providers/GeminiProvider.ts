// lib/javari/providers/GeminiProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class GeminiProvider extends BaseProvider {
  getName(): AIProvider {
    return 'gemini' as AIProvider;
  }

  getModel(): string {
    return 'gemini-1.5-flash';
  }

  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeoutMs: number = 20000
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
        throw new Error('TIMEOUT: Gemini request took too long.');
      }
      throw error;
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>, 
    maxRetries: number = 2
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Retry on 429 (rate limit) or 503 (service unavailable)
        if (error.message?.includes('429') || error.message?.includes('503')) {
          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
            console.log(`[Gemini] Rate limited, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            continue;
          }
        }
        
        throw error;
      }
    }
    
    throw lastError || new Error('Unknown error');
  }

  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    const modelToUse = options?.preferredModel || 'gemini-1.5-flash';
    const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('[Gemini] Request:', {
      requestId,
      model: modelToUse,
      messageLength: message.length
    });
    
    // Gemini API expects "contents" array with parts
    const contents = [
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];
    
    // Add system instruction if role prompt provided
    const systemInstruction = options?.rolePrompt ? {
      parts: [{ text: options.rolePrompt }]
    } : undefined;

    try {
      const response = await this.retryWithBackoff(async () => {
        return await this.fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1/models/${modelToUse}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents,
              systemInstruction,
              generationConfig: {
                maxOutputTokens: options?.maxTokens || 2000,
                temperature: options?.temperature || 0.7,
              },
            }),
          },
          20000 // 20 second timeout
        );
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Gemini] API error:', {
          requestId,
          status: response.status,
          error: errorText.substring(0, 200)
        });
        throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      yield* this.processStream(response, modelToUse, requestId);

    } catch (error: any) {
      console.error('[Gemini] Error:', {
        requestId,
        model: modelToUse,
        error: error.message
      });
      throw error;
    }
  }

  private async *processStream(
    response: Response, 
    modelUsed: string,
    requestId: string
  ): AsyncIterator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    const streamStartTime = Date.now();
    let chunkCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const elapsed = Date.now() - streamStartTime;
          console.log(`[Gemini] Stream complete:`, {
            requestId,
            model: modelUsed,
            durationMs: elapsed,
            chunks: chunkCount
          });
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          
          // Gemini SSE format: "data: {...}"
          if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            
            try {
              const json = JSON.parse(data);
              
              // Gemini response structure: candidates[0].content.parts[0].text
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                chunkCount++;
                yield text;
              }
              
              // Check for finish reason
              const finishReason = json.candidates?.[0]?.finishReason;
              if (finishReason && finishReason !== 'STOP') {
                console.warn(`[Gemini] Unexpected finish:`, {
                  requestId,
                  finishReason
                });
              }
            } catch (e) {
              // Skip invalid JSON chunks
              console.debug('[Gemini] Skipped invalid JSON chunk');
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    // Gemini 1.5 Flash pricing (as of Feb 2026)
    // $0.075 per 1M input tokens, $0.30 per 1M output tokens
    const inputCost = (inputTokens * 0.075) / 1000000;
    const outputCost = (outputTokens * 0.30) / 1000000;
    return inputCost + outputCost;
  }
}
