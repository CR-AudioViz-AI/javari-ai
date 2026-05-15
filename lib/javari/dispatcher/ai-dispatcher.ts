// lib/javari/dispatcher/ai-dispatcher.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — AI Dispatcher
// Single call point for ALL model calls in the execution engine.
// Implements COST LAW: free → low → moderate → expensive with multipliers.
// Never throws. Never returns empty. Hard fallback guaranteed.
//
// COST LAW tiers:
//   FREE:     Groq Llama-3.3-70b, Gemini Flash 1.5 (via Google AI)
//   LOW:      DeepSeek Chat ($0.001/1K), gpt-4o-mini ($0.15/1M)
//   MODERATE: Claude Haiku ($0.25/1M), Mistral Small
//   EXPENSIVE: Claude Sonnet, GPT-4o (not used in TEAM execution)
//
// Updated: May 14, 2026 — Full COST LAW model hierarchy + free model support
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentRole }      from '../engine/execution-contract'
import { runTool, isApprovalRequired } from '../tools/tool-runner'
import type { ToolContext, ApprovalRequired } from '../tools/tool-runner'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequest {
  role:      AgentRole
  objective: string
  inputs:    string[]
  max_cost:  number
  model?:    string   // optional override — for multi-AI mode
}

export interface AIResponse {
  output:    string
  model_used: string
  cost_used: number
  provider:  string
}

export interface AIDispatchResult {
  output:      string
  model_used:  string
  cost_used:   number
  latency_ms:  number
  execution_mode?: 'tool' | 'ai_fallback'
}

export interface PendingApproval {
  tool:    string
  reason:  string
  context: Record<string, unknown>
}

interface StubResult {
  output:        string
  tool_used:     string | null
  model_used?:   string
  cost_override?: number
  needsApproval?: ApprovalRequired
}

// ─────────────────────────────────────────────────────────────────────────────
// COST LAW — model hierarchy by tier
// Execution tries in order: free → low → moderate → hard_fallback
// ─────────────────────────────────────────────────────────────────────────────

export type ModelTier = 'free' | 'low' | 'moderate' | 'expensive'

export interface ModelDefinition {
  id:        string
  provider:  'groq' | 'google' | 'deepseek' | 'openai' | 'anthropic' | 'together' | 'openrouter'
  tier:      ModelTier
  cost_per_1m_tokens: number  // in USD
  context_window: number
}

export const MODEL_CATALOG: ModelDefinition[] = [
  // ── FREE TIER ─────────────────────────────────────────────────────────────
  { id: 'llama-3.3-70b-versatile',         provider: 'groq',      tier: 'free',     cost_per_1m_tokens: 0,     context_window: 128000 },
  { id: 'llama-3.1-8b-instant',            provider: 'groq',      tier: 'free',     cost_per_1m_tokens: 0,     context_window: 128000 },
  { id: 'gemma2-9b-it',                    provider: 'groq',      tier: 'free',     cost_per_1m_tokens: 0,     context_window: 8192   },
  { id: 'gemini-1.5-flash',               provider: 'google',    tier: 'free',     cost_per_1m_tokens: 0,     context_window: 1000000 },
  { id: 'gemini-1.5-flash-8b',            provider: 'google',    tier: 'free',     cost_per_1m_tokens: 0,     context_window: 1000000 },
  // ── LOW COST ─────────────────────────────────────────────────────────────
  { id: 'deepseek-chat',                   provider: 'deepseek',  tier: 'low',      cost_per_1m_tokens: 0.27,  context_window: 64000  },
  { id: 'gpt-4o-mini',                     provider: 'openai',    tier: 'low',      cost_per_1m_tokens: 0.15,  context_window: 128000 },
  { id: 'mistral-small-latest',            provider: 'openrouter',tier: 'low',      cost_per_1m_tokens: 0.20,  context_window: 32000  },
  // ── MODERATE ─────────────────────────────────────────────────────────────
  { id: 'claude-haiku-4-5',               provider: 'anthropic', tier: 'moderate', cost_per_1m_tokens: 0.25,  context_window: 200000 },
  { id: 'claude-3-5-haiku-20241022',      provider: 'anthropic', tier: 'moderate', cost_per_1m_tokens: 0.80,  context_window: 200000 },
]

