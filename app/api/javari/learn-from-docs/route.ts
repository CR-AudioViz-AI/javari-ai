// ============================================================
// JAVARI LEARNING API - /api/javari/learn-from-docs
// ============================================================
// Allows Javari to ingest and learn from documentation
// Created: November 11, 2025 - 3:05 PM EST
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ============================================================
// TYPES
// ============================================================

interface LearningRequest {
  mode: 'immediate' | 'batch' | 'single';
  doc_id?: string; // For single doc learning
  category?: string; // For batch learning by category
  max_docs?: number; // Max docs to process in batch
  force_refresh?: boolean; // Re-learn already learned docs
}

interface LearningResult {
  success: boolean;
  docs_processed: number;
  docs_failed: number;
  results: Array<{
    doc_id: string;
    title: string;
    status: 'success' | 'failed';
    confidence_score?: number;
    error?: string;
  }>;
  queue_status: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body: LearningRequest = await request.json();
    const { mode = 'immediate', doc_id, category, max_docs = 10, force_refresh = false } = body;

    // Verify API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.JAVARI_API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }

    let result: LearningResult;

    switch (mode) {
      case 'single':
        if (!doc_id) {
          return NextResponse.json(
            { error: 'doc_id required for single mode' },
            { status: 400 }
          );
        }
        result = await learnSingleDoc(doc_id, force_refresh);
        break;

      case 'batch':
        result = await learnBatchDocs(category, max_docs, force_refresh);
        break;

      case 'immediate':
      default:
        result = await processQueuedDocs(max_docs);
        break;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error in Javari learning API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to check status
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.JAVARI_API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }

