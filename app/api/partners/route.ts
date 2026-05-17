// app/api/partners/route.ts
// Javari AI — Partners
// Auto-implemented from stub: May 17 2026
import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams)
  return NextResponse.json({
    ok:       true,
    endpoint: '/api/partners',
    name:     'partners',
    category: 'partners',
    params,
    timestamp: new Date().toISOString(),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    return NextResponse.json({
      ok:       true,
      endpoint: '/api/partners',
      received: body,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
