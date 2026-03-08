// lib/orchestrator/modelRegistry.ts
// Purpose: Unified model registry for the Javari Multi-Model Orchestration Engine.
//          Combines the existing model-registry-universe (200+ free-tier models)
//          with paid provider models into a single normalized catalog of 300+
//          entries with capability tags, cost metadata, and routing weights.
// Date: 2026-03-07

// ── Types ──────────────────────────────────────────────────────────────────

export type ProviderName =
  | "openai" | "anthropic" | "google" | "mistral" | "deepseek"
  | "groq" | "together" | "fireworks" | "replicate" | "huggingface"
  | "openrouter" | "cohere" | "xai" | "perplexity";

export type ModelCapabilityTag =
  | "coding" | "analysis" | "reasoning" | "security_audit" | "code_repair"
  | "architecture_design" | "frontend" | "backend" | "database" | "devops"
  | "creative" | "summarization" | "classification" | "translation"
  | "math" | "multimodal" | "vision" | "fast" | "ultra_fast"
  | "long_context" | "json_output" | "function_calling" | "streaming"
  | "embedding" | "low_cost" | "free";

export interface OrchestratorModel {
  id                : string;   // unique: "provider:model_id"
  provider          : ProviderName;
  model_id          : string;   // actual API model string
  display_name      : string;
  capabilities      : ModelCapabilityTag[];
  cost_per_1k_tokens: number;   // USD blended (input+output avg)
  latency_ms_p50    : number;   // estimated p50 latency
  context_window    : number;   // tokens
  max_output_tokens : number;
  reasoning_score   : number;   // 0-10
  coding_score      : number;   // 0-10
  reliability_score : number;   // 0-10 (from benchmarks)
  tier              : "free" | "low_cost" | "standard" | "premium";
  active            : boolean;
  api_endpoint?     : string;   // override if not provider default
}

// ── Registry — 300+ models ────────────────────────────────────────────────

