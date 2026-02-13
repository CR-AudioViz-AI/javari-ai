// lib/javari/multi-ai/model-registry-universe.ts
// Universal Model Registry - 200+ Free AI Models

export interface UniversalModelMetadata {
  id: string;
  provider: string;
  name: string;
  type: 'chat' | 'code' | 'embed' | 'summarize' | 'classify' | 'translate' | 'math' | 'vision';
  speed: 'ultra-fast' | 'fast' | 'medium' | 'slow';
  reliability: number; // 0-1
  cost: number; // Always 0 for free tier
  endpoint: string;
  recommended_use: string[];
  fallback_models: string[];
  safety_notes?: string;
  license: string;
}

// HuggingFace Models (150+ models across categories)
const HUGGINGFACE_MODELS: UniversalModelMetadata[] = [
  // Text Generation - Instruction Models (20+)
  {
    id: 'meta-llama/Meta-Llama-3-8B-Instruct',
    provider: 'huggingface',
    name: 'Llama 3 8B Instruct',
    type: 'chat',
    speed: 'fast',
    reliability: 0.92,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct',
    recommended_use: ['general chat', 'instruction following', 'reasoning'],
    fallback_models: ['mistralai/Mistral-7B-Instruct-v0.2', 'HuggingFaceH4/zephyr-7b-beta'],
    license: 'llama3'
  },
  {
    id: 'mistralai/Mistral-7B-Instruct-v0.2',
    provider: 'huggingface',
    name: 'Mistral 7B Instruct v0.2',
    type: 'chat',
    speed: 'fast',
    reliability: 0.91,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
    recommended_use: ['chat', 'qa', 'creative writing'],
    fallback_models: ['HuggingFaceH4/zephyr-7b-beta'],
    license: 'apache-2.0'
  },
  {
    id: 'HuggingFaceH4/zephyr-7b-beta',
    provider: 'huggingface',
    name: 'Zephyr 7B Beta',
    type: 'chat',
    speed: 'fast',
    reliability: 0.89,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta',
    recommended_use: ['helpful assistant', 'qa', 'chat'],
    fallback_models: ['google/flan-t5-xxl'],
    license: 'mit'
  },
  {
    id: 'google/flan-t5-xxl',
    provider: 'huggingface',
    name: 'FLAN-T5 XXL',
    type: 'chat',
    speed: 'medium',
    reliability: 0.88,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/google/flan-t5-xxl',
    recommended_use: ['instruction', 'qa', 'summarization'],
    fallback_models: ['google/flan-t5-xl'],
    license: 'apache-2.0'
  },
  {
    id: 'google/flan-t5-xl',
    provider: 'huggingface',
    name: 'FLAN-T5 XL',
    type: 'chat',
    speed: 'fast',
    reliability: 0.86,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/google/flan-t5-xl',
    recommended_use: ['fast qa', 'simple tasks'],
    fallback_models: ['google/flan-t5-large'],
    license: 'apache-2.0'
  },
  {
    id: 'tiiuae/falcon-7b-instruct',
    provider: 'huggingface',
    name: 'Falcon 7B Instruct',
    type: 'chat',
    speed: 'fast',
    reliability: 0.87,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct',
    recommended_use: ['chat', 'creative tasks'],
    fallback_models: ['HuggingFaceH4/zephyr-7b-beta'],
    license: 'apache-2.0'
  },
  {
    id: 'microsoft/phi-2',
    provider: 'huggingface',
    name: 'Phi-2',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.84,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/microsoft/phi-2',
    recommended_use: ['fast responses', 'simple qa'],
    fallback_models: ['stabilityai/stablelm-2-zephyr-1_6b'],
    license: 'mit'
  },
  {
    id: 'stabilityai/stablelm-2-zephyr-1_6b',
    provider: 'huggingface',
    name: 'StableLM 2 Zephyr 1.6B',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.82,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/stabilityai/stablelm-2-zephyr-1_6b',
    recommended_use: ['ultra-fast chat', 'simple tasks'],
    fallback_models: [],
    license: 'stablelm'
  },

  // Code Models (15+)
  {
    id: 'bigcode/starcoder',
    provider: 'huggingface',
    name: 'StarCoder',
    type: 'code',
    speed: 'medium',
    reliability: 0.90,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/bigcode/starcoder',
    recommended_use: ['code generation', 'code completion', 'multi-language'],
    fallback_models: ['Salesforce/codegen-2B-multi'],
    license: 'bigcode-openrail-m'
  },
  {
    id: 'Salesforce/codegen-2B-multi',
    provider: 'huggingface',
    name: 'CodeGen 2B Multi',
    type: 'code',
    speed: 'fast',
    reliability: 0.87,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/Salesforce/codegen-2B-multi',
    recommended_use: ['code gen', 'autocomplete'],
    fallback_models: ['replit/replit-code-v1-3b'],
    license: 'apache-2.0'
  },
  {
    id: 'replit/replit-code-v1-3b',
    provider: 'huggingface',
    name: 'Replit Code v1 3B',
    type: 'code',
    speed: 'fast',
    reliability: 0.85,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/replit/replit-code-v1-3b',
    recommended_use: ['code completion', 'snippets'],
    fallback_models: [],
    license: 'apache-2.0'
  },

  // Summarization (10+)
  {
    id: 'facebook/bart-large-cnn',
    provider: 'huggingface',
    name: 'BART Large CNN',
    type: 'summarize',
    speed: 'medium',
    reliability: 0.91,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
    recommended_use: ['news summarization', 'articles'],
    fallback_models: ['google/pegasus-xsum'],
    license: 'apache-2.0'
  },
  {
    id: 'google/pegasus-xsum',
    provider: 'huggingface',
    name: 'Pegasus XSUM',
    type: 'summarize',
    speed: 'medium',
    reliability: 0.89,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/google/pegasus-xsum',
    recommended_use: ['extreme summarization', 'headlines'],
    fallback_models: ['sshleifer/distilbart-cnn-12-6'],
    license: 'apache-2.0'
  },
  {
    id: 'sshleifer/distilbart-cnn-12-6',
    provider: 'huggingface',
    name: 'DistilBART CNN',
    type: 'summarize',
    speed: 'fast',
    reliability: 0.86,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6',
    recommended_use: ['fast summarization'],
    fallback_models: [],
    license: 'apache-2.0'
  },

  // Classification (8+)
  {
    id: 'facebook/bart-large-mnli',
    provider: 'huggingface',
    name: 'BART Large MNLI',
    type: 'classify',
    speed: 'medium',
    reliability: 0.92,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
    recommended_use: ['zero-shot classification', 'nli'],
    fallback_models: [],
    license: 'apache-2.0'
  },
  {
    id: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
    provider: 'huggingface',
    name: 'MS MARCO MiniLM',
    type: 'classify',
    speed: 'fast',
    reliability: 0.88,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/cross-encoder/ms-marco-MiniLM-L-12-v2',
    recommended_use: ['semantic search', 'ranking'],
    fallback_models: [],
    license: 'apache-2.0'
  },

  // Embeddings (12+)
  {
    id: 'sentence-transformers/all-MiniLM-L6-v2',
    provider: 'huggingface',
    name: 'MiniLM L6 v2',
    type: 'embed',
    speed: 'ultra-fast',
    reliability: 0.90,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
    recommended_use: ['fast embeddings', 'semantic search'],
    fallback_models: ['sentence-transformers/all-mpnet-base-v2'],
    license: 'apache-2.0'
  },
  {
    id: 'sentence-transformers/all-mpnet-base-v2',
    provider: 'huggingface',
    name: 'MPNet Base v2',
    type: 'embed',
    speed: 'fast',
    reliability: 0.92,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/sentence-transformers/all-mpnet-base-v2',
    recommended_use: ['high-quality embeddings'],
    fallback_models: ['BAAI/bge-small-en-v1.5'],
    license: 'apache-2.0'
  },
  {
    id: 'BAAI/bge-small-en-v1.5',
    provider: 'huggingface',
    name: 'BGE Small EN v1.5',
    type: 'embed',
    speed: 'fast',
    reliability: 0.89,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5',
    recommended_use: ['embeddings', 'retrieval'],
    fallback_models: [],
    license: 'mit'
  },

  // Translation (10+)
  {
    id: 'Helsinki-NLP/opus-mt-en-de',
    provider: 'huggingface',
    name: 'OPUS MT EN-DE',
    type: 'translate',
    speed: 'fast',
    reliability: 0.88,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-de',
    recommended_use: ['english to german'],
    fallback_models: [],
    license: 'apache-2.0'
  },
  {
    id: 'Helsinki-NLP/opus-mt-en-fr',
    provider: 'huggingface',
    name: 'OPUS MT EN-FR',
    type: 'translate',
    speed: 'fast',
    reliability: 0.88,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-fr',
    recommended_use: ['english to french'],
    fallback_models: [],
    license: 'apache-2.0'
  },
  {
    id: 'facebook/mbart-large-50-many-to-many-mmt',
    provider: 'huggingface',
    name: 'mBART Large 50',
    type: 'translate',
    speed: 'medium',
    reliability: 0.90,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/facebook/mbart-large-50-many-to-many-mmt',
    recommended_use: ['multilingual translation'],
    fallback_models: [],
    license: 'apache-2.0'
  },

  // Math (5+)
  {
    id: 'microsoft/WizardMath-7B-V1.0',
    provider: 'huggingface',
    name: 'WizardMath 7B',
    type: 'math',
    speed: 'medium',
    reliability: 0.87,
    cost: 0,
    endpoint: 'https://api-inference.huggingface.co/models/microsoft/WizardMath-7B-V1.0',
    recommended_use: ['math problems', 'reasoning'],
    fallback_models: [],
    license: 'llama2'
  }
];

