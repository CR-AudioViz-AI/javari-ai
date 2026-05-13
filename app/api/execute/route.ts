// app/api/execute/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — Primary execution endpoint
// Accepts a validated execution plan from craudiovizai.
// Creates ReadableStream, passes send() callback into executePlanStreaming().
// Guarantees complete event. Zero database writes.
// craudiovizai handles all DB persistence on complete event.
// Created: May 1, 2026 | Stabilized: May 12, 2026
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse }    from 'next/server'
import { executePlanStreaming }         from '@/lib/javari/engine/execution-engine'
import type { SSEEvent }               from '@/lib/javari/engine/execution-engine'
import {
  validateExecutionPlan,
  buildExecutionGraph,
} from '@/lib/javari/engine/execution-contract'
import type { ExecutionPlan }          from '@/lib/javari/engine/execution-contract'

export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 60

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://craudiovizai.com',
  'https://www.craudiovizai.com',
  process.env.CRAUDIOVIZAI_URL ?? '',
].filter(Boolean)

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-javari-caller-key',
    }
  }
  return {}
}

const CALLER_KEY = process.env.JAVARI_CALLER_KEY ?? ''

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 200, headers: corsHeaders(origin) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  // ── Auth ──────────────────────────────────────────────────────────────────
  const callerKey = req.headers.get('x-javari-caller-key') ?? ''
  if (!CALLER_KEY || callerKey !== CALLER_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', status: 'failed' },
      { status: 401, headers: corsHeaders(origin) }
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', status: 'failed' },
      { status: 400, headers: corsHeaders(origin) }
    )
  }

  // ── Validate plan — validateExecutionPlan throws on failure ───────────────
  console.log('[PLAN RECEIVED]', JSON.stringify(rawBody, null, 2))

  let plan: ExecutionPlan
  try {
    plan = validateExecutionPlan(rawBody)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PLAN VALIDATION ERROR]', msg)
    return new NextResponse(JSON.stringify({
      status:        'validation_failed',
      error:         msg,
      plan_received: rawBody,
    }), {
      status:  400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }

  let graph
  try {
    graph = buildExecutionGraph(plan)
    console.log('[GRAPH BUILT]', { plan_id: plan.plan_id, tasks: plan.tasks.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GRAPH BUILD ERROR]', msg)
    return NextResponse.json({ error: msg, status: 'graph_error' }, { status: 500, headers: corsHeaders(origin) })
  }

  // ── Build SSE ReadableStream ───────────────────────────────────────────────
  // executePlanStreaming uses callback pattern — we wrap it in ReadableStream
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: SSEEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Client disconnected
        }
      }

      let completed = false
      try {
        // Emit start
        send({ type: 'start', plan_id: plan.plan_id } as SSEEvent)

        // Accumulate task results from callbacks for the complete event
        const completedTasks: unknown[] = []
        let   totalCost = 0

        // Wrap send to accumulate task_complete results
        const wrappedSend = (event: SSEEvent) => {
          if (event.type === 'task_complete' || event.type === 'task_error') {
            const result = (event as Record<string, unknown>)['result']
            if (result && typeof result === 'object') {
              completedTasks.push(result)
              totalCost += ((result as Record<string, number>)['cost_used'] ?? 0)
            }
          }
          send(event)
        }

        // Run engine with wrapped send callback
        await executePlanStreaming(graph, plan, wrappedSend)

        // Guaranteed complete event
        const failed = completedTasks.filter(
          (t) => (t as Record<string,string>)['status'] === 'failed'
        ).length
        const status = failed === completedTasks.length && completedTasks.length > 0 ? 'failed'
                     : failed > 0 ? 'partial'
                     : 'complete'

        send({
          type:       'complete',
          plan_id:    plan.plan_id,
          status,
          tasks:      completedTasks,
          total_cost: totalCost,
        } as SSEEvent)

        completed = true

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[EXECUTION ERROR]', msg)
        send({ type: 'error', error: msg } as SSEEvent)

        // Guaranteed complete even on error
        if (!completed) {
          send({ type: 'complete', plan_id: plan.plan_id, status: 'failed', tasks: [], total_cost: 0 } as SSEEvent)
        }
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new NextResponse(stream, {
    status:  200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders(origin),
    },
  })
}

export async function GET() {
  return NextResponse.json({
    status:    'javari-ai execution engine online',
    db_writes: false,
    note:      'zero database writes — craudiovizai owns all persistence',
  })
}
