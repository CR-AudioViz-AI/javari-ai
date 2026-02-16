// lib/javari/providers/MistralProvider.ts
import { BaseProvider, ExtendedExtendedRouterOptions } from './BaseProvider';
import { AIProvider, ExtendedRouterOptions } from '../router/types';

export class MistralProvider extends BaseProvider {
  private model: string = 'mistral-large-latest';

  getName(): AIProvider {
    return 'mistral';
  }

  getModel(): string {
    return this.model;
  }

  async *generateStream(message: string, options?: ExtendedRouterOptions): AsyncIterator<string> {
    const response = await this.withTimeout(
      fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: message }],
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.7,
          stream: true,
        }),
      }),
      options?.timeout
    );

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
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
    return (inputTokens * 0.000002) + (outputTokens * 0.000006);
  }
}