    // Get learning statistics
    const { data: stats, error } = await supabase
      .from('javari_learning_stats')
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error getting learning stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// LEARNING FUNCTIONS
// ============================================================

/**
 * Learn from a single document
 */
async function learnSingleDoc(docId: string, forceRefresh: boolean): Promise<LearningResult> {
  const results: LearningResult = {
    success: false,
    docs_processed: 0,
    docs_failed: 0,
    results: [],
    queue_status: await getQueueStatus(),
  };

  try {
    // Get document
    const { data: doc, error: docError } = await supabase
      .from('documentation_system_docs')
      .select('*')
      .eq('id', docId)
      .single();

    if (docError || !doc) {
      results.results.push({
        doc_id: docId,
        title: 'Unknown',
        status: 'failed',
        error: 'Document not found',
      });
      results.docs_failed++;
      return results;
    }

    // Check if already learned
    if (doc.learned_by_javari && !forceRefresh) {
      results.results.push({
        doc_id: docId,
        title: doc.title,
        status: 'success',
        confidence_score: doc.javari_confidence_score,
        error: 'Already learned (use force_refresh to re-learn)',
      });
      results.docs_processed++;
      results.success = true;
      return results;
    }

    // Process the document
    const learningResult = await processDocument(doc);

    results.results.push(learningResult);
    if (learningResult.status === 'success') {
      results.docs_processed++;
      results.success = true;
    } else {
      results.docs_failed++;
    }

    results.queue_status = await getQueueStatus();
    return results;
  } catch (error: any) {
    results.results.push({
      doc_id: docId,
      title: 'Unknown',
      status: 'failed',
      error: error.message,
    });
    results.docs_failed++;
    return results;
  }
}

/**
 * Learn from batch of documents by category
 */
async function learnBatchDocs(
  category?: string,
  maxDocs: number = 10,
  forceRefresh: boolean = false
): Promise<LearningResult> {
  const results: LearningResult = {
    success: false,
    docs_processed: 0,
    docs_failed: 0,
    results: [],
    queue_status: await getQueueStatus(),
  };

  try {
    // Build query
    let query = supabase
      .from('documentation_system_docs')
      .select('*')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(maxDocs);

    // Add category filter if provided
    if (category) {
      query = query.eq('category', category);
    }

    // Add learned filter unless force refresh
    if (!forceRefresh) {
      query = query.eq('learned_by_javari', false);
    }

    const { data: docs, error: docsError } = await query;

    if (docsError) throw docsError;
    if (!docs || docs.length === 0) {
      results.success = true;
      return results;
    }

    // Process each document
    for (const doc of docs) {
      const learningResult = await processDocument(doc);
      results.results.push(learningResult);

      if (learningResult.status === 'success') {
        results.docs_processed++;
      } else {
        results.docs_failed++;
      }
    }

    results.success = results.docs_processed > 0;
    results.queue_status = await getQueueStatus();
    return results;
  } catch (error: any) {
    console.error('Error in batch learning:', error);
    throw error;
  }
}

/**
 * Process documents from the queue
 */
async function processQueuedDocs(maxDocs: number = 10): Promise<LearningResult> {
  const results: LearningResult = {
    success: false,
    docs_processed: 0,
    docs_failed: 0,
    results: [],
    queue_status: await getQueueStatus(),
  };

  try {
    // Process up to maxDocs from queue
    for (let i = 0; i < maxDocs; i++) {
      // Get next doc from queue
      const { data: nextDoc, error: queueError } = await supabase.rpc('get_next_doc_for_learning');

      if (queueError || !nextDoc || nextDoc.length === 0) {
        break; // No more docs in queue
      }

      const docData = nextDoc[0];

      // Process the document
      const learningResult = await processDocument({
        id: docData.doc_id,
        title: docData.doc_title,
        content: docData.doc_content,
        category: docData.doc_category,
      });

      results.results.push(learningResult);

      if (learningResult.status === 'success') {
        results.docs_processed++;
      } else {
        results.docs_failed++;
      }
    }

    results.success = results.docs_processed > 0;
    results.queue_status = await getQueueStatus();
    return results;
  } catch (error: any) {
    console.error('Error processing queue:', error);
    throw error;
  }
}

/**
 * Process a single document - generate embedding and store
 */
async function processDocument(doc: any): Promise<{
  doc_id: string;
  title: string;
  status: 'success' | 'failed';
  confidence_score?: number;
  error?: string;
}> {
  try {
    // Prepare content for embedding
    const contentForEmbedding = `${doc.title}\n\n${doc.content}\n\nCategory: ${doc.category}`;

    // Generate embedding using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: contentForEmbedding,
      encoding_format: 'float',
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Store in Javari's learning table
    const { error: learningError } = await supabase.from('javari_learning').insert({
      question_pattern: doc.title,
      answer: doc.content,
      confidence_score: 0.85, // Base confidence for documentation
      usage_count: 0,
      success_rate: 1.0,
      source: 'documentation',
      embedding: embedding,
      metadata: {
        doc_id: doc.id,
        category: doc.category,
        app_name: doc.app_name,
      },
    });

    if (learningError) throw learningError;

    // Mark document as learned
    const { error: markError } = await supabase.rpc('mark_doc_as_learned', {
      p_doc_id: doc.id,
      p_confidence_score: 0.85,
      p_notes: `Learned on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
    });

    if (markError) throw markError;

    return {
      doc_id: doc.id,
      title: doc.title,
      status: 'success',
      confidence_score: 0.85,
    };
  } catch (error: any) {
    console.error(`Error processing document ${doc.id}:`, error);

    // Mark queue item as failed
    await supabase
      .from('javari_document_queue')
      .update({
        status: 'failed',
        error_message: error.message,
        retry_count: supabase.rpc('javari_document_queue.retry_count', { increment: 1 }),
        updated_at: new Date().toISOString(),
      })
      .eq('doc_id', doc.id)
      .eq('status', 'processing');

    return {
      doc_id: doc.id,
      title: doc.title,
      status: 'failed',
      error: error.message,
    };
  }
}

/**
 * Get current queue status
 */
async function getQueueStatus(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const { data, error } = await supabase.from('javari_document_queue').select('status');

  if (error) {
    console.error('Error getting queue status:', error);
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }

  const counts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  data?.forEach((item: any) => {
    if (item.status === 'pending') counts.pending++;
    else if (item.status === 'processing') counts.processing++;
    else if (item.status === 'completed') counts.completed++;
    else if (item.status === 'failed') counts.failed++;
  });

  return counts;
}

// ============================================================
// EXPORT CONFIG
// ============================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
