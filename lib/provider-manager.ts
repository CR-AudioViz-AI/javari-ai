/**
 * JAVARI AI - MULTI-PROVIDER MANAGER WITH STREAMING
 * Enhanced with streaming support for all providers
 * Updated: November 24, 2025 - 4:40 AM EST - Added getProviderManager singleton
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mistral } from '@mistralai/mistralai';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage, logError } from '@/lib/utils/error-utils';

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

export interface StreamChunk {
  text: string;
  done: boolean;
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

    // Gemini (Google) - check both env var names
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }

    // Mistral
    if (process.env.MISTRAL_API_KEY) {
      this.mistral = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY,
      });
    }
  }

  // ================================================================
  // MAIN CHAT FUNCTION WITH STREAMING
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
    } catch (error: unknown) {
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
        
        const fallbackRequest = { ...request, provider: fallbackProvider };
        const response = await this.chatWithProvider(fallbackRequest);
        response.wasFailover = true;
        
        return response;
      }

      throw error;
    }
  }

  /**
   * Stream chat responses (returns async generator)
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const startTime = Date.now();
    let totalTokens = 0;
    let outputText = '';

    try {
      // Route to appropriate streaming function
      const stream = this.getStreamForProvider(request);

      for await (const chunk of stream) {
        outputText += chunk.text;
        totalTokens++;
        yield chunk;
      }

      // Log success after stream completes
      const latency = Date.now() - startTime;
      await this.logPerformance({
        provider: request.provider,
        model: request.model,
        success: true,
        tokens: totalTokens,
        cost: this.estimateCost(request.provider, request.model, totalTokens),
        latency,
      });

    } catch (error: unknown) {
      console.error(`Streaming failed for ${request.provider}:`, error);
      
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

      throw error;
    }
  }

  // ================================================================
  // PROVIDER-SPECIFIC STREAMING
  // ================================================================

  private async *getStreamForProvider(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    switch (request.provider) {
      case 'openai':
        yield* this.streamOpenAI(request);
        break;
      case 'claude':
        yield* this.streamClaude(request);
        break;
      case 'gemini':
        yield* this.streamGemini(request);
        break;
      case 'mistral':
        yield* this.streamMistral(request);
        break;
      default:
        throw new Error(`Unknown provider: ${request.provider}`);
    }
  }

  private async *streamOpenAI(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const stream = await this.openai.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4000,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        yield { text, done: false };
      }
    }
    
    yield { text: '', done: true };
  }

  private async *streamClaude(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.claude) throw new Error('Claude not initialized');

    // Convert messages to Claude format
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const stream = await this.claude.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 4000,
      temperature: request.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield { text: chunk.delta.text, done: false };
      }
    }
    
    yield { text: '', done: true };
  }

  private async *streamGemini(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.gemini) throw new Error('Gemini not initialized');

    const model = this.gemini.getGenerativeModel({ model: request.model });

    // Convert messages to Gemini format
    const history = request.messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = request.messages[request.messages.length - 1];
    
    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield { text, done: false };
      }
    }
    
    yield { text: '', done: true };
  }

  private async *streamMistral(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.mistral) throw new Error('Mistral not initialized');

    const stream = await this.mistral.chat.stream({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      maxTokens: request.maxTokens ?? 4000,
    });

    for await (const chunk of stream) {
      const text = chunk.data?.choices?.[0]?.delta?.content || '';
      if (text) {
        yield { text, done: false };
      }
    }
    
    yield { text: '', done: true };
  }

  // ================================================================
  // NON-STREAMING PROVIDER IMPLEMENTATIONS
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

    const history = request.messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history });
    const lastMessage = request.messages[request.messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;

    const latency = Date.now() - startTime;
    
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
    const pricing: Record<ProviderName, { input: number; output: number }> = {
      openai: { input: 0.03 / 1000, output: 0.06 / 1000 },
      claude: { input: 0.003 / 1000, output: 0.015 / 1000 },
      gemini: { input: 0.00035 / 1000, output: 0.00105 / 1000 },
      mistral: { input: 0.001 / 1000, output: 0.003 / 1000 },
    };

    const rates = pricing[provider];
    return (inputTokens * rates.input) + (outputTokens * rates.output);
  }

  private estimateCost(provider: ProviderName, model: string, totalTokens: number): number {
    return this.calculateCost(provider, model, totalTokens / 2, totalTokens / 2);
  }

  // ================================================================
  // FALLBACK PROVIDER
  // ================================================================

  private async getFallbackProvider(failedProvider: ProviderName): Promise<ProviderName | null> {
    const fallbacks: Record<ProviderName, ProviderName> = {
      openai: 'claude',
      claude: 'gemini',
      gemini: 'mistral',
      mistral: 'openai',
    };

    return fallbacks[failedProvider] || null;
  }

  // ================================================================
  // PERFORMANCE LOGGING
  // ================================================================

  private async logPerformance(log: {
    provider: ProviderName;
    model: string;
    success: boolean;
    tokens: number;
    cost: number;
    latency: number;
    error?: string;
  }) {
    try {
      await this.supabase.from('ai_performance').insert({
        provider: log.provider,
        model: log.model,
        success: log.success,
        tokens: log.tokens,
        cost: log.cost,
        latency: log.latency,
        error: log.error,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log performance:', error);
    }
  }

  // [FEATURE_FAST_STUBS] Auto-generated stub to unblock build
  // Replace with real implementation
  async getAllProviderStatus(): Promise<Record<string, any>> {
    const enabled = (process.env.FEATURE_FAST_STUBS ?? "1") !== "0";
    if (!enabled) {
      throw new Error("ProviderManager.getAllProviderStatus stub disabled via FEATURE_FAST_STUBS=0");
    }
    
    // Return empty provider status map as safe default
    return {};
  }

}

// ================================================================
// SINGLETON INSTANCE GETTER
// ================================================================

let providerManagerInstance: ProviderManager | null = null;

/**
 * Get singleton instance of ProviderManager
 * This ensures we only initialize providers once
 */
export function getProviderManager(): ProviderManager {
  if (!providerManagerInstance) {
    providerManagerInstance = new ProviderManager();
  }
  return providerManagerInstance;
}
