// app/api/javari/team/route.ts
// Javari Team API - multi-model ensemble: planner + builder + validator
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { routeAndExecute, detectTaskType } from '@/lib/javari/router'
export const dynamic = 'force-dynamic'

const SYSTEM = [
  'You are part of Javari AI, the autonomous operating system for CR AudioViz AI.',
  'Mission: "Your Story. Our Design." Be precise and actionable.',
].join('\n')

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const taskType = detectTaskType(message)
    const steps: { role: string; model: string; tier: string; content: string }[] = []

    // Step 1 - Planner: break down the task (free model)
    const planPrompt = 'Break down this task into 3-5 concrete steps. Be brief.\n\nTask: ' + message
    const plan = await routeAndExecute(planPrompt, { taskType: 'planning', maxTier: 'low', systemPrompt: SYSTEM })
    steps.push({ role: 'planner', model: plan.model, tier: plan.tier, content: plan.content })

    // Step 2 - Builder: execute the plan (low-cost model)
    const buildPrompt = 'Plan:\n' + plan.content + '\n\nNow execute this plan fully for: ' + message
    const build = await routeAndExecute(buildPrompt, { taskType, maxTier: 'low', systemPrompt: SYSTEM })
    steps.push({ role: 'builder', model: build.model, tier: build.tier, content: build.content })

    // Step 3 - Validator: review and return final best version
    const validatePrompt = 'Review this output and return the final best version only.\n\nOutput:\n' + build.content
    const validate = await routeAndExecute(validatePrompt, { taskType: 'verification', maxTier: 'moderate', systemPrompt: SYSTEM })
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