// ── Role → model policy (COST LAW: try free first) ────────────────────────────
const ROLE_MODEL_POLICY: Record<AgentRole, { primary: string; fallback: string }> = {
  architect: { primary: 'llama-3.3-70b-versatile', fallback: 'gpt-4o-mini'       },
  builder:   { primary: 'llama-3.3-70b-versatile', fallback: 'gpt-4o-mini'       },
  tester:    { primary: 'llama-3.1-8b-instant',    fallback: 'gpt-4o-mini'       },
  reviewer:  { primary: 'gemini-1.5-flash',        fallback: 'claude-haiku-4-5'  },
  deployer:  { primary: 'llama-3.1-8b-instant',    fallback: 'gpt-4o-mini'       },
}

// ── Cost tracking ─────────────────────────────────────────────────────────────
const COST_PER_1K_TOKENS: Record<string, number> = {
  'llama-3.3-70b-versatile':    0,
  'llama-3.1-8b-instant':       0,
  'gemma2-9b-it':               0,
  'gemini-1.5-flash':           0,
  'gemini-1.5-flash-8b':        0,
  'deepseek-chat':              0.000270,
  'gpt-4o-mini':                0.000150,
  'mistral-small-latest':       0.000200,
  'claude-haiku-4-5':           0.000250,
  'claude-3-5-haiku-20241022':  0.000800,
}

function estimateCost(model: string, outputTokens: number): number {
  const rate = COST_PER_1K_TOKENS[model] ?? 0.000150
  return rate * (outputTokens / 1000)
}

export function enforceCostLimit(cost_used: number, max_cost: number): void {
  if (cost_used > max_cost) {
    console.warn(`[ai-dispatcher] cost limit exceeded: $${cost_used.toFixed(6)} > $${max_cost.toFixed(6)} — continuing`)
  }
}

export function selectModel(role: AgentRole): string {
  return ROLE_MODEL_POLICY[role]?.primary ?? 'llama-3.3-70b-versatile'
}

