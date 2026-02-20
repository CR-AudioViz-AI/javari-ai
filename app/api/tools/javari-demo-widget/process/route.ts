import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = "force-dynamic"
export const maxDuration = 30

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase environment variables are not set')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function verifyUser(authHeader: string | null) {
  if (!authHeader) {
    throw new Error('Authorization header missing')
  }

  const token = authHeader.split(' ')[1]
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    throw new Error('Invalid or expired token')
  }

  return data.user
}

async function deductCredits(userId: string, credits: number) {
  // Placeholder for actual credit deduction logic
  const { data, error } = await supabase
    .from('credits')
    .update({ balance: supabase.raw('balance - ?', credits) })
    .eq('user_id', userId)
    .select()

  if (error || !data || data.length === 0 || data[0].balance < 0) {
    throw new Error('Insufficient credits')
  }
}

async function processJavariDemoWidget(input: Record<string, unknown>) {
  // Placeholder for actual AI processing logic
  return { preview: 'AI generated preview based on input' }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get('authorization')
    const user = await verifyUser(authHeader)

    const input = await req.json() as Record<string, unknown>

    await deductCredits(user.id, 1)

    const result = await processJavariDemoWidget(input)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[javari-demo-widget]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}