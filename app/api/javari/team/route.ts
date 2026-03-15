// app/api/javari/team/route.ts
// Javari Team API — multi-model ensemble via model-router
// planner -> builder -> validator, all through route()
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { route } from '@/lib/javari/model-router'
export const dynamic = 'force-dynamic'

const SYSTEM = [
  'You are part of Javari AI, the autonomous operating system for CR AudioViz AI.',
  'Mission: "Your Story. Our Design." Be precise and actionable.',
].join('\n')

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const steps: { role: string; model: string; tier: string; content: string; cost: number }[] = []

    // Step 1 - Planner (planning type)
    const plan = await route('planning',
      'Break down this task into 3-5 concrete steps. Be brief.\n\nTask: ' + message,
      { systemPrompt: SYSTEM }
    )
    steps.push({ role: 'planner', model: plan.model, tier: plan.tier, content: plan.content, cost: plan.cost })

    // Step 2 - Builder (coding type for implementation tasks)
    const build = await route('coding',
      'Plan:\n' + plan.content + '\n\nNow execute this plan fully for: ' + message,
      { systemPrompt: SYSTEM }
    )
    steps.push({ role: 'builder', model: build.model, tier: build.tier, content: build.content, cost: build.cost })

    // Step 3 - Validator (verification type)
    const validate = await route('verification',
      'Review this output and return the final best version only.\n\nOutput:\n' + build.content,
      { systemPrompt: SYSTEM }
    )
    steps.push({ role: 'validator', model: validate.model, tier: validate.tier, content: validate.content, cost: validate.cost })

    const totalCost = steps.reduce((s, step) => s + step.cost, 0)

    return NextResponse.json({
      content:    validate.content,
      model:      validate.model,
      tier:       validate.tier,
      total_cost: totalCost,
      ensemble:   steps,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
