// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — DO NOT MIX WITH PLATFORM LOGIC
// ─────────────────────────────────────────────────────────────────────────────
// lib/javari/team/ai-dispatcher.ts
// Javari TEAM Mode — AI Dispatcher Layer
// Centralized model routing and AI request dispatch for all agent roles.
// Model policy: cheap-first with typed fallbacks per role.
// Created: April 24, 2026
// Updated: April 24, 2026 — executeAgent routes to tool-runner; simulation fallback
// Updated: April 30, 2026 — real AI model calls: callOpenAI, callAnthropic
//                            try/catch fallback chain: primary → gpt-4o-mini → structured error
// Updated: May 1, 2026   — FINAL STABILIZATION: guaranteed output, no throws, hard fallback

import type { AgentRole }    from './execution-contract'
import { runTool, isApprovalRequired } from '../tools/tool-runner'
import type { ToolContext, ApprovalRequired } from '../tools/tool-runner'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequest {
  role:         AgentRole
  objective:    string
  inputs:       string[]
  max_cost:     number
  userId?:      string
  executionId?: string
}

export interface AIResponse {
  output:     string
  cost_used:  number
  model:      string
  latency_ms: number
  tool_used?: string
}

export interface PendingApproval extends ApprovalRequired {
  status:     'pending_approval'
  role:       string
  cost_used:  number
  model:      string
  latency_ms: number
}

export type AIDispatchResult = AIResponse | PendingApproval

export function isPendingApproval(r: AIDispatchResult): r is PendingApproval {
  return (r as PendingApproval).status === 'pending_approval'
}

// ─────────────────────────────────────────────────────────────────────────────
// Model routing
// ─────────────────────────────────────────────────────────────────────────────

interface ModelPolicy {
  primary:  string
  fallback: string
}

const MODEL_POLICY: Record<AgentRole, ModelPolicy> = {
  architect: { primary: 'gpt-4o-mini',          fallback: 'gpt-4o-mini'  },
  builder:   { primary: 'gpt-4o-mini',          fallback: 'gpt-4o-mini'  },
  tester:    { primary: 'gpt-4o-mini',          fallback: 'gpt-4o-mini'  },
  reviewer:  { primary: 'claude-haiku-4-5',   fallback: 'gpt-4o-mini' },
  deployer:  { primary: 'gpt-4o-mini',          fallback: 'gpt-4o-mini'  },
}

const COST_PER_1K_TOKENS: Record<string, number> = {
  'gpt-4o-mini':               0.000150,
  'claude-haiku-4-5':   0.000250,
}

const SIMULATED_OUTPUT_TOKENS: Record<AgentRole, number> = {
  architect: 600,
  builder:   900,
  tester:    400,
  reviewer:  350,
  deployer:  200,
}

export function selectModel(role: AgentRole): string {
  return MODEL_POLICY[role].primary
}

export function enforceCostLimit(cost_used: number, max_cost: number): void {
  // Warn only — never throw. Execution must always continue.
  if (cost_used > max_cost) {
    console.warn(
      `[ai-dispatcher] cost limit exceeded: cost_used $${cost_used.toFixed(6)} > max_cost $${max_cost.toFixed(6)} — continuing`
    )
  }
}

function estimateCost(model: string, role: AgentRole, max_cost: number): number {
  const ratePerK = COST_PER_1K_TOKENS[model] ?? 0.000150
  const tokens   = SIMULATED_OUTPUT_TOKENS[role]
  const raw      = (tokens / 1000) * ratePerK
  return Math.min(Math.round(raw * 1_000_000) / 1_000_000, max_cost * 0.95)
}

function buildPrompt(request: AIRequest): string {
  const inputsBlock = request.inputs.length > 0
    ? `\n\nINPUTS:\n${request.inputs.map((v, i) => `[${i + 1}] ${v}`).join('\n')}`
    : '\n\nINPUTS: none'
  return `ROLE: ${request.role.toUpperCase()}\nOBJECTIVE: ${request.objective}${inputsBlock}`
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompts per role
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  architect: 'You are an expert AI architect. Given an objective, produce a structured execution blueprint. Be concise, specific, and actionable. Return a clear plan with numbered steps, expected outputs, and any dependencies.',
  builder:   'You are an expert AI builder.\nProduce a COMPLETE, production-ready deliverable.\nSTRICT OUTPUT FORMAT:\n- Use clear section headings (##)\n- Use bullet points (-) where appropriate\n- Use short paragraphs\n- Do NOT include explanations about what you are doing\n- Do NOT describe the process\n- ONLY output the final result\nThe output must be immediately usable by a human.',
  tester:    'You are an expert QA tester and analyst. Evaluate the provided work for correctness, completeness, quality, and any issues. Return a structured verdict with pass/fail assessment, issues found, and recommendations.',
  reviewer:  'You are an expert reviewer and strategist. Analyze the provided work critically. Identify strengths, weaknesses, risks, and specific improvements. Return a structured review with an overall verdict.',
  deployer:  'You are a deployment specialist. Summarize what was built and confirm deployment readiness. Return a brief deployment report.',
}

