/**
 * Javari AI - Learning Search API
 * Semantic search through knowledge base
 * 
 * Created: November 4, 2025 - 7:45 PM EST
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      );
    }

    // Generate embedding for query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query
      })
    });

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Search using vector similarity
    const { data: results, error } = await supabase.rpc('match_javari_learnings', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 5
    });

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        { success: false, error: 'Search failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      results: results?.map((r: any) => ({
        id: r.id,
        questionPattern: r.question_pattern,
        answer: r.answer,
        confidenceScore: r.confidence_score,
        usageCount: r.usage_count,
        successRate: r.success_rate,
        source: r.source,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })) || []
    });
  } catch (error) {
    console.error('Error searching learnings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search' },
      { status: 500 }
    );
  }
}
