// app/api/javari/video/route.ts
// Javari AI Video Avatar — D-ID talking avatar generation
// Full production implementation
// Updated: May 17, 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic   = 'force-dynamic'
export const runtime   = 'nodejs'
export const maxDuration = 60

const DID_KEY    = process.env.DID_API_KEY ?? ''
const HEYGEN_KEY = process.env.HEYGEN_API_KEY ?? ''

// D-ID presenter images (pre-built avatars)
const AVATARS = {
  javari:       'https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg',
  professional: 'https://create-images-results.d-id.com/DefaultPresenters/William_m/image.jpeg',
  casual:       'https://create-images-results.d-id.com/DefaultPresenters/Alex_m/image.jpeg',
}

export async function GET() {
  return NextResponse.json({
    status:    'Javari Video API online',
    providers: { did: !!DID_KEY, heygen: !!HEYGEN_KEY },
    avatars:   Object.keys(AVATARS),
    capabilities: ['talking_avatar', 'lip_sync', 'custom_script'],
    cost:      'D-ID 5 free credits/month',
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!DID_KEY) {
      return NextResponse.json({ error: 'D-ID API key not configured' }, { status: 503 })
    }

    const body = await req.json() as {
      script:    string
      avatar?:   keyof typeof AVATARS
      voice_id?: string
      action?:   'create' | 'status'
      talk_id?:  string
    }

    // ── Check status of existing talk ────────────────────────────────────────
    if (body.action === 'status' && body.talk_id) {
      const res = await fetch(`https://api.d-id.com/talks/${body.talk_id}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(DID_KEY).toString('base64')}`,
          Accept: 'application/json',
        },
      })
      const d = await res.json()
      return NextResponse.json(d)
    }

    // ── Create new talking avatar video ──────────────────────────────────────
    if (!body.script?.trim()) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 })
    }

    const avatarUrl = AVATARS[body.avatar ?? 'javari'] ?? AVATARS.javari

    const res = await fetch('https://api.d-id.com/talks', {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${Buffer.from(DID_KEY).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept:         'application/json',
      },
      body: JSON.stringify({
        source_url: avatarUrl,
        script: {
          type:     'text',
          input:    body.script.slice(0, 1000),
          provider: {
            type:     'elevenlabs',
            voice_id: body.voice_id ?? 'EXAVITQu4vr4xnSDxMaL',
          },
        },
        config: { fluent: true, pad_audio: 0.5 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `D-ID error: ${err.slice(0, 150)}` }, { status: 502 })
    }

    const d = await res.json() as { id?: string; status?: string }

    return NextResponse.json({
      talk_id:  d.id,
      status:   d.status,
      message:  'Video generation started. Poll /api/javari/video with action=status&talk_id={id}',
      provider: 'd-id',
    })

  } catch (err) {
    console.error('[video] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