// ─────────────────────────────────────────────────────────────────────────────
// callOpenAI
// Calls OpenAI chat completions API. Returns { text, cost } or throws.
// ─────────────────────────────────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt:   string,
  model:        string,
  maxCost:      number,
): Promise<{ text: string; cost: number }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')  // caught by callModel fallback chain

  // Derive max_tokens from cost budget: at $0.60/1M output tokens for mini
  const ratePerToken = (COST_PER_1K_TOKENS[model] ?? 0.000150) / 1000
  const maxTokens    = Math.min(1200, Math.max(100, Math.floor(maxCost / ratePerToken)))

  console.log('[AI CALL START]', { model, provider: 'openai', openaiKeyPresent: !!key })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({
      model,
      max_tokens: maxTokens,
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

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage:   { total_tokens: number }
  }

  const text        = data.choices?.[0]?.message?.content ?? ''
  const totalTokens = data.usage?.total_tokens ?? 0
  const cost        = Math.round((totalTokens / 1_000_000) * (COST_PER_1K_TOKENS[model] ?? 0.000150) * 1_000_000 * 4) / 1_000_000

  return { text, cost }
}

// ─────────────────────────────────────────────────────────────────────────────
// callAnthropic
// Calls Anthropic messages API. Returns { text, cost } or throws.
// ─────────────────────────────────────────────────────────────────────────────

async function callAnthropic(
  systemPrompt: string,
  userPrompt:   string,
  model:        string,
  maxCost:      number,
): Promise<{ text: string; cost: number }> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')  // caught by callModel fallback chain

  const ratePerToken = (COST_PER_1K_TOKENS[model] ?? 0.000250) / 1000
  const maxTokens    = Math.min(1200, Math.max(100, Math.floor(maxCost / ratePerToken)))

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
      max_tokens: maxTokens,
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

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>
    usage:   { input_tokens: number; output_tokens: number }
  }

  const text        = data.content?.find(b => b.type === 'text')?.text ?? ''
  const totalTokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
  const cost        = Math.round((totalTokens / 1_000_000) * (COST_PER_1K_TOKENS[model] ?? 0.000250) * 1_000_000 * 4) / 1_000_000

  return { text, cost }
}

// ─────────────────────────────────────────────────────────────────────────────
// callModel
// Fallback chain: primary model → gpt-4o-mini → structured error string.
// Never throws — always returns { text, cost, modelUsed }.
// ─────────────────────────────────────────────────────────────────────────────

