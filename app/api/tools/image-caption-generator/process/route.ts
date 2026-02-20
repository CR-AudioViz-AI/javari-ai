import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[image-caption-generator] Request received')

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    console.log('[image-caption-generator] Missing Authorization token')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    console.log('[image-caption-generator] Invalid token')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userId = authData.user.id
  const { data: creditData, error: creditError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single()

  if (creditError || !creditData || creditData.credits < 2) {
    console.log('[image-caption-generator] Insufficient credits')
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 400 })
  }

  const { description } = await req.json()
  if (!description || typeof description !== 'string' || description.trim() === '') {
    console.log('[image-caption-generator] Invalid input')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Placeholder for image caption generation logic
  const generatedCaption = `Generated caption for: ${description}`

  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits: creditData.credits - 2 })
    .eq('user_id', userId)

  if (updateError) {
    console.log('[image-caption-generator] Failed to update credits')
    return NextResponse.json({ success: false, error: 'Failed to update credits' }, { status: 500 })
  }

  console.log('[image-caption-generator] Caption generated successfully')
  return NextResponse.json({ success: true, caption: generatedCaption })
}