/**
 * Universe Router - Phase 2.7
 * Intelligent routing across 200+ models from 13 providers
 * 
 * Providers: HuggingFace, Groq, OpenRouter, DeepSeek, Replicate, 
 *            TogetherAI, Cohere, Voyage, Jina, Nomic, Stability, 
 *            Perplexity, Local
 */

import { UNIVERSE_MODELS, type UniverseModel } from './model-registry-universe';
import { callHuggingFace } from '../providers/huggingface';
import { callGroq } from '../providers/groq';
import { callOpenRouter } from '../providers/openrouter';
import { callDeepSeek } from '../providers/deepseek';
import { callReplicate } from '../providers/replicate';
import { callTogether } from '../providers/together';
import { callCohere } from '../providers/cohere';
import { callVoyage, callJina, callNomic, callStability } from '../providers/specialized';

export interface UniverseRoutingPolicy {
  preferredProviders?: string[];
  preferredCategories?: string[];
  preferredTags?: string[];
  excludeProviders?: string[];
  requireCapabilities?: ('streaming' | 'functionCalling' | 'vision' | 'audio')[];
  maxContextWindow?: number;
  preferSpeed?: boolean; // Prefer fastest providers (Groq, Together)
  preferQuality?: boolean; // Prefer largest/best models
}

export interface UniverseRoutingResult {
  response: string;
  routing: {
    selectedModel: string;
    modelName: string;
    provider: string;
    category: string;
    fallbacksAttempted: number;
    latencyMs: number;
    success: boolean;
  };
}

/**
 * Execute a prompt using Universe intelligent routing
 */
