// lib/javari/providers/CohereProvider.ts
import { BaseProvider } from './BaseProvider';
import { AIProvider, RouterOptions } from '../router/types';

export class CohereProvider extends BaseProvider {
  private model: string = 'command-r-plus';

  getName(): AIProvider {
    return 'cohere';
  }

  getModel(): string {
    return this.model;
  }

  async *generateStream(message: string, options?: RouterOptions): AsyncIterator<string> {
    const response = await this.withTimeout(
      fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          message: message,
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature || 0.7,
          stream: true,
        }),
      }),
      options?.timeout
    );

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status}`);
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
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);
          
          if (json.event_type === 'text-generation') {
            const content = json.text;
            if (content) yield content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.000003) + (outputTokens * 0.000015);
  }
}
