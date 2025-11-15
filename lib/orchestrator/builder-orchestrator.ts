/**
 * Javari AI Builder Orchestrator
 * Transforms Javari from chat assistant to autonomous builder
 * 
 * @version 1.0.0
 * @created 2025-11-14
 * @author CR AudioViz AI, LLC
 */

import { logError, formatApiError } from "@/lib/utils/error-handler";
import { createClient } from '@/lib/supabase/client';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type TaskType = 
  | 'build_website'
  | 'build_mobile_app'
  | 'build_desktop_app'
  | 'generate_code'
  | 'debug_code'
  | 'create_api'
  | 'design_database'
  | 'write_documentation'
  | 'create_ui_design'
  | 'optimize_performance'
  | 'security_audit'
  | 'deploy_application'
  | 'generate_content'
  | 'analyze_data'
  | 'research_topic'
  | 'legal_analysis'
  | 'financial_analysis'
  | 'real_estate_analysis'
  | 'image_generation'
  | 'voice_generation'
  | 'video_generation'
  | 'avatar_creation'
  | 'photo_manipulation';

export type AIProvider = 'openai' | 'claude' | 'gemini' | 'perplexity';

export interface BuildTask {
  id: string;
  type: TaskType;
  description: string;
  requirements: string[];
  constraints?: {
    budget?: number;
    timeline?: string;
    quality?: 'fast' | 'balanced' | 'premium';
    platform?: string[];
  };
  context?: Record<string, any>;
}

export interface BuildResult {
  success: boolean;
  output: {
    files?: Array<{ path: string; content: string; language: string }>;
    deploymentUrl?: string;
    documentation?: string;
    nextSteps?: string[];
  };
  metadata: {
    aiProvider: AIProvider;
    model: string;
    tokensUsed: number;
    costUSD: number;
    executionTimeMs: number;
    confidence: number;
  };
  errors?: string[];
  warnings?: string[];
}

export interface OrchestratorConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  perplexityApiKey?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  economyMode?: boolean; // Prefer cheaper models when possible
  maxCostPerTask?: number; // Maximum cost in USD
  enableLearning?: boolean; // Learn from every build
}

// ============================================================================
// AI PROVIDER ROUTING LOGIC
// ============================================================================

/**
 * Intelligent routing to best AI provider based on task type
 */
export class AIRouter {
  private static TASK_PREFERENCES: Record<TaskType, { provider: AIProvider; model: string; cost: number }[]> = {
    // Code-heavy tasks: Claude excels
    build_website: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 },
      { provider: 'gemini', model: 'gemini-1.5-pro', cost: 0.01 }
    ],
    build_mobile_app: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    build_desktop_app: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    generate_code: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 },
      { provider: 'gemini', model: 'gemini-1.5-flash', cost: 0.005 }
    ],
    debug_code: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'o1-mini', cost: 0.01 }
    ],
    
    // API/Database tasks: GPT-4 or Claude
    create_api: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    design_database: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    
    // Documentation: Gemini (good quality, cheap)
    write_documentation: [
      { provider: 'gemini', model: 'gemini-1.5-pro', cost: 0.01 },
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 }
    ],
    
    // Design/Creative: Gemini or Claude
    create_ui_design: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'gemini', model: 'gemini-1.5-pro', cost: 0.01 }
    ],
    
    // Analysis tasks: Perplexity for research, Claude for reasoning
    research_topic: [
      { provider: 'perplexity', model: 'sonar-pro', cost: 0.005 },
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 }
    ],
    analyze_data: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    legal_analysis: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'perplexity', model: 'sonar-pro', cost: 0.005 }
    ],
    financial_analysis: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    real_estate_analysis: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'perplexity', model: 'sonar-pro', cost: 0.005 }
    ],
    
    // Performance/Security: Claude or GPT-4
    optimize_performance: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    security_audit: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 },
      { provider: 'openai', model: 'gpt-4-turbo', cost: 0.02 }
    ],
    
    // Deployment: Simple routing
    deploy_application: [
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 }
    ],
    
    // Content generation: Gemini (cheap) or Claude (quality)
    generate_content: [
      { provider: 'gemini', model: 'gemini-1.5-flash', cost: 0.005 },
      { provider: 'claude', model: 'claude-sonnet-4-20250514', cost: 0.015 }
    ],
    
    // Creative AI tasks: Specialized models
    image_generation: [
      { provider: 'openai', model: 'dall-e-3', cost: 0.04 }
    ],
    voice_generation: [
      { provider: 'openai', model: 'tts-1', cost: 0.015 }
    ],
    video_generation: [
      { provider: 'openai', model: 'sora', cost: 0.10 } // Placeholder
    ],
    avatar_creation: [
      { provider: 'openai', model: 'dall-e-3', cost: 0.04 }
    ],
    photo_manipulation: [
      { provider: 'openai', model: 'dall-e-3', cost: 0.04 }
    ]
  };

  /**
   * Select best AI provider for the task
   */
  static selectProvider(
    taskType: TaskType,
    economyMode: boolean = false,
    maxCost?: number
  ): { provider: AIProvider; model: string; estimatedCost: number } {
    const preferences = this.TASK_PREFERENCES[taskType] || this.TASK_PREFERENCES.generate_code;
    
    // Filter by cost if maxCost specified
    let options = preferences;
    if (maxCost) {
      options = preferences.filter(p => p.cost <= maxCost);
    }
    
    // Economy mode: pick cheapest
    if (economyMode) {
      const cheapest = options.reduce((min, curr) => 
        curr.cost < min.cost ? curr : min
      );
      return {
        provider: cheapest.provider,
        model: cheapest.model,
        estimatedCost: cheapest.cost
      };
    }
    
    // Quality mode: pick first (best quality)
    const best = options[0];
    return {
      provider: best.provider,
      model: best.model,
      estimatedCost: best.cost
    };
  }
}

