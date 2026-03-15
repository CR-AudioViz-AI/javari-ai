// app/api/autonomy/loop/route.ts
// Javari Autonomous Loop — fires on every cron trigger
// Pulls one pending roadmap task, executes it, returns result.
// Budget-gated: stops if daily spend >= $1.00
// Saturday, March 14, 2026
import { NextResponse }  from 'next/server'
import { createClient }  from '@supabase/supabase-js'
import { route }         from '@/lib/javari/model-router'
import { getDailySpend } from '@/lib/javari/model-router'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60   // Vercel function max (Pro plan)

const DAILY_BUDGET  = 1.00
const MAX_PER_CYCLE = 3    // tasks per cron invocation

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET — called by Vercel cron every 2 minutes ───────────────────────────────
export async function GET() {
  const cycleStart = Date.now()
  const supabase   = db()
  const executed: unknown[] = []

  // Step 5: Budget gate
  const spent = await getDailySpend()
  if (spent >= DAILY_BUDGET) {
    return NextResponse.json({
      status:      'budget_reached',
      daily_spend: `$${spent.toFixed(4)}`,
      limit:       `$${DAILY_BUDGET}`,
      cycle_ms:    Date.now() - cycleStart,
    })
  }

  // Step 2: Loop — execute up to MAX_PER_CYCLE tasks per invocation
  for (let i = 0; i < MAX_PER_CYCLE; i++) {
    // Re-check budget each iteration
    const currentSpend = await getDailySpend()
    if (currentSpend >= DAILY_BUDGET) break

    // Pull next pending task
    const { data: tasks } = await supabase
      .from('roadmap_tasks')
      .select('id, title, description, phase_id, metadata')
      .eq('status', 'pending')
      .order('id', { ascending: true })
      .limit(1)

    if (!tasks?.length) break  // No more pending — go idle

    const task     = tasks[0]
    const taskType = detectType(task.title + ' ' + (task.description ?? ''))
    const prompt   = `Task: ${task.title}\n\nDescription:\n${task.description ?? ''}`

    // Mark running
    await supabase.from('roadmap_tasks')
      .update({ status: 'running', updated_at: Date.now() })
      .eq('id', task.id)

    let taskResult: unknown = null
    try {
      const result = await route(taskType as any, prompt, {
        systemPrompt: [
          'You are Javari AI, the autonomous operating system for CR AudioViz AI.',
          'Execute the task precisely. Mission: "Your Story. Our Design."',
        ].join('\n'),
        maxTier: 'low',
      })

      if (result.blocked) {
        await supabase.from('roadmap_tasks')
          .update({ status: 'pending', error: result.reason, updated_at: Date.now() })
          .eq('id', task.id)
        break  // Budget hit — stop cycle
      }

      // Update roadmap_tasks — completed with assigned_model
      await supabase.from('roadmap_tasks').update({
        status:         'completed',
        assigned_model: result.model,
        completed_at:   new Date().toISOString(),
        result:         result.content.slice(0, 1000),
        cost:           result.cost,
        updated_at:     Date.now(),
      }).eq('id', task.id)

      // Write job record
      const { data: job } = await supabase.from('javari_jobs').insert({
        task:         task.title,
        priority:     'normal',
        status:       'complete',
        dry_run:      false,
        triggered_by: 'cron_autonomous_loop',
        metadata:     { roadmap_task_id: task.id, task_type: taskType },
        started_at:   new Date(cycleStart).toISOString(),
        completed_at: new Date().toISOString(),
        result:       { output: result.content.slice(0, 2000), model: result.model, cost: result.cost },
      }).select('id').single()

      // Write memory
      const memType = ['planning','analysis'].includes(taskType) ? 'decision' : 'fact'
      await supabase.from('javari_memory').insert({
        memory_type: memType,
        key:         `roadmap:${task.id}`,
        value:       result.content.slice(0, 2000),
        source:      'cron_autonomous_loop',
        task_id:     job?.id ?? task.id,
        content:     result.content.slice(0, 8000),
      })

      taskResult = {
        roadmap_task_id: task.id,
        title:           task.title,
        task_type:       taskType,
        model:           result.model,
        cost:            result.cost,
        job_id:          job?.id,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Re-queue on failure (up to retry logic in worker)
      await supabase.from('roadmap_tasks')
        .update({ status: 'pending', error: msg, updated_at: Date.now() })
        .eq('id', task.id)
      taskResult = { roadmap_task_id: task.id, title: task.title, error: msg }
    }

    if (taskResult) executed.push(taskResult)
  }

  const finalSpend = await getDailySpend()

  return NextResponse.json({
    status:      executed.length > 0 ? 'executed' : 'idle',
    tasks_run:   executed.length,
    executed,
    daily_spend: `$${finalSpend.toFixed(4)}`,
    budget_left: `$${Math.max(0, DAILY_BUDGET - finalSpend).toFixed(4)}`,
    cycle_ms:    Date.now() - cycleStart,
    timestamp:   new Date().toISOString(),
  })
}

function detectType(text: string): string {
  const t = text.toLowerCase()
  if (/plan|design|architect|strateg|roadmap|breakdown/.test(t)) return 'planning'
  if (/code|implement|write|build|fix|debug|refactor|function|component|deploy/.test(t)) return 'coding'
  if (/verify|validate|check|review|test|audit|confirm|ensure/.test(t)) return 'verification'
  if (/analys|research|investig|examine|evaluat/.test(t)) return 'analysis'
  if (/document|readme|spec|guide|explain/.test(t)) return 'documentation'
  return 'chat'
}
