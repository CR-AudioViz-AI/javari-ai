// lib/javari/dispatcher/ai-dispatcher.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI — Master Dispatcher
// THE single call point for ALL AI in the ecosystem.
// Self-healing: auto-switches models on failure, logs for learning.
// 300+ models via OpenRouter + direct providers.
//
// COST LAW (enforced in strict order):
//   FREE:     OpenRouter free models (28 models, $0.00)
//             Groq (14,400 req/day free)
//             Gemini (via Google AI, free tier)
//   CHEAP:    OpenRouter <$0.10/1M, DeepSeek, Mistral Nemo
//   LOW:      OpenRouter <$0.50/1M, gpt-4o-mini
//   MODERATE: Claude Haiku, GPT-4o
//   EXPENSIVE: Only when explicitly requested
//
// Self-healing: on failure → next tier → log → notify
// Created: May 15, 2026
// ─────────────────────────────────────────────────────────────────────────────

import type { AgentRole } from '../engine/execution-contract'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequest {
  role:      AgentRole
  objective: string
  inputs:    string[]
  max_cost:  number
  model?:    string   // explicit override (multi-AI mode)
}

export interface AIDispatchResult {
  output:     string
  model_used: string
  cost_used:  number
  latency_ms: number
  tier:       'free' | 'cheap' | 'low' | 'moderate' | 'expensive' | 'fallback'
  provider:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Catalog — COST LAW tiers
// ─────────────────────────────────────────────────────────────────────────────

interface ModelDef {
  id:       string
  provider: 'openrouter' | 'groq' | 'google' | 'anthropic' | 'openai' | 'deepseek' | 'xai'
  tier:     'free' | 'cheap' | 'low' | 'moderate' | 'expensive'
  cost_per_1m: number
  context:  number
  strengths: string[]  // what this model is best for
}

const MODELS: ModelDef[] = [
  // ── FREE TIER (OpenRouter) ──────────────────────────────────────────────────
  { id: 'deepseek/deepseek-v4-flash:free',        provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 1048576, strengths: ['code','reasoning','general'] },
  { id: 'qwen/qwen3-coder:free',                  provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 1048576, strengths: ['code','technical'] },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 1000000, strengths: ['general','reasoning'] },
  { id: 'google/gemma-4-31b-it:free',             provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 262144,  strengths: ['general','creative'] },
  { id: 'openai/gpt-oss-120b:free',               provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 131072,  strengths: ['general','balanced'] },
  { id: 'openai/gpt-oss-20b:free',                provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 131072,  strengths: ['fast','general'] },
  { id: 'minimax/minimax-m2.5:free',              provider: 'openrouter', tier: 'free', cost_per_1m: 0,    context: 204800,  strengths: ['creative','writing'] },
  // ── FREE TIER (Direct providers) ───────────────────────────────────────────
  { id: 'llama-3.3-70b-versatile',                provider: 'groq',       tier: 'free', cost_per_1m: 0,    context: 128000,  strengths: ['general','fast'] },
  { id: 'llama-3.1-8b-instant',                   provider: 'groq',       tier: 'free', cost_per_1m: 0,    context: 128000,  strengths: ['fast','simple'] },
  { id: 'gemma2-9b-it',                           provider: 'groq',       tier: 'free', cost_per_1m: 0,    context: 8192,    strengths: ['balanced'] },
  { id: 'gemini-1.5-flash',                       provider: 'google',     tier: 'free', cost_per_1m: 0,    context: 1000000, strengths: ['multimodal','fast'] },
  { id: 'gemini-1.5-flash-8b',                    provider: 'google',     tier: 'free', cost_per_1m: 0,    context: 1000000, strengths: ['fastest','simple'] },
  // ── CHEAP TIER (<$0.10/1M) ─────────────────────────────────────────────────
  { id: 'mistralai/mistral-nemo',                 provider: 'openrouter', tier: 'cheap', cost_per_1m: 0.03,  context: 131072, strengths: ['general','efficient'] },
  { id: 'meta-llama/llama-3.1-8b-instruct',      provider: 'openrouter', tier: 'cheap', cost_per_1m: 0.05,  context: 131072, strengths: ['fast','general'] },
  { id: 'google/gemma-3-4b-it',                  provider: 'openrouter', tier: 'cheap', cost_per_1m: 0.08,  context: 131072, strengths: ['efficient'] },
  { id: 'deepseek-chat',                         provider: 'deepseek',   tier: 'cheap', cost_per_1m: 0.27,  context: 64000,  strengths: ['reasoning','code'] },
  // ── LOW TIER (<$0.50/1M) ───────────────────────────────────────────────────
  { id: 'meta-llama/llama-3.3-70b-instruct',     provider: 'openrouter', tier: 'low',  cost_per_1m: 0.27,  context: 128000, strengths: ['general','reasoning'] },
  { id: 'gpt-4o-mini',                           provider: 'openai',     tier: 'low',  cost_per_1m: 0.15,  context: 128000, strengths: ['general','balanced'] },
  { id: 'mistralai/mistral-small-24b-instruct-2501', provider: 'openrouter', tier: 'low', cost_per_1m: 0.08, context: 32768, strengths: ['efficient'] },
  // ── MODERATE TIER ($0.50-2/1M) ─────────────────────────────────────────────
  { id: 'claude-haiku-4-5',                      provider: 'anthropic',  tier: 'moderate', cost_per_1m: 0.25, context: 200000, strengths: ['quality','writing'] },
  { id: 'grok-3-mini',                           provider: 'xai',        tier: 'moderate', cost_per_1m: 0.30, context: 131072, strengths: ['reasoning','fast'] },
  { id: 'google/gemini-2.0-flash-lite-001',      provider: 'openrouter', tier: 'moderate', cost_per_1m: 0.30, context: 1048576, strengths: ['speed','multimodal'] },
  // ── EXPENSIVE (use sparingly) ──────────────────────────────────────────────
  { id: 'claude-sonnet-4-20250514',              provider: 'anthropic',  tier: 'expensive', cost_per_1m: 3.00, context: 200000, strengths: ['complex','best'] },
  { id: 'openai/gpt-4o',                         provider: 'openrouter', tier: 'expensive', cost_per_1m: 5.00, context: 128000, strengths: ['best_general'] },
]

