import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[voice-transcriber] Processing request...')
  
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
  }

  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', authData.user.id)
    .single()

  if (creditsError || !creditsData || creditsData.credits < 3) {
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
  }

  const body = await req.json()
  const { description } = body

  if (!description || typeof description !== 'string' || description.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Deduct credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits: creditsData.credits - 3 })
    .eq('user_id', authData.user.id)

  if (updateError) {
    return NextResponse.json({ success: false, error: 'Failed to deduct credits' }, { status: 500 })
  }

  // Simulate processing based on description
  console.log('[voice-transcriber] Transcribing with description:', description)
  // Here you would call the actual transcription service

  return NextResponse.json({ success: true, message: 'Transcription completed' })
}