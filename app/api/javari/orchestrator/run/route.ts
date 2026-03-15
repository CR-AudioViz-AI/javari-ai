// app/api/javari/orchestrator/run/route.ts
// Javari Orchestrator — queue a roadmap task, execute via router, store result
// memory_type valid values: fact | context | decision | error | preference
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { route }         from '@/lib/javari/model-router'
import { getDailySpend } from '@/lib/javari/model-router'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET — orchestrator status ─────────────────────────────────────────────────
export async function GET() {
  const supabase = db()
  const [jobsRes, memRes, spend] = await Promise.all([
    supabase.from('javari_jobs').select('status'),
    supabase.from('javari_memory').select('id', { count: 'exact' }),
    getDailySpend(),
  ])

  const counts = (jobsRes.data ?? []).reduce((acc: Record<string, number>, r: { status: string }) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1; return acc
  }, {})

  return NextResponse.json({
    orchestrator:  'online',
    jobs:          counts,
    memory_chunks: memRes.count ?? 0,
    daily_spend:   `$${spend.toFixed(4)}`,
    budget_left:   `$${Math.max(0, 1.00 - spend).toFixed(4)}`,
    router:        { primary: 'gpt-4o-mini', fallback: 'claude-haiku', emergency: 'claude-sonnet' },
    timestamp:     new Date().toISOString(),
  })
}

// ── POST — queue + execute + store to memory ──────────────────────────────────
export async function POST(req: NextRequest) {
  const start    = Date.now()
  const supabase = db()

  try {
    const body     = await req.json().catch(() => ({}))
    const task     = (body.task     ?? 'general_task') as string
    const priority = (body.priority ?? 'normal') as string
    const metadata = (body.metadata ?? {}) as Record<string, unknown>
    const taskType = (body.task_type ?? detectCanonicalType(task)) as string

    // ── Insert job ─────────────────────────────────────────────────────────────
    const { data: job, error: insertErr } = await supabase
      .from('javari_jobs')
      .insert({
        task, priority, status: 'queued', dry_run: false,
        triggered_by: 'orchestrator_run',
        metadata: { ...metadata, task_type: taskType },
      })
      .select('id, task, priority, metadata')
      .single()

    if (insertErr || !job) {
      return NextResponse.json(
        { error: insertErr?.message ?? 'Insert failed' }, { status: 500 }
      )
    }

    // ── Mark running ───────────────────────────────────────────────────────────
    await supabase.from('javari_jobs').update({
      status: 'running', started_at: new Date().toISOString(),
    }).eq('id', job.id)

    // ── Execute through model-router ───────────────────────────────────────────
    const prompt = buildPrompt(task, metadata)
    const result = await route(taskType as any, prompt, {
      systemPrompt: [
        'You are Javari AI, the autonomous operating system for CR AudioViz AI.',
        'Execute the task precisely. Return clear, structured output.',
        'Mission: "Your Story. Our Design."',
      ].join('\n'),
      maxTier: priority === 'critical' ? 'moderate' : 'low',
    })

    if (result.blocked) {
      await supabase.from('javari_jobs').update({
        status: 'failed', error: result.reason,
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
      return NextResponse.json({
        job_id: job.id, status: 'blocked', reason: result.reason,
        duration_ms: Date.now() - start,
      })
    }

    // ── Store job result ───────────────────────────────────────────────────────
    await supabase.from('javari_jobs').update({
      status: 'complete', completed_at: new Date().toISOString(),
      result: {
        output: result.content.slice(0, 4000),
        model: result.model, provider: result.provider,
        tier: result.tier, cost: result.cost,
      },
    }).eq('id', job.id)

    // ── Step 9: Write to javari_memory ────────────────────────────────────────
    // memory_type must be one of: fact | context | decision | error | preference
    const memType = classifyMemoryType(taskType)
    const { data: memRow } = await supabase.from('javari_memory').insert({
      memory_type: memType,
      key:         `job:${job.id}`,
      value:       result.content.slice(0, 2000),
      source:      'javari_orchestrator',
      task_id:     job.id,
      content:     result.content.slice(0, 8000),
    }).select('id').single()

    // ── Write execution record ────────────────────────────────────────────────
    await supabase.from('javari_executions').insert({
      job_id: job.id, step: 'orchestrator_execution', step_index: 1, status: 'complete',
      input:  { prompt: prompt.slice(0, 500), task_type: taskType },
      output: { content: result.content.slice(0, 2000), model: result.model, cost: result.cost },
    })

    return NextResponse.json({
      job_id:      job.id,
      status:      'complete',
      task, task_type: taskType,
      model:       result.model, provider: result.provider,
      tier:        result.tier, cost: `$${result.cost.toFixed(5)}`,
      attempts:    result.attempts,
      memory_id:   memRow?.id ?? null,
      memory_type: memType,
      output:      result.content.slice(0, 2000),
      duration_ms: Date.now() - start,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, duration_ms: Date.now() - start }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPrompt(task: string, meta: Record<string, unknown>): string {
  const ctx = Object.entries(meta)
    .filter(([k]) => k !== 'task_type')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')
  return `Task: ${task}${ctx ? '\n\nContext:\n' + ctx : ''}`
}

function detectCanonicalType(task: string): string {
  const t = task.toLowerCase()
  if (/plan|design|architect|strateg|roadmap|breakdown/.test(t)) return 'planning'
  if (/code|implement|write|build|fix|debug|refactor|function|component|deploy/.test(t)) return 'coding'
  if (/verify|validate|check|review|test|audit|confirm|ensure/.test(t)) return 'verification'
  if (/analys|research|investig|examine|evaluat/.test(t)) return 'analysis'
  if (/document|readme|spec|guide|explain/.test(t)) return 'documentation'
  return 'chat'
}

function classifyMemoryType(taskType: string): 'fact' | 'context' | 'decision' | 'error' | 'preference' {
  // Map task types to valid javari_memory memory_type values
  if (['coding', 'documentation'].includes(taskType)) return 'fact'
  if (['planning', 'analysis'].includes(taskType))    return 'decision'
  if (['verification'].includes(taskType))             return 'fact'
  return 'context'
}
