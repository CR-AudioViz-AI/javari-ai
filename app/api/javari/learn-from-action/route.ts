// app/api/javari/learn-from-action/route.ts — javari-ai
// Javari learns from every action she takes
// Logs outcomes, adjusts model selection, improves prompts over time
// This is the self-improvement loop — runs after every AI call
// May 17, 2026 — CR AudioViz AI, LLC
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

const GROQ = process.env.GROQ_API_KEY ?? ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      action_type:   string    // 'chat'|'generate'|'voice'|'video'|'execute'
      model_used:    string    // which model was used
      provider:      string    // which provider
      prompt_length: number    // input tokens
      output_length: number    // output tokens
      latency_ms:    number    // how long it took
      cost_usd:      number    // what it cost
      success:       boolean   // did it succeed
      error?:        string    // error if any
      user_rating?:  number    // 1-5 if user rated it
      app_id?:       string    // which javari app called this
      task_type?:    string    // what kind of task
    }

    const supabase = db()

    // 1. Log the action to learning table
    await supabase.from('javari_learning_log').insert({
      action_type:   body.action_type,
      model_used:    body.model_used,
      provider:      body.provider,
      prompt_length: body.prompt_length,
      output_length: body.output_length,
      latency_ms:    body.latency_ms,
      cost_usd:      body.cost_usd,
      success:       body.success,
      error:         body.error ?? null,
      user_rating:   body.user_rating ?? null,
      app_id:        body.app_id ?? null,
      task_type:     body.task_type ?? null,
      created_at:    new Date().toISOString(),
    }).catch(() => {}) // non-fatal

    // 2. Update model performance stats
    if (body.success) {
      const { data: existing } = await supabase
        .from('javari_model_stats')
        .select('*')
        .eq('model', body.model_used)
        .single()
        .catch(() => ({ data: null }))

      if (existing) {
        await supabase.from('javari_model_stats').update({
          total_calls:      (existing.total_calls ?? 0) + 1,
          success_calls:    (existing.success_calls ?? 0) + (body.success ? 1 : 0),
          total_cost:       (existing.total_cost ?? 0) + body.cost_usd,
          avg_latency_ms:   Math.round(((existing.avg_latency_ms ?? 0) * (existing.total_calls ?? 1) + body.latency_ms) / ((existing.total_calls ?? 0) + 1)),
          last_used:        new Date().toISOString(),
        }).eq('model', body.model_used).catch(() => {})
      } else {
        await supabase.from('javari_model_stats').insert({
          model:           body.model_used,
          provider:        body.provider,
          total_calls:     1,
          success_calls:   body.success ? 1 : 0,
          total_cost:      body.cost_usd,
          avg_latency_ms:  body.latency_ms,
          last_used:       new Date().toISOString(),
        }).catch(() => {})
      }
    }

    // 3. If user rated poorly (1-2), trigger self-analysis
    if (body.user_rating && body.user_rating <= 2 && GROQ) {
      // Async self-analysis — don't block the response
      setTimeout(async () => {
        try {
          const analysis = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${GROQ}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama-3.1-8b-instant',
              max_tokens: 300,
              messages: [{
                role: 'user',
                content: `A user rated a Javari AI response 2/5 or lower.
Action type: ${body.action_type}
Model used: ${body.model_used}
Error: ${body.error ?? 'none'}
Latency: ${body.latency_ms}ms

In 2-3 sentences, what likely went wrong and how should Javari improve this type of request?`
              }]
            }),
          })
          if (analysis.ok) {
            const d = await analysis.json() as { choices?: Array<{ message?: { content?: string } }> }
            const insight = d.choices?.[0]?.message?.content ?? ''
            if (insight) {
              await db().from('javari_insights').insert({
                action_type:  body.action_type,
                model_used:   body.model_used,
                user_rating:  body.user_rating,
                insight,
                created_at:   new Date().toISOString(),
              }).catch(() => {})
            }
          }
        } catch { /* non-fatal */ }
      }, 100)
    }

    return NextResponse.json({ logged: true, model: body.model_used })

  } catch (err) {
    return NextResponse.json({ logged: false, error: String(err) })
  }
}

// GET — return learning summary (what Javari has learned)
export async function GET(req: NextRequest) {
  const supabase = db()
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '7')
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const [{ data: stats }, { data: insights }] = await Promise.all([
    supabase.from('javari_model_stats').select('*').order('total_calls', { ascending: false }).limit(20),
    supabase.from('javari_insights').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(10),
  ])

  const totalCalls  = stats?.reduce((s, r) => s + (r.total_calls ?? 0), 0) ?? 0
  const totalCost   = stats?.reduce((s, r) => s + (r.total_cost ?? 0), 0) ?? 0
  const successRate = stats && totalCalls > 0
    ? stats.reduce((s, r) => s + (r.success_calls ?? 0), 0) / totalCalls * 100
    : 100

  return NextResponse.json({
    learning_summary: {
      total_calls:   totalCalls,
      total_cost_usd: totalCost.toFixed(6),
      avg_cost_per_call: totalCalls > 0 ? (totalCost / totalCalls).toFixed(6) : '0',
      success_rate:  `${successRate.toFixed(1)}%`,
      models_used:   stats?.length ?? 0,
      period_days:   days,
    },
    top_models:  stats?.slice(0, 5) ?? [],
    insights:    insights ?? [],
    status:      'Javari is learning and improving every day',
  })
}
