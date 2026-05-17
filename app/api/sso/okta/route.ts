// app/api/sso/okta/route.ts
// Javari AI — Okta
// Auto-implemented from stub: May 17 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  return NextResponse.json({
    ok:       true,
    endpoint: '/api/sso/okta',
    name:     'okta',
    category: 'sso',
    params,
    timestamp: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    return NextResponse.json({
      ok:       true,
      endpoint: '/api/sso/okta',
      received: body,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
