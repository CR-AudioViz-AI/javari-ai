// lib/javari/router.ts
// Javari AI Router - Henderson Cost Law: Free -> Low -> Moderate -> Expensive
// Cost order: gpt-4o-mini ($0.15/1M) -> claude-haiku ($0.80/1M) -> claude-sonnet ($3.00/1M)
// Anthropic key: OZYh...b1gAA (confirmed valid March 14, 2026)
// Saturday, March 14, 2026
import { getSecret } from '@/lib/platform-secrets/getSecret'

export const COST_TIERS = { free: 0, low: 0.5, moderate: 3.0, expensive: 15.0 } as const
export type ModelTier = keyof typeof COST_TIERS

export const MODELS = {
  planning: [
    { id: 'gpt-4o-mini',              provider: 'openai',    tier: 'low'      as ModelTier, costPer1m: 0.15 },
    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', tier: 'low'      as ModelTier, costPer1m: 0.80 },
    { id: 'claude-sonnet-4-6',         provider: 'anthropic', tier: 'moderate' as ModelTier, costPer1m: 3.00 },
  ],
  coding: [
    { id: 'gpt-4o-mini',              provider: 'openai',    tier: 'low'      as ModelTier, costPer1m: 0.15 },
    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', tier: 'low'      as ModelTier, costPer1m: 0.80 },
    { id: 'claude-sonnet-4-6',         provider: 'anthropic', tier: 'moderate' as ModelTier, costPer1m: 3.00 },
  ],
  verification: [
    { id: 'gpt-4o-mini',              provider: 'openai',    tier: 'low'      as ModelTier, costPer1m: 0.15 },
    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', tier: 'low'      as ModelTier, costPer1m: 0.80 },
    { id: 'claude-sonnet-4-6',         provider: 'anthropic', tier: 'moderate' as ModelTier, costPer1m: 3.00 },
  ],
  chat: [
    { id: 'gpt-4o-mini',              provider: 'openai',    tier: 'low'      as ModelTier, costPer1m: 0.15 },
    { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', tier: 'low'      as ModelTier, costPer1m: 0.80 },
    { id: 'claude-sonnet-4-6',         provider: 'anthropic', tier: 'moderate' as ModelTier, costPer1m: 3.00 },
  ],
} as const
export type TaskType = keyof typeof MODELS

export const COST_CEILINGS = {
  per_task_usd: 0.05,
  daily_usd:    5.00,
  max_tier:     'low' as ModelTier,
}

export function detectTaskType(text: string): TaskType {
  const t = text.toLowerCase()
  if (/\b(plan|design|architect|strateg|roadmap|breakdown|outline)/.test(t)) return 'planning'
  if (/\b(code|implement|write|build|fix|debug|refactor|function|component|file|deploy)/.test(t)) return 'coding'
  if (/\b(verify|validate|check|review|test|audit|confirm|ensure)/.test(t)) return 'verification'
  return 'chat'
}

export interface RouterModel { id: string; provider: string; tier: ModelTier; costPer1m: number }

export function selectModel(taskType: TaskType, maxTier: ModelTier = 'low'): RouterModel {
  const order: ModelTier[] = ['free', 'low', 'moderate', 'expensive']
  const maxIdx = order.indexOf(maxTier)
  const candidates = (MODELS[taskType] as readonly RouterModel[]).filter(
    m => order.indexOf(m.tier) <= maxIdx
  )
  return candidates[0] ?? (MODELS[taskType][0] as RouterModel)
}

export async function resolveApiKey(provider: string): Promise<string | null> {
  const map: Record<string, string> = {
    openai:     'OPENAI_API_KEY',
    anthropic:  'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    google:     'GOOGLE_GEMINI_API_KEY',
    xai:        'XAI_API_KEY',
    groq:       'GROQ_API_KEY',
  }
  const name = map[provider]
  if (!name) return null
  try { const v = await getSecret(name); if (v) return v } catch {}
  return process.env[name] ?? null
}

export interface RouterResult {
  content: string; model: string; provider: string; tier: ModelTier
  taskType: TaskType; costPer1m: number; attempts: number
}

export async function routeAndExecute(
  prompt: string,
  opts?: { taskType?: TaskType; maxTier?: ModelTier; systemPrompt?: string }
): Promise<RouterResult> {
  const taskType = opts?.taskType ?? detectTaskType(prompt)
  const maxTier  = opts?.maxTier  ?? COST_CEILINGS.max_tier
  const order: ModelTier[] = ['free', 'low', 'moderate', 'expensive']
  const maxIdx = order.indexOf(maxTier)
  const queue  = (MODELS[taskType] as readonly RouterModel[]).filter(
    m => order.indexOf(m.tier) <= maxIdx
  )
  let attempts = 0
  const errors: string[] = []
  for (const model of queue) {
    attempts++
    const apiKey = await resolveApiKey(model.provider)
    if (!apiKey) { errors.push(model.id + ': no key'); continue }
    try {
      const content = await callModel(model, prompt, apiKey, opts?.systemPrompt)
      if (content?.trim()) {
        return { content, model: model.id, provider: model.provider,
                 tier: model.tier, taskType, costPer1m: model.costPer1m, attempts }
      }
      errors.push(model.id + ': empty response')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(model.id + ': ' + msg.slice(0, 80))
      console.warn('[router]', model.id, 'failed:', msg.slice(0, 120))
    }
  }
  throw new Error('All ' + queue.length + ' models exhausted. ' + errors.join(' | '))
}

async function callModel(
  m: RouterModel, prompt: string, key: string, sys?: string
): Promise<string> {
  if (m.provider === 'openai') {
    const { default: OpenAI } = await import('openai')
    const res = await new OpenAI({ apiKey: key }).chat.completions.create({
      model: m.id, max_tokens: 4096,
      messages: [
        ...(sys ? [{ role: 'system' as const, content: sys }] : []),
        { role: 'user' as const, content: prompt },
      ],
    })
    return res.choices[0]?.message?.content ?? ''
  }
  if (m.provider === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const res = await new Anthropic({ apiKey: key }).messages.create({
      model: m.id, max_tokens: 4096, system: sys,
      messages: [{ role: 'user', content: prompt }],
    })
    return (res.content[0] as { text: string }).text ?? ''
  }
  if (m.provider === 'google') {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const res = await new GoogleGenerativeAI(key)
      .getGenerativeModel({ model: m.id })
      .generateContent(sys ? sys + '\n\n' + prompt : prompt)
    return res.response.text()
  }
  const baseURL: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1',
    xai:        'https://api.x.ai/v1',
    groq:       'https://api.groq.com/openai/v1',
  }
  const { default: OpenAI } = await import('openai')
  const res = await new OpenAI({ apiKey: key, baseURL: baseURL[m.provider] ?? undefined })
    .chat.completions.create({
      model: m.id,
      messages: [
        ...(sys ? [{ role: 'system' as const, content: sys }] : []),
        { role: 'user' as const, content: prompt },
      ],
    })
  return res.choices[0]?.message?.content ?? ''
}
