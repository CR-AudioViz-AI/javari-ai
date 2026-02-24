import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import DocumentIngestionSystem from '@/lib/autonomous/document-ingestion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { title, content, type, source, metadata } = await request.json();

    if (!title || !content || !type || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, type, source' },
        { status: 400 }
      );
    }

    const ingestionSystem = new DocumentIngestionSystem(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const result = await ingestionSystem.ingestDocument({
      title,
      content,
      type,
      source,
      metadata: metadata || {},
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Generate embeddings asynchronously
    if (process.env.OPENAI_API_KEY && result.documentId) {
      ingestionSystem.generateEmbeddings(
        result.documentId,
        process.env.OPENAI_API_KEY
      ).catch(err => console.error('Embedding generation error:', err));
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      message: 'Document ingested successfully',
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      );
    }

    const ingestionSystem = new DocumentIngestionSystem(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results = await ingestionSystem.searchDocuments(query, limit);

    return NextResponse.json({
      success: true,
      results,
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
