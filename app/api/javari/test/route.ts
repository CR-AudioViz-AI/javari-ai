// app/api/javari/test/route.ts
// Javari Execution Test — end-to-end verification
// Creates a code_generation job, runs it through the worker, returns result
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@supabase/supabase-js'
import { executeJob }     from '@/lib/javari/worker'
import { getWorkerStats } from '@/lib/javari/worker'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Insert test job
    const { data: job, error: insertErr } = await supabase
      .from('javari_jobs')
      .insert({
        task:         'code_generation',
        priority:     'normal',
        status:       'queued',
        dry_run:      false,
        triggered_by: 'javari_execution_test',
        metadata: {
          prompt: 'Generate a TypeScript function that calculates compound interest given principal, rate, time, and compounding frequency. Include JSDoc and error handling.',
          repo:   'javari-ai',
          target: 'lib/utils/finance.ts',
        },
      })
      .select('id, task, priority, metadata')
      .single()

    if (insertErr || !job) {
      return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 })
    }

    // Execute immediately (bypass queue for test)
    const result = await executeJob(job)
    const stats  = getWorkerStats()
    const ms     = Date.now() - start

    return NextResponse.json({
      test:    'code_generation',
      passed:  result.status === 'complete',
      jobId:   result.jobId,
      status:  result.status,
      model:   result.model,
      provider:result.provider,
      tier:    result.tier,
      output:  result.output?.slice(0, 1000),
      error:   result.error,
      duration_ms: ms,
      worker_stats: stats,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg, duration_ms: Date.now() - start }, { status: 500 })
  }
}
