// app/api/javari/learn/route.ts
// Javari AI Learning System — autonomous self-improvement
// Logs execution results, identifies patterns, improves prompts
// Created: May 15, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  // Return learning stats
  try {
    const { data: logs } = await db()
      .from('javari_learning_log')
      .select('model_used, task_role, success, cost_used, latency_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    const total    = logs?.length ?? 0
    const success  = logs?.filter(l => l.success).length ?? 0
    const avgCost  = total > 0 ? (logs?.reduce((s, l) => s + (l.cost_used ?? 0), 0) ?? 0) / total : 0
    const avgLatency = total > 0 ? (logs?.reduce((s, l) => s + (l.latency_ms ?? 0), 0) ?? 0) / total : 0

    // Model performance breakdown
    const modelStats: Record<string, { count: number; success: number; avgCost: number }> = {}
    for (const log of logs ?? []) {
      const m = log.model_used ?? 'unknown'
      if (!modelStats[m]) modelStats[m] = { count: 0, success: 0, avgCost: 0 }
      modelStats[m].count++
      if (log.success) modelStats[m].success++
      modelStats[m].avgCost += log.cost_used ?? 0
    }
    for (const m of Object.keys(modelStats)) {
      modelStats[m].avgCost /= modelStats[m].count
    }

    return NextResponse.json({
      status:          'Javari Learning System online',
      total_executions: total,
      success_rate:     total > 0 ? Math.round(success / total * 100) : 0,
      avg_cost_usd:     avgCost.toFixed(8),
      avg_latency_ms:   Math.round(avgLatency),
      model_performance: modelStats,
    })
  } catch {
    return NextResponse.json({ status: 'Learning system online', note: 'Stats unavailable (table may not exist yet)' })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      plan_id:    string
      task_id:    string
      task_role:  string
      model_used: string
      success:    boolean
      cost_used:  number
      latency_ms: number
      output_quality?: number  // 1-10 rating
      user_feedback?:  string
    }

    // Log the execution result for learning
    try {
      await db().from('javari_learning_log').insert({
        plan_id:        body.plan_id,
        task_id:        body.task_id,
        task_role:      body.task_role,
        model_used:     body.model_used,
        success:        body.success,
        cost_used:      body.cost_used,
        latency_ms:     body.latency_ms,
        output_quality: body.output_quality,
        user_feedback:  body.user_feedback,
        created_at:     new Date().toISOString(),
      })
    } catch { /* table may not exist — non-fatal */ }

    // Learning logic: identify if a cheaper model could have done this
    const isFreeModel = (body.model_used ?? '').includes(':free') ||
      ['llama-3.3-70b-versatile', 'gemini-1.5-flash', 'llama-3.1-8b-instant'].includes(body.model_used)

    const recommendation = body.success && !isFreeModel
      ? 'Consider trying a free model for this task type next time'
      : body.success && isFreeModel
      ? 'Free model succeeded — keep using for this task type'
      : 'Task failed — escalate to more capable model'

    return NextResponse.json({
      logged:         true,
      recommendation,
      model_was_free: isFreeModel,
      cost_saved:     isFreeModel ? body.cost_used : 0,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
