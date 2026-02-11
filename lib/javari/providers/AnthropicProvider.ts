// lib/javari/providers/AnthropicProvider.ts
import { BaseProvider } from './BaseProvider';
import { AIProvider, RouterOptions } from '../router/types';

export class AnthropicProvider extends BaseProvider {
  // Using Claude 3.5 Sonnet latest version
  private model: string = 'claude-3-5-sonnet-latest';

  getName(): AIProvider {
    return 'anthropic';
  }

  getModel(): string {
    return this.model;
  }

  async *generateStream(message: string, options?: RouterOptions): AsyncIterator<string> {
    const response = await this.withTimeout(
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
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
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const eventMatch = line.match(/^event: (.+)$/m);
        const dataMatch = line.match(/^data: (.+)$/m);
        
        if (eventMatch && dataMatch) {
          const event = eventMatch[1];
          const data = dataMatch[1];
          
          if (event === 'content_block_delta') {
            try {
              const json = JSON.parse(data);
              const content = json.delta?.text;
              if (content) yield content;
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }
  }

  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.000003) + (outputTokens * 0.000015);
  }
}
