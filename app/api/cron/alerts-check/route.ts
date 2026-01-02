// app/api/cron/alerts-check/route.ts
// Runs every 30 minutes to check for issues

import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/javari/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'run_checks' })
    })
    
    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Cron error'
    }, { status: 500 })
  }
}