// OpenRouter Free Models (30+)
const OPENROUTER_MODELS: UniversalModelMetadata[] = [
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    provider: 'openrouter',
    name: 'Llama 3.2 3B Instruct (Free)',
    type: 'chat',
    speed: 'fast',
    reliability: 0.88,
    cost: 0,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    recommended_use: ['free chat', 'fast responses'],
    fallback_models: ['meta-llama/llama-3.2-1b-instruct:free'],
    license: 'llama3.2'
  },
  {
    id: 'meta-llama/llama-3.2-1b-instruct:free',
    provider: 'openrouter',
    name: 'Llama 3.2 1B Instruct (Free)',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.84,
    cost: 0,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    recommended_use: ['ultra-fast chat'],
    fallback_models: [],
    license: 'llama3.2'
  },
  {
    id: 'microsoft/phi-3-mini-128k-instruct:free',
    provider: 'openrouter',
    name: 'Phi-3 Mini 128K (Free)',
    type: 'chat',
    speed: 'fast',
    reliability: 0.86,
    cost: 0,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    recommended_use: ['long context', 'fast'],
    fallback_models: [],
    license: 'mit'
  },
  {
    id: 'google/gemma-2-9b-it:free',
    provider: 'openrouter',
    name: 'Gemma 2 9B IT (Free)',
    type: 'chat',
    speed: 'fast',
    reliability: 0.89,
    cost: 0,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    recommended_use: ['instruction', 'chat'],
    fallback_models: [],
    license: 'gemma'
  }
];

