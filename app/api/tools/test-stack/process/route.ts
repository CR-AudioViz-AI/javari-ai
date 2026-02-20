import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase URL and Service Role Key must be provided')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1]
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: user, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
  }

  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  if (creditsError || !creditsData || creditsData.credits < 1) {
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 400 })
  }

  const body = await req.json()
  const { description } = body

  if (!description || typeof description !== 'string' || description.trim() === '') {
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Process the description
  console.log(`[test-stack] Processing description: ${description}`)

  // Deduct credits
  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ credits: creditsData.credits - 1 })
    .eq('user_id', user.id)

  if (deductError) {
    return NextResponse.json({ success: false, error: 'Failed to deduct credits' }, { status: 500 })
  }

  // Log the operation
  console.log(`[test-stack] User ${user.id} processed description: ${description}`)

  return NextResponse.json({ success: true, message: 'Description processed successfully' })
}