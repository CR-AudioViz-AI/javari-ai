// app/api/javari/worker/route.ts
// Javari Worker API — batch job processor using model-router
// Step 6: Execution loop — fetch -> execute -> store, retry up to 3x
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { route }        from '@/lib/javari/model-router'
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
  })
}

export async function POST(req: NextRequest) {
  const body    = await req.json().catch(() => ({}))
  const maxJobs = Math.min(Number(body.maxJobs) || 5, 20)
  const supabase = db()
  const results: unknown[] = []

  // ── Execution loop (Step 6) ────────────────────────────────────────────────
  // while (tasks_remaining) { fetch -> execute -> store }
  // Does not stop on single failure — continues to next job.
  let processed = 0
  while (processed < maxJobs) {
    const { data: jobs } = await supabase
      .from('javari_jobs')
      .select('id, task, priority, metadata')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)

    if (!jobs?.length) break  // No more queued jobs

    const job   = jobs[0]
    const meta  = (job.metadata ?? {}) as Record<string, unknown>
    const type  = (meta.task_type as string) ?? 'chat'

    // Mark running
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
          .map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`

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

        // Store result + memory
        await supabase.from('javari_jobs').update({
          status: 'complete', completed_at: new Date().toISOString(),
          result: { output: result.content, model: result.model, cost: result.cost },
        }).eq('id', job.id)

        await supabase.from('javari_memory').insert({
          task_id:    job.id,
          content:    result.content.slice(0, 8000),
          created_at: new Date().toISOString(),
        })

        results.push({ jobId: job.id, status: 'complete', model: result.model, tier: result.tier, attempt })
        success = true
        break
      } catch (err: unknown) {
        lastErr = err instanceof Error ? err.message : String(err)
        if (attempt < 3) {
          await supabase.from('javari_jobs')
            .update({ status: 'queued' }).eq('id', job.id)  // re-queue for retry
        }
      }
    }

    if (!success) {
      await supabase.from('javari_jobs').update({
        status: 'failed', error: lastErr, completed_at: new Date().toISOString(),
      }).eq('id', job.id)
      results.push({ jobId: job.id, status: 'failed', error: lastErr })
    }

    processed++
  }

  const spend = await getDailySpend()
  return NextResponse.json({
    processed,
    results,
    daily_spend: `$${spend.toFixed(4)}`,
    timestamp:   new Date().toISOString(),
  })
}
