import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    console.error('[resume-builder] Missing Authorization header')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    console.error('[resume-builder] Invalid token')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authData.user.id

  const { data: creditData, error: creditError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single()

  if (creditError || !creditData || creditData.credits < 5) {
    console.error('[resume-builder] Insufficient credits')
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 403 })
  }

  const { description } = await req.json()
  if (!description || typeof description !== 'string' || description.trim() === '') {
    console.error('[resume-builder] Invalid input')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Placeholder for resume processing logic
  console.log('[resume-builder] Processing resume for user:', userId)

  // Deduct credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits: creditData.credits - 5 })
    .eq('user_id', userId)

  if (updateError) {
    console.error('[resume-builder] Failed to deduct credits')
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }

  // Simulate successful resume processing
  console.log('[resume-builder] Resume processed successfully for user:', userId)
  return NextResponse.json({ success: true, message: 'Resume processed successfully' })
}