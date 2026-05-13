// app/api/execute/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — Primary execution endpoint
// Accepts a validated execution plan from craudiovizai.
// Runs the plan via executePlanStreaming(graph, plan, send) callback pattern.
// Wraps the callback in a ReadableStream for SSE delivery.
// ZERO database writes — craudiovizai handles all persistence on complete event.
// Created: May 1, 2026
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
export const maxDuration = 300

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

  // ── Validate plan ─────────────────────────────────────────────────────────
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

  const graph = buildExecutionGraph(plan)
  console.log('[EXECUTION START]', { plan_id: plan.plan_id, tasks: plan.tasks.length })

  // ── Build SSE ReadableStream wrapping the callback-based executePlanStreaming
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: SSEEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Client disconnected — ignore
        }
      }

      try {
        // Emit start event
        send({ type: 'start', plan_id: plan.plan_id } as SSEEvent)

        // Run the execution engine with send callback
        const result = await executePlanStreaming(graph, plan, send)

        // Emit final complete event with full result payload
        const tasks  = Array.from(result.results.values())
        const total  = tasks.reduce((s, t) => s + (t.cost_used ?? 0), 0)
        const failed = tasks.filter(t => t.status === 'failed').length
        const status = failed === tasks.length ? 'failed'
                     : failed > 0             ? 'partial'
                                               : 'complete'

        console.log('[EXECUTION COMPLETE]', { plan_id: plan.plan_id, status, tasks: tasks.length, total_cost: total })

        send({
          type:       'complete',
          plan_id:    plan.plan_id,
          status,
          tasks,
          total_cost: total,
        } as SSEEvent)

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[EXECUTION ERROR]', msg)
        send({ type: 'error', error: msg } as SSEEvent)
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