export async function executeUniverseModel(
  prompt: string,
  policy?: UniverseRoutingPolicy
): Promise<UniverseRoutingResult> {
  const startTime = Date.now();

  // Select best model based on policy
  const selectedModel = selectBestModel(policy);

  if (!selectedModel) {
    throw new Error('No suitable model found for the given policy');
  }

  let fallbacksAttempted = 0;
  let lastError: Error | null = null;

  // Try selected model, then fallbacks
  const modelsToTry = [
    selectedModel,
    ...getFallbackModels(selectedModel, policy),
  ];

  for (const model of modelsToTry.slice(0, 3)) { // Max 3 attempts
    try {
      const response = await callModelByProvider(model, prompt);
      const latencyMs = Date.now() - startTime;

      return {
        response,
        routing: {
          selectedModel: model.id,
          modelName: model.name,
          provider: model.provider,
          category: model.category,
          fallbacksAttempted,
          latencyMs,
          success: true,
        },
      };
    } catch (error) {
      lastError = error as Error;
      fallbacksAttempted++;
      
      // Log fallback attempt
      console.warn(`Model ${model.id} failed, trying fallback...`, error);
      
      continue;
    }
  }

  // All attempts failed
  const latencyMs = Date.now() - startTime;
  throw new Error(
    `All models failed after ${fallbacksAttempted} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Call a model by routing to correct provider
 */
async function callModelByProvider(
  model: UniverseModel,
  prompt: string
): Promise<string> {
  switch (model.provider) {
    case 'huggingface':
      return await callHuggingFace(model.id, prompt);

    case 'groq':
      return await callGroq(model.id, prompt);

    case 'openrouter':
      return await callOpenRouter(model.id, prompt);

    case 'deepseek':
      return await callDeepSeek(model.id, prompt);

    case 'replicate':
      return await callReplicate(model.id, prompt);

    case 'together':
      return await callTogether(model.id, prompt);

    case 'cohere':
      return await callCohere(model.id, prompt);

    case 'voyage':
      // Embedding model - not for text generation
      throw new Error('Voyage models are embedding-only');

    case 'jina':
      // Embedding model - not for text generation
      throw new Error('Jina models are embedding-only');

    case 'nomic':
      // Embedding model - not for text generation
      throw new Error('Nomic models are embedding-only');

    case 'stability':
      // Image generation model - special handling
      if (model.category === 'image') {
        return await callStability(prompt, model.id);
      }
      throw new Error('Stability models require image generation context');

    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

/**
 * Select the best model based on routing policy
 */
function selectBestModel(policy?: UniverseRoutingPolicy): UniverseModel | null {
  let candidates = [...UNIVERSE_MODELS];

  // Filter out embedding-only models for text generation
  candidates = candidates.filter(m => 
    m.category !== 'embedding' || !policy?.preferredCategories?.includes('chat')
  );

  // Apply provider filters
  if (policy?.preferredProviders?.length) {
    const preferred = candidates.filter(m =>
      policy.preferredProviders!.includes(m.provider)
    );
    if (preferred.length > 0) {
      candidates = preferred;
    }
  }

  if (policy?.excludeProviders?.length) {
    candidates = candidates.filter(
      m => !policy.excludeProviders!.includes(m.provider)
    );
  }

  // Apply category filters
  if (policy?.preferredCategories?.length) {
    const preferred = candidates.filter(m =>
      policy.preferredCategories!.includes(m.category)
    );
    if (preferred.length > 0) {
      candidates = preferred;
    }
  }

  // Apply tag filters
  if (policy?.preferredTags?.length) {
    const preferred = candidates.filter(m =>
      policy.preferredTags!.some(tag => m.tags.includes(tag))
    );
    if (preferred.length > 0) {
      candidates = preferred;
    }
  }

  // Apply capability requirements
  if (policy?.requireCapabilities?.length) {
    candidates = candidates.filter(m =>
      policy.requireCapabilities!.every(cap => m.capabilities[cap])
    );
  }

  // Apply context window filter
  if (policy?.maxContextWindow) {
    candidates = candidates.filter(
      m => m.contextWindow >= policy.maxContextWindow!
    );
  }

  // Prefer speed (Groq, TogetherAI with "turbo" tag)
  if (policy?.preferSpeed) {
    const fast = candidates.filter(
      m => m.provider === 'groq' || m.tags.includes('turbo') || m.tags.includes('fast')
    );
    if (fast.length > 0) {
      candidates = fast;
    }
  }

  // Prefer quality (larger models, 70B+)
  if (policy?.preferQuality) {
    const quality = candidates.filter(
      m => m.tags.includes('large') || m.tags.includes('powerful') || m.name.includes('70B')
    );
    if (quality.length > 0) {
      candidates = quality;
    }
  }

  // Default: prefer Groq for speed if no specific policy
  if (!policy) {
    const groq = candidates.filter(m => m.provider === 'groq');
    if (groq.length > 0) {
      return groq[0];
    }
  }

  return candidates[0] || null;
}

/**
 * Get fallback models for a given model
 */
function getFallbackModels(
  model: UniverseModel,
  policy?: UniverseRoutingPolicy
): UniverseModel[] {
  // Same category, different provider
  const sameCategoryDifferentProvider = UNIVERSE_MODELS.filter(
    m =>
      m.category === model.category &&
      m.provider !== model.provider &&
      !policy?.excludeProviders?.includes(m.provider)
  );

  // Prefer fast providers for fallback
  const fastFallbacks = sameCategoryDifferentProvider.filter(
    m => m.provider === 'groq' || m.provider === 'together'
  );

  return fastFallbacks.length > 0
    ? fastFallbacks.slice(0, 2)
    : sameCategoryDifferentProvider.slice(0, 2);
}

/**
 * Get embeddings from Universe embedding models
 */
export async function getUniverseEmbeddings(
  texts: string[],
  preferredProvider?: 'voyage' | 'jina' | 'nomic' | 'cohere' | 'huggingface'
): Promise<number[][]> {
  const embeddingModels = UNIVERSE_MODELS.filter(m => m.category === 'embedding');

  if (embeddingModels.length === 0) {
    throw new Error('No embedding models available');
  }

  // Prefer specified provider
  let model = embeddingModels.find(m => m.provider === preferredProvider);
  if (!model) {
    // Default to best available
    model = embeddingModels.find(m => m.provider === 'voyage') ||
            embeddingModels.find(m => m.provider === 'cohere') ||
            embeddingModels[0];
  }

  switch (model.provider) {
    case 'voyage':
      return await callVoyage(texts);

    case 'jina':
      return await callJina(texts);

    case 'nomic':
      return await callNomic(texts);

    case 'cohere':
      const { callCohereEmbed } = await import('../providers/cohere');
      return await callCohereEmbed(texts);

    case 'huggingface':
      // HuggingFace embeddings would need special handling
      throw new Error('HuggingFace embeddings not yet implemented in Universe router');

    default:
      throw new Error(`Unknown embedding provider: ${model.provider}`);
  }
}

/**
 * Generate images using Universe image models
 */
export async function generateUniverseImage(
  prompt: string,
  preferredProvider?: 'stability' | 'replicate'
): Promise<string> {
  const imageModels = UNIVERSE_MODELS.filter(m => m.category === 'image');

  if (imageModels.length === 0) {
    throw new Error('No image generation models available');
  }

  // Prefer specified provider
  let model = imageModels.find(m => m.provider === preferredProvider);
  if (!model) {
    // Default to SDXL
    model = imageModels.find(m => m.id.includes('sdxl')) || imageModels[0];
  }

  return await callStability(prompt, model.id);
}

/**
 * Detect task type and auto-select best model category
 */
export function detectTaskCategory(prompt: string): UniverseModel['category'] {
  const lowerPrompt = prompt.toLowerCase();

  // Code detection
  if (
    lowerPrompt.includes('code') ||
    lowerPrompt.includes('function') ||
    lowerPrompt.includes('debug') ||
    lowerPrompt.includes('script') ||
    /```/.test(prompt)
  ) {
    return 'code';
  }

  // Math detection
  if (
    lowerPrompt.includes('calculate') ||
    lowerPrompt.includes('solve') ||
    lowerPrompt.includes('equation') ||
    /\d+\s*[\+\-\*\/]\s*\d+/.test(prompt)
  ) {
    return 'math';
  }

  // Summarization detection
  if (
    lowerPrompt.includes('summarize') ||
    lowerPrompt.includes('summary') ||
    lowerPrompt.includes('tldr')
  ) {
    return 'summarization';
  }

  // Translation detection
  if (
    lowerPrompt.includes('translate') ||
    lowerPrompt.includes('translation') ||
    /to (french|spanish|german|chinese|japanese)/i.test(prompt)
  ) {
    return 'translation';
  }

  // Image generation detection
  if (
    lowerPrompt.includes('generate image') ||
    lowerPrompt.includes('create image') ||
    lowerPrompt.includes('draw') ||
    lowerPrompt.includes('picture of')
  ) {
    return 'image';
  }

  // Creative writing detection
  if (
    lowerPrompt.includes('story') ||
    lowerPrompt.includes('poem') ||
    lowerPrompt.includes('creative') ||
    lowerPrompt.includes('write a')
  ) {
    return 'creative';
  }

  // Default to chat
  return 'chat';
}

/**
 * Auto-route with intelligent task detection
 */
export async function autoRoute(prompt: string): Promise<UniverseRoutingResult> {
  const category = detectTaskCategory(prompt);

  const policy: UniverseRoutingPolicy = {
    preferredCategories: [category],
    preferSpeed: true, // Default to speed
  };

  return await executeUniverseModel(prompt, policy);
}
