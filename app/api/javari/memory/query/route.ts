// app/api/javari/memory/query/route.ts
// Javari AI Memory — semantic search over conversation history
// Stores and retrieves context across sessions via Supabase
// Updated: May 17, 2026
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  const q      = req.nextUrl.searchParams.get('q')
  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '10')

  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  try {
    const supabase = db()
    let query = supabase
      .from('javari_memory')
      .select('id, content, context, created_at, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (q) {
      query = query.ilike('content', `%${q}%`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ memories: data ?? [], count: data?.length ?? 0 })
  } catch (err) {
    return NextResponse.json({ memories: [], count: 0, note: String(err) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      user_id:   string
      content:   string
      context?:  string
      metadata?: Record<string, unknown>
    }

    if (!body.user_id || !body.content) {
      return NextResponse.json({ error: 'user_id and content required' }, { status: 400 })
    }

    const supabase = db()
    const { data, error } = await supabase
      .from('javari_memory')
      .insert({
        user_id:    body.user_id,
        content:    body.content.slice(0, 4000),
        context:    body.context ?? null,
        metadata:   body.metadata ?? {},
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      // Table may not exist yet — return graceful response
      return NextResponse.json({ stored: false, note: 'Memory table not yet created' })
    }

    return NextResponse.json({ stored: true, id: data?.id })
  } catch (err) {
    return NextResponse.json({ stored: false, error: String(err) })
  }
}

export async function DELETE(req: NextRequest) {
  const userId  = req.nextUrl.searchParams.get('user_id')
  const memId   = req.nextUrl.searchParams.get('id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const supabase = db()
  const q = supabase.from('javari_memory').delete().eq('user_id', userId)
  if (memId) q.eq('id', memId)

  const { error } = await q
  return NextResponse.json({ deleted: !error })
}
