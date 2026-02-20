import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      console.error('[sentiment-analyzer] Missing Authorization token')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      console.error('[sentiment-analyzer] Invalid token or user not found')
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', authData.user.id)
      .single()

    if (creditsError || !creditsData || creditsData.credits < 1) {
      console.error('[sentiment-analyzer] Insufficient credits')
      return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 402 })
    }

    const { text } = await req.json()
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error('[sentiment-analyzer] Invalid input text')
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
    }

    // Simulate sentiment analysis processing
    const result = {
      sentiment: 'positive',
      emotion: 'joy',
      intent: 'feedback',
      confidence: 0.95
    }

    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: creditsData.credits - 1 })
      .eq('user_id', authData.user.id)

    if (updateError) {
      console.error('[sentiment-analyzer] Failed to deduct credits')
      return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 })
    }

    console.log('[sentiment-analyzer] Processing successful')
    return NextResponse.json({ success: true, result })

  } catch (error) {
    console.error('[sentiment-analyzer] Unexpected error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}