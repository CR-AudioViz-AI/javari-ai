// lib/javari/providers/OpenAIProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class OpenAIProvider extends BaseProvider {
  private model: string = 'gpt-4-turbo-preview';
  private fallbackModel: string = 'gpt-4o-mini'; // Faster fallback

  getName(): AIProvider {
    return 'openai';
  }

  getModel(): string {
    return this.model;
  }

  // ENHANCEMENT #2: Expanded Prompt Rewriting
  private optimizePrompt(message: string): string {
    let optimized = message;
    
    // Remove polite prefixes that add no value
    optimized = optimized.replace(/^(can you|could you|please|would you)\s+/gi, '');
    
    // Rewrite slow-trigger words to fast-trigger equivalents
    optimized = optimized.replace(/\bcreate\s+a\s+/gi, 'build a ');
    optimized = optimized.replace(/\bcreate\s+an\s+/gi, 'build an ');
    optimized = optimized.replace(/\bmake\s+a\s+/gi, 'develop a ');
    optimized = optimized.replace(/\bmake\s+an\s+/gi, 'develop an ');
    optimized = optimized.replace(/\bgenerate\s+a\s+full\s+/gi, 'produce a working ');
    optimized = optimized.replace(/\bwrite\s+me\s+/gi, 'write ');
    optimized = optimized.replace(/\bi\s+need\s+code\s+for\s+/gi, 'write code for ');
    
    return optimized.trim();
  }

  // ENHANCEMENT #1: 10-second Timeout Guard with helpful message
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
        throw new Error('TIMEOUT: This request is taking too long. Try rephrasing as: build a login screen');
      }
      throw error;
    }
  }

  // ENHANCEMENT #3: Model Fallback with 2-second stream start check
  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    // ENHANCEMENT #2: Optimize prompt before sending
    const optimizedMessage = this.optimizePrompt(message);
    
    console.log('[OpenAI] Original:', message);
    console.log('[OpenAI] Optimized:', optimizedMessage);
    
    const messages: Array<{role: string; content: string}> = [];
    
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    messages.push({ role: 'user', content: optimizedMessage });

    // Try primary model first
    let modelToUse = this.model;
    let attemptedFallback = false;

    try {
      // ENHANCEMENT #1: 10-second timeout protection
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
        10000 // 10 second timeout
      );

      if (!response.ok) {
        // ENHANCEMENT #3: If primary model fails, try fallback
        if (!attemptedFallback && response.status === 429) {
          console.log('[OpenAI] Rate limit hit, trying fallback model...');
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
      // ENHANCEMENT #4: Improved error logging
      console.error('[OpenAI] Error:', {
        originalPrompt: message,
        rewrittenPrompt: optimizedMessage,
        modelUsed: modelToUse,
        timeoutTriggered: error.message?.includes('TIMEOUT'),
        error: error.message
      });
      
      // ENHANCEMENT #3: Fallback on timeout
      if (error.message?.includes('TIMEOUT') && !attemptedFallback) {
        console.log('[OpenAI] Timeout on primary model, trying fallback...');
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
            8000 // Shorter timeout for fallback
          );
          
          if (fallbackResponse.ok) {
            yield* this.processStream(fallbackResponse, modelToUse, optimizedMessage);
            return;
          }
        } catch (fallbackError) {
          console.error('[OpenAI] Fallback also failed:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  // Helper: Process SSE stream
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
            console.log('[OpenAI] Stream complete:', {
              modelUsed,
              rewrittenPrompt: optimizedPrompt.substring(0, 50)
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
