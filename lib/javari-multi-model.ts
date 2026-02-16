/**
 * Javari AI Multi-Model Support
 * Enables switching between OpenAI, Anthropic Claude, and other AI models
 * 
 * @version 4.0.0
 * @last-updated 2025-10-27
 */

import Anthropic from '@anthropic-ai/sdk';
import { JAVARI_SYSTEM_PROMPT } from './javari-system-prompt';
import { FUNCTION_SCHEMAS, FUNCTION_HANDLERS } from './javari-functions';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export type AIModel = 
  | 'gpt-4-turbo'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229';

export interface ModelConfig {
  id: AIModel;
  name: string;
  provider: 'openai' | 'anthropic';
  contextWindow: number;
  costPer1kTokens: { input: number; output: number };
  features: string[];
  recommended: boolean;
  description: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: any;
}

export interface ChatCompletionOptions {
  model: AIModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  functions?: any[];
  userId?: string;
  sessionId?: string;
}

/**
 * Available AI Models Configuration
 */
export const AVAILABLE_MODELS: Record<AIModel, ModelConfig> = {
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    costPer1kTokens: { input: 0.01, output: 0.03 },
    features: ['function_calling', 'vision', 'json_mode', 'large_context'],
    recommended: false,
    description: 'Most capable OpenAI model with large context window'
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    contextWindow: 8192,
    costPer1kTokens: { input: 0.03, output: 0.06 },
    features: ['function_calling', 'vision'],
    recommended: false,
    description: 'Highly capable for complex reasoning tasks'
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextWindow: 16384,
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
    features: ['function_calling', 'json_mode'],
    recommended: false,
    description: 'Fast and cost-effective for most tasks'
  },
  'claude-3-5-sonnet-latest': {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    features: ['function_calling', 'vision', 'large_context', 'extended_thinking'],
    recommended: true,
    description: 'Recommended: Excellent balance of intelligence, speed, and cost'
  },
  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kTokens: { input: 0.015, output: 0.075 },
    features: ['function_calling', 'vision', 'large_context', 'highest_intelligence'],
    recommended: false,
    description: 'Most powerful Claude model for complex tasks'
  },
  'claude-3-sonnet-20240229': {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    features: ['function_calling', 'vision', 'large_context'],
    recommended: false,
    description: 'Balanced intelligence and speed (previous generation)'
  }
};

/**
 * Multi-Model Chat Handler
 * Routes requests to appropriate AI provider
 */
export class JavariMultiModel {
  private openaiApiKey: string;
  private anthropicApiKey: string;
  private anthropicClient: Anthropic;

  constructor(openaiKey: string, anthropicKey: string) {
    this.openaiApiKey = openaiKey;
    this.anthropicApiKey = anthropicKey;
    this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
  }

  /**
   * Send chat completion request to appropriate provider
   */
  async chat(options: ChatCompletionOptions): Promise<string> {
    const modelConfig = AVAILABLE_MODELS[options.model];
    
    if (modelConfig.provider === 'openai') {
      return this.chatOpenAI(options);
    } else if (modelConfig.provider === 'anthropic') {
      return this.chatAnthropic(options);
    }
    
    throw new Error(`Unsupported provider for model: ${options.model}`);
  }

  /**
   * OpenAI Chat Completion
   */
  private async chatOpenAI(options: ChatCompletionOptions): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: JAVARI_SYSTEM_PROMPT },
          ...options.messages
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        functions: options.functions ?? FUNCTION_SCHEMAS,
        function_call: 'auto'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Handle function calls if present
    if (data.choices[0].message.function_call) {
      const functionName = data.choices[0].message.function_call.name;
      const functionArgs = JSON.parse(data.choices[0].message.function_call.arguments);
      
      // Execute the function
      const handler = FUNCTION_HANDLERS[functionName];
      if (handler) {
        const result = await handler(functionArgs);
        
        // Send result back to model
        return this.chatOpenAI({
          ...options,
          messages: [
            ...options.messages,
            data.choices[0].message,
            {
              role: 'function',
              name: functionName,
              content: JSON.stringify(result)
            }
          ]
        });
      }
    }

    return data.choices[0].message.content;
  }

  /**
   * Anthropic Claude Chat Completion
   */
  private async chatAnthropic(options: ChatCompletionOptions): Promise<string> {
    // Convert messages to Anthropic format
    const anthropicMessages = options.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

    const response = await this.anthropicClient.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      system: JAVARI_SYSTEM_PROMPT,
      messages: anthropicMessages,
      temperature: options.temperature ?? 0.7,
      tools: options.functions?.map(fn => ({
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters
      })) ?? []
    });

    // Handle tool calls if present
    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
      );
      
      if (toolUseBlock) {
        const handler = FUNCTION_HANDLERS[toolUseBlock.name];
        if (handler) {
          const result = await handler(toolUseBlock.input);
          
          // Send result back to model
          return this.chatAnthropic({
            ...options,
            messages: [
              ...options.messages,
              {
                role: 'assistant',
                content: JSON.stringify(response.content)
              },
              {
                role: 'user',
                content: JSON.stringify({
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: JSON.stringify(result)
                })
              }
            ]
          });
        }
      }
    }

    // Extract text response
    const textBlock = response.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );

    return textBlock?.text || 'I apologize, but I encountered an issue generating a response.';
  }

  /**
   * Stream chat completion (for real-time responses)
   */
  async *chatStream(options: ChatCompletionOptions): AsyncGenerator<string> {
    const modelConfig = AVAILABLE_MODELS[options.model];
    
    if (modelConfig.provider === 'anthropic') {
      yield* this.chatStreamAnthropic(options);
    } else {
      yield* this.chatStreamOpenAI(options);
    }
  }

  /**
   * OpenAI Streaming
   */
  private async *chatStreamOpenAI(options: ChatCompletionOptions): AsyncGenerator<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: 'system', content: JAVARI_SYSTEM_PROMPT },
          ...options.messages
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API Error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e: unknown) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Anthropic Streaming
   */
  private async *chatStreamAnthropic(options: ChatCompletionOptions): AsyncGenerator<string> {
    const anthropicMessages = options.messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

    const stream = await this.anthropicClient.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      system: JAVARI_SYSTEM_PROMPT,
      messages: anthropicMessages as any,
      temperature: options.temperature ?? 0.7
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  /**
   * Calculate estimated cost for a chat request
   */
  calculateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
    const config = AVAILABLE_MODELS[model];
    const inputCost = (inputTokens / 1000) * config.costPer1kTokens.input;
    const outputCost = (outputTokens / 1000) * config.costPer1kTokens.output;
    return inputCost + outputCost;
  }

  /**
   * Get recommended model based on use case
   */
  getRecommendedModel(useCase: 'general' | 'complex' | 'fast' | 'cost_effective'): AIModel {
    switch (useCase) {
      case 'complex':
        return 'claude-3-opus-20240229';
      case 'fast':
        return 'gpt-3.5-turbo';
      case 'cost_effective':
        return 'gpt-3.5-turbo';
      case 'general':
      default:
        return 'claude-3-5-sonnet-latest';
    }
  }
}

/**
 * Export helper function to create multi-model instance
 */
export function createJavariMultiModel(openaiKey: string, anthropicKey: string): JavariMultiModel {
  return new JavariMultiModel(openaiKey, anthropicKey);
}

/**
 * Model comparison for user-facing UI
 */
export function compareModels(): Array<ModelConfig & { rank: number }> {
  return Object.values(AVAILABLE_MODELS)
    .map(model => ({
      ...model,
      rank: model.recommended ? 1 : 2
    }))
    .sort((a, b) => a.rank - b.rank);
}
