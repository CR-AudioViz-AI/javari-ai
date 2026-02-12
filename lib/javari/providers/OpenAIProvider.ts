// lib/javari/providers/OpenAIProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class OpenAIProvider extends BaseProvider {
  private model: string = 'gpt-4-turbo-preview';
  private fallbackModel: string = 'gpt-4o-mini';

  getName(): AIProvider {
    return 'openai';
  }

  getModel(): string {
    return this.model;
  }

  // CRITICAL FIX: Target nouns that trigger slow responses
  private optimizePrompt(message: string): string {
    let optimized = message;
    
    // Remove polite prefixes
    optimized = optimized.replace(/^(can you|could you|please|would you)\s+/gi, '');
    
    // Rewrite slow verbs
    optimized = optimized.replace(/\bcreate\s+/gi, 'build ');
    optimized = optimized.replace(/\bmake\s+/gi, 'develop ');
    optimized = optimized.replace(/\bgenerate\s+a\s+full\s+/gi, 'produce a working ');
    optimized = optimized.replace(/\bwrite\s+me\s+/gi, 'write ');
    optimized = optimized.replace(/\bi\s+need\s+code\s+for\s+/gi, 'write code for ');
    
    // CRITICAL: Rewrite slow target nouns (the actual problem)
    optimized = optimized.replace(/\bscreen\b/gi, 'interface');
    optimized = optimized.replace(/\bapp\b/gi, 'application code');
    optimized = optimized.replace(/\bpage\b/gi, 'component');
    optimized = optimized.replace(/\bplatform\b/gi, 'system');
    optimized = optimized.replace(/\bauthentication system\b/gi, 'auth code');
    optimized = optimized.replace(/\be-commerce\s+/gi, 'shop ');
    optimized = optimized.replace(/\bsocial media\s+/gi, 'social ');
    optimized = optimized.replace(/\bfull-stack\s+/gi, '');
    optimized = optimized.replace(/\bcomplete\s+/gi, '');
    
    return optimized.trim();
  }

  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeoutMs: number = 10000
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
        throw new Error('TIMEOUT: Request took too long. Try a simpler prompt.');
      }
      throw error;
    }
  }

  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    const optimizedMessage = this.optimizePrompt(message);
    
    console.log('[OpenAI] Original:', message);
    console.log('[OpenAI] Optimized:', optimizedMessage);
    
    const messages: Array<{role: string; content: string}> = [];
    
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    messages.push({ role: 'user', content: optimizedMessage });

    let modelToUse = this.model;
    let attemptedFallback = false;

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
        10000
      );

      if (!response.ok) {
        if (!attemptedFallback && response.status === 429) {
          console.log('[OpenAI] Rate limit, trying fallback...');
          attemptedFallback = true;
          modelToUse = this.fallbackModel;
          
          const fallbackResponse = await this.fetchWithTimeout(
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
            10000
          );
          
          if (!fallbackResponse.ok) {
            throw new Error(`OpenAI API error: ${fallbackResponse.status}`);
          }
          
          yield* this.processStream(fallbackResponse, modelToUse, optimizedMessage);
          return;
        }
        
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      yield* this.processStream(response, modelToUse, optimizedMessage);

    } catch (error: any) {
      console.error('[OpenAI] Error:', {
        originalPrompt: message,
        rewrittenPrompt: optimizedMessage,
        modelUsed: modelToUse,
        timeoutTriggered: error.message?.includes('TIMEOUT'),
        error: error.message
      });
      
      if (error.message?.includes('TIMEOUT') && !attemptedFallback) {
        console.log('[OpenAI] Timeout, trying fallback...');
        attemptedFallback = true;
        modelToUse = this.fallbackModel;
        
        try {
          const fallbackResponse = await this.fetchWithTimeout(
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
                max_tokens: options?.maxTokens || 1500,
                temperature: options?.temperature || 0.7,
                stream: true,
              }),
            },
            8000
          );
          
          if (fallbackResponse.ok) {
            yield* this.processStream(fallbackResponse, modelToUse, optimizedMessage);
            return;
          }
        } catch (fallbackError) {
          console.error('[OpenAI] Fallback failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  private async *processStream(
    response: Response, 
    modelUsed: string,
    optimizedPrompt: string
  ): AsyncIterator<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let firstChunkReceived = false;
    const streamStartTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstChunkReceived) {
        const elapsed = Date.now() - streamStartTime;
        console.log(`[OpenAI] First chunk in ${elapsed}ms (model: ${modelUsed})`);
        firstChunkReceived = true;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('[OpenAI] Complete:', {
              modelUsed,
              prompt: optimizedPrompt.substring(0, 50)
            });
            return;
          }

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.00001) + (outputTokens * 0.00003);
  }
}
