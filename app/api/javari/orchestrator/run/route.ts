// app/api/javari/orchestrator/run/route.ts
// Javari Orchestrator — queue a roadmap task, execute via router, store result
// Step 8: POST triggers execution loop. GET returns status.
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@supabase/supabase-js'
import { route }          from '@/lib/javari/model-router'
import { getDailySpend }  from '@/lib/javari/model-router'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET — status ───────────────────────────────────────────────────────────────
export async function GET() {
  const supabase = db()
  const [jobs, memory, spend] = await Promise.all([
    supabase.from('javari_jobs').select('status', { count: 'exact' })
      .in('status', ['queued','running','complete','failed']),
    supabase.from('javari_memory').select('id', { count: 'exact' }),
    getDailySpend(),
  ])

  const counts = (jobs.data ?? []).reduce((acc: Record<string, number>, r: { status: string }) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1; return acc
  }, {})

  return NextResponse.json({
    orchestrator:  'online',
    jobs:          counts,
    memory_chunks: memory.count ?? 0,
    daily_spend:   `$${spend.toFixed(4)}`,
    budget_left:   `$${Math.max(0, 1.00 - spend).toFixed(4)}`,
    timestamp:     new Date().toISOString(),
  })
}

// ── POST — queue + execute a task ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const start = Date.now()
  const supabase = db()

  try {
    const body = await req.json().catch(() => ({}))
    const task       = body.task     ?? 'general_task'
    const priority   = body.priority ?? 'normal'
    const metadata   = body.metadata ?? {}
    const taskType   = body.task_type ?? detectCanonicalType(task)

    // ── Insert job ────────────────────────────────────────────────────────────
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
        { error: insertErr?.message ?? 'Job insert failed' }, { status: 500 }
      )
    }

    // ── Mark running ──────────────────────────────────────────────────────────
    await supabase.from('javari_jobs').update({
      status: 'running', started_at: new Date().toISOString(),
    }).eq('id', job.id)

    // ── Build prompt ──────────────────────────────────────────────────────────
    const prompt = buildPrompt(task, metadata)

    // ── Execute through router ────────────────────────────────────────────────
    const result = await route(taskType as any, prompt, {
      systemPrompt: [
        'You are Javari AI, the autonomous operating system for CR AudioViz AI.',
        'Execute the given task precisely. Return structured output.',
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

    // ── Store result ──────────────────────────────────────────────────────────
    await supabase.from('javari_jobs').update({
      status: 'complete', completed_at: new Date().toISOString(),
      result: {
        output: result.content, model: result.model,
        provider: result.provider, tier: result.tier, cost: result.cost,
      },
    }).eq('id', job.id)

    // ── Write to javari_memory (Step 9) ───────────────────────────────────────
    const { data: memRow } = await supabase.from('javari_memory').insert({
      task_id:    job.id,
      content:    result.content.slice(0, 8000),
      created_at: new Date().toISOString(),
    }).select('id').single()

    // ── Write execution record ────────────────────────────────────────────────
    await supabase.from('javari_executions').insert({
      job_id:     job.id,
      step:       'orchestrator_execution',
      step_index: 1,
      status:     'complete',
      input:      { prompt: prompt.slice(0, 500), task_type: taskType },
      output:     { content: result.content.slice(0, 2000), model: result.model, cost: result.cost },
    })

    return NextResponse.json({
      job_id:      job.id,
      status:      'complete',
      task,
      task_type:   taskType,
      model:       result.model,
      provider:    result.provider,
      tier:        result.tier,
      cost:        `$${result.cost.toFixed(5)}`,
      attempts:    result.attempts,
      memory_id:   memRow?.id ?? null,
      output:      result.content.slice(0, 2000),
      duration_ms: Date.now() - start,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: msg, duration_ms: Date.now() - start }, { status: 500 }
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPrompt(task: string, meta: Record<string, unknown>): string {
  const metaStr = Object.entries(meta)
    .filter(([k]) => k !== 'task_type')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')
  return `Task: ${task}${metaStr ? '\n\nContext:\n' + metaStr : ''}`
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
