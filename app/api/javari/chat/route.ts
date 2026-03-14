// app/api/javari/chat/route.ts
// Javari Chat API - single model, cost-optimised routing
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { routeAndExecute, detectTaskType } from '@/lib/javari/router'
export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = [
  'You are Javari AI, the autonomous operating system for CR AudioViz AI.',
  'You help Roy Henderson and Cindy Henderson build the Javari ecosystem.',
  'Mission: "Your Story. Our Design."',
  'Be direct, technical, and actionable. No filler.',
].join('\n')

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const taskType = detectTaskType(message)
    const result   = await routeAndExecute(message, {
      taskType,
      maxTier: 'low',
      systemPrompt: SYSTEM_PROMPT,
    })

    return NextResponse.json({
      content:  result.content,
      model:    result.model,
      provider: result.provider,
      tier:     result.tier,
      taskType: result.taskType,
      attempts: result.attempts,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[javari/chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