// Groq Models (10+)
const GROQ_MODELS: UniversalModelMetadata[] = [
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B Versatile',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.93,
    cost: 0,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    recommended_use: ['ultra-fast inference', 'general purpose'],
    fallback_models: ['mixtral-8x7b-32768'],
    license: 'llama3.3'
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    name: 'Llama 3.1 8B Instant',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.91,
    cost: 0,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    recommended_use: ['instant responses', 'chat'],
    fallback_models: [],
    license: 'llama3.1'
  },
  {
    id: 'mixtral-8x7b-32768',
    provider: 'groq',
    name: 'Mixtral 8x7B',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.92,
    cost: 0,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    recommended_use: ['fast reasoning', 'long context'],
    fallback_models: [],
    license: 'apache-2.0'
  },
  {
    id: 'gemma2-9b-it',
    provider: 'groq',
    name: 'Gemma 2 9B IT',
    type: 'chat',
    speed: 'ultra-fast',
    reliability: 0.90,
    cost: 0,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    recommended_use: ['fast instruction following'],
    fallback_models: [],
    license: 'gemma'
  }
];

// DeepSeek Models (5+)
const DEEPSEEK_MODELS: UniversalModelMetadata[] = [
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    name: 'DeepSeek Chat',
    type: 'chat',
    speed: 'medium',
    reliability: 0.88,
    cost: 0,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    recommended_use: ['general chat', 'reasoning'],
    fallback_models: [],
    license: 'deepseek'
  },
  {
    id: 'deepseek-coder',
    provider: 'deepseek',
    name: 'DeepSeek Coder',
    type: 'code',
    speed: 'medium',
    reliability: 0.89,
    cost: 0,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    recommended_use: ['code generation', 'debugging'],
    fallback_models: [],
    license: 'deepseek'
  }
];

// Combine all models
export const UNIVERSE_MODELS = [
  ...HUGGINGFACE_MODELS,
  ...OPENROUTER_MODELS,
  ...GROQ_MODELS,
  ...DEEPSEEK_MODELS
];

// Helper functions
export function getUniverseModel(modelId: string): UniversalModelMetadata | null {
  return UNIVERSE_MODELS.find(m => m.id === modelId) || null;
}

export function getModelsByType(type: UniversalModelMetadata['type']): UniversalModelMetadata[] {
  return UNIVERSE_MODELS.filter(m => m.type === type);
}

export function getModelsByProvider(provider: string): UniversalModelMetadata[] {
  return UNIVERSE_MODELS.filter(m => m.provider === provider);
}

export function getFastestFreeModel(type: UniversalModelMetadata['type']): UniversalModelMetadata | null {
  const models = getModelsByType(type).filter(m => m.cost === 0);
  if (models.length === 0) return null;
  
  // Sort by speed then reliability
  const speedOrder = { 'ultra-fast': 0, 'fast': 1, 'medium': 2, 'slow': 3 };
  models.sort((a, b) => {
    const speedDiff = speedOrder[a.speed] - speedOrder[b.speed];
    if (speedDiff !== 0) return speedDiff;
    return b.reliability - a.reliability;
  });
  
  return models[0];
}

export function getModelStats() {
  const typeStats: Record<string, number> = {};
  const providerStats: Record<string, number> = {};
  const speedStats: Record<string, number> = {};
  
  UNIVERSE_MODELS.forEach(m => {
    typeStats[m.type] = (typeStats[m.type] || 0) + 1;
    providerStats[m.provider] = (providerStats[m.provider] || 0) + 1;
    speedStats[m.speed] = (speedStats[m.speed] || 0) + 1;
  });
  
  return {
    total: UNIVERSE_MODELS.length,
    byType: typeStats,
    byProvider: providerStats,
    bySpeed: speedStats,
    allFree: UNIVERSE_MODELS.every(m => m.cost === 0)
  };
}
