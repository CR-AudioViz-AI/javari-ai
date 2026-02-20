import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('[brand-color-palette] Request received')

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    console.log('[brand-color-palette] Missing Authorization header')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    console.log('[brand-color-palette] Invalid token')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', user.id)
    .single()

  if (creditsError || !creditsData || creditsData.credits < 2) {
    console.log('[brand-color-palette] Insufficient credits')
    return NextResponse.json({ success: false, error: 'Insufficient credits' }, { status: 403 })
  }

  const body = await req.json()
  const { description } = body

  if (!description || typeof description !== 'string' || description.trim() === '') {
    console.log('[brand-color-palette] Invalid input')
    return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
  }

  // Placeholder for the actual color palette generation logic
  const palette = generateColorPalette(description)

  if (!palette) {
    console.log('[brand-color-palette] Failed to generate palette')
    return NextResponse.json({ success: false, error: 'Failed to generate palette' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits: creditsData.credits - 2 })
    .eq('user_id', user.id)

  if (updateError) {
    console.log('[brand-color-palette] Failed to update credits')
    return NextResponse.json({ success: false, error: 'Failed to update credits' }, { status: 500 })
  }

  console.log('[brand-color-palette] Palette generated successfully')
  return NextResponse.json({ success: true, palette })
}

function generateColorPalette(description: string) {
  // Simulate palette generation based on description
  return {
    colors: ['#FF5733', '#33FF57', '#3357FF'],
    accessibilityScores: [8.5, 7.2, 9.1],
    cssExport: '.bg-primary { background-color: #FF5733; }',
    tailwindExport: 'bg-primary: #FF5733'
  }
}