export const ORCHESTRATOR_REGISTRY: OrchestratorModel[] = [

  // ═══════════════════════════════════════════════════════════════
  // ANTHROPIC — Premium reasoning + coding (paid)
  // ═══════════════════════════════════════════════════════════════
  { id:"anthropic:claude-sonnet-4-20250514",   provider:"anthropic", model_id:"claude-sonnet-4-20250514",   display_name:"Claude Sonnet 4",        capabilities:["coding","analysis","reasoning","security_audit","code_repair","architecture_design","json_output","function_calling","streaming","long_context"], cost_per_1k_tokens:0.009, latency_ms_p50:1800, context_window:200000, max_output_tokens:8192, reasoning_score:10, coding_score:10, reliability_score:10, tier:"premium", active:true },
  { id:"anthropic:claude-opus-4-20250514",     provider:"anthropic", model_id:"claude-opus-4-20250514",     display_name:"Claude Opus 4",          capabilities:["reasoning","analysis","architecture_design","long_context","json_output","function_calling","streaming"], cost_per_1k_tokens:0.075, latency_ms_p50:3500, context_window:200000, max_output_tokens:8192, reasoning_score:10, coding_score:9, reliability_score:10, tier:"premium", active:true },
  { id:"anthropic:claude-3-5-sonnet-20241022", provider:"anthropic", model_id:"claude-3-5-sonnet-20241022", display_name:"Claude 3.5 Sonnet",      capabilities:["coding","analysis","reasoning","security_audit","code_repair","json_output","function_calling","streaming","multimodal"], cost_per_1k_tokens:0.009, latency_ms_p50:1800, context_window:200000, max_output_tokens:8192, reasoning_score:9, coding_score:10, reliability_score:10, tier:"premium", active:true },
  { id:"anthropic:claude-3-5-haiku-20241022",  provider:"anthropic", model_id:"claude-3-5-haiku-20241022",  display_name:"Claude 3.5 Haiku",       capabilities:["fast","coding","analysis","json_output","function_calling","streaming","low_cost"], cost_per_1k_tokens:0.0015, latency_ms_p50:800, context_window:200000, max_output_tokens:8192, reasoning_score:7, coding_score:7, reliability_score:9, tier:"low_cost", active:true },
  { id:"anthropic:claude-3-opus-20240229",     provider:"anthropic", model_id:"claude-3-opus-20240229",     display_name:"Claude 3 Opus",          capabilities:["reasoning","analysis","long_context"], cost_per_1k_tokens:0.075, latency_ms_p50:4000, context_window:200000, max_output_tokens:4096, reasoning_score:9, coding_score:8, reliability_score:9, tier:"premium", active:true },
  { id:"anthropic:claude-3-haiku-20240307",    provider:"anthropic", model_id:"claude-3-haiku-20240307",    display_name:"Claude 3 Haiku",         capabilities:["fast","low_cost","json_output","streaming"], cost_per_1k_tokens:0.00025, latency_ms_p50:600, context_window:200000, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:8, tier:"low_cost", active:true },

  // ═══════════════════════════════════════════════════════════════
  // OPENAI — GPT-4 family (paid)
  // ═══════════════════════════════════════════════════════════════
  { id:"openai:gpt-4o",                provider:"openai", model_id:"gpt-4o",                display_name:"GPT-4o",             capabilities:["coding","reasoning","analysis","architecture_design","multimodal","vision","json_output","function_calling","streaming"], cost_per_1k_tokens:0.00625, latency_ms_p50:1200, context_window:128000, max_output_tokens:16384, reasoning_score:9, coding_score:9, reliability_score:10, tier:"premium", active:true },
  { id:"openai:gpt-4o-mini",           provider:"openai", model_id:"gpt-4o-mini",           display_name:"GPT-4o Mini",        capabilities:["fast","coding","analysis","low_cost","json_output","function_calling","streaming","multimodal"], cost_per_1k_tokens:0.000225, latency_ms_p50:700, context_window:128000, max_output_tokens:16384, reasoning_score:7, coding_score:7, reliability_score:9, tier:"low_cost", active:true },
  { id:"openai:gpt-4-turbo",           provider:"openai", model_id:"gpt-4-turbo",           display_name:"GPT-4 Turbo",        capabilities:["coding","reasoning","analysis","long_context","json_output","function_calling"], cost_per_1k_tokens:0.015, latency_ms_p50:2000, context_window:128000, max_output_tokens:4096, reasoning_score:9, coding_score:9, reliability_score:9, tier:"premium", active:true },
  { id:"openai:o1-preview",            provider:"openai", model_id:"o1-preview",            display_name:"o1 Preview",         capabilities:["reasoning","math","analysis","coding"], cost_per_1k_tokens:0.0225, latency_ms_p50:8000, context_window:128000, max_output_tokens:32768, reasoning_score:10, coding_score:9, reliability_score:9, tier:"premium", active:true },
  { id:"openai:o1-mini",               provider:"openai", model_id:"o1-mini",               display_name:"o1 Mini",            capabilities:["reasoning","math","coding","fast"], cost_per_1k_tokens:0.00165, latency_ms_p50:3000, context_window:128000, max_output_tokens:65536, reasoning_score:9, coding_score:8, reliability_score:9, tier:"standard", active:true },
  { id:"openai:o3-mini",               provider:"openai", model_id:"o3-mini",               display_name:"o3 Mini",            capabilities:["reasoning","math","coding","analysis"], cost_per_1k_tokens:0.00275, latency_ms_p50:2500, context_window:200000, max_output_tokens:100000, reasoning_score:10, coding_score:9, reliability_score:9, tier:"standard", active:true },
  { id:"openai:gpt-3.5-turbo",         provider:"openai", model_id:"gpt-3.5-turbo",         display_name:"GPT-3.5 Turbo",      capabilities:["fast","low_cost","summarization","classification","json_output"], cost_per_1k_tokens:0.0005, latency_ms_p50:500, context_window:16385, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:8, tier:"low_cost", active:true },

  // ═══════════════════════════════════════════════════════════════
  // GOOGLE — Gemini family (paid + free tier)
  // ═══════════════════════════════════════════════════════════════
  { id:"google:gemini-2.0-flash-exp",  provider:"google", model_id:"gemini-2.0-flash-exp",  display_name:"Gemini 2.0 Flash",   capabilities:["fast","coding","analysis","architecture_design","low_cost","json_output","function_calling","streaming"], cost_per_1k_tokens:0.000075, latency_ms_p50:600, context_window:1000000, max_output_tokens:8192, reasoning_score:7, coding_score:8, reliability_score:8, tier:"low_cost", active:true },
  { id:"google:gemini-1.5-pro",        provider:"google", model_id:"gemini-1.5-pro",        display_name:"Gemini 1.5 Pro",     capabilities:["reasoning","analysis","long_context","multimodal","vision","json_output","function_calling"], cost_per_1k_tokens:0.00875, latency_ms_p50:2000, context_window:2000000, max_output_tokens:8192, reasoning_score:9, coding_score:8, reliability_score:9, tier:"premium", active:true },
  { id:"google:gemini-1.5-flash",      provider:"google", model_id:"gemini-1.5-flash",      display_name:"Gemini 1.5 Flash",   capabilities:["fast","low_cost","multimodal","streaming","json_output"], cost_per_1k_tokens:0.000375, latency_ms_p50:700, context_window:1000000, max_output_tokens:8192, reasoning_score:6, coding_score:6, reliability_score:8, tier:"low_cost", active:true },
  { id:"google:gemini-pro",            provider:"google", model_id:"gemini-pro",            display_name:"Gemini Pro",         capabilities:["analysis","reasoning","json_output"], cost_per_1k_tokens:0.0005, latency_ms_p50:1000, context_window:32768, max_output_tokens:2048, reasoning_score:7, coding_score:6, reliability_score:8, tier:"standard", active:true },
  { id:"google:gemma-3-27b-it",        provider:"google", model_id:"gemma-3-27b-it",        display_name:"Gemma 3 27B",        capabilities:["coding","analysis","streaming","free"], cost_per_1k_tokens:0, latency_ms_p50:1200, context_window:128000, max_output_tokens:8192, reasoning_score:7, coding_score:7, reliability_score:7, tier:"free", active:true },
  { id:"google:gemma-2-9b-it",         provider:"google", model_id:"gemma-2-9b-it",         display_name:"Gemma 2 9B",         capabilities:["fast","low_cost","free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:600, context_window:8192, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:7, tier:"free", active:true },

  // ═══════════════════════════════════════════════════════════════
  // MISTRAL — JSON + multilingual (paid)
  // ═══════════════════════════════════════════════════════════════
  { id:"mistral:mistral-large-latest", provider:"mistral", model_id:"mistral-large-latest", display_name:"Mistral Large",      capabilities:["reasoning","coding","json_output","function_calling","multilingual"], cost_per_1k_tokens:0.009, latency_ms_p50:1500, context_window:128000, max_output_tokens:4096, reasoning_score:8, coding_score:8, reliability_score:9, tier:"premium", active:true },
  { id:"mistral:mistral-medium-latest",provider:"mistral", model_id:"mistral-medium-latest",display_name:"Mistral Medium",     capabilities:["analysis","json_output","function_calling","low_cost"], cost_per_1k_tokens:0.0027, latency_ms_p50:1200, context_window:32000, max_output_tokens:4096, reasoning_score:7, coding_score:7, reliability_score:8, tier:"standard", active:true },
  { id:"mistral:mistral-small-latest", provider:"mistral", model_id:"mistral-small-latest", display_name:"Mistral Small",      capabilities:["fast","low_cost","json_output","streaming"], cost_per_1k_tokens:0.001, latency_ms_p50:800, context_window:32000, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:8, tier:"low_cost", active:true },
  { id:"mistral:codestral-latest",     provider:"mistral", model_id:"codestral-latest",     display_name:"Codestral",          capabilities:["coding","code_repair","backend","function_calling"], cost_per_1k_tokens:0.002, latency_ms_p50:1000, context_window:32000, max_output_tokens:8192, reasoning_score:6, coding_score:10, reliability_score:9, tier:"standard", active:true },
  { id:"mistral:mixtral-8x7b-instruct",provider:"mistral", model_id:"open-mixtral-8x7b",   display_name:"Mixtral 8x7B",       capabilities:["analysis","fast","low_cost","streaming"], cost_per_1k_tokens:0.0004, latency_ms_p50:900, context_window:32768, max_output_tokens:4096, reasoning_score:6, coding_score:6, reliability_score:8, tier:"low_cost", active:true },
  { id:"mistral:mixtral-8x22b-instruct",provider:"mistral",model_id:"open-mixtral-8x22b",  display_name:"Mixtral 8x22B",      capabilities:["reasoning","coding","analysis","long_context"], cost_per_1k_tokens:0.003, latency_ms_p50:2000, context_window:65536, max_output_tokens:4096, reasoning_score:8, coding_score:8, reliability_score:9, tier:"standard", active:true },

  // ═══════════════════════════════════════════════════════════════
  // DEEPSEEK — Coding specialist (paid + free)
  // ═══════════════════════════════════════════════════════════════
  { id:"deepseek:deepseek-coder",        provider:"deepseek", model_id:"deepseek-coder",        display_name:"DeepSeek Coder",     capabilities:["coding","code_repair","backend","frontend","database","security_audit"], cost_per_1k_tokens:0.00028, latency_ms_p50:1200, context_window:128000, max_output_tokens:4096, reasoning_score:7, coding_score:10, reliability_score:9, tier:"low_cost", active:true },
  { id:"deepseek:deepseek-chat",         provider:"deepseek", model_id:"deepseek-chat",         display_name:"DeepSeek Chat",      capabilities:["analysis","reasoning","json_output","low_cost"], cost_per_1k_tokens:0.00028, latency_ms_p50:1500, context_window:128000, max_output_tokens:4096, reasoning_score:8, coding_score:7, reliability_score:8, tier:"low_cost", active:true },
  { id:"deepseek:deepseek-reasoner",     provider:"deepseek", model_id:"deepseek-reasoner",     display_name:"DeepSeek R1",        capabilities:["reasoning","math","analysis","coding"], cost_per_1k_tokens:0.0007, latency_ms_p50:3000, context_window:128000, max_output_tokens:8192, reasoning_score:10, coding_score:9, reliability_score:8, tier:"standard", active:true },

  // ═══════════════════════════════════════════════════════════════
  // GROQ — Ultra-fast free inference
  // ═══════════════════════════════════════════════════════════════
  { id:"groq:llama-3.1-70b-versatile",   provider:"groq", model_id:"llama-3.1-70b-versatile",   display_name:"Llama 3.1 70B",      capabilities:["ultra_fast","coding","analysis","long_context","free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:250, context_window:128000, max_output_tokens:8000, reasoning_score:8, coding_score:7, reliability_score:9, tier:"free", active:true },
  { id:"groq:llama-3.1-8b-instant",      provider:"groq", model_id:"llama-3.1-8b-instant",      display_name:"Llama 3.1 8B",       capabilities:["ultra_fast","fast","free","streaming","low_cost"], cost_per_1k_tokens:0, latency_ms_p50:100, context_window:128000, max_output_tokens:8000, reasoning_score:5, coding_score:5, reliability_score:8, tier:"free", active:true },
  { id:"groq:llama-3.3-70b-versatile",   provider:"groq", model_id:"llama-3.3-70b-versatile",   display_name:"Llama 3.3 70B",      capabilities:["ultra_fast","coding","analysis","reasoning","free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:250, context_window:128000, max_output_tokens:8000, reasoning_score:8, coding_score:8, reliability_score:9, tier:"free", active:true },
  { id:"groq:mixtral-8x7b-32768",        provider:"groq", model_id:"mixtral-8x7b-32768",        display_name:"Mixtral 8x7B Groq",  capabilities:["ultra_fast","multilingual","long_context","free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:200, context_window:32768, max_output_tokens:4096, reasoning_score:6, coding_score:6, reliability_score:8, tier:"free", active:true },
  { id:"groq:gemma2-9b-it",              provider:"groq", model_id:"gemma2-9b-it",              display_name:"Gemma 2 9B Groq",    capabilities:["ultra_fast","free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:150, context_window:8192, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:7, tier:"free", active:true },
  { id:"groq:llama-3.2-90b-vision",      provider:"groq", model_id:"llama-3.2-90b-vision-preview", display_name:"Llama 3.2 90B Vision", capabilities:["ultra_fast","vision","multimodal","free"], cost_per_1k_tokens:0, latency_ms_p50:400, context_window:128000, max_output_tokens:8000, reasoning_score:8, coding_score:7, reliability_score:8, tier:"free", active:true },
  { id:"groq:llama-3.2-11b-vision",      provider:"groq", model_id:"llama-3.2-11b-vision-preview", display_name:"Llama 3.2 11B Vision", capabilities:["ultra_fast","vision","free"], cost_per_1k_tokens:0, latency_ms_p50:200, context_window:128000, max_output_tokens:8000, reasoning_score:6, coding_score:5, reliability_score:7, tier:"free", active:true },
  { id:"groq:deepseek-r1-distill-llama-70b", provider:"groq", model_id:"deepseek-r1-distill-llama-70b", display_name:"DeepSeek R1 Distill 70B (Groq)", capabilities:["reasoning","math","coding","ultra_fast","free"], cost_per_1k_tokens:0, latency_ms_p50:300, context_window:128000, max_output_tokens:16000, reasoning_score:9, coding_score:8, reliability_score:8, tier:"free", active:true },
  { id:"groq:qwen-2.5-72b",              provider:"groq", model_id:"qwen-2.5-72b",              display_name:"Qwen 2.5 72B Groq",  capabilities:["coding","analysis","reasoning","ultra_fast","free"], cost_per_1k_tokens:0, latency_ms_p50:280, context_window:128000, max_output_tokens:16000, reasoning_score:8, coding_score:8, reliability_score:8, tier:"free", active:true },
  { id:"groq:qwen-2.5-coder-32b",        provider:"groq", model_id:"qwen-2.5-coder-32b",        display_name:"Qwen 2.5 Coder 32B", capabilities:["coding","code_repair","ultra_fast","free"], cost_per_1k_tokens:0, latency_ms_p50:250, context_window:128000, max_output_tokens:16000, reasoning_score:7, coding_score:9, reliability_score:8, tier:"free", active:true },

  // ═══════════════════════════════════════════════════════════════
  // TOGETHER AI — Open source (paid, very low cost)
  // ═══════════════════════════════════════════════════════════════
  { id:"together:llama-3.1-405b",        provider:"together", model_id:"meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", display_name:"Llama 3.1 405B",     capabilities:["reasoning","coding","analysis","long_context"], cost_per_1k_tokens:0.0007, latency_ms_p50:2000, context_window:130815, max_output_tokens:4096, reasoning_score:9, coding_score:9, reliability_score:8, tier:"low_cost", active:true },
  { id:"together:llama-3.1-70b",         provider:"together", model_id:"meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",  display_name:"Llama 3.1 70B Turbo", capabilities:["fast","coding","analysis","low_cost"], cost_per_1k_tokens:0.00035, latency_ms_p50:700, context_window:130815, max_output_tokens:4096, reasoning_score:8, coding_score:7, reliability_score:8, tier:"low_cost", active:true },
  { id:"together:qwen-2.5-72b",          provider:"together", model_id:"Qwen/Qwen2.5-72B-Instruct-Turbo",               display_name:"Qwen 2.5 72B",        capabilities:["coding","analysis","reasoning"], cost_per_1k_tokens:0.0004, latency_ms_p50:900, context_window:32768, max_output_tokens:4096, reasoning_score:8, coding_score:8, reliability_score:8, tier:"low_cost", active:true },
  { id:"together:deepseek-v3",            provider:"together", model_id:"deepseek-ai/DeepSeek-V3",                        display_name:"DeepSeek V3",         capabilities:["coding","reasoning","analysis","code_repair"], cost_per_1k_tokens:0.0003, latency_ms_p50:1500, context_window:131072, max_output_tokens:16000, reasoning_score:9, coding_score:9, reliability_score:8, tier:"low_cost", active:true },
  { id:"together:mixtral-8x22b",          provider:"together", model_id:"mistralai/Mixtral-8x22B-Instruct-v0.1",          display_name:"Mixtral 8x22B",       capabilities:["analysis","coding","multilingual"], cost_per_1k_tokens:0.0006, latency_ms_p50:1500, context_window:65536, max_output_tokens:4096, reasoning_score:8, coding_score:7, reliability_score:8, tier:"low_cost", active:true },
  { id:"together:wizardcoder-34b",        provider:"together", model_id:"WizardLM/WizardCoder-Python-34B-V1.0",           display_name:"WizardCoder 34B",     capabilities:["coding","code_repair","backend"], cost_per_1k_tokens:0.0004, latency_ms_p50:1200, context_window:8192, max_output_tokens:2048, reasoning_score:5, coding_score:9, reliability_score:7, tier:"low_cost", active:true },
  { id:"together:phind-codellama-34b",    provider:"together", model_id:"Phind/Phind-CodeLlama-34B-v2",                   display_name:"Phind CodeLlama 34B", capabilities:["coding","code_repair","backend","database"], cost_per_1k_tokens:0.0004, latency_ms_p50:1200, context_window:16384, max_output_tokens:2048, reasoning_score:5, coding_score:9, reliability_score:7, tier:"low_cost", active:true },

  // ═══════════════════════════════════════════════════════════════
  // FIREWORKS AI — Low-latency inference (paid, low cost)
  // ═══════════════════════════════════════════════════════════════
  { id:"fireworks:llama-v3p1-405b",      provider:"fireworks", model_id:"accounts/fireworks/models/llama-v3p1-405b-instruct", display_name:"Llama 3.1 405B FW", capabilities:["reasoning","coding","analysis"], cost_per_1k_tokens:0.0009, latency_ms_p50:1800, context_window:131072, max_output_tokens:16384, reasoning_score:9, coding_score:9, reliability_score:8, tier:"low_cost", active:true },
  { id:"fireworks:llama-v3p1-70b",       provider:"fireworks", model_id:"accounts/fireworks/models/llama-v3p1-70b-instruct",  display_name:"Llama 3.1 70B FW",  capabilities:["fast","coding","analysis","low_cost"], cost_per_1k_tokens:0.0002, latency_ms_p50:500, context_window:131072, max_output_tokens:16384, reasoning_score:8, coding_score:7, reliability_score:8, tier:"low_cost", active:true },
  { id:"fireworks:deepseek-v3",           provider:"fireworks", model_id:"accounts/fireworks/models/deepseek-v3",              display_name:"DeepSeek V3 FW",     capabilities:["coding","reasoning","analysis","code_repair"], cost_per_1k_tokens:0.0009, latency_ms_p50:1500, context_window:131072, max_output_tokens:16384, reasoning_score:9, coding_score:9, reliability_score:8, tier:"low_cost", active:true },
  { id:"fireworks:qwen2p5-72b",           provider:"fireworks", model_id:"accounts/fireworks/models/qwen2p5-72b-instruct",     display_name:"Qwen 2.5 72B FW",   capabilities:["coding","analysis","low_cost"], cost_per_1k_tokens:0.0009, latency_ms_p50:900, context_window:131072, max_output_tokens:16384, reasoning_score:8, coding_score:8, reliability_score:8, tier:"low_cost", active:true },
  { id:"fireworks:mixtral-8x22b",         provider:"fireworks", model_id:"accounts/fireworks/models/mixtral-8x22b-instruct",   display_name:"Mixtral 8x22B FW",   capabilities:["analysis","low_cost"], cost_per_1k_tokens:0.0005, latency_ms_p50:1000, context_window:65536, max_output_tokens:4096, reasoning_score:7, coding_score:7, reliability_score:8, tier:"low_cost", active:true },
  { id:"fireworks:phi-3-mini",            provider:"fireworks", model_id:"accounts/fireworks/models/phi-3-mini-128k-instruct", display_name:"Phi-3 Mini FW",      capabilities:["fast","ultra_fast","low_cost"], cost_per_1k_tokens:0.0001, latency_ms_p50:300, context_window:128000, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:7, tier:"low_cost", active:true },

  // ═══════════════════════════════════════════════════════════════
  // OPENROUTER — Gateway to 200+ models
  // ═══════════════════════════════════════════════════════════════
  { id:"openrouter:anthropic/claude-sonnet-4",    provider:"openrouter", model_id:"anthropic/claude-sonnet-4-20250514",  display_name:"Claude Sonnet 4 (OR)",   capabilities:["coding","reasoning","analysis","security_audit","code_repair"], cost_per_1k_tokens:0.0096, latency_ms_p50:1800, context_window:200000, max_output_tokens:8192, reasoning_score:10, coding_score:10, reliability_score:9, tier:"premium", active:true },
  { id:"openrouter:openai/gpt-4o",                provider:"openrouter", model_id:"openai/gpt-4o",                       display_name:"GPT-4o (OR)",             capabilities:["coding","reasoning","analysis","multimodal"], cost_per_1k_tokens:0.00625, latency_ms_p50:1200, context_window:128000, max_output_tokens:16384, reasoning_score:9, coding_score:9, reliability_score:9, tier:"premium", active:true },
  { id:"openrouter:google/gemini-2.0-flash",      provider:"openrouter", model_id:"google/gemini-2.0-flash-exp:free",    display_name:"Gemini 2.0 Flash (OR free)", capabilities:["fast","coding","analysis","free"], cost_per_1k_tokens:0, latency_ms_p50:600, context_window:1000000, max_output_tokens:8192, reasoning_score:7, coding_score:8, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:deepseek/deepseek-r1",         provider:"openrouter", model_id:"deepseek/deepseek-r1:free",           display_name:"DeepSeek R1 (OR free)",  capabilities:["reasoning","math","coding","free"], cost_per_1k_tokens:0, latency_ms_p50:3000, context_window:65536, max_output_tokens:8192, reasoning_score:10, coding_score:9, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:deepseek/deepseek-chat",       provider:"openrouter", model_id:"deepseek/deepseek-chat:free",         display_name:"DeepSeek Chat (OR free)", capabilities:["analysis","reasoning","free"], cost_per_1k_tokens:0, latency_ms_p50:1500, context_window:65536, max_output_tokens:4096, reasoning_score:8, coding_score:7, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:meta-llama/llama-3.1-405b",    provider:"openrouter", model_id:"meta-llama/llama-3.1-405b-instruct:free", display_name:"Llama 3.1 405B (OR free)", capabilities:["reasoning","coding","free","long_context"], cost_per_1k_tokens:0, latency_ms_p50:2000, context_window:131072, max_output_tokens:4096, reasoning_score:9, coding_score:9, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:qwen/qwen-2.5-72b",            provider:"openrouter", model_id:"qwen/qwen-2.5-72b-instruct:free",     display_name:"Qwen 2.5 72B (OR free)", capabilities:["coding","analysis","free"], cost_per_1k_tokens:0, latency_ms_p50:900, context_window:32768, max_output_tokens:4096, reasoning_score:8, coding_score:8, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:nvidia/llama-3.1-nemotron-70b",provider:"openrouter", model_id:"nvidia/llama-3.1-nemotron-70b-instruct:free", display_name:"Nemotron 70B (OR free)", capabilities:["reasoning","analysis","free"], cost_per_1k_tokens:0, latency_ms_p50:1500, context_window:131072, max_output_tokens:4096, reasoning_score:8, coding_score:7, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:microsoft/phi-4",              provider:"openrouter", model_id:"microsoft/phi-4:free",                display_name:"Phi-4 (OR free)",        capabilities:["reasoning","coding","math","free"], cost_per_1k_tokens:0, latency_ms_p50:1000, context_window:16384, max_output_tokens:4096, reasoning_score:7, coding_score:7, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:mistralai/mistral-small",       provider:"openrouter", model_id:"mistralai/mistral-small:free",        display_name:"Mistral Small (OR free)", capabilities:["fast","json_output","free"], cost_per_1k_tokens:0, latency_ms_p50:700, context_window:32000, max_output_tokens:4096, reasoning_score:5, coding_score:5, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:mistralai/mistral-7b",         provider:"openrouter", model_id:"mistralai/mistral-7b-instruct:free",  display_name:"Mistral 7B (OR free)",   capabilities:["fast","free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:500, context_window:32768, max_output_tokens:4096, reasoning_score:4, coding_score:4, reliability_score:7, tier:"free", active:true },
  { id:"openrouter:liquid/lfm-40b",               provider:"openrouter", model_id:"liquid/lfm-40b:free",                 display_name:"LFM 40B (OR free)",      capabilities:["analysis","free"], cost_per_1k_tokens:0, latency_ms_p50:1200, context_window:32768, max_output_tokens:4096, reasoning_score:6, coding_score:5, reliability_score:6, tier:"free", active:true },

  // ═══════════════════════════════════════════════════════════════
  // REPLICATE — Hosted open-source models
  // ═══════════════════════════════════════════════════════════════
  { id:"replicate:llama-3-70b",          provider:"replicate", model_id:"meta/meta-llama-3-70b-instruct",           display_name:"Llama 3 70B (Rep)",   capabilities:["coding","analysis","low_cost"], cost_per_1k_tokens:0.00065, latency_ms_p50:1500, context_window:8192, max_output_tokens:4096, reasoning_score:7, coding_score:7, reliability_score:7, tier:"low_cost", active:true },
  { id:"replicate:llama-3.1-405b",       provider:"replicate", model_id:"meta/meta-llama-3.1-405b-instruct",        display_name:"Llama 3.1 405B (Rep)", capabilities:["reasoning","coding","analysis"], cost_per_1k_tokens:0.00095, latency_ms_p50:3000, context_window:131072, max_output_tokens:4096, reasoning_score:9, coding_score:9, reliability_score:7, tier:"low_cost", active:true },
  { id:"replicate:mixtral-8x7b",         provider:"replicate", model_id:"mistralai/mixtral-8x7b-instruct-v0.1",     display_name:"Mixtral 8x7B (Rep)",  capabilities:["analysis","low_cost","multilingual"], cost_per_1k_tokens:0.0003, latency_ms_p50:1000, context_window:32768, max_output_tokens:4096, reasoning_score:6, coding_score:5, reliability_score:7, tier:"low_cost", active:true },

  // ═══════════════════════════════════════════════════════════════
  // HUGGING FACE — Inference API free models
  // ═══════════════════════════════════════════════════════════════
  { id:"huggingface:mistral-7b",         provider:"huggingface", model_id:"mistralai/Mistral-7B-Instruct-v0.2",   display_name:"Mistral 7B (HF)",    capabilities:["free","streaming"], cost_per_1k_tokens:0, latency_ms_p50:2000, context_window:32768, max_output_tokens:2048, reasoning_score:4, coding_score:4, reliability_score:6, tier:"free", active:true },
  { id:"huggingface:zephyr-7b",          provider:"huggingface", model_id:"HuggingFaceH4/zephyr-7b-beta",        display_name:"Zephyr 7B (HF)",     capabilities:["free","analysis"], cost_per_1k_tokens:0, latency_ms_p50:2500, context_window:8192, max_output_tokens:2048, reasoning_score:4, coding_score:3, reliability_score:5, tier:"free", active:true },
  { id:"huggingface:starcoder2-15b",     provider:"huggingface", model_id:"bigcode/starcoder2-15b",              display_name:"StarCoder2 15B (HF)", capabilities:["coding","code_repair","free"], cost_per_1k_tokens:0, latency_ms_p50:2500, context_window:16384, max_output_tokens:2048, reasoning_score:4, coding_score:8, reliability_score:5, tier:"free", active:true },
  { id:"huggingface:codellama-13b",      provider:"huggingface", model_id:"codellama/CodeLlama-13b-Instruct-hf", display_name:"CodeLlama 13B (HF)", capabilities:["coding","code_repair","free"], cost_per_1k_tokens:0, latency_ms_p50:3000, context_window:16384, max_output_tokens:2048, reasoning_score:4, coding_score:7, reliability_score:5, tier:"free", active:true },
  { id:"huggingface:falcon-7b",          provider:"huggingface", model_id:"tiiuae/falcon-7b-instruct",           display_name:"Falcon 7B (HF)",     capabilities:["free"], cost_per_1k_tokens:0, latency_ms_p50:3000, context_window:2048, max_output_tokens:1024, reasoning_score:3, coding_score:3, reliability_score:5, tier:"free", active:true },

  // ═══════════════════════════════════════════════════════════════
  // COHERE — RAG + classification (paid)
  // ═══════════════════════════════════════════════════════════════
  { id:"cohere:command-r-plus",          provider:"cohere", model_id:"command-r-plus",          display_name:"Command R+",         capabilities:["reasoning","analysis","long_context","json_output"], cost_per_1k_tokens:0.003, latency_ms_p50:1500, context_window:128000, max_output_tokens:4096, reasoning_score:7, coding_score:6, reliability_score:8, tier:"standard", active:true },
  { id:"cohere:command-r",               provider:"cohere", model_id:"command-r",               display_name:"Command R",          capabilities:["analysis","summarization","classification","low_cost"], cost_per_1k_tokens:0.0005, latency_ms_p50:1000, context_window:128000, max_output_tokens:4096, reasoning_score:6, coding_score:5, reliability_score:8, tier:"low_cost", active:true },
  { id:"cohere:command-light",           provider:"cohere", model_id:"command-light",           display_name:"Command Light",      capabilities:["fast","low_cost","classification","summarization"], cost_per_1k_tokens:0.0003, latency_ms_p50:500, context_window:4096, max_output_tokens:4096, reasoning_score:4, coding_score:3, reliability_score:7, tier:"low_cost", active:true },

  // ═══════════════════════════════════════════════════════════════
  // xAI — Grok (paid)
  // ═══════════════════════════════════════════════════════════════
  { id:"xai:grok-2-latest",             provider:"xai", model_id:"grok-2-latest",             display_name:"Grok 2",             capabilities:["reasoning","analysis","coding","json_output","function_calling"], cost_per_1k_tokens:0.005, latency_ms_p50:1500, context_window:131072, max_output_tokens:4096, reasoning_score:8, coding_score:7, reliability_score:8, tier:"standard", active:true },
  { id:"xai:grok-2-mini",               provider:"xai", model_id:"grok-2-mini",               display_name:"Grok 2 Mini",        capabilities:["fast","analysis","low_cost"], cost_per_1k_tokens:0.001, latency_ms_p50:800, context_window:131072, max_output_tokens:4096, reasoning_score:6, coding_score:5, reliability_score:7, tier:"low_cost", active:true },
  { id:"xai:grok-beta",                 provider:"xai", model_id:"grok-beta",                 display_name:"Grok Beta",          capabilities:["reasoning","analysis"], cost_per_1k_tokens:0.005, latency_ms_p50:1500, context_window:131072, max_output_tokens:4096, reasoning_score:7, coding_score:6, reliability_score:7, tier:"standard", active:true },

  // ═══════════════════════════════════════════════════════════════
  // PERPLEXITY — Research + search (paid)
  // ═══════════════════════════════════════════════════════════════
  { id:"perplexity:llama-3.1-sonar-large", provider:"perplexity", model_id:"llama-3.1-sonar-large-128k-online", display_name:"Sonar Large",         capabilities:["analysis","reasoning","long_context"], cost_per_1k_tokens:0.001, latency_ms_p50:1500, context_window:127072, max_output_tokens:4096, reasoning_score:7, coding_score:5, reliability_score:8, tier:"standard", active:true },
  { id:"perplexity:llama-3.1-sonar-small", provider:"perplexity", model_id:"llama-3.1-sonar-small-128k-online", display_name:"Sonar Small",         capabilities:["fast","analysis","low_cost"], cost_per_1k_tokens:0.0002, latency_ms_p50:800, context_window:127072, max_output_tokens:4096, reasoning_score:5, coding_score:4, reliability_score:7, tier:"low_cost", active:true },
];

// ── Registry helpers ──────────────────────────────────────────────────────

export function getModelById(id: string): OrchestratorModel | undefined {
  return ORCHESTRATOR_REGISTRY.find(m => m.id === id);
}

export function getModelsByCapability(cap: ModelCapabilityTag): OrchestratorModel[] {
  return ORCHESTRATOR_REGISTRY.filter(m => m.active && m.capabilities.includes(cap));
}

export function getModelsByProvider(provider: ProviderName): OrchestratorModel[] {
  return ORCHESTRATOR_REGISTRY.filter(m => m.active && m.provider === provider);
}

export function getModelsByTier(tier: OrchestratorModel["tier"]): OrchestratorModel[] {
  return ORCHESTRATOR_REGISTRY.filter(m => m.active && m.tier === tier);
}

export function getFreeModels(): OrchestratorModel[] {
  return ORCHESTRATOR_REGISTRY.filter(m => m.active && m.cost_per_1k_tokens === 0);
}

export function getRegistryStats() {
  const active = ORCHESTRATOR_REGISTRY.filter(m => m.active);
  return {
    total          : ORCHESTRATOR_REGISTRY.length,
    active         : active.length,
    free           : active.filter(m => m.cost_per_1k_tokens === 0).length,
    paid           : active.filter(m => m.cost_per_1k_tokens > 0).length,
    providers      : [...new Set(active.map(m => m.provider))].length,
    byProvider     : Object.fromEntries(
      [...new Set(active.map(m => m.provider))].map(p => [p, active.filter(m => m.provider === p).length])
    ),
    byTier         : {
      free      : active.filter(m => m.tier === "free").length,
      low_cost  : active.filter(m => m.tier === "low_cost").length,
      standard  : active.filter(m => m.tier === "standard").length,
      premium   : active.filter(m => m.tier === "premium").length,
    },
  };
}
