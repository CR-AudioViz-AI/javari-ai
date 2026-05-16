// app/api/javari/video/route.ts
// Javari AI Video Avatar — D-ID + HeyGen
// Created: May 15, 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const DID_API_KEY    = process.env.DID_API_KEY ?? ''
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY ?? ''

export async function GET() {
  return NextResponse.json({
    status:   'Javari Video API online',
    providers: {
      did:    !!DID_API_KEY,
      heygen: !!HEYGEN_API_KEY,
    },
    avatars: ['javari-default', 'professional-male', 'professional-female'],
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      text:       string
      provider?:  'did' | 'heygen'
      avatar_id?: string
      voice_id?:  string
    }

    if (!body.text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    const provider = body.provider ?? (DID_API_KEY ? 'did' : 'heygen')

    if (provider === 'did') {
      if (!DID_API_KEY) return NextResponse.json({ error: 'D-ID not configured' }, { status: 503 })

      const res = await fetch('https://api.d-id.com/talks', {
        method:  'POST',
        headers: {
          Authorization:  `Basic ${DID_API_KEY}`,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify({
          script: { type: 'text', input: body.text, provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' } },
          source_url: 'https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg',
          config:     { fluent: true, pad_audio: 0.5 },
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `D-ID error: ${err.slice(0, 200)}` }, { status: res.status })
      }

      const data = await res.json()
      return NextResponse.json({ provider: 'did', talk_id: data.id, status: data.status, created_at: new Date().toISOString() })
    }

    if (provider === 'heygen') {
      if (!HEYGEN_API_KEY) return NextResponse.json({ error: 'HeyGen not configured' }, { status: 503 })

      const res = await fetch('https://api.heygen.com/v2/video/generate', {
        method:  'POST',
        headers: { 'X-Api-Key': HEYGEN_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_inputs: [{
            character: { type: 'avatar', avatar_id: body.avatar_id ?? 'Abigail_expressive_2024112501', scale: 1 },
            voice:     { type: 'text', input_text: body.text, voice_id: body.voice_id ?? '1bd001e7e50f421d891986aad5158bc8' },
            background: { type: 'color', value: '#f0f0f0' },
          }],
          dimension:   { width: 1280, height: 720 },
          aspect_ratio: '16:9',
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `HeyGen error: ${err.slice(0, 200)}` }, { status: res.status })
      }

      const data = await res.json()
      return NextResponse.json({ provider: 'heygen', video_id: data.data?.video_id, status: 'processing' })
    }

    return NextResponse.json({ error: 'No video provider configured' }, { status: 503 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
