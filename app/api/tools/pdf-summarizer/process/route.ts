import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[pdf-summarizer] Missing or invalid authorization header')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    console.error('[pdf-summarizer] Authentication failed', authError)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authData.user.id
  const { data: creditData, error: creditError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single()

  if (creditError || !creditData || creditData.credits < 4) {
    console.error('[pdf-summarizer] Insufficient credits', creditError)
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
  }

  const body = await req.json()
  const { description } = body

  if (!description || typeof description !== 'string' || description.trim() === '') {
    console.error('[pdf-summarizer] Invalid input')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Placeholder for the actual PDF processing logic
  console.log('[pdf-summarizer] Processing PDF with description:', description)
  // Simulate processing
  const result = { summary: 'This is a summary', keyPoints: [], chapters: [], qna: [] }

  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits: creditData.credits - 4 })
    .eq('user_id', userId)

  if (updateError) {
    console.error('[pdf-summarizer] Failed to deduct credits', updateError)
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }

  return NextResponse.json({ success: true, ...result })
}