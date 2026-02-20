import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = "force-dynamic"
export const maxDuration = 30

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function verifyUser(token: string) {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data) {
    throw new Error('Invalid or missing token')
  }
  return data.user
}

async function deductCredits(userId: string, credits: number) {
  // Dummy implementation for credit deduction
  // Replace with actual logic to deduct credits
  const success = true // Assume success for this example
  if (!success) {
    throw new Error('Insufficient credits')
  }
}

async function generateColorPalette(input: Record<string, unknown>) {
  // Dummy implementation for color palette generation
  // Replace with actual AI/tool API call
  return { palette: ['#FFFFFF', '#000000'] }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Authorization header missing' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return NextResponse.json({ success: false, error: 'Bearer token missing' }, { status: 401 })
    }

    const user = await verifyUser(token)

    const body = await req.json() as Record<string, unknown>
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
    }

    await deductCredits(user.id, 1)

    const result = await generateColorPalette(body)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[color-palette]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}