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
    console.log('[background-remover] Missing or invalid authorization header')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    console.log('[background-remover] User authentication failed')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  if (creditsError || !creditsData || creditsData.credits < 2) {
    console.log('[background-remover] Insufficient credits')
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
  }

  const body = await req.json()
  const { imageUrl, customBackground } = body

  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    console.log('[background-remover] Invalid input')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Placeholder for actual background removal processing
  console.log('[background-remover] Processing image:', imageUrl)
  // Assume processing is successful and returns a result
  const processedImageUrl = 'https://example.com/processed-image.png'

  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits: creditsData.credits - 2 })
    .eq('user_id', user.id)

  if (updateError) {
    console.log('[background-remover] Failed to deduct credits')
    return NextResponse.json({ success: false, error: 'Failed to deduct credits' }, { status: 500 })
  }

  console.log('[background-remover] Successfully processed and deducted credits')
  return NextResponse.json({ success: true, processedImageUrl })
}