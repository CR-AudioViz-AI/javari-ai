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
    console.log('[social-caption-generator] Missing or invalid authorization header')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: user, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    console.log('[social-caption-generator] Authentication failed', authError)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { description } = await req.json()
  if (!description || typeof description !== 'string' || description.trim() === '') {
    console.log('[social-caption-generator] Invalid input: description is required')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  if (creditsError || !creditsData || creditsData.credits < 1) {
    console.log('[social-caption-generator] Insufficient credits')
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
  }

  // Deduct 1 credit
  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ credits: creditsData.credits - 1 })
    .eq('user_id', user.id)

  if (deductError) {
    console.log('[social-caption-generator] Failed to deduct credits', deductError)
    return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
  }

  // Process the description to generate a social media caption
  const caption = generateCaption(description)

  console.log('[social-caption-generator] Caption generated successfully')
  return NextResponse.json({ success: true, caption })
}

function generateCaption(description: string): string {
  // Placeholder function for generating a caption
  // This should be replaced with actual logic for generating captions
  return `Generated caption for: ${description}`
}