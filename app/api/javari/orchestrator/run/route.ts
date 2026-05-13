// app/api/javari/orchestrator/run/route.ts
// DISABLED — May 12, 2026
// This route was calling OpenAI directly via lib/javari/model-router (not dispatchAI).
// It was running as a cron every 3 minutes, exhausting the shared API key quota.
// Disabled until it can be refactored to use dispatchAI exclusively.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const GONE = { status: 'gone', message: 'Orchestrator disabled — pending dispatchAI migration', code: 410 }

export async function GET() { return NextResponse.json(GONE, { status: 410 }) }
export async function POST() { return NextResponse.json(GONE, { status: 410 }) }
