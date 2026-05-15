// app/api/conversations/route.ts
// Javari conversation memory — stores and retrieves chat history
// Created: May 14, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id') ?? 'anonymous'
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')
  try {
    const { data, error } = await db()
      .from('javari_conversations')
      .select('id, user_id, messages, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return NextResponse.json({ conversations: data ?? [] })
  } catch {
    return NextResponse.json({ conversations: [] })
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id') ?? 'anonymous'
  const body   = await req.json() as { messages: unknown[]; conversation_id?: string }
  try {
    if (body.conversation_id) {
      const { data } = await db()
        .from('javari_conversations')
        .update({ messages: body.messages, updated_at: new Date().toISOString() })
        .eq('id', body.conversation_id)
        .eq('user_id', userId)
        .select('id')
        .single()
      return NextResponse.json({ id: data?.id, updated: true })
    } else {
      const { data } = await db()
        .from('javari_conversations')
        .insert({ user_id: userId, messages: body.messages,
                  created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .select('id')
        .single()
      return NextResponse.json({ id: data?.id, created: true })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
