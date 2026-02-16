// lib/javari/multi-ai/router.ts
// Multi-AI routing engine with policy enforcement

import { ModelMetadata, selectModelByTask, getModel, getFallbackModel } from './model-registry';

export interface RoutingPolicy {
  maxCostPerRequest?: number; // USD
  preferredProviders?: string[];
  excludedProviders?: string[];
  requireReasoning?: boolean;
  requireSpeed?: boolean;
  requireCoding?: boolean;
  allowFallback?: boolean;
}

export interface RoutingDecision {
  selectedModel: ModelMetadata;
  reason: string;
  alternatives: ModelMetadata[];
  costEstimate: number;
  confidence: number;
  overrideApplied?: string;
}

export interface RoutingContext {
  prompt: string;
  mode: 'single' | 'super' | 'advanced' | 'roadmap' | 'council';
  policy?: RoutingPolicy;
  userOverride?: string; // Model ID override
}

// Keyword-based capability detection
function analyzePrompt(prompt: string): {
  needsReasoning: boolean;
  needsSpeed: boolean;
  needsCoding: boolean;
  complexity: 'low' | 'medium' | 'high';
} {
  const lower = prompt.toLowerCase();
  
  // Reasoning keywords
  const reasoningKeywords = [
    'analyze', 'explain', 'why', 'reason', 'logic', 'think', 'consider',
    'evaluate', 'compare', 'pros and cons', 'trade-off', 'decision',
    'strategy', 'plan', 'architect', 'design', 'optimize'
  ];
  
  // Speed keywords
  const speedKeywords = [
    'quick', 'fast', 'immediately', 'urgent', 'asap', 'right now',
    'simple', 'brief', 'short', 'summarize'
  ];
  
  // Coding keywords
  const codingKeywords = [
    'code', 'function', 'class', 'implement', 'build', 'create',
    'debug', 'fix', 'refactor', 'api', 'database', 'algorithm',
    'component', 'module', 'package', 'library', 'framework'
  ];
  
  const needsReasoning = reasoningKeywords.some(kw => lower.includes(kw));
  const needsSpeed = speedKeywords.some(kw => lower.includes(kw));
  const needsCoding = codingKeywords.some(kw => lower.includes(kw));
  
  // Complexity based on prompt length and structure
  const wordCount = prompt.split(/\s+/).length;
  let complexity: 'low' | 'medium' | 'high' = 'low';
  
  if (wordCount > 100 || needsReasoning) complexity = 'medium';
  if (wordCount > 200 || (needsReasoning && needsCoding)) complexity = 'high';
  
  return { needsReasoning, needsSpeed, needsCoding, complexity };
}

// Cost ceiling enforcement
function enforceCostCeiling(
  model: ModelMetadata,
  policy: RoutingPolicy,
  estimatedTokens: number
): boolean {
  if (!policy.maxCostPerRequest) return true;
  
  const inputCost = (estimatedTokens * model.pricing.inputPerMillion) / 1000000;
  const outputCost = (estimatedTokens * 2 * model.pricing.outputPerMillion) / 1000000;
  const totalCost = inputCost + outputCost;
  
  return totalCost <= policy.maxCostPerRequest;
}

// Override detection from prompt
function detectOverride(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  
  // Model-specific keywords
  const overrides: Record<string, string[]> = {
    'o1': ['use o1', 'with o1', 'o-series', 'o1 model'],
    'claude-sonnet-4': ['use claude', 'with claude', 'claude sonnet'],
    'gpt-4o': ['use gpt-4o', 'with gpt-4o', 'gpt4o'],
    '-2-flash': ['use', 'with', 'flash'],
    'groq-llama': ['use groq', 'with groq', 'fast inference']
  };
  
  for (const [modelId, keywords] of Object.entries(overrides)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return modelId;
    }
  }
  
  return null;
}

