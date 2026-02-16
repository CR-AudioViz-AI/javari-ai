// lib/javari/providers/OpenRouterProvider.ts
/**
 * OpenRouter Provider - Access to 200+ AI Models
 * 
 * JAAE Full Activation - Universal AI Router
 * Tier: CORE+ (Meta-provider with dynamic routing)
 * 
 * Features:
 * - 200+ models from multiple providers
 * - Unified REST endpoint
 * - Dynamic model selection
 * - Cost optimization
 * - Speed routing
 * - Streaming support
 */

import { BaseProvider, ExtendedRouterOptions } from './BaseProvider';
import { AIProvider } from '../router/types';

// OpenRouter Model Metadata
export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider: {
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
}

// Popular models curated for different use cases
const OPENROUTER_FEATURED_MODELS = {
  // FREE models
  free: {
    chat: 'deepseek/deepseek-chat',
    reasoning: 'deepseek/deepseek-r1:free',
    fast: 'meta-llama/llama-3.1-8b-instruct:free',
    efficient: 'mistralai/mistral-7b-instruct:free',
  },
  // Premium models
  premium: {
    claude: 'anthropic/claude-3.5-sonnet',
    gpt4: 'openai/gpt-4-turbo',
    reasoning: 'openai/o1-preview',
  },
  // Specialized
  specialized: {
    code: 'deepseek/deepseek-coder',
    vision: 'openai/gpt-4-vision-preview',
    long: 'anthropic/claude-3-opus',
  },
};

export class OpenRouterProvider extends BaseProvider {
  private model: string = OPENROUTER_FEATURED_MODELS.free.chat; // Default to free model
  protected timeout: number = 20000; // 20s provider timeout
  private baseURL: string = 'https://openrouter.ai/api/v1';
  private modelCache: OpenRouterModel[] = [];
  private lastCacheUpdate: number = 0;
  private cacheTTL: number = 3600000; // 1 hour

  getName(): AIProvider {
    return 'openrouter' as AIProvider;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Set specific model
   */
  setModel(modelId: string): void {
    this.model = modelId;
  }

  /**
   * Fetch all available models from OpenRouter
   */
  async fetchModels(): Promise<OpenRouterModel[]> {
    // Return cached if still valid
    if (this.modelCache.length > 0 && Date.now() - this.lastCacheUpdate < this.cacheTTL) {
      return this.modelCache;
    }

    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        console.error('[OpenRouter] Failed to fetch models:', response.status);
        return [];
      }

      const data = await response.json();
      this.modelCache = data.data || [];
      this.lastCacheUpdate = Date.now();
      
      return this.modelCache;
    } catch (error) {
      console.error('[OpenRouter] Error fetching models:', error);
      return [];
    }
  }

  /**
   * Find cheapest model for a task
   */
  async getCheapestModel(): Promise<string> {
    const models = await this.fetchModels();
    if (models.length === 0) return OPENROUTER_FEATURED_MODELS.free.chat;

    const sorted = models
      .filter(m => m.pricing && parseFloat(m.pricing.prompt) > 0)
      .sort((a, b) => {
        const costA = parseFloat(a.pricing.prompt) + parseFloat(a.pricing.completion);
        const costB = parseFloat(b.pricing.prompt) + parseFloat(b.pricing.completion);
        return costA - costB;
      });

    return sorted[0]?.id || OPENROUTER_FEATURED_MODELS.free.chat;
  }

  /**
   * Get free models
   */
  getFreeModels(): string[] {
    return Object.values(OPENROUTER_FEATURED_MODELS.free);
  }

  async *generateStream(
    message: string,
    options?: ExtendedRouterOptions
  ): AsyncIterator<string> {
    const timeoutMs = options?.timeout || this.timeout;
    
    // Use preferredModel if provided, otherwise use default
    const modelToUse = options?.preferredModel || this.model;

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [];
    
    if (options?.rolePrompt) {
      messages.push({ role: 'system', content: options.rolePrompt });
    }
    
    messages.push({ role: 'user', content: message });

    try {
      const response = await this.withTimeout(
        fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://javariai.com',
            'X-Title': 'Javari AI',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages,
            max_tokens: options?.maxTokens || 2000,
            temperature: options?.temperature || 0.7,
            stream: true,
          }),
        }),
        timeoutMs
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenRouter API error: HTTP ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = `OpenRouter: ${errorJson.error?.message || errorText}`;
        } catch {
          errorMessage = `OpenRouter: ${errorText.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body from OpenRouter API');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  yield content;
                }
              } catch (parseError) {
                console.error('[OpenRouter] Failed to parse chunk:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Provider timeout') {
          throw new Error(`OpenRouter provider timeout after ${timeoutMs}ms`);
        }
        throw error;
      }
      throw new Error(`OpenRouter provider error: ${String(error)}`);
    }
  }

  /**
   * Estimate cost using OpenRouter's model pricing
   */
  async estimateCost(inputTokens: number, outputTokens: number): Promise<number> {
    const models = await this.fetchModels();
    const currentModel = models.find(m => m.id === this.model);

    if (!currentModel || !currentModel.pricing) {
      // Default fallback pricing (DeepSeek free model)
      return 0;
    }

    const inputCost = (inputTokens / 1_000_000) * parseFloat(currentModel.pricing.prompt);
    const outputCost = (outputTokens / 1_000_000) * parseFloat(currentModel.pricing.completion);
    
    return inputCost + outputCost;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): string[] {
    return [
      'chat',
      'streaming',
      'multi-model',
      'cost-optimization',
      'dynamic-routing',
      'free-tier',
      '200+-models',
    ];
  }

  /**
   * Get all available models
   */
  async getAvailableModels(): Promise<string[]> {
    const models = await this.fetchModels();
    return models.map(m => m.id);
  }

  /**
   * Get model by capability
   */
  async getModelByCapability(capability: 'fastest' | 'cheapest' | 'best' | 'code' | 'vision'): Promise<string> {
    switch (capability) {
      case 'fastest':
        return OPENROUTER_FEATURED_MODELS.free.fast;
      case 'cheapest':
        return await this.getCheapestModel();
      case 'best':
        return OPENROUTER_FEATURED_MODELS.premium.claude;
      case 'code':
        return OPENROUTER_FEATURED_MODELS.specialized.code;
      case 'vision':
        return OPENROUTER_FEATURED_MODELS.specialized.vision;
      default:
        return this.model;
    }
  }
}
