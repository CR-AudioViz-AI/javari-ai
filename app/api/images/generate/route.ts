// app/api/images/generate/route.ts
// Javari AI Image Generator — DALL-E 3 via OpenAI API
// Falls back to OpenRouter image models if primary fails
// Cost: Standard ~$0.04/image, HD ~$0.08/image
// CR AudioViz AI · EIN 39-3646201 · May 2026
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { prompt, n = 1, size = '1024x1024', quality = 'standard', style = 'vivid' } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt required' }, { status: 400 })
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
    }

    // Primary: DALL-E 3
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: Math.min(n, 4),
        size,
        quality,
        style,
        response_format: 'url',
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      // Handle content policy violations gracefully
      if (err.error?.code === 'content_policy_violation') {
        return NextResponse.json(
          { error: 'This prompt was flagged by content policy. Try rephrasing.' },
          { status: 400 }
        )
      }
      // Fallback to DALL-E 2 for unsupported sizes
      if (n > 1) {
        const res2 = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
          body: JSON.stringify({ model: 'dall-e-2', prompt, n, size: '1024x1024', response_format: 'url' }),
        })
        if (res2.ok) {
          const data2 = await res2.json()
          return NextResponse.json({ images: data2.data.map((d: any) => d.url), model: 'dall-e-2' })
        }
      }
      throw new Error(err.error?.message || 'Generation failed')
    }

    const data = await res.json()
    const images = data.data.map((d: any) => d.url)

    return NextResponse.json({
      images,
      model: 'dall-e-3',
      revised_prompts: data.data.map((d: any) => d.revised_prompt),
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Generation failed' }, { status: 500 })
  }
}
