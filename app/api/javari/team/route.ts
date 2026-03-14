// app/api/javari/team/route.ts
// Javari Team API — multi-model ensemble: planner (cheap) + builder (cheap) + validator (best)
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { routeAndExecute, detectTaskType } from '@/lib/javari/router'
export const dynamic = 'force-dynamic'

const SYSTEM = \`You are part of Javari AI, the autonomous operating system for CR AudioViz AI.
Mission: "Your Story. Our Design." Be precise and actionable.\`

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const taskType = detectTaskType(message)
    const steps: { role: string; model: string; tier: string; content: string }[] = []

    // Step 1 — Planner: break down the task (free model)
    const plan = await routeAndExecute(
      \`Break down this task into 3-5 concrete steps. Be brief and specific.\n\nTask: \${message}\`,
      { taskType: 'planning', maxTier: 'free', systemPrompt: SYSTEM }
    )
    steps.push({ role: 'planner', model: plan.model, tier: plan.tier, content: plan.content })

    // Step 2 — Builder: execute the plan (low-cost model)
    const build = await routeAndExecute(
      \`Plan:\n\${plan.content}\n\nNow execute this plan fully for: \${message}\`,
      { taskType, maxTier: 'low', systemPrompt: SYSTEM }
    )
    steps.push({ role: 'builder', model: build.model, tier: build.tier, content: build.content })

    // Step 3 — Validator: review and improve (best available)
    const validate = await routeAndExecute(
      \`Review this output and improve it if needed. Return the final best version only.\n\nOutput:\n\${build.content}\`,
      { taskType: 'verification', maxTier: 'moderate', systemPrompt: SYSTEM }
    )
    steps.push({ role: 'validator', model: validate.model, tier: validate.tier, content: validate.content })

    return NextResponse.json({
      content:  validate.content,
      model:    validate.model,
      tier:     validate.tier,
      ensemble: steps,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