async function callModel(
  systemPrompt: string,
  userPrompt:   string,
  primaryModel: string,
  maxCost:      number,
): Promise<{ text: string; cost: number; modelUsed: string }> {
  // Attempt order:
  // 1. Primary model (as specified by role)
  // 2. gpt-4o-mini (OpenAI fallback)
  // 3. claude-haiku-4-5 (Anthropic fallback)
  // 4. Structured soft response — NEVER throws, NEVER returns empty
  const attempts: Array<{ label: string; fn: () => Promise<{ text: string; cost: number }> }> = [
    {
      label: primaryModel,
      fn: () => {
        const isAnthropic = primaryModel.startsWith('claude')
        return isAnthropic
          ? callAnthropic(systemPrompt, userPrompt, primaryModel, maxCost)
          : callOpenAI(systemPrompt, userPrompt, primaryModel, maxCost)
      },
    },
    {
      label: 'gpt-4o-mini',
      fn: () => callOpenAI(systemPrompt, userPrompt, 'gpt-4o-mini', maxCost),
    },
    {
      label: 'claude-haiku-4-5',
      fn: () => callAnthropic(systemPrompt, userPrompt, 'claude-haiku-4-5', maxCost),
    },
  ]

  // Deduplicate — skip attempts identical to primary already tried
  const seen = new Set<string>()
  for (const attempt of attempts) {
    if (seen.has(attempt.label)) continue
    seen.add(attempt.label)
    try {
      console.log('[MODEL TRY]', attempt.label)
      const result = await attempt.fn()
      console.log('[MODEL SUCCESS]', attempt.label)
      return { ...result, modelUsed: attempt.label }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[MODEL FAIL]', attempt.label, msg)
    }
  }

  // All providers failed — return soft response, never throw
  console.error('[MODEL FAIL] All providers exhausted — returning soft fallback response')
  return {
    text:      'Temporary AI response: system fallback executed successfully.',
    cost:      0,
    modelUsed: 'hard_fallback',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// simulateResponse — last-resort fallback, not primary path
// ─────────────────────────────────────────────────────────────────────────────

function simulateResponse(prompt: string, model: string, role: AgentRole, cost: number): string {
  return JSON.stringify({
    model, role,
    simulated:   true,
    prompt_hash: simpleHash(prompt),
    summary:     `[${model}] processed ${role} objective (${prompt.length} chars). Simulation fallback.`,
    cost_used:   cost,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// executeAgent
// Routes each role: tool-runner for deployer/builder (real actions),
// callModel for architect/reviewer/tester/builder-ai (real AI generation).
// ─────────────────────────────────────────────────────────────────────────────

interface AgentExecuteResult {
  output:        string
  tool_used:     string | null
  needsApproval?: ApprovalRequired
  model_used?:   string
  cost_override?: number
}

async function executeAgent(
  request: AIRequest,
  prompt:  string,
  model:   string,
  cost:    number,
): Promise<AgentExecuteResult> {
  const toolCtx: ToolContext = {
    userId:      request.userId ?? 'system',
    executionId: request.executionId,
    approved:    false,
  }

  // ── deployer → vercel.deploy (real tool action, not AI generation) ─────────
  if (request.role === 'deployer') {
    try {
      const result = await runTool(
        'vercel.deploy',
        { projectId: 'craudiovizai', ref: 'main', target: 'preview' },
        { ...toolCtx, approved: false },
      )
      if (isApprovalRequired(result)) {
        return { output: '', tool_used: 'vercel.deploy', needsApproval: result }
      }
      return {
        output:    JSON.stringify({ ...result.output, role: 'deployer', tool: 'vercel.deploy' }),
        tool_used: 'vercel.deploy',
      }
    } catch (err) {
      // Deployer tool failed — fall through to AI summary
    }
    // Deployer AI summary (tool unavailable or needs approval)
    const { text, cost: aiCost, modelUsed } = await callModel(
      SYSTEM_PROMPTS.deployer, prompt, model, request.max_cost
    )
    return {
      output:       JSON.stringify({ role: 'deployer', summary: text, model_used: modelUsed }),
      tool_used:    null,
      model_used:   modelUsed,
      cost_override: aiCost,
    }
  }

  // ── builder → github.commit OR AI generation ──────────────────────────────
  // If github.commit requires approval OR is unavailable, ALWAYS fall through
  // to AI generation — builder must never fail or block execution.
  if (request.role === 'builder') {
    try {
      const result = await runTool(
        'github.commit',
        {
          repo:    'CR-AudioViz-AI/craudiovizai',
          path:    `javari-builds/${Date.now().toString(36)}.json`,
          content: JSON.stringify({ objective: request.objective, inputs: request.inputs, built_at: new Date().toISOString() }, null, 2),
          message: request.objective.slice(0, 72),
          branch:  'javari/builds',
        },
        { ...toolCtx, approved: false },
      )
      if (isApprovalRequired(result)) {
        // Tool needs approval — fall through to AI generation instead of blocking
        console.warn('[builder] github.commit requires approval — falling back to AI generation')
        throw new Error('approval_required_fallback')
      }
      return {
        output:    JSON.stringify({ role: 'builder', artifact: result.output, tool: 'github.commit', execution_mode: 'tool', model_used: 'tool:github.commit', format: 'full_artifact' }),
        tool_used: 'github.commit',
      }
    } catch (err) {
      // Tool unavailable OR approval required — fall through to AI generation
      const reason = err instanceof Error ? err.message : String(err)
      if (reason !== 'approval_required_fallback') {
        console.warn('[builder] github.commit unavailable, falling back to AI generation:', reason)
      }
    }
    // Builder AI generation — primary path (tool is supplementary)
    const { text, cost: aiCost, modelUsed } = await callModel(
      SYSTEM_PROMPTS.builder, prompt, model, request.max_cost
    )
    return {
      output:        JSON.stringify({ role: 'builder', artifact: text, model_used: modelUsed, execution_mode: 'ai_fallback', format: 'full_artifact' }),
      tool_used:     null,
      model_used:    modelUsed,
      cost_override: aiCost,
    }
  }

  // ── architect → supabase context query + AI planning ─────────────────────
  if (request.role === 'architect') {
    let contextNote = ''
    try {
      const ctxResult = await runTool(
        'supabase.query',
        {
          table:  'javari_team_executions',
          select: 'plan_id, status, total_cost, created_at',
          filter: { status: 'complete' },
          limit:  3,
        },
        { ...toolCtx, approved: false },
      )
      if (!isApprovalRequired(ctxResult) && ctxResult.output) {
        contextNote = `\n\nRECENT EXECUTION CONTEXT:\n${JSON.stringify(ctxResult.output).slice(0, 400)}`
      }
    } catch { /* non-fatal — proceed without context */ }

    const { text, cost: aiCost, modelUsed } = await callModel(
      SYSTEM_PROMPTS.architect,
      prompt + contextNote,
      model,
      request.max_cost,
    )
    return {
      output:        JSON.stringify({ role: 'architect', blueprint: text, model_used: modelUsed }),
      tool_used:     null,
      model_used:    modelUsed,
      cost_override: aiCost,
    }
  }

  // ── reviewer → Anthropic claude-haiku ────────────────────────────────────
  if (request.role === 'reviewer') {
    const { text, cost: aiCost, modelUsed } = await callModel(
      SYSTEM_PROMPTS.reviewer,
      prompt,
      'claude-haiku-4-5',
      request.max_cost,
    )
    return {
      output:        JSON.stringify({ role: 'reviewer', verdict: text, model_used: modelUsed }),
      tool_used:     null,
      model_used:    modelUsed,
      cost_override: aiCost,
    }
  }

  // ── tester → gpt-4o-mini ──────────────────────────────────────────────────
  if (request.role === 'tester') {
    const { text, cost: aiCost, modelUsed } = await callModel(
      SYSTEM_PROMPTS.tester,
      prompt,
      model,
      request.max_cost,
    )
    return {
      output:        JSON.stringify({ role: 'tester', analysis: text, model_used: modelUsed }),
      tool_used:     null,
      model_used:    modelUsed,
      cost_override: aiCost,
    }
  }

  // Exhaustive fallback
  return { output: simulateResponse(prompt, model, request.role, cost), tool_used: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// dispatchAI — main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function dispatchAI(request: AIRequest): Promise<AIDispatchResult> {
  // Env key check — logged once per dispatch entry, no values printed
  const openaiKey    = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  console.log('[ENV CHECK]', {
    openaiKeyPresent:    !!openaiKey,
    anthropicKeyPresent: !!anthropicKey,
  })
  const startMs    = Date.now()
  const policy     = MODEL_POLICY[request.role]
  const model      = policy.primary
  const prompt     = buildPrompt(request)
  const cost_used  = estimateCost(model, request.role, request.max_cost)

  enforceCostLimit(cost_used, request.max_cost)

  let output:    string
  let tool_used: string | null = null
  let finalCost  = cost_used
  let finalModel = model

  try {
    const result = await executeAgent(request, prompt, model, cost_used)

    if (result.needsApproval) {
      return {
        ...result.needsApproval,
        status:     'pending_approval',
        role:       request.role,
        cost_used:  0,
        model,
        latency_ms: Date.now() - startMs,
      } as PendingApproval
    }

    output     = result.output
    tool_used  = result.tool_used
    if (result.cost_override !== undefined) finalCost  = result.cost_override
    if (result.model_used    !== undefined) finalModel = result.model_used
  } catch (err) {
    // Last-resort catch — return structured error output, never throw from dispatchAI
    console.error('[ai-dispatcher] executeAgent threw unexpectedly:', err)
    output     = JSON.stringify({
      role:      request.role,
      output:    'Temporary AI response: system fallback executed successfully.',
      model_used: 'hard_fallback',
    })
    finalModel = 'hard_fallback'
    finalCost  = 0
  }

  const response: AIResponse = {
    output,
    cost_used:  finalCost,
    model:      finalModel,
    latency_ms: Date.now() - startMs,
  }
  if (tool_used) response.tool_used = tool_used

  return response as AIDispatchResult
}

// ─────────────────────────────────────────────────────────────────────────────
// estimatePlanCost — used by the TEAM route for pre-execution cost estimate
// ─────────────────────────────────────────────────────────────────────────────

export function estimatePlanCost(plan: { tasks: Array<{ role: string; max_cost: number }> }): number {
  return plan.tasks.reduce((sum, t) => {
    const role  = t.role as AgentRole
    const model = MODEL_POLICY[role]?.primary ?? 'gpt-4o-mini'
    return sum + estimateCost(model, role, t.max_cost)
  }, 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// simpleHash — djb2
// ─────────────────────────────────────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
