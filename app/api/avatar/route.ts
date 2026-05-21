// app/api/avatar/route.ts
// Javari Avatar System — identity layer for the CRAIverse
// Every user gets a persistent avatar that shapes their AI experience
// CR AudioViz AI · EIN 39-3646201 · May 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || ''
  const cookie = req.headers.get('cookie') || ''
  
  // Try Authorization header
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (token && token.length > 20) return token
  }
  
  // Try cookie
  const match = cookie.match(/sb-[^-]+-auth-token=([^;]+)/)
  if (match) return match[1]
  
  return null
}

// GET /api/avatar — fetch user avatar or return defaults
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId') || getUserId(req)
    
    if (!userId) {
      return NextResponse.json({ avatar: null, isDefault: true })
    }

    const sb = supabase()
    const { data, error } = await sb
      .from('user_avatars')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return NextResponse.json({ avatar: null, isDefault: true })
    }

    return NextResponse.json({ avatar: data, isDefault: false })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/avatar — create new avatar
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, ...avatarData } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const sb = supabase()
    const { data, error } = await sb
      .from('user_avatars')
      .upsert({
        user_id: userId,
        ...avatarData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ avatar: data, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH /api/avatar — update existing avatar
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, ...updates } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const sb = supabase()
    const { data, error } = await sb
      .from('user_avatars')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ avatar: data, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
