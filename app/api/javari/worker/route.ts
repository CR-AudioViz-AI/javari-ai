// app/api/javari/worker/route.ts
// Javari Worker — execution loop: fetch queued jobs -> route() -> store results + memory
// Retry up to 3 times. Does not stop on single failure. Step 6.
// memory_type valid values: fact | context | decision | error | preference
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { route }         from '@/lib/javari/model-router'
import { getDailySpend } from '@/lib/javari/model-router'
export const dynamic = 'force-dynamic'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const spend = await getDailySpend()
  return NextResponse.json({
    worker:      'online',
    daily_spend: `$${spend.toFixed(4)}`,
    budget_left: `$${Math.max(0, 1.00 - spend).toFixed(4)}`,
    timestamp:   new Date().toISOString(),
    router:      { order: ['gpt-4o-mini', 'claude-haiku', 'claude-sonnet'], max_tier: 'low' },
  })
}

export async function POST(req: NextRequest) {
  const body     = await req.json().catch(() => ({}))
  const maxJobs  = Math.min(Number(body.maxJobs) || 5, 20)
  const supabase = db()
  const results: unknown[] = []
  let processed = 0

  // ── Execution loop (Step 6): while tasks_remaining, fetch -> execute -> store ─
  while (processed < maxJobs) {
    const { data: jobs } = await supabase
      .from('javari_jobs')
      .select('id, task, priority, metadata')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)

    if (!jobs?.length) break   // No more queued jobs

    const job  = jobs[0]
    const meta = (job.metadata ?? {}) as Record<string, unknown>
    const type = (meta.task_type as string) ?? 'chat'

    await supabase.from('javari_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)

    // ── Retry loop — up to 3 attempts ─────────────────────────────────────────
    let success = false
    let lastErr = ''

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const prompt = `Task: ${job.task}\n${Object.entries(meta)
          .filter(([k]) => k !== 'task_type')
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`

        const result = await route(type as any, prompt, {
          maxTier: job.priority === 'critical' ? 'moderate' : 'low',
        })

        if (result.blocked) {
          await supabase.from('javari_jobs').update({
            status: 'failed', error: result.reason,
            completed_at: new Date().toISOString(),
          }).eq('id', job.id)
          results.push({ jobId: job.id, status: 'blocked', reason: result.reason })
          success = true
          break
        }

        // Store result
        await supabase.from('javari_jobs').update({
          status: 'complete', completed_at: new Date().toISOString(),
          result: { output: result.content.slice(0, 4000), model: result.model, cost: result.cost },
        }).eq('id', job.id)

        // Step 9: Write to javari_memory
        const memType = type === 'planning' || type === 'analysis' ? 'decision' : 'fact'
        await supabase.from('javari_memory').insert({
          memory_type: memType,
          key:         `job:${job.id}:attempt:${attempt}`,
          value:       result.content.slice(0, 2000),
          source:      'javari_worker',
          task_id:     job.id,
          content:     result.content.slice(0, 8000),
        })

        results.push({
          jobId:   job.id,
          status:  'complete',
          model:   result.model,
          tier:    result.tier,
          cost:    result.cost,
          attempt,
        })
        success = true
        break
      } catch (err: unknown) {
        lastErr = err instanceof Error ? err.message : String(err)
        // Re-queue for retry (only if not last attempt)
        if (attempt < 3) {
          await supabase.from('javari_jobs')
            .update({ status: 'queued' }).eq('id', job.id)
          await new Promise(r => setTimeout(r, 1000 * attempt)) // back-off
        }
      }
    }

    if (!success) {
      await supabase.from('javari_jobs').update({
        status: 'failed', error: lastErr, completed_at: new Date().toISOString(),
      }).eq('id', job.id)
      // Store error in memory
      await supabase.from('javari_memory').insert({
        memory_type: 'error',
        key:         `job:${job.id}:failed`,
        value:       lastErr.slice(0, 500),
        source:      'javari_worker',
        task_id:     job.id,
      })
      results.push({ jobId: job.id, status: 'failed', error: lastErr })
    }

    processed++
  }

  const spend = await getDailySpend()
  return NextResponse.json({
    processed,
    results,
    daily_spend: `$${spend.toFixed(4)}`,
    budget_left: `$${Math.max(0, 1.00 - spend).toFixed(4)}`,
    timestamp:   new Date().toISOString(),
  })
}