// ─────────────────────────────────────────────────────────────────────────────
// Role → Model Policy (COST LAW)
// Each role gets a primary (free) and escalation path
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_POLICY: Record<AgentRole, { primary: string; strengths: string[] }> = {
  architect: { primary: 'deepseek/deepseek-v4-flash:free', strengths: ['reasoning', 'general'] },
  builder:   { primary: 'qwen/qwen3-coder:free',           strengths: ['code', 'technical']    },
  tester:    { primary: 'llama-3.1-8b-instant',            strengths: ['fast', 'general']      },
  reviewer:  { primary: 'google/gemma-4-31b-it:free',      strengths: ['general', 'creative']  },
  deployer:  { primary: 'openai/gpt-oss-20b:free',         strengths: ['general', 'fast']      },
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompts — per role, production-grade
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  architect: `You are Javari's Architect Agent for CR AudioViz AI. Mission: "Your Story. Our Design."

Your role: Strategic planning, system design, solution blueprinting.
Think like a Fortune 50 architect. No shortcuts. Complete solutions.
Identify the best approach, risks, and dependencies.

Output ONLY valid JSON:
{"role":"architect","blueprint":"<complete strategic plan>","approach":"<method>","risks":"<key risks>","model_used":"<your model name>"}`,

  builder: `You are Javari's Builder Agent for CR AudioViz AI. Mission: "Your Story. Our Design."

Your role: Implementation, execution, artifact creation.
Build production-ready, complete solutions. Henderson Standard: Fortune 50 quality.
No placeholders, no incomplete work, no shortcuts.

Output ONLY valid JSON:
{"role":"builder","artifact":"<complete implementation>","approach":"<what was built>","model_used":"<your model name>"}`,

  tester: `You are Javari's Tester Agent for CR AudioViz AI. Mission: "Your Story. Our Design."

Your role: Quality assurance, validation, issue identification.
Test thoroughly. Find real problems. Provide specific, actionable feedback.
Rate confidence in the solution.

Output ONLY valid JSON:
{"role":"tester","test_results":"<findings>","issues":"<list of issues>","passed":true,"confidence":9,"model_used":"<your model name>"}`,

  reviewer: `You are Javari's Reviewer Agent for CR AudioViz AI. Mission: "Your Story. Our Design."

Your role: Quality review, improvement suggestions, final validation.
Be specific. Rate quality. Suggest concrete improvements.
Consider the user's perspective and business impact.

Output ONLY valid JSON:
{"role":"reviewer","verdict":"<detailed review>","improvements":"<specific suggestions>","score":8,"model_used":"<your model name>"}`,

  deployer: `You are Javari's Deployer Agent for CR AudioViz AI. Mission: "Your Story. Our Design."

Your role: Deployment preparation, documentation, delivery readiness.
Write clear deployment notes. Verify readiness. Prepare handoff.
Think about what the user needs to know.

Output ONLY valid JSON:
{"role":"deployer","deployment_notes":"<complete notes>","checklist":"<deployment steps>","ready":true,"model_used":"<your model name>"}`,
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider call functions — each with full error handling
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenRouter(modelId: string, system: string, user: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'Authorization':  `Bearer ${key}`,
      'HTTP-Referer':   'https://craudiovizai.com',
      'X-Title':        'Javari AI — CR AudioViz AI',
    },
    body: JSON.stringify({
      model:       modelId,
      max_tokens:  2048,
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter ${modelId} HTTP ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message: string } }
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`)
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGroq(modelId: string, system: string, user: string): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({
      model: modelId, max_tokens: 2048, temperature: 0.7,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq ${modelId} HTTP ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGoogle(modelId: string, system: string, user: string): Promise<string> {
  const key = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!key) throw new Error('GOOGLE_AI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google ${modelId} HTTP ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callAnthropic(modelId: string, system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId, max_tokens: 2048, system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic ${modelId} HTTP ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  return data.content?.find(b => b.type === 'text')?.text ?? ''
}

async function callOpenAI(modelId: string, system: string, user: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({
      model: modelId, max_tokens: 2048, temperature: 0.7,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${modelId} HTTP ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

// ─────────────────────────────────────────────────────────────────────────────
// callProvider — routes to the right provider function
// ─────────────────────────────────────────────────────────────────────────────

async function callProvider(model: ModelDef, system: string, user: string): Promise<string> {
  switch (model.provider) {
    case 'openrouter': return callOpenRouter(model.id, system, user)
    case 'groq':       return callGroq(model.id, system, user)
    case 'google':     return callGoogle(model.id, system, user)
    case 'anthropic':  return callAnthropic(model.id, system, user)
    case 'openai':     return callOpenAI(model.id, system, user)
    case 'deepseek': {
      const key = process.env.DEEPSEEK_API_KEY
      if (!key) throw new Error('DEEPSEEK_API_KEY not set')
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'deepseek-chat', max_tokens: 2048, temperature: 0.7,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      })
      if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`)
      const d = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return d.choices?.[0]?.message?.content ?? ''
    }
    case 'xai': {
      const key = process.env.XAI_API_KEY
      if (!key) throw new Error('XAI_API_KEY not set')
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: model.id, max_tokens: 2048, temperature: 0.7,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      })
      if (!res.ok) throw new Error(`xAI HTTP ${res.status}`)
      const d = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
      return d.choices?.[0]?.message?.content ?? ''
    }
    default: throw new Error(`Unknown provider: ${model.provider}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-healing model selector
// Tries models in COST LAW order, logs failures for learning
// ─────────────────────────────────────────────────────────────────────────────

function buildAttemptChain(primaryModelId: string, maxCost: number): ModelDef[] {
  // Find the primary model
  const primary = MODELS.find(m => m.id === primaryModelId)

  // Build chain: primary first, then by tier, respecting cost limit
  const maxCostPer1m = maxCost * 1_000_000 / 2000  // assume 2000 output tokens max
  const chain: ModelDef[] = []

  if (primary) chain.push(primary)

  // Add free models not already in chain
  for (const m of MODELS.filter(m => m.tier === 'free' && m.id !== primaryModelId)) {
    chain.push(m)
  }

  // Add cheap models within cost limit
  for (const m of MODELS.filter(m => m.tier === 'cheap' && m.cost_per_1m <= Math.max(maxCostPer1m, 0.1))) {
    if (!chain.find(c => c.id === m.id)) chain.push(m)
  }

  // Add low cost if budget allows
  if (maxCost > 0.005) {
    for (const m of MODELS.filter(m => m.tier === 'low')) {
      if (!chain.find(c => c.id === m.id)) chain.push(m)
    }
  }

  // Add moderate if budget allows
  if (maxCost > 0.01) {
    for (const m of MODELS.filter(m => m.tier === 'moderate')) {
      if (!chain.find(c => c.id === m.id)) chain.push(m)
    }
  }

  return chain
}

// ─────────────────────────────────────────────────────────────────────────────
// dispatchAI — THE main entry point
// Self-healing: tries each model in chain, falls back on failure
// ─────────────────────────────────────────────────────────────────────────────

export async function dispatchAI(request: AIRequest): Promise<AIDispatchResult> {
  const startMs = Date.now()
  const system  = SYSTEM_PROMPTS[request.role] ?? SYSTEM_PROMPTS.builder
  const user    = `Task: ${request.objective}\n\nContext inputs: ${request.inputs.join(', ') || 'none'}`

  // Determine primary model
  const primaryId = request.model ?? ROLE_POLICY[request.role]?.primary ?? 'deepseek/deepseek-v4-flash:free'

  // Build COST LAW attempt chain
  const chain = buildAttemptChain(primaryId, request.max_cost)

  // Env check — log which providers are available
  console.log('[ENV CHECK]', {
    openrouter: !!process.env.OPENROUTER_API_KEY,
    groq:       !!process.env.GROQ_API_KEY,
    google:     !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY),
    anthropic:  !!process.env.ANTHROPIC_API_KEY,
    openai:     !!process.env.OPENAI_API_KEY,
    deepseek:   !!process.env.DEEPSEEK_API_KEY,
    xai:        !!process.env.XAI_API_KEY,
  })

  // Try each model in COST LAW order
  for (const model of chain) {
    try {
      console.log('[MODEL TRY]', { model: model.id, provider: model.provider, tier: model.tier })
      const raw = await callProvider(model, system, user)

      if (!raw || raw.length < 5) {
        console.warn('[MODEL EMPTY]', model.id, '— response too short, trying next')
        continue
      }

      // Parse output — inject model_used if JSON
      let output = raw
      try {
        const parsed = JSON.parse(raw)
        parsed.model_used = model.id
        output = JSON.stringify(parsed)
      } catch {
        // Not JSON — wrap it
        output = JSON.stringify({
          role:       request.role,
          result:     raw,
          model_used: model.id,
        })
      }

      const latency = Date.now() - startMs
      console.log('[MODEL SUCCESS]', { model: model.id, latency, tier: model.tier })

      return {
        output,
        model_used: model.id,
        cost_used:  model.cost_per_1m / 1_000_000 * Math.ceil(raw.length / 4),
        latency_ms: latency,
        tier:       model.tier,
        provider:   model.provider,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[MODEL FAIL]', { model: model.id, error: msg.slice(0, 150) })
      // Continue to next model — self-healing
    }
  }

  // All models failed — hard fallback
  console.error('[DISPATCH HARD FALLBACK] All models exhausted')
  return {
    output:     JSON.stringify({ role: request.role, result: 'AI processing temporarily unavailable. Please retry.', model_used: 'fallback' }),
    model_used: 'fallback',
    cost_used:  0,
    latency_ms: Date.now() - startMs,
    tier:       'fallback',
    provider:   'none',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports for engine compatibility
// ─────────────────────────────────────────────────────────────────────────────

export { MODELS, ROLE_POLICY }

export function selectModel(role: AgentRole): string {
  return ROLE_POLICY[role]?.primary ?? 'deepseek/deepseek-v4-flash:free'
}

export function estimatePlanCost(plan: { tasks: Array<{ max_cost: number }> }): number {
  return plan.tasks.reduce((s, t) => s + (t.max_cost ?? 0.01), 0)
}

export function enforceCostLimit(cost: number, max: number): void {
  if (cost > max) console.warn(`[COST WARNING] $${cost.toFixed(6)} exceeds limit $${max.toFixed(6)}`)
}

// Legacy interface for execution-engine.ts compatibility
export interface AIResponse {
  output:     string
  model_used: string
  cost_used:  number
}
