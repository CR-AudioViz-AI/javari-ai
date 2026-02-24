import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1]
  if (!token) {
    console.error('[test-stack] Missing authorization token')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    console.error('[test-stack] Invalid token or user not found')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { description } = await req.json()
  if (typeof description !== 'string' || description.trim() === '') {
    console.error('[test-stack] Invalid input: description is required')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  if (creditsError || !creditsData || creditsData.credits < 2) {
    console.error('[test-stack] Insufficient credits')
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
  }

  const { error: deductionError } = await supabase
    .from('user_credits')
    .update({ credits: creditsData.credits - 2 })
    .eq('user_id', user.id)

  if (deductionError) {
    console.error('[test-stack] Failed to deduct credits')
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }

  console.log('[test-stack] Processing description:', description)
  // Placeholder for actual processing logic based on description
  const processingResult = true // Assume processing is successful

  return NextResponse.json({ success: processingResult })
}