// ============================================================================
// BUILDER ORCHESTRATOR
// ============================================================================

export class BuilderOrchestrator {
  private config: OrchestratorConfig;
  private openai?: OpenAI;
  private claude?: Anthropic;
  private gemini?: GoogleGenerativeAI;
  private supabase?: ReturnType<typeof createClient>;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    
    // Initialize AI clients
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
    if (config.anthropicApiKey) {
      this.claude = new Anthropic({ apiKey: config.anthropicApiKey });
    }
    if (config.geminiApiKey) {
      this.gemini = new GoogleGenerativeAI(config.geminiApiKey);
    }
    if (config.supabaseUrl && config.supabaseKey) {
      // Supabase client would be initialized here
    }
  }

  /**
   * Main execution method - orchestrates the entire build process
   */
  async executeBuild(task: BuildTask, userId?: string): Promise<BuildResult> {
    const startTime = Date.now();
    
    try {
      // 1. Analyze task and select best AI
      const { provider, model, estimatedCost } = AIRouter.selectProvider(
        task.type,
        this.config.economyMode,
        this.config.maxCostPerTask
      );
      
      // 2. Prepare prompt based on task type
      const prompt = this.buildPrompt(task);
      
      // 3. Execute with selected AI
      const aiResponse = await this.executeWithAI(provider, model, prompt, task);
      
      // 4. Parse and structure response
      const result = await this.parseAIResponse(aiResponse, task);
      
      // 5. Validate output
      const validation = await this.validateOutput(result);
      
      // 6. Learn from this execution (if enabled)
      if (this.config.enableLearning && userId) {
        await this.learnFromExecution(task, result, userId);
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: validation.isValid,
        output: result.output,
        metadata: {
          aiProvider: provider,
          model,
          tokensUsed: aiResponse.tokensUsed || 0,
          costUSD: aiResponse.cost || estimatedCost,
          executionTimeMs: executionTime,
          confidence: result.confidence || 0.8
        },
        errors: validation.errors,
        warnings: validation.warnings
      };
      
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        output: {},
        metadata: {
          aiProvider: 'openai', // Default
          model: 'unknown',
          tokensUsed: 0,
          costUSD: 0,
          executionTimeMs: executionTime,
          confidence: 0
        },
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  /**
   * Build specialized prompt based on task type
   */
  private buildPrompt(task: BuildTask): string {
    const basePrompt = `You are Javari AI, an expert autonomous builder created by CR AudioViz AI.

TASK: ${task.type}
DESCRIPTION: ${task.description}

REQUIREMENTS:
${task.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

${task.constraints ? `
CONSTRAINTS:
- Quality Level: ${task.constraints.quality || 'balanced'}
- Timeline: ${task.constraints.timeline || 'standard'}
${task.constraints.platform ? `- Platforms: ${task.constraints.platform.join(', ')}` : ''}
${task.constraints.budget ? `- Budget: $${task.constraints.budget}` : ''}
` : ''}

INSTRUCTIONS:
1. Analyze the requirements carefully
2. Create a complete, production-ready solution
3. Include all necessary files with full code (no placeholders)
4. Provide clear documentation
5. Suggest next steps for deployment/testing

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "files": [
    {
      "path": "path/to/file.ext",
      "content": "complete file content",
      "language": "typescript|python|html|etc"
    }
  ],
  "documentation": "markdown formatted docs",
  "deploymentInstructions": "step-by-step deployment guide",
  "nextSteps": ["actionable next steps"],
  "confidence": 0.95
}`;

    return basePrompt;
  }

  /**
   * Execute task with selected AI provider
   */
  private async executeWithAI(
    provider: AIProvider,
    model: string,
    prompt: string,
    task: BuildTask
  ): Promise<{ response: string; tokensUsed?: number; cost?: number }> {
    
    switch (provider) {
      case 'openai':
        return await this.executeWithOpenAI(model, prompt);
      
      case 'claude':
        return await this.executeWithClaude(model, prompt);
      
      case 'gemini':
        return await this.executeWithGemini(model, prompt);
      
      case 'perplexity':
        return await this.executeWithPerplexity(model, prompt);
      
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private async executeWithOpenAI(model: string, prompt: string) {
    if (!this.openai) throw new Error('OpenAI not initialized');
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });
    
    return {
      response: response.choices[0]?.message?.content || '{}',
      tokensUsed: response.usage?.total_tokens,
      cost: this.calculateOpenAICost(model, response.usage)
    };
  }

  private async executeWithClaude(model: string, prompt: string) {
    if (!this.claude) throw new Error('Claude not initialized');
    
    const response = await this.claude.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '{}';
    
    return {
      response: text,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      cost: this.calculateClaudeCost(model, response.usage)
    };
  }

  private async executeWithGemini(model: string, prompt: string) {
    if (!this.gemini) throw new Error('Gemini not initialized');
    
    const genModel = this.gemini.getGenerativeModel({ model });
    const result = await genModel.generateContent(prompt);
    const response = result.response.text();
    
    return {
      response,
      tokensUsed: 0, // Gemini doesn't provide token count easily
      cost: 0.01 // Estimate
    };
  }

  private async executeWithPerplexity(model: string, prompt: string) {
    // Perplexity API implementation
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.perplexityApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    const data = await response.json();
    return {
      response: data.choices[0]?.message?.content || '{}',
      tokensUsed: data.usage?.total_tokens,
      cost: 0.005
    };
  }

  private calculateOpenAICost(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number }) {
    if (!usage) return 0;
    // Simplified cost calculation
    const inputCost = (usage.prompt_tokens || 0) / 1000 * 0.01;
    const outputCost = (usage.completion_tokens || 0) / 1000 * 0.03;
    return inputCost + outputCost;
  }

  private calculateClaudeCost(model: string, usage: { input_tokens: number; output_tokens: number }) {
    const inputCost = usage.input_tokens / 1000 * 0.003;
    const outputCost = usage.output_tokens / 1000 * 0.015;
    return inputCost + outputCost;
  }

  /**
   * Parse AI response into structured BuildResult
   */
  private async parseAIResponse(
    aiResponse: { response: string },
    task: BuildTask
  ): Promise<{ output: BuildResult['output']; confidence: number }> {
    try {
      const parsed = JSON.parse(aiResponse.response);
      return {
        output: {
          files: parsed.files || [],
          documentation: parsed.documentation,
          nextSteps: parsed.nextSteps || []
        },
        confidence: parsed.confidence || 0.8
      };
    } catch {
      // Fallback if not JSON
      return {
        output: {
          documentation: aiResponse.response,
          nextSteps: ['Review output and refine as needed']
        },
        confidence: 0.5
      };
    }
  }

  /**
   * Validate the build output
   */
  private async validateOutput(result: { output: BuildResult['output'] }): Promise<{
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if files were generated
    if (!result.output.files || result.output.files.length === 0) {
      warnings.push('No files generated');
    }
    
    // Check if documentation exists
    if (!result.output.documentation) {
      warnings.push('No documentation provided');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Learn from execution (store for future improvement)
   */
  private async learnFromExecution(
    task: BuildTask,
    result: { output: BuildResult['output']; confidence: number },
    userId: string
  ): Promise<void> {
    // Store execution data in Supabase for learning
    // This will be used to improve future task routing and execution
    try {
      if (this.supabase) {
        // await this.supabase.from('javari_learning_data').insert({
        //   user_id: userId,
        //   task_type: task.type,
        //   confidence: result.confidence,
        //   success: true,
        //   created_at: new Date().toISOString()
        // });
      }
    } catch (error: unknown) {
      console.error('Failed to log learning data:', error);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

