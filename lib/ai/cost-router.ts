/**
 * JAVARI AI - Smart Cost Router
 * Routes queries to the most cost-effective AI while tracking every cent
 * 
 * Created: December 29, 2025
 * Purpose: Maximize margin, minimize cost, track everything
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Cost per 1M tokens (as of Dec 2025)
const AI_COSTS = {
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'sonar-pro': { input: 0.20, output: 0.60 }, // Perplexity
} as const;

type ModelKey = keyof typeof AI_COSTS;

// Query complexity classifier
type Complexity = 'simple' | 'medium' | 'complex' | 'search';

interface CostTrackingResult {
  response: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  responseTimeMs: number;
  complexity: Complexity;
  timestamp: string;
}

// Supabase client for logging
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Classify query complexity to route to right model
 */
function classifyComplexity(message: string): Complexity {
  const lowerMsg = message.toLowerCase();
  
  // Search queries - current events, lookups
  if (
    lowerMsg.includes('latest') ||
    lowerMsg.includes('current') ||
    lowerMsg.includes('news') ||
    lowerMsg.includes('today') ||
    lowerMsg.includes('search for') ||
    lowerMsg.includes('find me') ||
    lowerMsg.includes('what is the price')
  ) {
    return 'search';
  }
  
  // Complex queries - code, strategy, long-form
  if (
    lowerMsg.includes('build') ||
    lowerMsg.includes('create') ||
    lowerMsg.includes('code') ||
    lowerMsg.includes('implement') ||
    lowerMsg.includes('strategy') ||
    lowerMsg.includes('analyze') ||
    lowerMsg.includes('fix') ||
    lowerMsg.includes('debug') ||
    message.length > 500
  ) {
    return 'complex';
  }
  
  // Simple queries - greetings, short questions
  if (
    message.length < 50 ||
    lowerMsg.includes('hello') ||
    lowerMsg.includes('hi') ||
    lowerMsg.includes('thanks') ||
    lowerMsg.includes('help')
  ) {
    return 'simple';
  }
  
  // Default to medium
  return 'medium';
}

/**
 * Get the best model for the complexity level
 */
function getModelForComplexity(complexity: Complexity): { provider: string; model: ModelKey } {
  switch (complexity) {
    case 'simple':
      return { provider: 'anthropic', model: 'claude-3-haiku-20240307' };
    case 'medium':
      return { provider: 'openai', model: 'gpt-4o-mini' };
    case 'complex':
      return { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' };
    case 'search':
      return { provider: 'perplexity', model: 'sonar-pro' };
    default:
      return { provider: 'anthropic', model: 'claude-3-haiku-20240307' };
  }
}

/**
 * Calculate cost in USD
 */
function calculateCost(model: ModelKey, inputTokens: number, outputTokens: number): number {
  const costs = AI_COSTS[model];
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // Round to 6 decimal places
}

/**
 * Log usage to Supabase for billing and analytics
 */
async function logUsage(
  userId: string,
  result: CostTrackingResult
): Promise<void> {
  try {
    await supabase.from('ai_usage_logs').insert({
      user_id: userId,
      provider: result.provider,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUSD,
      response_time_ms: result.responseTimeMs,
      complexity: result.complexity,
      created_at: result.timestamp,
    });
  } catch (error) {
    console.error('Failed to log AI usage:', error);
  }
}

/**
 * Call Anthropic (Claude)
 */
async function callAnthropic(
  model: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const result = await client.messages.create({
    model,
    max_tokens: 4096,
    messages,
  });
  
  return {
    response: result.content[0].type === 'text' ? result.content[0].text : '',
    inputTokens: result.usage.input_tokens,
    outputTokens: result.usage.output_tokens,
  };
}

/**
 * Call OpenAI
 */
async function callOpenAI(
  model: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const result = await client.chat.completions.create({
    model,
    messages,
  });
  
  return {
    response: result.choices[0]?.message?.content || '',
    inputTokens: result.usage?.prompt_tokens || 0,
    outputTokens: result.usage?.completion_tokens || 0,
  };
}

/**
 * Call Perplexity
 */
async function callPerplexity(
  model: string,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  });
  
  const result = await response.json();
  
  return {
    response: result.choices?.[0]?.message?.content || '',
    inputTokens: result.usage?.prompt_tokens || 0,
    outputTokens: result.usage?.completion_tokens || 0,
  };
}

