// app/api/javari/orchestrator/run/route.ts
// Javari Orchestrator — queue reader + manual trigger
// GET:  pulls next pending task from roadmap_tasks and executes it
// POST: accepts manual task input (body), executes immediately
// Both paths: route() -> javari_jobs -> javari_memory -> roadmap_tasks update
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { route }         from '@/lib/javari/model-router'
import { getDailySpend } from '@/lib/javari/model-router'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DAILY_BUDGET = 1.00

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET — pull next pending roadmap task and execute it ───────────────────────
export async function GET() {
  const start    = Date.now()
  const supabase = db()

  // Step 5: Budget safety check
  const spent = await getDailySpend()
  if (spent >= DAILY_BUDGET) {
    return NextResponse.json({
      status:      'budget_reached',
      daily_spend: `$${spent.toFixed(4)}`,
      limit:       `$${DAILY_BUDGET}`,
    })
  }

  // Step 1: Pull next pending task — no priority column, order by id ASC
  const { data: tasks } = await supabase
    .from('roadmap_tasks')
    .select('id, title, description, phase_id, source, metadata')
    .eq('status', 'pending')
    .order('id', { ascending: true })
    .limit(1)

  if (!tasks?.length) {
    const counts = await getJobCounts(supabase)
    return NextResponse.json({
      status:      'idle',
      message:     'No pending tasks in roadmap_tasks',
      jobs:        counts,
      daily_spend: `$${spent.toFixed(4)}`,
      budget_left: `$${Math.max(0, DAILY_BUDGET - spent).toFixed(4)}`,
      timestamp:   new Date().toISOString(),
    })
  }

  const task = tasks[0]
  return executeRoadmapTask(task, start, supabase)
}

// ── POST — manual task or status check ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const start    = Date.now()
  const supabase = db()
  const body     = await req.json().catch(() => ({}))

  // Budget check
  const spent = await getDailySpend()
  if (spent >= DAILY_BUDGET) {
    return NextResponse.json({
      status:      'budget_reached',
      daily_spend: `$${spent.toFixed(4)}`,
    })
  }

  // If body has { pull: true } — pull from queue like GET
  if (body.pull === true) {
    const { data: tasks } = await supabase
      .from('roadmap_tasks')
      .select('id, title, description, phase_id, source, metadata')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .limit(1)

    if (!tasks?.length) {
      return NextResponse.json({ status: 'idle', message: 'No pending tasks' })
    }
    return executeRoadmapTask(tasks[0], start, supabase)
  }

  // Manual task from body
  const task     = (body.task     ?? 'general_task') as string
  const priority = (body.priority ?? 'normal') as string
  const metadata = (body.metadata ?? {}) as Record<string, unknown>
  const taskType = (body.task_type ?? detectType(task)) as string

  return executeManualTask({ task, priority, taskType, metadata }, start, supabase)
}

