// app/api/test-openai/route.ts
// TEMP DIAGNOSTIC — DELETE AFTER USE
import { NextRequest, NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const runtime    = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const openaiKey    = process.env.OPENAI_API_KEY    ?? ''
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  console.log('[TEST-AI] Keys present:', {
    openai:    !!openaiKey,
    anthropic: !!anthropicKey,
    openaiLen: openaiKey.length,
    anthropicLen: anthropicKey.length,
  })

  const results: Record<string, unknown> = {
    openaiKeyPresent:    !!openaiKey,
    anthropicKeyPresent: !!anthropicKey,
    openaiKeyLen:        openaiKey.length,
    anthropicKeyLen:     anthropicKey.length,
    openaiKeyPrefix:     openaiKey.slice(0, 10),
  }

  // Test OpenAI
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model:      'gpt-4o-mini',
        max_tokens: 10,
        messages:   [{ role: 'user', content: 'Say "ok"' }],
      }),
    })
    const body = await res.json()
    console.log('[TEST-OPENAI] status:', res.status, 'body:', JSON.stringify(body).slice(0, 200))
    results.openai = {
      status: res.status,
      ok:     res.ok,
      body,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TEST-OPENAI] fetch error:', msg)
    results.openai = { error: msg }
  }

  // Test Anthropic
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-3-haiku-20240307',
        max_tokens: 10,
        messages:   [{ role: 'user', content: 'Say "ok"' }],
      }),
    })
    const body = await res.json()
    console.log('[TEST-ANTHROPIC] status:', res.status, 'body:', JSON.stringify(body).slice(0, 200))
    results.anthropic = {
      status: res.status,
      ok:     res.ok,
      body,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TEST-ANTHROPIC] fetch error:', msg)
    results.anthropic = { error: msg }
  }

  return NextResponse.json(results)
}
