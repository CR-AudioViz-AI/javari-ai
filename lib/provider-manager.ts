/**
 * JAVARI AI - MULTI-PROVIDER MANAGER
 * Handles OpenAI, Claude, Gemini, and Mistral with automatic fallback
 * Created: Tuesday, October 28, 2025 - 1:25 PM EST
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mistral } from '@mistralai/mistralai';
import { createClient } from '@supabase/supabase-js';

// ================================================================
// TYPES
// ================================================================

export type ProviderName = 'openai' | 'claude' | 'gemini' | 'mistral';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  provider: ProviderName;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  provider: ProviderName;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latency: number;
  wasFailover?: boolean;
}

export interface ProviderConfig {
  name: ProviderName;
  displayName: string;
  isEnabled: boolean;
  priority: number;
  fallbackProvider?: ProviderName;
}

// ================================================================
// PROVIDER MANAGER CLASS
// ================================================================

export class ProviderManager {
  private openai: OpenAI | null = null;
  private claude: Anthropic | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private mistral: Mistral | null = null;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    // Initialize Supabase
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize providers
    this.initializeProviders();
  }

  // ================================================================
  // INITIALIZATION
  // ================================================================

  private initializeProviders() {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Claude (Anthropic)
    if (process.env.ANTHROPIC_API_KEY) {
      this.claude = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    // Gemini (Google)
    if (process.env.GOOGLE_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }

    // Mistral
    if (process.env.MISTRAL_API_KEY) {
      this.mistral = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY,
      });
    }
  }

  // ================================================================
  // MAIN CHAT FUNCTION
  // ================================================================

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      // Try primary provider
      const response = await this.chatWithProvider(request);
      
      // Log success
      await this.logPerformance({
        provider: request.provider,
        model: request.model,
        success: true,
        tokens: response.tokens.total,
        cost: response.cost,
        latency: response.latency,
      });

      return response;
    } catch (error) {
      console.error(`Primary provider ${request.provider} failed:`, error);

      // Log failure
      await this.logPerformance({
        provider: request.provider,
        model: request.model,
        success: false,
        tokens: 0,
        cost: 0,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Try fallback
      const fallbackProvider = await this.getFallbackProvider(request.provider);
      if (fallbackProvider) {
        console.log(`Falling back to ${fallbackProvider}`);
        
        const fallbackRequest = {
          ...request,
          provider: fallbackProvider,
          model: await this.getDefaultModel(fallbackProvider),
        };

        try {
          const response = await this.chatWithProvider(fallbackRequest);
          
          // Log success with failover flag
          await this.logPerformance({
            provider: fallbackProvider,
            model: fallbackRequest.model,
            success: true,
            tokens: response.tokens.total,
            cost: response.cost,
            latency: response.latency,
          });

          // Log auto-heal action
          await this.logAutoHeal({
            triggerType: 'provider_failure',
            triggerReason: `${request.provider} failed, auto-switched to ${fallbackProvider}`,
            actionTaken: `Fallback to ${fallbackProvider} successful`,
            wasSuccessful: true,
          });

          return { ...response, wasFailover: true };
        } catch (fallbackError) {
          console.error(`Fallback to ${fallbackProvider} also failed:`, fallbackError);
          
          // Log auto-heal failure
          await this.logAutoHeal({
            triggerType: 'provider_failure',
            triggerReason: `Both ${request.provider} and ${fallbackProvider} failed`,
            actionTaken: `Attempted fallback to ${fallbackProvider}`,
            wasSuccessful: false,
            errorMessage: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          });

          throw new Error(`All providers failed. Last error: ${fallbackError}`);
        }
      }

      throw error;
    }
  }

  // ================================================================
  // PROVIDER-SPECIFIC CHAT IMPLEMENTATIONS
  // ================================================================

  private async chatWithProvider(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    switch (request.provider) {
      case 'openai':
        return await this.chatWithOpenAI(request, startTime);
      case 'claude':
        return await this.chatWithClaude(request, startTime);
      case 'gemini':
        return await this.chatWithGemini(request, startTime);
      case 'mistral':
        return await this.chatWithMistral(request, startTime);
      default:
        throw new Error(`Unknown provider: ${request.provider}`);
    }
  }

  private async chatWithOpenAI(request: ChatRequest, startTime: number): Promise<ChatResponse> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const completion = await this.openai.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4000,
    });

    const latency = Date.now() - startTime;
    const tokens = {
      input: completion.usage?.prompt_tokens ?? 0,
      output: completion.usage?.completion_tokens ?? 0,
      total: completion.usage?.total_tokens ?? 0,
    };

    return {
      content: completion.choices[0].message.content ?? '',
      provider: 'openai',
      model: request.model,
      tokens,
      cost: this.calculateCost('openai', request.model, tokens.input, tokens.output),
      latency,
    };
  }

  private async chatWithClaude(request: ChatRequest, startTime: number): Promise<ChatResponse> {
    if (!this.claude) throw new Error('Claude not initialized');

    // Convert messages to Claude format (no system role in messages)
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const completion = await this.claude.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 4000,
      temperature: request.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const latency = Date.now() - startTime;
    const tokens = {
      input: completion.usage.input_tokens,
      output: completion.usage.output_tokens,
      total: completion.usage.input_tokens + completion.usage.output_tokens,
    };

    return {
      content: completion.content[0].type === 'text' ? completion.content[0].text : '',
      provider: 'claude',
      model: request.model,
      tokens,
      cost: this.calculateCost('claude', request.model, tokens.input, tokens.output),
      latency,
    };
  }

  private async chatWithGemini(request: ChatRequest, startTime: number): Promise<ChatResponse> {
    if (!this.gemini) throw new Error('Gemini not initialized');

    const model = this.gemini.getGenerativeModel({ model: request.model });

    // Convert messages to Gemini format
    const history = request.messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = request.messages[request.messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;

    const latency = Date.now() - startTime;
    
    // Estimate tokens (Gemini doesn't provide exact counts)
    const inputTokens = Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
    const outputTokens = Math.ceil(response.text().length / 4);

    const tokens = {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    };

    return {
      content: response.text(),
      provider: 'gemini',
      model: request.model,
      tokens,
      cost: this.calculateCost('gemini', request.model, tokens.input, tokens.output),
      latency,
    };
  }

  private async chatWithMistral(request: ChatRequest, startTime: number): Promise<ChatResponse> {
    if (!this.mistral) throw new Error('Mistral not initialized');

    const completion = await this.mistral.chat.complete({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4000,
    });

    const latency = Date.now() - startTime;
    const tokens = {
      input: completion.usage?.promptTokens ?? 0,
      output: completion.usage?.completionTokens ?? 0,
      total: completion.usage?.totalTokens ?? 0,
    };

    return {
      content: completion.choices?.[0]?.message?.content ?? '',
      provider: 'mistral',
      model: request.model,
      tokens,
      cost: this.calculateCost('mistral', request.model, tokens.input, tokens.output),
      latency,
    };
  }

  // ================================================================
  // COST CALCULATION
  // ================================================================

  private calculateCost(provider: ProviderName, model: string, inputTokens: number, outputTokens: number): number {
    // Cost per 1K tokens
    const pricing: Record<string, { input: number; output: number }> = {
      // OpenAI
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      
      // Claude
      'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      
      // Gemini
      'gemini-pro': { input: 0.0005, output: 0.0015 },
      'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
      
      // Mistral
      'mistral-large-latest': { input: 0.004, output: 0.012 },
      'mistral-medium-latest': { input: 0.0027, output: 0.0081 },
      'mistral-small-latest': { input: 0.0002, output: 0.0006 },
    };

    const modelPricing = pricing[model] || { input: 0.001, output: 0.002 };
    return (inputTokens / 1000) * modelPricing.input + (outputTokens / 1000) * modelPricing.output;
  }

  // ================================================================
  // HELPER FUNCTIONS
  // ================================================================

  private async getFallbackProvider(failedProvider: ProviderName): Promise<ProviderName | null> {
    const { data } = await this.supabase
      .from('javari_providers')
      .select('name, priority, is_enabled')
      .eq('is_enabled', true)
      .neq('name', failedProvider)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    return data?.name as ProviderName || null;
  }

  private async getDefaultModel(provider: ProviderName): Promise<string> {
    const { data } = await this.supabase
      .from('javari_provider_models')
      .select('model_name')
      .eq('provider', provider)
      .eq('is_enabled', true)
      .order('context_window', { ascending: false })
      .limit(1)
      .single();

    return data?.model_name || this.getHardcodedDefaultModel(provider);
  }

  private getHardcodedDefaultModel(provider: ProviderName): string {
    const defaults: Record<ProviderName, string> = {
      openai: 'gpt-4-turbo-preview',
      claude: 'claude-3-5-sonnet-20241022',
      gemini: 'gemini-pro',
      mistral: 'mistral-large-latest',
    };
    return defaults[provider];
  }

  // ================================================================
  // LOGGING
  // ================================================================

  private async logPerformance(data: {
    provider: string;
    model: string;
    success: boolean;
    tokens: number;
    cost: number;
    latency: number;
    error?: string;
  }) {
    try {
      // Update provider performance stats
      const { error } = await this.supabase.rpc('update_provider_performance', {
        p_provider: data.provider,
        p_model: data.model,
        p_success: data.success,
        p_tokens: data.tokens,
        p_cost: data.cost,
        p_latency_ms: data.latency,
      });

      if (error) console.error('Error logging performance:', error);

      // If failure, log to provider health
      if (!data.success) {
        await this.supabase.from('javari_provider_health').insert({
          provider: data.provider,
          status: 'down',
          error_message: data.error,
          checked_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error in logPerformance:', error);
    }
  }

  private async logAutoHeal(data: {
    triggerType: string;
    triggerReason: string;
    actionTaken: string;
    wasSuccessful: boolean;
    errorMessage?: string;
  }) {
    try {
      await this.supabase.from('javari_auto_heal_actions').insert({
        trigger_type: data.triggerType,
        trigger_reason: data.triggerReason,
        action_taken: data.actionTaken,
        was_successful: data.wasSuccessful,
        error_message: data.errorMessage,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error in logAutoHeal:', error);
    }
  }

  // ================================================================
  // PROVIDER STATUS
  // ================================================================

  async checkProviderHealth(provider: ProviderName): Promise<boolean> {
    try {
      const testRequest: ChatRequest = {
        provider,
        model: await this.getDefaultModel(provider),
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 10,
      };

      await this.chatWithProvider(testRequest);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getAllProviderStatus(): Promise<Record<ProviderName, boolean>> {
    const providers: ProviderName[] = ['openai', 'claude', 'gemini', 'mistral'];
    const statuses: Record<ProviderName, boolean> = {} as any;

    for (const provider of providers) {
      statuses[provider] = await this.checkProviderHealth(provider);
    }

    return statuses;
  }
}

// ================================================================
// SINGLETON EXPORT
// ================================================================

let providerManagerInstance: ProviderManager | null = null;

export function getProviderManager(): ProviderManager {
  if (!providerManagerInstance) {
    providerManagerInstance = new ProviderManager();
  }
  return providerManagerInstance;
}
