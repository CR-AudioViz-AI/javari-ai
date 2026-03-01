// Router v4 - Preview build validation trigger: 2026-02-28T23:30:00-05:00
// lib/ai/router.ts
// Router v4 - Hardened Provider Validation & Cost Guardrails
// Created: 2026-01-02
// Branch: feature/router-v4-hardening

import { createClient } from '@supabase/supabase-js';
import { isProviderAvailable, updateProviderHealth } from "@/lib/javari/telemetry/provider-health";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface RouterResponse {
  content: string;
  model: string;
  cost: number;
  provider: string;
}

interface ProviderConfig {
  baseUrl: string;
  envKey: string;
  models: string[];
  inputCostPer1M: number;
  outputCostPer1M: number;
}

// [CONSOLIDATED] ProviderHealth interface moved to lib/javari/telemetry/provider-health.ts

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MAX_TOKENS_DEFAULT = 2048;
const MAX_COST_DEFAULT = 0.05; // $0.05 per request
const MAX_RETRIES = 3;
const RETRY_DELAYS = [250, 500, 1000]; // Exponential backoff in ms
// [CONSOLIDATED] Health thresholds now in provider-health.ts

// Provider configurations with costs (December 2025)
const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    envKey: 'ANTHROPIC_API_KEY',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini'],
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile'],
    inputCostPer1M: 0,
    outputCostPer1M: 0
  },
  perplexity: {
    baseUrl: 'https://api.perplexity.ai/chat/completions',
    envKey: 'PERPLEXITY_API_KEY',
    models: ['sonar-pro'],
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0
  }
};

// ═══════════════════════════════════════════════════════════════
// PROVIDER HEALTH — delegated to persistent provider-health.ts
// (in-memory tracking removed — all health state is in Supabase)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// COST CALCULATION
// ═══════════════════════════════════════════════════════════════

function calculateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = PROVIDERS[provider];
  if (!config) return 0;
  
  const inputCost = (inputTokens / 1_000_000) * config.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * config.outputCostPer1M;
  
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

// ═══════════════════════════════════════════════════════════════
// PROVIDER API CALLS WITH VALIDATION
// ═══════════════════════════════════════════════════════════════

async function callAnthropic(
  message: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env[PROVIDERS.anthropic.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${PROVIDERS.anthropic.envKey}`);
  }

  const response = await fetch(PROVIDERS.anthropic.baseUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: message }]
    })
  });

  // CRITICAL: Validate HTTP status before parsing
  if (!response.ok) {
    throw new Error(`Anthropic HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Guard against missing data.content
  if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
    throw new Error('Anthropic: Missing or empty content array');
  }

  // Guard against missing data.usage
  if (!data.usage || typeof data.usage.input_tokens !== 'number' || typeof data.usage.output_tokens !== 'number') {
    throw new Error('Anthropic: Missing or invalid usage data');
  }

  return {
    content: data.content[0].text || '',
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens
  };
}

async function callOpenAI(
  message: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env[PROVIDERS.openai.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${PROVIDERS.openai.envKey}`);
  }

  const response = await fetch(PROVIDERS.openai.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: message }]
    })
  });

  // CRITICAL: Validate HTTP status
  if (!response.ok) {
    throw new Error(`OpenAI HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Guard against missing data.choices
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error('OpenAI: Missing or empty choices array');
  }

  // Guard against missing data.usage
  if (!data.usage || typeof data.usage.prompt_tokens !== 'number' || typeof data.usage.completion_tokens !== 'number') {
    throw new Error('OpenAI: Missing or invalid usage data');
  }

  return {
    content: data.choices[0].message?.content || '',
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens
  };
}

async function callGroq(
  message: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env[PROVIDERS.groq.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${PROVIDERS.groq.envKey}`);
  }

  const response = await fetch(PROVIDERS.groq.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: message }]
    })
  });

  // CRITICAL: Validate HTTP status
  if (!response.ok) {
    throw new Error(`Groq HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Guard against missing data.choices
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error('Groq: Missing or empty choices array');
  }

  // Guard against missing data.usage
  if (!data.usage || typeof data.usage.prompt_tokens !== 'number' || typeof data.usage.completion_tokens !== 'number') {
    throw new Error('Groq: Missing or invalid usage data');
  }

  return {
    content: data.choices[0].message?.content || '',
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens
  };
}

