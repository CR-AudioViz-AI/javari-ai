// app/api/javari/worker/route.ts
// Javari Worker API — trigger batch processing of javari_jobs queue
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { runWorkerBatch, getWorkerStats } from '@/lib/javari/worker'
export const dynamic = 'force-dynamic'

export async function GET() {
  const stats = getWorkerStats()
  return NextResponse.json({
    worker:   'online',
    stats,
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/javari/worker        — run batch (default 5 jobs)',
      'GET  /api/javari/worker        — worker status',
      'POST /api/javari/orchestrator/run — queue new job',
    ],
  })
}

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json().catch(() => ({}))
    const maxJobs  = Number(body.maxJobs) || 5
    const results  = await runWorkerBatch(maxJobs)
    const stats    = getWorkerStats()

    return NextResponse.json({
      processed: results.length,
      results,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