export function routeRequest(context: RoutingContext): RoutingDecision {
  const analysis = analyzePrompt(context.prompt);
  const override = detectOverride(context.prompt);
  
  // Handle user override
  if (context.userOverride || override) {
    const modelId = context.userOverride || override!;
    const model = getModel(modelId);
    
    if (model) {
      return {
        selectedModel: model,
        reason: `User override: ${modelId}`,
        alternatives: [],
        costEstimate: 0,
        confidence: 1.0,
        overrideApplied: modelId
      };
    }
  }
  
  // Mode-specific routing
  if (context.mode === 'council') {
    // Council mode uses predefined models (handled by orchestrator)
    const model = getModel('gpt-4o-mini') || getFallbackModel();
    return {
      selectedModel: model,
      reason: 'Council mode: orchestrator will manage multi-model workflow',
      alternatives: [],
      costEstimate: 0,
      confidence: 1.0
    };
  }
  
  // Build task requirements
  const taskRequirements: any = {
    needsReasoning: analysis.needsReasoning,
    needsSpeed: analysis.needsSpeed,
    needsCoding: analysis.needsCoding
  };
  
  // Apply cost constraints from policy
  if (context.policy?.maxCostPerRequest) {
    // Map cost ceiling to cost tier
    if (context.policy.maxCostPerRequest < 0.01) {
      taskRequirements.maxCost = 'free';
    } else if (context.policy.maxCostPerRequest < 0.05) {
      taskRequirements.maxCost = 'low';
    } else if (context.policy.maxCostPerRequest < 0.20) {
      taskRequirements.maxCost = 'medium';
    } else {
      taskRequirements.maxCost = 'high';
    }
  }
  
  // Select optimal model
  let selectedModel = selectModelByTask(taskRequirements);
  
  // Apply provider filters
  if (context.policy?.preferredProviders?.length) {
    const preferred = context.policy.preferredProviders;
    if (!preferred.includes(selectedModel.provider)) {
      // Try to find preferred provider
      const alternativeModel = selectModelByTask({
        ...taskRequirements,
        maxCost: 'premium' // Relax cost for preferred provider
      });
      
      if (preferred.includes(alternativeModel.provider)) {
        selectedModel = alternativeModel;
      }
    }
  }
  
  // Build decision
  const estimatedTokens = Math.min(context.prompt.length * 1.5, 2000);
  
  return {
    selectedModel,
    reason: buildReason(selectedModel, analysis, context),
    alternatives: [], // Could populate with runner-ups
    costEstimate: estimateCost(selectedModel, estimatedTokens),
    confidence: calculateConfidence(selectedModel, analysis)
  };
}

function buildReason(
  model: ModelMetadata,
  analysis: ReturnType<typeof analyzePrompt>,
  context: RoutingContext
): string {
  const reasons: string[] = [];
  
  if (analysis.needsReasoning) {
    reasons.push(`High reasoning required (${model.capabilities.reasoning}/10)`);
  }
  
  if (analysis.needsSpeed) {
    reasons.push(`Speed optimized (${model.speed})`);
  }
  
  if (analysis.needsCoding) {
    reasons.push(`Coding capability (${model.capabilities.coding}/10)`);
  }
  
  if (model.cost === 'free') {
    reasons.push('Cost-optimized (free tier)');
  }
  
  if (reasons.length === 0) {
    reasons.push(`General purpose: ${model.name}`);
  }
  
  return reasons.join(', ');
}

function estimateCost(model: ModelMetadata, tokens: number): number {
  const inputCost = (tokens * model.pricing.inputPerMillion) / 1000000;
  const outputCost = (tokens * 2 * model.pricing.outputPerMillion) / 1000000;
  return inputCost + outputCost;
}

function calculateConfidence(
  model: ModelMetadata,
  analysis: ReturnType<typeof analyzePrompt>
): number {
  let confidence = model.reliability;
  
  // Boost confidence if capabilities match requirements
  if (analysis.needsReasoning && model.capabilities.reasoning >= 8) {
    confidence += 0.05;
  }
  if (analysis.needsCoding && model.capabilities.coding >= 8) {
    confidence += 0.05;
  }
  if (analysis.needsSpeed && model.capabilities.speed >= 8) {
    confidence += 0.05;
  }
  
  return Math.min(confidence, 1.0);
}

export interface RouterLog {
  timestamp: string;
  context: RoutingContext;
  decision: RoutingDecision;
  executionTime?: number;
  success?: boolean;
  error?: string;
}

export class RouterLogger {
  private logs: RouterLog[] = [];
  private maxLogs = 100;
  
  log(context: RoutingContext, decision: RoutingDecision): void {
    this.logs.unshift({
      timestamp: new Date().toISOString(),
      context,
      decision
    });
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
  }
  
  updateLog(timestamp: string, update: Partial<RouterLog>): void {
    const log = this.logs.find(l => l.timestamp === timestamp);
    if (log) {
      Object.assign(log, update);
    }
  }
  
  getLogs(limit = 10): RouterLog[] {
    return this.logs.slice(0, limit);
  }
  
  getStats(): {
    totalRequests: number;
    byProvider: Record<string, number>;
    avgCost: number;
    avgConfidence: number;
  } {
    const byProvider: Record<string, number> = {};
    let totalCost = 0;
    let totalConfidence = 0;
    
    this.logs.forEach(log => {
      const provider = log.decision.selectedModel.provider;
      byProvider[provider] = (byProvider[provider] || 0) + 1;
      totalCost += log.decision.costEstimate;
      totalConfidence += log.decision.confidence;
    });
    
    return {
      totalRequests: this.logs.length,
      byProvider,
      avgCost: this.logs.length > 0 ? totalCost / this.logs.length : 0,
      avgConfidence: this.logs.length > 0 ? totalConfidence / this.logs.length : 0
    };
  }
}

// Global router logger instance
export const globalRouterLogger = new RouterLogger();