async function callPerplexity(
  message: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env[PROVIDERS.perplexity.envKey];
  if (!apiKey) {
    throw new Error(`Missing ${PROVIDERS.perplexity.envKey}`);
  }

  const response = await fetch(PROVIDERS.perplexity.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: message }]
    })
  });

  // CRITICAL: Validate HTTP status
  if (!response.ok) {
    throw new Error(`Perplexity HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // Guard against missing data.choices
  if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
    throw new Error('Perplexity: Missing or empty choices array');
  }

  // Guard against missing data.usage
  if (!data.usage || typeof data.usage.prompt_tokens !== 'number' || typeof data.usage.completion_tokens !== 'number') {
    throw new Error('Perplexity: Missing or invalid usage data');
  }

  return {
    content: data.choices[0].message?.content || '',
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens
  };
}

// ═══════════════════════════════════════════════════════════════
// RETRY WITH EXPONENTIAL BACKOFF
// ═══════════════════════════════════════════════════════════════

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callProviderWithRetry(
  provider: string,
  message: string,
  model: string,
  maxTokens: number
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let result;
      
      switch (provider) {
        case 'anthropic':
          result = await callAnthropic(message, model, maxTokens);
          break;
        case 'openai':
          result = await callOpenAI(message, model, maxTokens);
          break;
        case 'groq':
          result = await callGroq(message, model, maxTokens);
          break;
        case 'perplexity':
          result = await callPerplexity(message, model, maxTokens);
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      // Success - record and return
      updateProviderHealth(provider, true, Date.now() - Date.now()); // latency handled by caller
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on last attempt
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt]);
      }
    }
  }

  // All retries failed - record failure
  updateProviderHealth(provider, false, 0);
  throw lastError || new Error(`${provider} failed after ${MAX_RETRIES} attempts`);
}

// ═══════════════════════════════════════════════════════════════
// USAGE LOGGING (OPTIONAL - GRACEFUL FAILURE)
// ═══════════════════════════════════════════════════════════════

async function logUsage(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  cost: number
): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Gracefully skip if Supabase not configured
    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if table exists (graceful schema drift handling)
    const { error: tableError } = await supabase
      .from('ai_messages')
      .select('id')
      .limit(1);

    // Skip logging if table doesn't exist
    if (tableError?.code === 'PGRST204' || tableError?.message?.includes('does not exist')) {
      return;
    }

    // Attempt to log
    await supabase.from('ai_messages').insert({
      provider,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Never crash on logging failure
    console.warn('Failed to log AI usage (non-critical):', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ROUTER FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function routeAIRequest(
  message: string,
  preferredProvider: string = 'anthropic',
  options: {
    maxTokens?: number;
    maxCost?: number;
  } = {}
): Promise<RouterResponse> {
  const maxTokens = Math.min(options.maxTokens || MAX_TOKENS_DEFAULT, MAX_TOKENS_DEFAULT);
  const maxCost = options.maxCost || MAX_COST_DEFAULT;

  // Provider priority order (healthy providers only)
  const providerOrder = [
    preferredProvider,
    'groq',      // Free fallback
    'openai',
    'perplexity',
    'anthropic'
  ].filter((p, i, arr) => arr.indexOf(p) === i); // Remove duplicates

  let lastError: Error | null = null;

  for (const provider of providerOrder) {
    // Skip providers in cooldown (persistent health check)
    if (!(await isProviderAvailable(provider))) {
      continue;
    }

    // Skip if provider not configured
    if (!PROVIDERS[provider]) {
      continue;
    }

    const config = PROVIDERS[provider];
    const model = config.models[0];

    try {
      const result = await callProviderWithRetry(provider, message, model, maxTokens);

      // Calculate cost
      const cost = calculateCost(provider, result.inputTokens, result.outputTokens);

      // Enforce cost ceiling
      if (cost > maxCost) {
        throw new Error(`Cost $${cost.toFixed(6)} exceeds max $${maxCost.toFixed(6)}`);
      }

      // Log usage (async, non-blocking, graceful failure)
      logUsage(provider, model, result.inputTokens, result.outputTokens, cost).catch(() => {});

      // Return structured response
      return {
        content: result.content,
        model,
        cost,
        provider
      };

    } catch (error) {
      lastError = error as Error;
      // Continue to next provider
    }
  }

  // All providers failed
  throw new Error('ROUTER_ALL_PROVIDERS_FAILED: ' + (lastError?.message || 'Unknown error'));
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK EXPORT
// ═══════════════════════════════════════════════════════════════

// [CONSOLIDATED] getProviderHealthStatus removed — use GET /api/provider-health instead
// import { getAllProviderHealth } from "@/lib/javari/telemetry/provider-health";