/**
 * MAIN ROUTER - The smart cost-optimized AI router
 */
export async function routeQuery(
  userId: string,
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<CostTrackingResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // 1. Classify complexity
  const complexity = classifyComplexity(message);
  
  // 2. Get optimal model
  const { provider, model } = getModelForComplexity(complexity);
  
  // 3. Prepare messages
  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: message },
  ];
  
  // 4. Call the appropriate provider
  let response: string;
  let inputTokens: number;
  let outputTokens: number;
  
  try {
    switch (provider) {
      case 'anthropic':
        const anthropicResult = await callAnthropic(model, messages);
        response = anthropicResult.response;
        inputTokens = anthropicResult.inputTokens;
        outputTokens = anthropicResult.outputTokens;
        break;
        
      case 'openai':
        const openaiResult = await callOpenAI(model, messages);
        response = openaiResult.response;
        inputTokens = openaiResult.inputTokens;
        outputTokens = openaiResult.outputTokens;
        break;
        
      case 'perplexity':
        const perplexityResult = await callPerplexity(model, messages);
        response = perplexityResult.response;
        inputTokens = perplexityResult.inputTokens;
        outputTokens = perplexityResult.outputTokens;
        break;
        
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    // Fallback to Haiku if primary fails
    console.error(`Primary ${provider} failed, falling back to Haiku:`, error);
    const fallback = await callAnthropic('claude-3-haiku-20240307', messages);
    response = fallback.response;
    inputTokens = fallback.inputTokens;
    outputTokens = fallback.outputTokens;
  }
  
  // 5. Calculate cost
  const costUSD = calculateCost(model as ModelKey, inputTokens, outputTokens);
  
  // 6. Build result
  const result: CostTrackingResult = {
    response,
    provider,
    model,
    inputTokens,
    outputTokens,
    costUSD,
    responseTimeMs: Date.now() - startTime,
    complexity,
    timestamp,
  };
  
  // 7. Log usage (async, don't wait)
  logUsage(userId, result).catch(console.error);
  
  return result;
}

/**
 * Get user's usage summary for billing
 */
export async function getUserUsageSummary(userId: string, startDate?: Date, endDate?: Date) {
  const query = supabase
    .from('ai_usage_logs')
    .select('*')
    .eq('user_id', userId);
  
  if (startDate) {
    query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query.lte('created_at', endDate.toISOString());
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  const summary = {
    totalCalls: data.length,
    totalCostUSD: data.reduce((sum, row) => sum + (row.cost_usd || 0), 0),
    totalInputTokens: data.reduce((sum, row) => sum + (row.input_tokens || 0), 0),
    totalOutputTokens: data.reduce((sum, row) => sum + (row.output_tokens || 0), 0),
    byProvider: {} as Record<string, { calls: number; cost: number }>,
    byComplexity: {} as Record<string, { calls: number; cost: number }>,
  };
  
  for (const row of data) {
    // By provider
    if (!summary.byProvider[row.provider]) {
      summary.byProvider[row.provider] = { calls: 0, cost: 0 };
    }
    summary.byProvider[row.provider].calls++;
    summary.byProvider[row.provider].cost += row.cost_usd || 0;
    
    // By complexity
    if (!summary.byComplexity[row.complexity]) {
      summary.byComplexity[row.complexity] = { calls: 0, cost: 0 };
    }
    summary.byComplexity[row.complexity].calls++;
    summary.byComplexity[row.complexity].cost += row.cost_usd || 0;
  }
  
  return summary;
}
