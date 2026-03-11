// Stub: CRM sync route - original truncated by autonomous commit
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'CRM sync API operational' })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ success: true, synced: 0 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
