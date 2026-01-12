// lib/javari-core.ts
// JAVARI CORE BOUNDARY - Single entry point for all requests
// v12.0 - Full autonomous system

import { javariLearning } from './javari-learning-system';
import { javariOrchestrator } from './javari-multi-model-orchestrator';
import { javariRoadmap } from './javari-roadmap-system';
import { getGuardrails, isActionAllowed } from './javari-guardrails';

// Core request/response types
export interface JavariRequest {
  messages: Array<{ role: string; content: string }>;
  sessionId?: string;
  userId?: string;
  context?: Record<string, any>;
}

export interface JavariResponse {
  message: string;
  mode: JavariMode;
  cost: number;
  model: string;
  actions?: string[];
  reasoning?: string;
  nextSteps?: string[];
}

export type JavariMode = 'BUILD' | 'ANALYZE' | 'EXECUTE' | 'RECOVER';

// Mode selection engine
class ModeEngine {
  selectMode(userMessage: string, context: any): JavariMode {
    const lower = userMessage.toLowerCase();
    
    // Error/failure context → RECOVER
    if (context?.previousFailed || context?.error) {
      return 'RECOVER';
    }
    
    // Build keywords → BUILD
    if (lower.match(/build|create|make|code|implement|develop/)) {
      return 'BUILD';
    }
    
    // Analysis keywords → ANALYZE
    if (lower.match(/analyze|review|compare|evaluate|assess/)) {
      return 'ANALYZE';
    }
    
    // Action keywords → EXECUTE
    if (lower.match(/deploy|run|execute|start|launch|fix/)) {
      return 'EXECUTE';
    }
    
    // Default to BUILD (Javari's primary mode)
    return 'BUILD';
  }
}

// Memory-first retrieval
async function checkMemory(query: string): Promise<string | null> {
  // Check if this exact query has been answered before
  // For now, stub - will integrate with actual memory store
  return null;
}

// Cost-aware model routing
interface ModelChoice {
  model: string;
  cost: number;
  rationale: string;
  fallbacks: string[];
}

function selectCheapestCapable(
  mode: JavariMode,
  complexity: 'low' | 'medium' | 'high'
): ModelChoice {
  // Cost table (per 1M tokens)
  const costs = {
    'gpt-3.5-turbo': 0.5,
    'gpt-4': 30,
    'claude-3-haiku': 0.25,
    'claude-3.5-sonnet': 3,
    'claude-3-opus': 15,
  };
  
  // Route based on mode + complexity
  if (mode === 'BUILD') {
    if (complexity === 'low') {
      return {
        model: 'claude-3-haiku',
        cost: costs['claude-3-haiku'],
        rationale: 'Simple build task - haiku sufficient',
        fallbacks: ['gpt-3.5-turbo', 'claude-3.5-sonnet'],
      };
    } else if (complexity === 'medium') {
      return {
        model: 'claude-3.5-sonnet',
        cost: costs['claude-3.5-sonnet'],
        rationale: 'Medium build - sonnet for quality',
        fallbacks: ['gpt-4', 'claude-3-opus'],
      };
    } else {
      return {
        model: 'claude-3.5-sonnet',
        cost: costs['claude-3.5-sonnet'],
        rationale: 'Complex build - sonnet optimal',
        fallbacks: ['claude-3-opus', 'gpt-4'],
      };
    }
  }
  
  if (mode === 'ANALYZE') {
    return {
      model: 'claude-3.5-sonnet',
      cost: costs['claude-3.5-sonnet'],
      rationale: 'Analysis requires structured thinking',
      fallbacks: ['gpt-4', 'claude-3-opus'],
    };
  }
  
  // Default: gpt-4 for general tasks
  return {
    model: 'gpt-4',
    cost: costs['gpt-4'],
    rationale: 'General purpose reasoning',
    fallbacks: ['claude-3.5-sonnet', 'gpt-3.5-turbo'],
  };
}

// Self-healing retry logic
async function executeWithHealing<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  fallbackFn?: () => Promise<T>
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      // On final retry, try fallback if available
      if (attempt === maxRetries && fallbackFn) {
        try {
          return await fallbackFn();
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }
    }
  }
  
  throw lastError || new Error('All attempts failed');
}

// JAVARI CORE
export class JavariCore {
  private modeEngine = new ModeEngine();
  
  async invoke(request: JavariRequest): Promise<JavariResponse> {
    const startTime = Date.now();
    const userMessage = request.messages[request.messages.length - 1].content;
    
    try {
      // 1. Check memory first
      const memoryResult = await checkMemory(userMessage);
      if (memoryResult) {
        javariLearning.trackAction('memory_hit', 'success');
        return {
          message: memoryResult,
          mode: 'BUILD',
          cost: 0,
          model: 'memory',
          reasoning: 'Retrieved from memory',
        };
      }
      
      // 2. Select mode
      const mode = this.modeEngine.selectMode(userMessage, request.context);
      
      // 3. Determine complexity
      const complexity = this.estimateComplexity(userMessage);
      
      // 4. Select cheapest capable model
      const modelChoice = selectCheapestCapable(mode, complexity);
      
      // 5. Execute with self-healing
      const result = await executeWithHealing(
        async () => {
          // Primary execution
          return await this.executeWithModel(request, mode, modelChoice.model);
        },
        2,
        async () => {
          // Fallback to next model
          const fallbackModel = modelChoice.fallbacks[0];
          console.log(`Falling back to ${fallbackModel}`);
          return await this.executeWithModel(request, mode, fallbackModel);
        }
      );
      
      // 6. Track learning
      javariLearning.trackAction(`${mode.toLowerCase()}_request`, 'success', {
        model: modelChoice.model,
      });
      
      const processingTime = Date.now() - startTime;
      
      return {
        message: result,
        mode,
        cost: modelChoice.cost,
        model: modelChoice.model,
        reasoning: modelChoice.rationale,
      };
      
    } catch (error: any) {
      // RECOVER mode
      javariLearning.trackAction('request', 'failure', {
        error: error.message,
      });
      
      return {
        message: `I encountered an issue but I'm still operational. Let me try a different approach. ${this.getRecoveryMessage(userMessage)}`,
        mode: 'RECOVER',
        cost: 0,
        model: 'recovery',
        reasoning: 'Graceful degradation after failure',
      };
    }
  }
  
  private estimateComplexity(message: string): 'low' | 'medium' | 'high' {
    const wordCount = message.split(/\s+/).length;
    
    if (wordCount < 20) return 'low';
    if (wordCount < 100) return 'medium';
    return 'high';
  }
  
  private async executeWithModel(
    request: JavariRequest,
    mode: JavariMode,
    model: string
  ): Promise<string> {
    // Stub - will connect to actual model providers
    return `[Mode: ${mode}] [Model: ${model}] Processing request...`;
  }
  
  private getRecoveryMessage(originalRequest: string): string {
    const roadmapItem = javariRoadmap.getNextRecommendedAction();
    
    if (roadmapItem) {
      return `Meanwhile, we have ${roadmapItem.title} on the roadmap. Should we work on that?`;
    }
    
    return 'What would you like me to build?';
  }
}

// Global instance
export const javariCore = new JavariCore();
