// app/api/javari/chat/route.ts
// Javari Chat API — ALL calls go through lib/javari/model-router
// No direct model references. Step 3.
// Saturday, March 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { route }           from '@/lib/javari/model-router'
import { detectTaskType }  from '@/lib/javari/router'
export const dynamic = 'force-dynamic'

const SYSTEM = [
  'You are Javari AI, the autonomous operating system for CR AudioViz AI.',
  'You help Roy Henderson and Cindy Henderson build the Javari ecosystem.',
  'Mission: "Your Story. Our Design." Be direct, technical, and actionable.',
].join('\n')

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 })

    const taskType = detectTaskType(message) as any
    const result   = await route(taskType, message, { systemPrompt: SYSTEM })

    if (result.blocked) {
      return NextResponse.json({ error: result.reason, blocked: true }, { status: 429 })
    }

    return NextResponse.json({
      content:  result.content,
      model:    result.model,
      provider: result.provider,
      tier:     result.tier,
      taskType: result.taskType,
      cost:     result.cost,
      attempts: result.attempts,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
