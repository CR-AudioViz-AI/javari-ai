// lib/javari/providers/OpenAIProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class OpenAIProvider extends BaseProvider {
  getName(): AIProvider {
    return 'openai';
  }

  getModel(): string {
    return 'gpt-4-turbo-preview';
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
    // Use preferredModel from router (set by preprocessPrompt)
    // @ts-ignore - preferredModel added dynamically
    const modelToUse = options?.preferredModel || 'gpt-4-turbo-preview';
    
    console.log('[OpenAI] Using model:', modelToUse);
    
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
        10000
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      yield* this.processStream(response, modelToUse);

    } catch (error: any) {
      console.error('[OpenAI] Error:', {
        model: modelToUse,
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
    const streamStartTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const elapsed = Date.now() - streamStartTime;
        console.log(`[OpenAI] Stream complete in ${elapsed}ms (model: ${modelUsed})`);
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