// ── Execute a roadmap_tasks row ───────────────────────────────────────────────
async function executeRoadmapTask(
  roadmapTask: { id: string; title: string; description: string; phase_id: string; source?: string; metadata?: Record<string, unknown> },
  start: number,
  supabase: ReturnType<typeof db>
) {
  const meta     = (roadmapTask.metadata ?? {}) as Record<string, unknown>
  const taskType = detectType(roadmapTask.title + ' ' + roadmapTask.description)
  const prompt   = `Task: ${roadmapTask.title}\n\nDescription:\n${roadmapTask.description}`

  // Mark running in roadmap_tasks
  await supabase.from('roadmap_tasks')
    .update({ status: 'running', updated_at: Date.now() })
    .eq('id', roadmapTask.id)

  try {
    const result = await route(taskType as any, prompt, {
      systemPrompt: [
        'You are Javari AI, the autonomous operating system for CR AudioViz AI.',
        'Execute the task precisely. Return clear, actionable output.',
        'Mission: "Your Story. Our Design."',
      ].join('\n'),
      maxTier: 'low',
    })

    if (result.blocked) {
      await supabase.from('roadmap_tasks').update({
        status:     'pending',
        updated_at: Date.now(),
        error:      result.reason,
      }).eq('id', roadmapTask.id)
      return NextResponse.json({ status: 'budget_reached', reason: result.reason })
    }

    // Step 1: Update roadmap_tasks — status=completed, assigned_model, completed_at
    await supabase.from('roadmap_tasks').update({
      status:          'completed',
      assigned_model:  result.model,
      completed_at:    new Date().toISOString(),
      result:          result.content.slice(0, 1000),
      cost:            result.cost,
      updated_at:      Date.now(),
    }).eq('id', roadmapTask.id)

    // Write job record
    const { data: job } = await supabase.from('javari_jobs').insert({
      task:         roadmapTask.title,
      priority:     'normal',
      status:       'complete',
      dry_run:      false,
      triggered_by: 'autonomous_queue_reader',
      metadata:     { roadmap_task_id: roadmapTask.id, task_type: taskType, phase_id: roadmapTask.phase_id },
      started_at:   new Date(start).toISOString(),
      completed_at: new Date().toISOString(),
      result:       { output: result.content.slice(0, 2000), model: result.model, cost: result.cost },
    }).select('id').single()

    // Write memory
    const memType = taskType === 'planning' || taskType === 'analysis' ? 'decision' : 'fact'
    const { data: mem } = await supabase.from('javari_memory').insert({
      memory_type: memType,
      key:         `roadmap:${roadmapTask.id}`,
      value:       result.content.slice(0, 2000),
      source:      'autonomous_orchestrator',
      task_id:     job?.id ?? roadmapTask.id,
      content:     result.content.slice(0, 8000),
    }).select('id').single()

    return NextResponse.json({
      status:            'executed',
      roadmap_task_id:   roadmapTask.id,
      roadmap_task_title:roadmapTask.title,
      task_type:         taskType,
      model:             result.model,
      provider:          result.provider,
      tier:              result.tier,
      cost:              `$${result.cost.toFixed(5)}`,
      memory_id:         mem?.id ?? null,
      job_id:            job?.id ?? null,
      output_preview:    result.content.slice(0, 300),
      duration_ms:       Date.now() - start,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabase.from('roadmap_tasks').update({
      status: 'pending', error: msg, updated_at: Date.now(),
    }).eq('id', roadmapTask.id)
    return NextResponse.json({ error: msg, roadmap_task_id: roadmapTask.id }, { status: 500 })
  }
}

// ── Execute a manual task ─────────────────────────────────────────────────────
async function executeManualTask(
  input: { task: string; priority: string; taskType: string; metadata: Record<string, unknown> },
  start: number,
  supabase: ReturnType<typeof db>
) {
  const { task, priority, taskType, metadata } = input
  const prompt = `Task: ${task}\n${Object.entries(metadata)
    .filter(([k]) => k !== 'task_type')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`

  const { data: job } = await supabase.from('javari_jobs').insert({
    task, priority, status: 'running', dry_run: false,
    triggered_by: 'orchestrator_manual',
    metadata:     { ...metadata, task_type: taskType },
    started_at:   new Date().toISOString(),
  }).select('id').single()

  try {
    const result = await route(taskType as any, prompt, {
      systemPrompt: 'You are Javari AI. Execute tasks precisely. Mission: "Your Story. Our Design."',
      maxTier:      priority === 'critical' ? 'moderate' : 'low',
    })

    if (result.blocked) {
      await supabase.from('javari_jobs').update({ status: 'failed', error: result.reason,
        completed_at: new Date().toISOString() }).eq('id', job?.id ?? '')
      return NextResponse.json({ status: 'budget_reached', reason: result.reason })
    }

    await supabase.from('javari_jobs').update({
      status: 'complete', completed_at: new Date().toISOString(),
      result: { output: result.content.slice(0, 4000), model: result.model, cost: result.cost },
    }).eq('id', job?.id ?? '')

    const memType = taskType === 'planning' || taskType === 'analysis' ? 'decision' : 'fact'
    const { data: mem } = await supabase.from('javari_memory').insert({
      memory_type: memType, key: `job:${job?.id}`,
      value: result.content.slice(0, 2000), source: 'javari_orchestrator',
      task_id: job?.id, content: result.content.slice(0, 8000),
    }).select('id').single()

    return NextResponse.json({
      job_id: job?.id, status: 'complete', task, task_type: taskType,
      model: result.model, provider: result.provider, tier: result.tier,
      cost: `$${result.cost.toFixed(5)}`, memory_id: mem?.id ?? null,
      output: result.content.slice(0, 2000), duration_ms: Date.now() - start,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (job?.id) await supabase.from('javari_jobs').update({
      status: 'failed', error: msg, completed_at: new Date().toISOString(),
    }).eq('id', job.id)
    return NextResponse.json({ error: msg, duration_ms: Date.now() - start }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectType(text: string): string {
  const t = text.toLowerCase()
  if (/plan|design|architect|strateg|roadmap|breakdown/.test(t)) return 'planning'
  if (/code|implement|write|build|fix|debug|refactor|function|component|deploy/.test(t)) return 'coding'
  if (/verify|validate|check|review|test|audit|confirm|ensure/.test(t)) return 'verification'
  if (/analys|research|investig|examine|evaluat/.test(t)) return 'analysis'
  if (/document|readme|spec|guide|explain/.test(t)) return 'documentation'
  return 'chat'
}

async function getJobCounts(supabase: ReturnType<typeof db>) {
  const { data } = await supabase.from('javari_jobs').select('status')
  return (data ?? []).reduce((acc: Record<string, number>, r: { status: string }) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1; return acc
  }, {})
}
