// app/api/javari/autonomous-dev/route.ts
// Javari Autonomous Development — executes development tasks automatically
// Uses COST LAW: free models first
// Created: May 14, 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const CALLER_KEY  = process.env.JAVARI_CALLER_KEY ?? ''
const CRAV_URL    = process.env.CRAUDIOVIZAI_URL ?? 'https://craudiovizai.com'

// Development task queue — auto-discovers and fixes issues
async function getNextTask(): Promise<{ objective: string; type: string } | null> {
  // Check if there are pending roadmap tasks
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data } = await db
    .from('roadmap_tasks')
    .select('id, title, description, status')
    .eq('status', 'pending')
    .limit(1)
    .single()
  if (!data) return null
  return { objective: `${data.title}: ${data.description}`, type: 'roadmap' }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const task = await getNextTask()
    if (!task) return NextResponse.json({ status: 'idle', message: 'No pending tasks' })

    // Execute via javari-ai execution engine
    const plan = {
      plan_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      total_estimated_cost: 0,
      tasks: [
        { id: 'task-architect', role: 'architect', objective: task.objective,
          inputs: [], outputs: ['blueprint'], dependencies: [],
          model: 'llama-3.3-70b-versatile', max_cost: 0.01, status: 'pending' },
        { id: 'task-builder', role: 'builder',
          objective: 'Implement the solution from the blueprint',
          inputs: ['blueprint'], outputs: ['artifact'], dependencies: ['task-architect'],
          model: 'llama-3.3-70b-versatile', max_cost: 0.01, status: 'pending' },
      ]
    }

    const res = await fetch(`https://javariai.com/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-javari-caller-key': CALLER_KEY },
      body: JSON.stringify(plan),
    })

    return NextResponse.json({
      status: 'executed',
      task: task.objective.slice(0, 100),
      plan_id: plan.plan_id,
      execution_status: res.status,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Javari autonomous dev ready', cost: '$0.00' })
}
