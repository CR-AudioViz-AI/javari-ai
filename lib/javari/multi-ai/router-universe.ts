// lib/javari/multi-ai/router-universe.ts
// Enhanced router with Universe-30 support (optional mode)

import { ModelMetadata, selectModelByTask, getModel as getOriginalModel } from './model-registry';
import { UniversalModelMetadata, UNIVERSE_MODELS, getFastestFreeModel, getUniverseModel } from './model-registry-universe';

export interface UniverseRoutingContext {
  prompt: string;
  mode: 'single' | 'super' | 'advanced' | 'roadmap' | 'council';
  useUniverse?: boolean; // Enable Universe-30 models
  policy?: {
    maxCostPerRequest?: number;
    preferredProviders?: string[];
    taskType?: 'chat' | 'code' | 'summarize' | 'classify' | 'embed' | 'translate' | 'math';
  };
  userOverride?: string;
}

export interface UniverseRoutingDecision {
  selectedModel: ModelMetadata | UniversalModelMetadata;
  reason: string;
  alternatives: (ModelMetadata | UniversalModelMetadata)[];
  costEstimate: number;
  confidence: number;
  isUniverseModel: boolean;
  overrideApplied?: string;
}

// Task detection from prompt
function detectTaskType(prompt: string): 'chat' | 'code' | 'summarize' | 'classify' | 'translate' | 'math' | undefined {
  const lower = prompt.toLowerCase();
  
  // Code detection
  if (/\b(code|function|class|debug|implement|script|program|api)\b/.test(lower)) {
    return 'code';
  }
  
  // Summarization detection
  if (/\b(summarize|summary|tldr|brief|condense|shorten)\b/.test(lower)) {
    return 'summarize';
  }
  
  // Translation detection
  if (/\b(translate|translation|in (french|german|spanish|chinese|japanese))\b/.test(lower)) {
    return 'translate';
  }
  
  // Math detection
  if (/\b(calculate|math|equation|solve|algebra|geometry)\b/.test(lower)) {
    return 'math';
  }
  
  // Classification detection
  if (/\b(classify|categorize|label|sentiment|category)\b/.test(lower)) {
    return 'classify';
  }
  
  // Default to chat
  return 'chat';
}

export function routeWithUniverse(context: UniverseRoutingContext): UniverseRoutingDecision {
  // If Universe mode not enabled, use original routing
  if (!context.useUniverse) {
    // Fallback to original model registry
    const originalModel = selectModelByTask({
      needsReasoning: /analyze|explain|why/.test(context.prompt.toLowerCase()),
      needsSpeed: /quick|fast|urgent/.test(context.prompt.toLowerCase()),
      needsCoding: /code|function|implement/.test(context.prompt.toLowerCase())
    });
    
    return {
      selectedModel: originalModel,
      reason: 'Using original 11-model registry (Universe mode disabled)',
      alternatives: [],
      costEstimate: 0,
      confidence: 0.85,
      isUniverseModel: false
    };
  }
  
  // UNIVERSE MODE ENABLED
  
  // Handle user override
  if (context.userOverride) {
    const universeModel = getUniverseModel(context.userOverride);
    if (universeModel) {
      return {
        selectedModel: universeModel,
        reason: `User override: ${context.userOverride}`,
        alternatives: [],
        costEstimate: 0,
        confidence: 1.0,
        isUniverseModel: true,
        overrideApplied: context.userOverride
      };
    }
    
    // Try original registry
    const originalModel = getOriginalModel(context.userOverride);
    if (originalModel) {
      return {
        selectedModel: originalModel,
        reason: `User override: ${context.userOverride} (original registry)`,
        alternatives: [],
        costEstimate: 0,
        confidence: 1.0,
        isUniverseModel: false,
        overrideApplied: context.userOverride
      };
    }
  }
  
  // Detect task type
  const detectedType = context.policy?.taskType || detectTaskType(context.prompt);
  
  // Get fastest free model for task type
  const fastestModel = getFastestFreeModel(detectedType);
  
  if (fastestModel) {
    return {
      selectedModel: fastestModel,
      reason: `Universe-30: Fastest free ${detectedType} model - ${fastestModel.name}`,
      alternatives: [],
      costEstimate: 0,
      confidence: fastestModel.reliability,
      isUniverseModel: true
    };
  }
  
  // Fallback to original registry if no Universe model found
  const fallbackModel = selectModelByTask({
    needsReasoning: detectedType === 'chat',
    needsCoding: detectedType === 'code',
    maxCost: 'free'
  });
  
  return {
    selectedModel: fallbackModel,
    reason: `Fallback to original registry (no Universe model for ${detectedType})`,
    alternatives: [],
    costEstimate: 0,
    confidence: 0.80,
    isUniverseModel: false
  };
}

// Universe model stats
export function getUniverseStats() {
  const typeCount: Record<string, number> = {};
  const providerCount: Record<string, number> = {};
  
  UNIVERSE_MODELS.forEach(model => {
    typeCount[model.type] = (typeCount[model.type] || 0) + 1;
    providerCount[model.provider] = (providerCount[model.provider] || 0) + 1;
  });
  
  return {
    totalModels: UNIVERSE_MODELS.length,
    byType: typeCount,
    byProvider: providerCount,
    allFree: true
  };
}

// Check if model is from Universe registry
export function isUniverseModel(modelId: string): boolean {
  return getUniverseModel(modelId) !== null;
}

// Get model (checks both registries)
export function getAnyModel(modelId: string): ModelMetadata | UniversalModelMetadata | null {
  return getUniverseModel(modelId) || getOriginalModel(modelId);
}
