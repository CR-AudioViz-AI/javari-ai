// lib/javari/multi-ai/router-universe-updated.ts
// Enhanced router with HuggingFace support

import { ModelMetadata, selectModelByTask, getModel as getOriginalModel } from './model-registry';
import { UniversalModelMetadata, UNIVERSE_MODELS, getFastestFreeModel, getUniverseModel } from './model-registry-universe';
import { callHuggingFace } from '../providers/huggingface';

export interface UniverseRoutingContext {
  prompt: string;
  mode: 'single' | 'super' | 'advanced' | 'roadmap' | 'council';
  useUniverse?: boolean;
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

// Task detection
function detectTaskType(prompt: string): 'chat' | 'code' | 'summarize' | 'classify' | 'translate' | 'math' | undefined {
  const lower = prompt.toLowerCase();
  
  if (/\b(code|function|class|debug|implement|script|program|api)\b/.test(lower)) {
    return 'code';
  }
  if (/\b(summarize|summary|tldr|brief|condense|shorten)\b/.test(lower)) {
    return 'summarize';
  }
  if (/\b(translate|translation|in (french|german|spanish|chinese|japanese))\b/.test(lower)) {
    return 'translate';
  }
  if (/\b(calculate|math|equation|solve|algebra|geometry)\b/.test(lower)) {
    return 'math';
  }
  if (/\b(classify|categorize|label|sentiment|category)\b/.test(lower)) {
    return 'classify';
  }
  
  return 'chat';
}

export function routeWithUniverse(context: UniverseRoutingContext): UniverseRoutingDecision {
  // If Universe mode not enabled, use original routing
  if (!context.useUniverse) {
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
  
  // Fallback to original registry
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

/**
 * Execute model request using appropriate provider
 */
export async function executeUniverseModel(
  model: UniversalModelMetadata,
  prompt: string
): Promise<string> {
  switch (model.provider) {
    case 'huggingface':
      return await callHuggingFace(model.id, prompt);
    
    case 'groq':
      return await executeGroq(model.id, prompt);
    
    case 'openrouter':
      return await executeOpenRouter(model.id, prompt);
    
    case 'deepseek':
      return await executeDeepSeek(model.id, prompt);
    
    default:
      throw new Error(`Provider ${model.provider} not implemented`);
  }
}

// Provider execution functions
async function executeGroq(modelId: string, prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Groq API key not configured');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    throw new Error(`Groq error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeOpenRouter(modelId: string, prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OpenRouter API key not configured');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://javariai.com',
      'X-Title': 'Javari AI'
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

async function executeDeepSeek(modelId: string, prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek API key not configured');
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek error: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// Universe stats
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

export function isUniverseModel(modelId: string): boolean {
  return getUniverseModel(modelId) !== null;
}

export function getAnyModel(modelId: string): ModelMetadata | UniversalModelMetadata | null {
  return getUniverseModel(modelId) || getOriginalModel(modelId);
}
