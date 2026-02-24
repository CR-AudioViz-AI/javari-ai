// app/api/javari/knowledge/route.ts
// Javari Knowledge Admin API - View, verify, and manage knowledge entries
// Timestamp: 2025-11-29 16:05 UTC

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get('filter') || 'all'; // all, verified, unverified, auto-learned
  const topic = searchParams.get('topic');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    let query = supabase
      .from('javari_knowledge')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filter === 'verified') {
      query = query.eq('verified', true);
    } else if (filter === 'unverified' || filter === 'auto-learned') {
      query = query.eq('verified', false);
    }

    if (topic) {
      query = query.eq('topic', topic);
    }

    const { data: entries, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get topic stats
    const { data: allEntries } = await supabase
      .from('javari_knowledge')
      .select('topic, verified');

    const topics: Record<string, { total: number; verified: number; unverified: number }> = {};
    allEntries?.forEach(entry => {
      if (!topics[entry.topic]) {
        topics[entry.topic] = { total: 0, verified: 0, unverified: 0 };
      }
      topics[entry.topic].total++;
      if (entry.verified) {
        topics[entry.topic].verified++;
      } else {
        topics[entry.topic].unverified++;
      }
    });

    return NextResponse.json({
      success: true,
      filter,
      topic: topic || 'all',
      entries: entries || [],
      count: entries?.length || 0,
      offset,
      limit,
      topics: Object.entries(topics).map(([name, stats]) => ({ name, ...stats })),
      stats: {
        total: allEntries?.length || 0,
        verified: allEntries?.filter(e => e.verified).length || 0,
        unverified: allEntries?.filter(e => !e.verified).length || 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch knowledge', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action, updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing knowledge ID' }, { status: 400 });
    }

    if (action === 'verify') {
      // Mark as verified
      const { data, error } = await supabase
        .from('javari_knowledge')
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          verified_by: 'admin'
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Knowledge entry verified',
        entry: data
      });
    }

    if (action === 'reject') {
      // Delete unverified entry
      const { error } = await supabase
        .from('javari_knowledge')
        .delete()
        .eq('id', id)
        .eq('verified', false); // Only delete unverified entries

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Knowledge entry rejected and deleted'
      });
    }

    if (action === 'update' && updates) {
      // Update entry fields
      const { data, error } = await supabase
        .from('javari_knowledge')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Knowledge entry updated',
        entry: data
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use: verify, reject, or update' }, { status: 400 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update knowledge', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing knowledge ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('javari_knowledge')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge entry deleted'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete knowledge', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
