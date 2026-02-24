import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[logo-generator] Missing or invalid authorization header')
      return NextResponse.json({ success: false, error: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.log('[logo-generator] User authentication failed')
      return NextResponse.json({ success: false, error: 'Unauthorized' })
    }

    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single()

    if (creditsError || !creditsData || creditsData.credits < 3) {
      console.log('[logo-generator] Insufficient credits')
      return NextResponse.json({ success: false, error: 'Insufficient credits' })
    }

    const body = await req.json()
    const { description } = body

    if (!description || typeof description !== 'string' || description.trim() === '') {
      console.log('[logo-generator] Invalid input description')
      return NextResponse.json({ success: false, error: 'Invalid input' })
    }

    // Placeholder for the actual logo generation logic
    console.log(`[logo-generator] Processing logo with description: ${description}`)
    const logoResult = { svg: '<svg>...</svg>', png: 'data:image/png;base64,...' }

    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: creditsData.credits - 3 })
      .eq('user_id', user.id)

    if (updateError) {
      console.log('[logo-generator] Failed to deduct credits')
      return NextResponse.json({ success: false, error: 'Failed to process credits' })
    }

    console.log('[logo-generator] Logo generation successful')
    return NextResponse.json({ success: true, logo: logoResult })
  } catch (error) {
    console.error('[logo-generator] Unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' })
  }
}