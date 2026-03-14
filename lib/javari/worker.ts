// lib/javari/worker.ts
// Javari Worker — javari_jobs → router → multi-AI execution → results
// Cost guardrails: per-task ceiling + daily ceiling + model whitelist
// Saturday, March 14, 2026
import { createClient }       from '@supabase/supabase-js'
import { routeAndExecute, detectTaskType, COST_CEILINGS } from './router'
import type { TaskType } from './router'

const supabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Daily cost tracker
let dailyCostUsd = 0; let costDate = new Date().toDateString()
function addCost(tokens: number, per1m: number) {
  const today = new Date().toDateString()
  if (today !== costDate) { dailyCostUsd = 0; costDate = today }
  dailyCostUsd += (tokens / 1_000_000) * per1m
  return dailyCostUsd
}

export interface JobResult {
  jobId: string; task: string; status: 'complete' | 'failed'
  output?: string; model?: string; provider?: string; tier?: string; error?: string
}

export async function executeJob(job: {
  id: string; task: string; priority: string; metadata?: Record<string, unknown>
}): Promise<JobResult> {
  const db = supabase()

  // Daily ceiling
  if (dailyCostUsd >= COST_CEILINGS.daily_usd) {
    await db.from('javari_jobs').update({
      status: 'failed', error: `Daily ceiling $${COST_CEILINGS.daily_usd} reached`,
    }).eq('id', job.id)
    return { jobId: job.id, task: job.task, status: 'failed', error: 'daily ceiling' }
  }

  await db.from('javari_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id)

  const meta   = job.metadata ?? {}
  const prompt = `Task: ${job.task}\n${Object.entries(meta).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`
  const type   = detectTaskType(job.task) as TaskType
  const tier   = job.priority === 'critical' ? 'moderate' : 'low'

  try {
    const res = await routeAndExecute(prompt, { taskType: type, maxTier: tier })
    addCost(1000, res.costPer1m)

    await db.from('javari_jobs').update({
      status: 'complete', completed_at: new Date().toISOString(),
      result: { output: res.content, model: res.model, provider: res.provider, tier: res.tier },
    }).eq('id', job.id)
    await db.from('javari_executions').insert({
      job_id: job.id, step: 'ai_execution', step_index: 1, status: 'complete',
      input:  { prompt: prompt.slice(0, 500) },
      output: { content: res.content.slice(0, 2000), model: res.model },
    })
    return { jobId: job.id, task: job.task, status: 'complete',
             output: res.content, model: res.model, provider: res.provider, tier: res.tier }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.from('javari_jobs').update({
      status: 'failed', error: msg, completed_at: new Date().toISOString(),
    }).eq('id', job.id)
    return { jobId: job.id, task: job.task, status: 'failed', error: msg }
  }
}

export async function runWorkerBatch(maxJobs = 5): Promise<JobResult[]> {
  const db = supabase()
  const { data: jobs } = await db.from('javari_jobs')
    .select('id, task, priority, metadata').eq('status', 'queued')
    .order('created_at', { ascending: true }).limit(maxJobs)
  if (!jobs?.length) return []
  const results: JobResult[] = []
  for (const job of jobs) {
    results.push(await executeJob(job))
    if (dailyCostUsd >= COST_CEILINGS.daily_usd) break
  }
  return results
}

export function getWorkerStats() {
  return { dailyCostUsd, ceiling: COST_CEILINGS.daily_usd, date: costDate }
}
