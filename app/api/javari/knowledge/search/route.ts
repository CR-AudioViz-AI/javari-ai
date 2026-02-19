// app/api/javari/knowledge/search/route.ts
// Dedicated semantic search diagnostic endpoint
// Tests ONLY: embedding generation + pgvector search (no LLM generation)
// Measures retrieval pipeline latency in isolation
// 2026-02-19 — TASK-P0-004 verification

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/javari/memory/embedding-provider';
import { searchSimilar } from '@/lib/javari/memory/semantic-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const topK = parseInt(searchParams.get('k') || '5');

  if (!q.trim()) {
    return NextResponse.json({ error: 'Missing ?q= query parameter' }, { status: 400 });
  }

  const t0 = Date.now();

  try {
    // Step 1: Embed
    const tEmbed0 = Date.now();
    const embedding = await generateEmbedding(q);
    const embedMs = Date.now() - tEmbed0;

    if (!embedding) {
      return NextResponse.json({
        success: false,
        error: 'Embedding generation failed',
        embedMs,
        totalMs: Date.now() - t0,
      });
    }

    // Step 2: pgvector search
    const tSearch0 = Date.now();
    const chunks = await searchSimilar(embedding, topK, q);
    const searchMs = Date.now() - tSearch0;

    const totalMs = Date.now() - t0;

    return NextResponse.json({
      success: true,
      query: q,
      embedMs,
      searchMs,
      totalMs,
      resultCount: chunks.length,
      underThreshold: totalMs < 3000,
      results: chunks.map(c => ({
        title: c.text.split('\n')[0],
        similarity: c.similarity !== undefined ? Math.round(c.similarity * 100) : null,
        preview: c.text.slice(0, 200),
      })),
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      totalMs: Date.now() - t0,
    }, { status: 500 });
  }
}
