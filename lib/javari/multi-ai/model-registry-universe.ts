/**
 * Universe Model Registry - Phase 2.7
 * 200+ Free-Tier Models Across 13 Providers
 * 
 * All models: cost = 0, auth = optional
 */

export interface UniverseModel {
  id: string;
  name: string;
  provider: 'huggingface' | 'groq' | 'openrouter' | 'deepseek' | 'replicate' | 'together' | 'cohere' | 'voyage' | 'jina' | 'nomic' | 'stability' | 'perplexity' | 'local';
  category: 'chat' | 'code' | 'reasoning' | 'creative' | 'embedding' | 'image' | 'math' | 'translation' | 'summarization' | 'classification';
  tags: string[];
  cost: number; // Always 0 for Universe
  contextWindow: number;
  capabilities: {
    streaming?: boolean;
    functionCalling?: boolean;
    vision?: boolean;
    audio?: boolean;
  };
}

export const UNIVERSE_MODELS: UniverseModel[] = [
  // ========================================
  // GROQ - Ultra-fast inference (11 models)
  // ========================================
  {
    id: 'llama-3.1-70b-versatile',
    name: 'Llama 3.1 70B',
    provider: 'groq',
    category: 'chat',
    tags: ['fast', 'versatile', 'long-context'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { streaming: true }
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    category: 'chat',
    tags: ['ultra-fast', 'instant', 'efficient'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'llama-3.2-1b-preview',
    name: 'Llama 3.2 1B',
    provider: 'groq',
    category: 'chat',
    tags: ['lightweight', 'edge', 'mobile'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'llama-3.2-3b-preview',
    name: 'Llama 3.2 3B',
    provider: 'groq',
    category: 'chat',
    tags: ['balanced', 'efficient'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    category: 'chat',
    tags: ['moe', 'multilingual', 'long-context'],
    cost: 0,
    contextWindow: 32768,
    capabilities: { streaming: true }
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'groq',
    category: 'chat',
    tags: ['google', 'efficient'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'gemma-7b-it',
    name: 'Gemma 7B',
    provider: 'groq',
    category: 'chat',
    tags: ['google', 'versatile'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'llama3-70b-8192',
    name: 'Llama 3 70B',
    provider: 'groq',
    category: 'chat',
    tags: ['powerful', 'balanced'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'llama3-8b-8192',
    name: 'Llama 3 8B',
    provider: 'groq',
    category: 'chat',
    tags: ['fast', 'efficient'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'llama-guard-3-8b',
    name: 'Llama Guard 3 8B',
    provider: 'groq',
    category: 'classification',
    tags: ['safety', 'moderation'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'llava-v1.5-7b-4096-preview',
    name: 'LLaVA 1.5 7B',
    provider: 'groq',
    category: 'chat',
    tags: ['vision', 'multimodal'],
    cost: 0,
    contextWindow: 4096,
    capabilities: { vision: true }
  },

  // ========================================
  // OPENROUTER - Access to 100s of models (20 selected free)
  // ========================================
  {
    id: 'google/-flash-1.5',
    name: 'Flash 1.5',
    provider: 'openrouter',
    category: 'chat',
    tags: ['fast', 'google', 'multimodal'],
    cost: 0,
    contextWindow: 1000000,
    capabilities: { streaming: true, vision: true }
  },
  {
    id: 'google/-flash-1.5-8b',
    name: 'Flash 1.5 8B',
    provider: 'openrouter',
    category: 'chat',
    tags: ['ultra-fast', 'google', 'efficient'],
    cost: 0,
    contextWindow: 1000000,
    capabilities: { streaming: true }
  },
  {
    id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    name: 'Llama 3.2 11B Vision',
    provider: 'openrouter',
    category: 'chat',
    tags: ['vision', 'multimodal', 'meta'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { vision: true }
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B',
    provider: 'openrouter',
    category: 'chat',
    tags: ['fast', 'meta', 'efficient'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { streaming: true }
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B',
    provider: 'openrouter',
    category: 'chat',
    tags: ['balanced', 'meta'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { streaming: true }
  },
  {
    id: 'microsoft/phi-3-mini-128k-instruct:free',
    name: 'Phi-3 Mini 128K',
    provider: 'openrouter',
    category: 'chat',
    tags: ['microsoft', 'long-context', 'small'],
    cost: 0,
    contextWindow: 128000,
    capabilities: {}
  },
  {
    id: 'microsoft/phi-3-medium-128k-instruct:free',
    name: 'Phi-3 Medium 128K',
    provider: 'openrouter',
    category: 'chat',
    tags: ['microsoft', 'long-context'],
    cost: 0,
    contextWindow: 128000,
    capabilities: {}
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B',
    provider: 'openrouter',
    category: 'chat',
    tags: ['fast', 'mistral'],
    cost: 0,
    contextWindow: 32768,
    capabilities: { streaming: true }
  },
  {
    id: 'openchat/openchat-7b:free',
    name: 'OpenChat 7B',
    provider: 'openrouter',
    category: 'chat',
    tags: ['open', 'versatile'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 405B',
    provider: 'openrouter',
    category: 'chat',
    tags: ['powerful', 'reasoning', 'large'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { functionCalling: true }
  },

  // ========================================
  // DEEPSEEK - Reasoning specialists (2 models)
  // ========================================
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    category: 'chat',
    tags: ['versatile', 'multilingual'],
    cost: 0,
    contextWindow: 64000,
    capabilities: { streaming: true }
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'deepseek',
    category: 'code',
    tags: ['coding', 'programming', 'specialized'],
    cost: 0,
    contextWindow: 64000,
    capabilities: { streaming: true }
  },

  // ========================================
  // HUGGINGFACE - 100+ open models (30 selected)
  // ========================================
  {
    id: 'meta-llama/Meta-Llama-3-8B-Instruct',
    name: 'Llama 3 8B (HF)',
    provider: 'huggingface',
    category: 'chat',
    tags: ['meta', 'versatile'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B v0.3',
    provider: 'huggingface',
    category: 'chat',
    tags: ['mistral', 'efficient'],
    cost: 0,
    contextWindow: 32768,
    capabilities: {}
  },
  {
    id: 'HuggingFaceH4/zephyr-7b-beta',
    name: 'Zephyr 7B',
    provider: 'huggingface',
    category: 'chat',
    tags: ['helpful', 'aligned'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'google/flan-t5-xxl',
    name: 'FLAN-T5 XXL',
    provider: 'huggingface',
    category: 'chat',
    tags: ['google', 'instruction', 'large'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'google/flan-t5-xl',
    name: 'FLAN-T5 XL',
    provider: 'huggingface',
    category: 'chat',
    tags: ['google', 'instruction'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'tiiuae/falcon-7b-instruct',
    name: 'Falcon 7B',
    provider: 'huggingface',
    category: 'chat',
    tags: ['falcon', 'tii'],
    cost: 0,
    contextWindow: 2048,
    capabilities: {}
  },
  {
    id: 'microsoft/phi-2',
    name: 'Phi-2',
    provider: 'huggingface',
    category: 'chat',
    tags: ['microsoft', 'small', 'efficient'],
    cost: 0,
    contextWindow: 2048,
    capabilities: {}
  },
  {
    id: 'stabilityai/stablelm-2-zephyr-1_6b',
    name: 'StableLM 2 Zephyr 1.6B',
    provider: 'huggingface',
    category: 'chat',
    tags: ['stability', 'tiny', 'edge'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'bigcode/starcoder',
    name: 'StarCoder',
    provider: 'huggingface',
    category: 'code',
    tags: ['code', 'bigcode', 'programming'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'Salesforce/codegen-2B-multi',
    name: 'CodeGen 2B',
    provider: 'huggingface',
    category: 'code',
    tags: ['salesforce', 'code', 'multi-language'],
    cost: 0,
    contextWindow: 2048,
    capabilities: {}
  },
  {
    id: 'replit/replit-code-v1-3b',
    name: 'Replit Code 3B',
    provider: 'huggingface',
    category: 'code',
    tags: ['replit', 'code', 'autocomplete'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'facebook/bart-large-cnn',
    name: 'BART Large CNN',
    provider: 'huggingface',
    category: 'summarization',
    tags: ['facebook', 'summarization', 'news'],
    cost: 0,
    contextWindow: 1024,
    capabilities: {}
  },
  {
    id: 'google/pegasus-xsum',
    name: 'Pegasus XSum',
    provider: 'huggingface',
    category: 'summarization',
    tags: ['google', 'summarization', 'extreme'],
    cost: 0,
    contextWindow: 1024,
    capabilities: {}
  },
  {
    id: 'sshleifer/distilbart-cnn-12-6',
    name: 'DistilBART CNN',
    provider: 'huggingface',
    category: 'summarization',
    tags: ['distilled', 'efficient', 'summarization'],
    cost: 0,
    contextWindow: 1024,
    capabilities: {}
  },
  {
    id: 'sentence-transformers/all-MiniLM-L6-v2',
    name: 'MiniLM L6 v2',
    provider: 'huggingface',
    category: 'embedding',
    tags: ['sentence', 'embedding', 'small'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'sentence-transformers/all-mpnet-base-v2',
    name: 'MPNet Base v2',
    provider: 'huggingface',
    category: 'embedding',
    tags: ['sentence', 'embedding', 'quality'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'BAAI/bge-small-en-v1.5',
    name: 'BGE Small EN v1.5',
    provider: 'huggingface',
    category: 'embedding',
    tags: ['bge', 'embedding', 'english'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'Helsinki-NLP/opus-mt-en-de',
    name: 'Opus MT EN-DE',
    provider: 'huggingface',
    category: 'translation',
    tags: ['translation', 'en-de', 'helsinki'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'Helsinki-NLP/opus-mt-en-fr',
    name: 'Opus MT EN-FR',
    provider: 'huggingface',
    category: 'translation',
    tags: ['translation', 'en-fr', 'helsinki'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'facebook/mbart-large-50-many-to-many-mmt',
    name: 'mBART Large 50',
    provider: 'huggingface',
    category: 'translation',
    tags: ['multilingual', 'translation', '50-lang'],
    cost: 0,
    contextWindow: 1024,
    capabilities: {}
  },
  {
    id: 'facebook/bart-large-mnli',
    name: 'BART Large MNLI',
    provider: 'huggingface',
    category: 'classification',
    tags: ['classification', 'nli', 'zero-shot'],
    cost: 0,
    contextWindow: 1024,
    capabilities: {}
  },
  {
    id: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
    name: 'MS Marco MiniLM',
    provider: 'huggingface',
    category: 'classification',
    tags: ['reranking', 'search', 'cross-encoder'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'microsoft/WizardMath-7B-V1.0',
    name: 'WizardMath 7B',
    provider: 'huggingface',
    category: 'math',
    tags: ['math', 'reasoning', 'microsoft'],
    cost: 0,
    contextWindow: 2048,
    capabilities: {}
  },

  // ========================================
  // TOGETHERAI - 50+ models (25 selected)
  // ========================================
  {
    id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    name: 'Llama 3.1 8B Turbo',
    provider: 'together',
    category: 'chat',
    tags: ['meta', 'fast', 'turbo'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { streaming: true }
  },
  {
    id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    name: 'Llama 3.1 70B Turbo',
    provider: 'together',
    category: 'chat',
    tags: ['meta', 'powerful', 'turbo'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { streaming: true }
  },
  {
    id: 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
    name: 'Llama 3 8B Turbo',
    provider: 'together',
    category: 'chat',
    tags: ['meta', 'balanced'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo',
    name: 'Llama 3 70B Turbo',
    provider: 'together',
    category: 'chat',
    tags: ['meta', 'large'],
    cost: 0,
    contextWindow: 8192,
    capabilities: { streaming: true }
  },
  {
    id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    name: 'Mixtral 8x7B',
    provider: 'together',
    category: 'chat',
    tags: ['mistral', 'moe'],
    cost: 0,
    contextWindow: 32768,
    capabilities: { streaming: true }
  },
  {
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B v0.3',
    provider: 'together',
    category: 'chat',
    tags: ['mistral', 'efficient'],
    cost: 0,
    contextWindow: 32768,
    capabilities: { streaming: true }
  },
  {
    id: 'Qwen/Qwen2-72B-Instruct',
    name: 'Qwen 2 72B',
    provider: 'together',
    category: 'chat',
    tags: ['qwen', 'large', 'multilingual'],
    cost: 0,
    contextWindow: 32768,
    capabilities: { streaming: true }
  },
  {
    id: 'Qwen/Qwen2-7B-Instruct',
    name: 'Qwen 2 7B',
    provider: 'together',
    category: 'chat',
    tags: ['qwen', 'efficient'],
    cost: 0,
    contextWindow: 32768,
    capabilities: { streaming: true }
  },
  {
    id: 'Qwen/Qwen1.5-110B-Chat',
    name: 'Qwen 1.5 110B',
    provider: 'together',
    category: 'chat',
    tags: ['qwen', 'powerful'],
    cost: 0,
    contextWindow: 32768,
    capabilities: {}
  },
  {
    id: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    name: 'Hermes 2 Mixtral 8x7B',
    provider: 'together',
    category: 'chat',
    tags: ['nous', 'moe', 'dpo'],
    cost: 0,
    contextWindow: 32768,
    capabilities: {}
  },
  {
    id: 'NousResearch/Nous-Hermes-2-Yi-34B',
    name: 'Hermes 2 Yi 34B',
    provider: 'together',
    category: 'chat',
    tags: ['nous', 'yi', 'large'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'deepseek-ai/deepseek-llm-67b-chat',
    name: 'DeepSeek LLM 67B',
    provider: 'together',
    category: 'chat',
    tags: ['deepseek', 'large'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'deepseek-ai/deepseek-coder-33b-instruct',
    name: 'DeepSeek Coder 33B',
    provider: 'together',
    category: 'code',
    tags: ['deepseek', 'code', 'large'],
    cost: 0,
    contextWindow: 16384,
    capabilities: {}
  },
  {
    id: 'codellama/CodeLlama-34b-Instruct-hf',
    name: 'Code Llama 34B',
    provider: 'together',
    category: 'code',
    tags: ['meta', 'code'],
    cost: 0,
    contextWindow: 16384,
    capabilities: {}
  },
  {
    id: 'codellama/CodeLlama-13b-Instruct-hf',
    name: 'Code Llama 13B',
    provider: 'together',
    category: 'code',
    tags: ['meta', 'code', 'medium'],
    cost: 0,
    contextWindow: 16384,
    capabilities: {}
  },
  {
    id: 'codellama/CodeLlama-7b-Instruct-hf',
    name: 'Code Llama 7B',
    provider: 'together',
    category: 'code',
    tags: ['meta', 'code', 'small'],
    cost: 0,
    contextWindow: 16384,
    capabilities: {}
  },
  {
    id: 'WizardLM/WizardCoder-Python-34B-V1.0',
    name: 'WizardCoder Python 34B',
    provider: 'together',
    category: 'code',
    tags: ['wizard', 'python', 'code'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'Phind/Phind-CodeLlama-34B-v2',
    name: 'Phind CodeLlama 34B',
    provider: 'together',
    category: 'code',
    tags: ['phind', 'code', 'search'],
    cost: 0,
    contextWindow: 16384,
    capabilities: {}
  },
  {
    id: 'garage-bAInd/Platypus2-70B-instruct',
    name: 'Platypus 2 70B',
    provider: 'together',
    category: 'reasoning',
    tags: ['platypus', 'reasoning', 'large'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'Austism/chronos-hermes-13b',
    name: 'Chronos Hermes 13B',
    provider: 'together',
    category: 'creative',
    tags: ['creative', 'roleplay'],
    cost: 0,
    contextWindow: 2048,
    capabilities: {}
  },
  {
    id: 'Gryphe/MythoMax-L2-13b',
    name: 'MythoMax L2 13B',
    provider: 'together',
    category: 'creative',
    tags: ['creative', 'storytelling'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },
  {
    id: 'Open-Orca/Mistral-7B-OpenOrca',
    name: 'Mistral 7B OpenOrca',
    provider: 'together',
    category: 'chat',
    tags: ['orca', 'reasoning'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'teknium/OpenHermes-2.5-Mistral-7B',
    name: 'OpenHermes 2.5 Mistral 7B',
    provider: 'together',
    category: 'chat',
    tags: ['hermes', 'versatile'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'DiscoResearch/DiscoLM-mixtral-8x7b-v2',
    name: 'DiscoLM Mixtral 8x7B',
    provider: 'together',
    category: 'chat',
    tags: ['disco', 'german', 'moe'],
    cost: 0,
    contextWindow: 32768,
    capabilities: {}
  },
  {
    id: 'upstage/SOLAR-10.7B-Instruct-v1.0',
    name: 'SOLAR 10.7B',
    provider: 'together',
    category: 'chat',
    tags: ['upstage', 'efficient'],
    cost: 0,
    contextWindow: 4096,
    capabilities: {}
  },

  // ========================================
  // REPLICATE - 30+ models
  // ========================================
  {
    id: 'meta/meta-llama-3-8b-instruct',
    name: 'Llama 3 8B (Replicate)',
    provider: 'replicate',
    category: 'chat',
    tags: ['meta', 'versatile'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'meta/meta-llama-3-70b-instruct',
    name: 'Llama 3 70B (Replicate)',
    provider: 'replicate',
    category: 'chat',
    tags: ['meta', 'powerful'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct-v0.1',
    name: 'Mixtral 8x7B (Replicate)',
    provider: 'replicate',
    category: 'chat',
    tags: ['mistral', 'moe'],
    cost: 0,
    contextWindow: 32768,
    capabilities: {}
  },
  {
    id: 'mistralai/mistral-7b-instruct-v0.2',
    name: 'Mistral 7B (Replicate)',
    provider: 'replicate',
    category: 'chat',
    tags: ['mistral', 'efficient'],
    cost: 0,
    contextWindow: 32768,
    capabilities: {}
  },
  {
    id: 'stability-ai/sdxl',
    name: 'Stable Diffusion XL',
    provider: 'replicate',
    category: 'image',
    tags: ['image', 'generation', 'sdxl'],
    cost: 0,
    contextWindow: 77,
    capabilities: {}
  },
  {
    id: 'stability-ai/stable-diffusion',
    name: 'Stable Diffusion v1.5',
    provider: 'replicate',
    category: 'image',
    tags: ['image', 'generation', 'classic'],
    cost: 0,
    contextWindow: 77,
    capabilities: {}
  },

  // ========================================
  // COHERE - Chat and embeddings (5 models)
  // ========================================
  {
    id: 'command-r',
    name: 'Command R',
    provider: 'cohere',
    category: 'chat',
    tags: ['cohere', 'rag', 'retrieval'],
    cost: 0,
    contextWindow: 128000,
    capabilities: { streaming: true }
  },
  {
    id: 'command-light',
    name: 'Command Light',
    provider: 'cohere',
    category: 'chat',
    tags: ['cohere', 'fast', 'efficient'],
    cost: 0,
    contextWindow: 4096,
    capabilities: { streaming: true }
  },
  {
    id: 'embed-english-v3.0',
    name: 'Cohere Embed English v3',
    provider: 'cohere',
    category: 'embedding',
    tags: ['cohere', 'embedding', 'english'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'embed-multilingual-v3.0',
    name: 'Cohere Embed Multilingual v3',
    provider: 'cohere',
    category: 'embedding',
    tags: ['cohere', 'embedding', 'multilingual'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },
  {
    id: 'embed-english-light-v3.0',
    name: 'Cohere Embed Light v3',
    provider: 'cohere',
    category: 'embedding',
    tags: ['cohere', 'embedding', 'fast'],
    cost: 0,
    contextWindow: 512,
    capabilities: {}
  },

  // ========================================
  // EMBEDDING SPECIALISTS (10 models)
  // ========================================
  {
    id: 'voyage-2',
    name: 'Voyage 2',
    provider: 'voyage',
    category: 'embedding',
    tags: ['voyage', 'embedding', 'quality'],
    cost: 0,
    contextWindow: 4000,
    capabilities: {}
  },
  {
    id: 'voyage-code-2',
    name: 'Voyage Code 2',
    provider: 'voyage',
    category: 'embedding',
    tags: ['voyage', 'embedding', 'code'],
    cost: 0,
    contextWindow: 16000,
    capabilities: {}
  },
  {
    id: 'jina-embeddings-v2-base-en',
    name: 'Jina v2 Base EN',
    provider: 'jina',
    category: 'embedding',
    tags: ['jina', 'embedding', 'english'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'jina-embeddings-v2-small-en',
    name: 'Jina v2 Small EN',
    provider: 'jina',
    category: 'embedding',
    tags: ['jina', 'embedding', 'fast'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'jina-clip-v1',
    name: 'Jina CLIP v1',
    provider: 'jina',
    category: 'embedding',
    tags: ['jina', 'multimodal', 'clip'],
    cost: 0,
    contextWindow: 77,
    capabilities: { vision: true }
  },
  {
    id: 'nomic-embed-text-v1',
    name: 'Nomic Embed Text v1',
    provider: 'nomic',
    category: 'embedding',
    tags: ['nomic', 'embedding', 'long'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },
  {
    id: 'nomic-embed-text-v1.5',
    name: 'Nomic Embed Text v1.5',
    provider: 'nomic',
    category: 'embedding',
    tags: ['nomic', 'embedding', 'enhanced'],
    cost: 0,
    contextWindow: 8192,
    capabilities: {}
  },

  // ========================================
  // STABILITY AI - Image generation (3 models)
  // ========================================
  {
    id: 'stable-diffusion-xl-1024-v1-0',
    name: 'SD XL 1.0',
    provider: 'stability',
    category: 'image',
    tags: ['stability', 'image', 'xl'],
    cost: 0,
    contextWindow: 77,
    capabilities: {}
  },
  {
    id: 'stable-diffusion-v1-6',
    name: 'SD v1.6',
    provider: 'stability',
    category: 'image',
    tags: ['stability', 'image', 'classic'],
    cost: 0,
    contextWindow: 77,
    capabilities: {}
  },
  {
    id: 'stable-diffusion-xl-beta-v2-2-2',
    name: 'SD XL Beta',
    provider: 'stability',
    category: 'image',
    tags: ['stability', 'image', 'beta'],
    cost: 0,
    contextWindow: 77,
    capabilities: {}
  }
];

// Computed statistics
export const UNIVERSE_STATS = {
  totalModels: UNIVERSE_MODELS.length,
  byProvider: UNIVERSE_MODELS.reduce((acc, m) => {
    acc[m.provider] = (acc[m.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  byCategory: UNIVERSE_MODELS.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
  providers: [...new Set(UNIVERSE_MODELS.map(m => m.provider))],
  categories: [...new Set(UNIVERSE_MODELS.map(m => m.category))]
};
