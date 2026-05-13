// app/api/execute/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — Primary execution endpoint
// Accepts a validated execution plan from craudiovizai.
// Runs the plan through the stateless TEAM engine.
// Streams SSE results back. ZERO database writes.
// craudiovizai receives ExecutionOutput and handles all DB, billing, credits.
// Created: May 1, 2026
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { executePlanStreaming }   from '@/lib/javari/engine/execution-engine'
import {
  validateExecutionPlan,
  buildExecutionGraph,
} from '@/lib/javari/engine/execution-contract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── CORS — only craudiovizai may call this endpoint ───────────────────────────
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

// ── Caller key — shared secret between craudiovizai and javari-ai ─────────────
const CALLER_KEY = process.env.JAVARI_CALLER_KEY ?? ''

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return new NextResponse(null, { status: 200, headers: corsHeaders(origin) })
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const callerKey = req.headers.get('x-javari-caller-key') ?? ''
  if (!CALLER_KEY || callerKey !== CALLER_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized', status: 'failed' },
      { status: 401, headers: corsHeaders(origin) }
    )
  }

  // ── Parse + validate plan ────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON', status: 'failed' },
      { status: 400, headers: corsHeaders(origin) }
    )
  }

  // ── Diagnostic logging + validation ─────────────────────────────────────────
  // validateExecutionPlan() throws on failure — it does NOT return { success }
  console.log('[PLAN RECEIVED]', JSON.stringify(rawBody, null, 2))

  let plan: ExecutionPlan
  try {
    plan = validateExecutionPlan(rawBody)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PLAN VALIDATION ERROR]', msg)
    return new Response(JSON.stringify({
      status:        'validation_failed',
      error:         msg,
      plan_received: rawBody,
    }), {
      status:  400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }

  const graph = buildExecutionGraph(plan)

  // ── Stream SSE — no DB writes happen here ────────────────────────────────────
  // The stream emits:
  //   { type: 'task_start',    task_id }
  //   { type: 'task_complete', task_id, result }
  //   { type: 'task_error',    task_id, error }
  //   { type: 'error',         error }
  //   { type: 'complete',      plan_id, status, total_cost, tasks }
  //
  // craudiovizai listens for 'complete' and uses the payload to:
  //   - write javari_team_executions to its Supabase
  //   - deduct credits
  //   - update billing records
  const stream = executePlanStreaming(graph, plan)

  return new NextResponse(stream, {
    status:  200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders(origin),
    },
  })
}

export async function GET() {
  return NextResponse.json({
    status:   'javari-ai execution engine online',
    db_writes: false,
    note:     'zero database writes — craudiovizai owns all persistence',
  })
}
