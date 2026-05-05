// app/api/execute/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Javari AI Engine — Primary execution endpoint
// Accepts an execution plan from craudiovizai, runs it through the TEAM engine,
// streams SSE results back, writes to javari-ai's own Supabase.
// craudiovizai handles auth + billing. javari-ai handles AI execution only.
// Created: May 1, 2026
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import {
  executePlanStreaming,
} from '@/lib/javari/engine/execution-engine'
import {
  validateExecutionPlan,
  buildExecutionGraph,
} from '@/lib/javari/engine/execution-contract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── CORS — craudiovizai is the only allowed caller ────────────────────────────
const ALLOWED_ORIGINS = [
  'https://craudiovizai.com',
  'https://www.craudiovizai.com',
  process.env.CRAUDIOVIZAI_URL ?? '',
].filter(Boolean)

function withCors(res: NextResponse, origin: string | null): NextResponse {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
  }
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-javari-caller-key')
  return res
}

// ── Caller key — craudiovizai must present this to authenticate ───────────────
const CALLER_KEY = process.env.JAVARI_CALLER_KEY ?? ''

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  return withCors(new NextResponse(null, { status: 200 }), origin)
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')

  // ── Auth: verify caller key ─────────────────────────────────────────────────
  const callerKey = req.headers.get('x-javari-caller-key') ?? ''
  if (!CALLER_KEY || callerKey !== CALLER_KEY) {
    return withCors(
      NextResponse.json({ error: 'Unauthorized', status: 'failed' }, { status: 401 }),
      origin
    )
  }

  // ── Parse + validate plan ───────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return withCors(
      NextResponse.json({ error: 'Invalid JSON body', status: 'failed' }, { status: 400 }),
      origin
    )
  }

  const planResult = validateExecutionPlan(rawBody)
  if (!planResult.success) {
    return withCors(
      NextResponse.json({ error: planResult.error, status: 'failed' }, { status: 422 }),
      origin
    )
  }

  const plan  = planResult.plan
  const graph = buildExecutionGraph(plan)

  // ── Stream execution via SSE ────────────────────────────────────────────────
  const stream = executePlanStreaming(graph, plan)

  const response = new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }

  return response
}

export async function GET() {
  return NextResponse.json({ status: 'javari-ai execution engine online' })
}
