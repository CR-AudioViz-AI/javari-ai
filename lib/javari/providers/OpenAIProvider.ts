// lib/javari/providers/OpenAIProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class OpenAIProvider extends BaseProvider {
  private primaryModel: string = 'gpt-4-turbo-preview';
  private fallbackModel: string = 'gpt-4o-mini'; // Fast model for deep codegen triggers

  // CRITICAL: Nouns that trigger slow deep-codegen pipeline in GPT-4 Turbo
  private DEEP_CODEGEN_NOUNS = [
    'screen', 'app', 'page', 'platform', 'system', 'dashboard',
    'ui', 'component', 'frontend', 'authentication', 'auth',
    'registration', 'full-stack', 'builder', 'interface'
  ];

  getName(): AIProvider {
    return 'openai';
  }

  getModel(): string {
    return this.primaryModel;
  }

  // Optimize prompts for faster responses
  private optimizePrompt(message: string): string {
    let optimized = message;
    
    // Remove polite prefixes
    optimized = optimized.replace(/^(can you|could you|please|would you)\s+/gi, '');
    
    // Rewrite slow verbs
    optimized = optimized.replace(/\bcreate\s+/gi, 'build ');
    optimized = optimized.replace(/\bmake\s+/gi, 'develop ');
    optimized = optimized.replace(/\bgenerate\s+a\s+full\s+/gi, 'produce a ');
    optimized = optimized.replace(/\bwrite\s+me\s+/gi, 'write ');
    
    return optimized.trim();
  }

  // CRITICAL: Detect if prompt contains deep-codegen trigger nouns
  private shouldUseFallbackModel(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return this.DEEP_CODEGEN_NOUNS.some(noun => lowerPrompt.includes(noun));
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
        throw new Error('TIMEOUT: Request took too long.');
      }
      throw error;
    }
  }

  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    const optimizedMessage = this.optimizePrompt(message);
    
    // CRITICAL: Choose model BEFORE making any API call
    const useFallback = this.shouldUseFallbackModel(optimizedMessage);
    const modelToUse = useFallback ? this.fallbackModel : this.primaryModel;
    
    console.log('[OpenAI] Prompt analysis:', {
      original: message.substring(0, 50),
      optimized: optimizedMessage.substring(0, 50),
      deepCodegenTrigger: useFallback,
      modelSelected: modelToUse
    });
    
    const messages: Array<{role: string; content: string}> = [];
    
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    messages.push({ role: 'user', content: optimizedMessage });

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
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      yield* this.processStream(response, modelToUse);

    } catch (error: any) {
      console.error('[OpenAI] Error:', {
        originalPrompt: message.substring(0, 50),
        rewrittenPrompt: optimizedMessage.substring(0, 50),
        modelUsed: modelToUse,
        nounTrigger: useFallback,
        error: error.message
      });
      
      throw error;
    }
  }

  private async *processStream(
    response: Response, 
    modelUsed: string
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
          if (data === '[DONE]') return;

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