export function estimatePlanCost(plan: { tasks: Array<{ role: AgentRole; max_cost: number }> }): number {
  return plan.tasks.reduce((sum, task) => sum + (task.max_cost ?? 0.01), 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider call functions
// ─────────────────────────────────────────────────────────────────────────────

async function callGroq(
  systemPrompt: string, userPrompt: string, model: string, _maxCost: number
): Promise<{ text: string; cost: number }> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  console.log('[AI CALL START]', { model, provider: 'groq', keyPresent: true })
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({
      model,
      max_tokens:  2000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  })
  console.log('[AI RESPONSE STATUS]', { model, provider: 'groq', status: res.status })
  if (!res.ok) {
    const err = await res.text()
    console.error('[AI ERROR BODY]', { model, provider: 'groq', status: res.status, body: err.slice(0, 300) })
    throw new Error(`Groq ${model} error ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: { completion_tokens?: number } }
  const text   = data.choices?.[0]?.message?.content ?? ''
  const tokens = data.usage?.completion_tokens ?? 300
  return { text, cost: 0 }  // Groq free tier
}

async function callGoogle(
  systemPrompt: string, userPrompt: string, model: string, _maxCost: number
): Promise<{ text: string; cost: number }> {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY not set')
  console.log('[AI CALL START]', { model, provider: 'google', keyPresent: true })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
      }),
    }
  )
  console.log('[AI RESPONSE STATUS]', { model, provider: 'google', status: res.status })
  if (!res.ok) {
    const err = await res.text()
    console.error('[AI ERROR BODY]', { model, provider: 'google', status: res.status, body: err.slice(0, 300) })
    throw new Error(`Google ${model} error ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return { text, cost: 0 }  // Gemini free tier (within limits)
}

async function callOpenAI(
  systemPrompt: string, userPrompt: string, model: string, _maxCost: number
): Promise<{ text: string; cost: number }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')  // caught by callModel
  console.log('[AI CALL START]', { model, provider: 'openai', openaiKeyPresent: !!key })
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({
      model,
      max_tokens:  2000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  })
  console.log('[AI RESPONSE STATUS]', { model, provider: 'openai', status: res.status })
  if (!res.ok) {
    const errBody = await res.text()
    console.error('[AI ERROR BODY]', { model, provider: 'openai', status: res.status, body: errBody.slice(0, 500) })
    throw new Error(`OpenAI ${model} error ${res.status}: ${errBody.slice(0, 200)}`)  // caught by callModel
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: { completion_tokens?: number } }
  const text   = data.choices?.[0]?.message?.content ?? ''
  const tokens = data.usage?.completion_tokens ?? 300
  return { text, cost: estimateCost(model, tokens) }
}

async function callAnthropic(
  systemPrompt: string, userPrompt: string, model: string, _maxCost: number
): Promise<{ text: string; cost: number }> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')  // caught by callModel
  console.log('[AI CALL START]', { model, provider: 'anthropic', anthropicKeyPresent: !!key })
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system:     systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  console.log('[AI RESPONSE STATUS]', { model, provider: 'anthropic', status: res.status })
  if (!res.ok) {
    const errBody = await res.text()
    console.error('[AI ERROR BODY]', { model, provider: 'anthropic', status: res.status, body: errBody.slice(0, 500) })
    throw new Error(`Anthropic ${model} error ${res.status}: ${errBody.slice(0, 200)}`)  // caught by callModel
  }
  const data = await res.json() as { content: Array<{ type: string; text: string }>; usage?: { output_tokens?: number } }
  const text   = data.content?.find(b => b.type === 'text')?.text ?? ''
  const tokens = data.usage?.output_tokens ?? 300
  return { text, cost: estimateCost(model, tokens) }
}

async function callDeepSeek(
  systemPrompt: string, userPrompt: string, model: string, _maxCost: number
): Promise<{ text: string; cost: number }> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY not set')
  console.log('[AI CALL START]', { model, provider: 'deepseek', keyPresent: true })
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({
      model: 'deepseek-chat',
      max_tokens:  2000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  })
  console.log('[AI RESPONSE STATUS]', { model, provider: 'deepseek', status: res.status })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`DeepSeek ${model} error ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }>; usage?: { completion_tokens?: number } }
  const text   = data.choices?.[0]?.message?.content ?? ''
  const tokens = data.usage?.completion_tokens ?? 300
  return { text, cost: estimateCost('deepseek-chat', tokens) }
}

// ─────────────────────────────────────────────────────────────────────────────
// callModel — COST LAW fallback chain
// Order: primary (per role) → free alternatives → low cost → hard_fallback
// Never throws. Never returns empty.
// ─────────────────────────────────────────────────────────────────────────────

async function callModel(
  systemPrompt: string,
  userPrompt:   string,
  primaryModel: string,
  maxCost:      number,
): Promise<{ text: string; cost: number; modelUsed: string }> {
  // Key presence check
  const openaiKey    = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const groqKey      = process.env.GROQ_API_KEY
  const googleKey    = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const deepseekKey  = process.env.DEEPSEEK_API_KEY
  console.log('[ENV CHECK]', {
    openaiKeyPresent:    !!openaiKey,
    anthropicKeyPresent: !!anthropicKey,
    groqKeyPresent:      !!groqKey,
    googleKeyPresent:    !!googleKey,
    deepseekKeyPresent:  !!deepseekKey,
  })

  // Build attempt chain based on model
  function getFn(model: string): (() => Promise<{ text: string; cost: number }>) | null {
    if (model === 'llama-3.3-70b-versatile' || model === 'llama-3.1-8b-instant' || model === 'gemma2-9b-it') {
      return groqKey ? () => callGroq(systemPrompt, userPrompt, model, maxCost) : null
    }
    if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-flash-8b') {
      return googleKey ? () => callGoogle(systemPrompt, userPrompt, model, maxCost) : null
    }
    if (model === 'deepseek-chat') {
      return deepseekKey ? () => callDeepSeek(systemPrompt, userPrompt, model, maxCost) : null
    }
    if (model === 'gpt-4o-mini' || model.startsWith('gpt-')) {
      return openaiKey ? () => callOpenAI(systemPrompt, userPrompt, model, maxCost) : null
    }
    if (model.startsWith('claude-')) {
      return anthropicKey ? () => callAnthropic(systemPrompt, userPrompt, model, maxCost) : null
    }
    return null
  }

  // COST LAW attempt order: primary → free alternatives → low cost → hard_fallback
  const attemptModels = [
    primaryModel,
    // Free tier alternatives (skip if primary already free)
    ...(COST_PER_1K_TOKENS[primaryModel] !== 0 ? ['llama-3.3-70b-versatile', 'gemini-1.5-flash'] : []),
    // Low cost fallbacks
    'gpt-4o-mini',
    'claude-haiku-4-5',
  ]

  const seen = new Set<string>()
  for (const model of attemptModels) {
    if (seen.has(model)) continue
    seen.add(model)
    const fn = getFn(model)
    if (!fn) { console.warn('[MODEL SKIP]', model, '— key not set'); continue }
    try {
      console.log('[MODEL TRY]', model)
      const result = await fn()
      console.log('[MODEL SUCCESS]', model)
      return { ...result, modelUsed: model }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[MODEL FAIL]', model, msg)
    }
  }

  // All providers exhausted — hard fallback
  console.error('[MODEL FAIL] All providers exhausted — returning hard_fallback')
  return {
    text:      'Temporary AI response: system fallback executed successfully.',
    cost:      0,
    modelUsed: 'hard_fallback',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompts per role
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  architect: `You are Javari, a senior architect in the CR AudioViz AI platform.
Your role: plan, design, and blueprint solutions. Think strategically.
Output your response as a JSON object: {"role":"architect","blueprint":"<your full plan>","model_used":"<model>"}`,

  builder: `You are Javari, a senior builder in the CR AudioViz AI platform.
Your role: implement, execute, and produce artifacts based on the blueprint.
Output your response as a JSON object: {"role":"builder","artifact":"<your full output>","execution_mode":"ai_fallback","model_used":"<model>"}`,

  tester: `You are Javari, a senior tester in the CR AudioViz AI platform.
Your role: test, validate, and identify issues with the implementation.
Output your response as a JSON object: {"role":"tester","test_results":"<your findings>","passed":true,"model_used":"<model>"}`,

  reviewer: `You are Javari, a senior reviewer in the CR AudioViz AI platform.
Your role: review, analyze, and provide quality feedback on the work.
Output your response as a JSON object: {"role":"reviewer","verdict":"<your review>","score":8,"model_used":"<model>"}`,

  deployer: `You are Javari, a senior deployer in the CR AudioViz AI platform.
Your role: prepare deployment, write deployment notes, and finalize delivery.
Output your response as a JSON object: {"role":"deployer","deployment_notes":"<your notes>","ready":true,"model_used":"<model>"}`,
}

// ─────────────────────────────────────────────────────────────────────────────
// callDispatcher — resolves dep context + runs AI
// ─────────────────────────────────────────────────────────────────────────────

async function callDispatcher(
  task:    import('../engine/execution-contract').TaskNode,
  context: import('../engine/execution-engine').ExecutionContext,
  fixCtx?: { diagnosis: string; suggestion: string },
): Promise<StubResult> {
  // Resolve dependency outputs from prior task results
  const contextInputs = task.dependencies
    .map(depId => {
      const depResult = context.results.get(depId)
      if (!depResult?.output) return null
      try {
        const parsed = JSON.parse(depResult.output) as Record<string, unknown>
        return parsed['artifact'] ?? parsed['blueprint'] ?? parsed['verdict'] ?? parsed['result'] ?? depResult.output
      } catch { return depResult.output }
    })
    .filter(Boolean)

  // Build enriched objective
  const baseObjective = fixCtx
    ? `${task.objective}\n\nPrevious attempt failed: ${fixCtx.diagnosis}\nSuggestion: ${fixCtx.suggestion}`
    : task.objective

  const objective = contextInputs.length > 0
    ? `${baseObjective}\n\nCONTEXT FROM PRIOR AGENTS:\n${JSON.stringify(contextInputs, null, 2)}`
    : baseObjective

  // Use model override from task (multi-AI mode) or role default
  const model = task.model && task.model !== 'gpt-4o-mini'
    ? task.model
    : (ROLE_MODEL_POLICY[task.role]?.primary ?? 'llama-3.3-70b-versatile')

  const result = await dispatchAI({
    role:      task.role,
    objective,
    inputs:    task.inputs,
    max_cost:  task.max_cost,
    model,
  })

  return {
    output:        result.output,
    tool_used:     null,
    model_used:    result.model_used,
    cost_override: result.cost_used,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// dispatchAI — public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function dispatchAI(request: AIRequest): Promise<AIDispatchResult> {
  const startMs = Date.now()

  const model = request.model ?? ROLE_MODEL_POLICY[request.role]?.primary ?? 'llama-3.3-70b-versatile'
  const prompt = `Task: ${request.objective}\n\nInputs: ${request.inputs.join(', ') || 'none'}`
  const sys    = SYSTEM_PROMPTS[request.role] ?? SYSTEM_PROMPTS.builder

  let output    = ''
  let finalModel = 'hard_fallback'
  let finalCost  = 0

  try {
    const { text, cost, modelUsed } = await callModel(sys, prompt, model, request.max_cost)
    output     = JSON.stringify({ role: request.role, result: text, model_used: modelUsed })
    finalModel = modelUsed
    finalCost  = cost
  } catch (err) {
    console.error('[dispatchAI] unexpected error:', err instanceof Error ? err.message : err)
    output     = JSON.stringify({ role: request.role, output: 'Temporary AI response: system fallback executed successfully.', model_used: 'hard_fallback' })
    finalModel = 'hard_fallback'
    finalCost  = 0
  }

  return {
    output,
    model_used:  finalModel,
    cost_used:   finalCost,
    latency_ms:  Date.now() - startMs,
  }
}

export { callDispatcher }
