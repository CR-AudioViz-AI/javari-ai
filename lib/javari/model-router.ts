// lib/javari/model-router.ts
// Javari Model Router — unified entry point for ALL AI calls in the platform
// This is the ONLY file that should make AI provider calls.
// All callers use: import { route } from "@/lib/javari/model-router"
// Saturday, March 14, 2026
import { routeAndExecute, detectTaskType } from './router'
import type { TaskType, ModelTier, RouterResult } from './router'
import { createClient } from '@supabase/supabase-js'

// ── Cost guardrails ────────────────────────────────────────────────────────────
const MAX_COST_PER_TASK = 0.02   // $0.02 hard limit per task
const DAILY_BUDGET      = 1.00   // $1.00/day hard limit

// ── Supabase client ────────────────────────────────────────────────────────────
function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Daily spend tracker ────────────────────────────────────────────────────────
export async function getDailySpend(): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await db()
      .from('daily_spend_tracker')
      .select('cost')
      .eq('date', today)
    return (data ?? []).reduce((sum: number, r: { cost: number }) => sum + (r.cost ?? 0), 0)
  } catch { return 0 }
}

async function recordSpend(
  taskType: string, model: string, provider: string,
  tokensIn: number, tokensOut: number, cost: number
): Promise<void> {
  try {
    await db().from('daily_spend_tracker').insert({
      date:          new Date().toISOString().split('T')[0],
      task_type:     taskType,
      model,
      provider,
      tokens_input:  tokensIn,
      tokens_output: tokensOut,
      cost,
    })
  } catch (err) {
    console.warn('[model-router] spend record failed:', err instanceof Error ? err.message : err)
  }
}

// ── Task type map (canonical) ─────────────────────────────────────────────────
export type CanonicalTaskType =
  | 'planning' | 'coding' | 'verification' | 'chat'
  | 'analysis' | 'documentation' | 'validation'

function normalise(taskType: CanonicalTaskType): TaskType {
  const map: Record<CanonicalTaskType, TaskType> = {
    planning:      'planning',
    coding:        'coding',
    verification:  'verification',
    validation:    'verification',
    chat:          'chat',
    analysis:      'planning',
    documentation: 'chat',
  }
  return map[taskType] ?? 'chat'
}

// ── Model priority enforcement ─────────────────────────────────────────────────
// Step 7: router order is gpt-4o-mini → claude-haiku → claude-sonnet
// Reject any higher-cost model automatically (max_tier = 'low' by default)
const DEFAULT_MAX_TIER: ModelTier = 'low'

// ── Public route() function — THE ONLY AI ENTRY POINT ─────────────────────────
export interface RouteOptions {
  systemPrompt?: string
  maxTier?:      ModelTier
  taskId?:       string
}

export interface RouteResult {
  content:  string
  model:    string
  provider: string
  tier:     ModelTier
  taskType: string
  cost:     number
  attempts: number
  blocked?: boolean
  reason?:  string
}

export async function route(
  taskType: CanonicalTaskType,
  messages: string | Array<{ role: string; content: string }>,
  options?: RouteOptions
): Promise<RouteResult> {
  // Build prompt string
  const prompt = typeof messages === 'string'
    ? messages
    : messages.map(m => `${m.role}: ${m.content}`).join('\n')

  // ── Daily budget guard ──────────────────────────────────────────────────────
  const dailySpend = await getDailySpend()
  if (dailySpend >= DAILY_BUDGET) {
    console.error(`[model-router] DAILY BUDGET EXCEEDED: $${dailySpend.toFixed(4)} >= $${DAILY_BUDGET}`)
    return {
      content:  '',
      model:    'none',
      provider: 'none',
      tier:     'free',
      taskType,
      cost:     0,
      attempts: 0,
      blocked:  true,
      reason:   `Daily budget $${DAILY_BUDGET} exceeded (spent $${dailySpend.toFixed(4)})`,
    }
  }

  // ── Execute through router ──────────────────────────────────────────────────
  const routerType = normalise(taskType)
  const maxTier    = options?.maxTier ?? DEFAULT_MAX_TIER

  const result: RouterResult = await routeAndExecute(prompt, {
    taskType:     routerType,
    maxTier,
    systemPrompt: options?.systemPrompt,
  })

  // ── Cost estimation (rough: ~750 tokens per 1k chars in/out) ───────────────
  const estTokensIn  = Math.ceil(prompt.length / 4)
  const estTokensOut = Math.ceil(result.content.length / 4)
  const estCost      = ((estTokensIn + estTokensOut) / 1_000_000) * result.costPer1m

  // ── Per-task cost guard ─────────────────────────────────────────────────────
  if (estCost > MAX_COST_PER_TASK) {
    console.warn(`[model-router] task cost $${estCost.toFixed(4)} > $${MAX_COST_PER_TASK} ceiling`)
  }

  // ── Record spend (fire-and-forget) ─────────────────────────────────────────
  recordSpend(taskType, result.model, result.provider, estTokensIn, estTokensOut, estCost)

  return {
    content:  result.content,
    model:    result.model,
    provider: result.provider,
    tier:     result.tier,
    taskType,
    cost:     estCost,
    attempts: result.attempts,
  }
}

// ── Convenience wrappers ───────────────────────────────────────────────────────
export const routePlanning      = (p: string, o?: RouteOptions) => route('planning', p, o)
export const routeCoding        = (p: string, o?: RouteOptions) => route('coding', p, o)
export const routeVerification  = (p: string, o?: RouteOptions) => route('verification', p, o)
export const routeAnalysis      = (p: string, o?: RouteOptions) => route('analysis', p, o)
export const routeDocumentation = (p: string, o?: RouteOptions) => route('documentation', p, o)
