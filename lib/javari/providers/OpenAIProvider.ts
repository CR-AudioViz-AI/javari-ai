// lib/javari/providers/OpenAIProvider.ts
import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

export class OpenAIProvider extends BaseProvider {
  private model: string = 'gpt-4-turbo-preview';

  getName(): AIProvider {
    return 'openai';
  }

  getModel(): string {
    return this.model;
  }

  // FIXED: Accept ExtendedRouterOptions with rolePrompt
  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    // FIXED: Build messages array with optional system prompt for role-based execution
    const messages: Array<{role: string; content: string}> = [];
    
    // Add system prompt if provided (for SuperMode role-based council)
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    // Add user message
    messages.push({ role: 'user', content: message });

    const response = await this.withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,  // FIXED: Use messages array with optional system prompt
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.7,
          stream: true,
        }),
      }),
      options?.timeout
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

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
