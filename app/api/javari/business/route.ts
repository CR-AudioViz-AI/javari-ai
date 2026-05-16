// app/api/javari/business/route.ts
// Javari AI Business Commands — natural language → platform actions
// Created: May 15, 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const JAVARI_CALLER_KEY = process.env.JAVARI_CALLER_KEY ?? ''

// Business command categories and their handlers
const COMMAND_PATTERNS = [
  { pattern: /check.*(revenue|sales|money|mrr)/i,  action: 'revenue_report',  description: 'Revenue & MRR report' },
  { pattern: /check.*(user|customer|signup)/i,      action: 'user_report',     description: 'User & customer metrics' },
  { pattern: /check.*(deploy|build|error)/i,        action: 'health_check',    description: 'System health check' },
  { pattern: /create.*(post|content|social)/i,      action: 'create_content',  description: 'Create social content' },
  { pattern: /send.*(email|newsletter)/i,           action: 'send_email',      description: 'Send email campaign' },
  { pattern: /check.*(credit|balance)/i,            action: 'credit_report',   description: 'Credit balance report' },
  { pattern: /fix|debug|repair/i,                   action: 'auto_fix',        description: 'Auto-fix system issues' },
  { pattern: /generate|create|build|make/i,         action: 'generate',        description: 'Generate content/code' },
  { pattern: /analyze|review|audit/i,               action: 'analyze',         description: 'Analyze and review' },
]

function classifyCommand(text: string) {
  for (const { pattern, action, description } of COMMAND_PATTERNS) {
    if (pattern.test(text)) return { action, description }
  }
  return { action: 'general', description: 'General AI task' }
}

export async function GET() {
  return NextResponse.json({
    status: 'Javari Business Command API online',
    commands: COMMAND_PATTERNS.map(p => p.description),
    examples: [
      'Check revenue for this month',
      'How many users signed up today?',
      'Check deployment health',
      'Create a social media post about Javari AI',
      'Generate a blog post about AI cost savings',
    ],
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { command: string; context?: Record<string, unknown> }
    if (!body.command?.trim()) return NextResponse.json({ error: 'command is required' }, { status: 400 })

    const { action, description } = classifyCommand(body.command)
    console.log('[business] Command:', body.command, '→ action:', action)

    // Execute via the AI engine using free models
    const plan = {
      plan_id:              `business-${Date.now()}`,
      created_at:           new Date().toISOString(),
      total_estimated_cost: 0,
      tasks: [{
        id:           'task-business',
        role:         'architect' as const,
        objective:    `You are Javari, the business AI for CR AudioViz AI. Execute this business command: "${body.command}"\n\nContext: ${JSON.stringify(body.context ?? {})}\n\nProvide a complete, actionable response. Be specific. Include any data you can generate. Action type: ${description}`,
        inputs:       [],
        outputs:      ['result'],
        dependencies: [],
        model:        'deepseek/deepseek-v4-flash:free',
        max_cost:     0.0,
        status:       'pending' as const,
      }],
    }

    const execRes = await fetch('https://javariai.com/api/execute', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-javari-caller-key': JAVARI_CALLER_KEY },
      body:    JSON.stringify(plan),
    })

    if (!execRes.ok || !execRes.body) {
      return NextResponse.json({ error: 'Execution failed' }, { status: 502 })
    }

    // Read SSE stream, extract final result
    const reader = execRes.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let result = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() ?? ''
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        try {
          const evt = JSON.parse(part.slice(6))
          if (evt.type === 'task_complete') {
            const out = evt.result?.output ?? ''
            try {
              const p = JSON.parse(out)
              result = p.blueprint ?? p.artifact ?? p.result ?? out
            } catch { result = out }
          }
        } catch { /* skip */ }
      }
    }

    return NextResponse.json({
      command:   body.command,
      action,
      result,
      model:     'deepseek-v4-flash (free)',
      cost:      '$0.00',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
