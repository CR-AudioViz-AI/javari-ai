import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authData.user.id
  const { description } = await req.json()

  if (!description || typeof description !== 'string' || description.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  const { data: creditData, error: creditError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single()

  if (creditError || !creditData || creditData.credits < 2) {
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
  }

  // Deduct credits
  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ credits: creditData.credits - 2 })
    .eq('user_id', userId)

  if (deductError) {
    return NextResponse.json({ success: false, error: 'Failed to deduct credits' }, { status: 500 })
  }

  // Process AI copywriting
  console.log('[ai-copywriter] Processing request for user:', userId)

  // Simulate AI processing
  const aiResult = `Generated copy for: ${description}`

  return NextResponse.json({ success: true, result: aiResult })
}