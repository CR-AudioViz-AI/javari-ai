/**
 * Javari AI - Continuous Learning Cron
 * 
 * Runs every 4 hours to:
 * 1. Fetch external data (news, crypto, weather)
 * 2. Update embeddings for new knowledge
 * 3. Generate proactive suggestions
 * 4. Cleanup expired data
 * 
 * Endpoint: GET /api/cron/continuous-learning
 * 
 * Created: December 13, 2025
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

interface PhaseResult {
  phase: string;
  success: boolean;
  duration_ms: number;
  details?: any;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const results: PhaseResult[] = [];
  
  console.log('[Continuous Learning] Starting learning cycle...');

  // Phase 1: Fetch external data
  const phase1Start = Date.now();
  try {
    const { fetchAllSources } = await import('@/lib/autonomous-enhanced/external-data-fetcher');
    const fetchResults = await fetchAllSources();
    
    const totalFetched = fetchResults.reduce((sum, r) => sum + r.fetched, 0);
    const totalStored = fetchResults.reduce((sum, r) => sum + Math.max(0, r.stored), 0);
    
    results.push({
      phase: 'external_data',
      success: true,
      duration_ms: Date.now() - phase1Start,
      details: { 
        sources: fetchResults.length,
        items_fetched: totalFetched,
        items_stored: totalStored,
        breakdown: fetchResults
      }
    });
  } catch (error: any) {
    console.error('[Continuous Learning] External data error:', error);
    results.push({
      phase: 'external_data',
      success: false,
      duration_ms: Date.now() - phase1Start,
      details: { error: error.message }
    });
  }

  // Phase 2: Update embeddings
  const phase2Start = Date.now();
  try {
    const { updateAllMissingEmbeddings } = await import('@/lib/autonomous-enhanced/embeddings');
    const embeddingResults = await updateAllMissingEmbeddings();
    
    results.push({
      phase: 'embeddings',
      success: true,
      duration_ms: Date.now() - phase2Start,
      details: embeddingResults
    });
  } catch (error: any) {
    console.error('[Continuous Learning] Embeddings error:', error);
    results.push({
      phase: 'embeddings',
      success: false,
      duration_ms: Date.now() - phase2Start,
      details: { error: error.message }
    });
  }

  // Phase 3: Generate suggestions from news
  const phase3Start = Date.now();
  try {
    const { generateNewsSuggestions, storeSuggestions } = await import('@/lib/autonomous-enhanced/proactive-suggestions');
    const newsSuggestions = await generateNewsSuggestions();
    const stored = await storeSuggestions(newsSuggestions);
    
    results.push({
      phase: 'suggestions',
      success: true,
      duration_ms: Date.now() - phase3Start,
      details: { 
        generated: newsSuggestions.length,
        stored 
      }
    });
  } catch (error: any) {
    console.error('[Continuous Learning] Suggestions error:', error);
    results.push({
      phase: 'suggestions',
      success: false,
      duration_ms: Date.now() - phase3Start,
      details: { error: error.message }
    });
  }

  // Phase 4: Cleanup expired data
  const phase4Start = Date.now();
  try {
    const { cleanupExpiredData } = await import('@/lib/autonomous-enhanced/external-data-fetcher');
    const { cleanupExpiredSuggestions } = await import('@/lib/autonomous-enhanced/proactive-suggestions');
    
    const dataCleanup = await cleanupExpiredData();
    const suggestionsCleanup = await cleanupExpiredSuggestions();
    
    results.push({
      phase: 'cleanup',
      success: true,
      duration_ms: Date.now() - phase4Start,
      details: { 
        expired_data_removed: dataCleanup,
        expired_suggestions_removed: suggestionsCleanup
      }
    });
  } catch (error: any) {
    console.error('[Continuous Learning] Cleanup error:', error);
    results.push({
      phase: 'cleanup',
      success: false,
      duration_ms: Date.now() - phase4Start,
      details: { error: error.message }
    });
  }

  // Phase 5: Gather insights
  const phase5Start = Date.now();
  try {
    const { getLearningInsights, getTopKnowledgeGaps } = await import('@/lib/autonomous-enhanced/feedback-learning');
    const { getDataSourceStats } = await import('@/lib/autonomous-enhanced/external-data-fetcher');
    
    const [insights, gaps, stats] = await Promise.all([
      getLearningInsights(7),
      getTopKnowledgeGaps(5),
      getDataSourceStats()
    ]);
    
    results.push({
      phase: 'insights',
      success: true,
      duration_ms: Date.now() - phase5Start,
      details: { 
        learning_stats: insights,
        top_knowledge_gaps: gaps,
        data_source_stats: stats
      }
    });
  } catch (error: any) {
    console.error('[Continuous Learning] Insights error:', error);
    results.push({
      phase: 'insights',
      success: false,
      duration_ms: Date.now() - phase5Start,
      details: { error: error.message }
    });
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;

  console.log(`[Continuous Learning] Completed: ${successCount}/${results.length} phases successful in ${totalDuration}ms`);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    timezone: 'EST',
    status: successCount === results.length ? 'success' : 'partial',
    summary: {
      total_phases: results.length,
      successful: successCount,
      failed: results.length - successCount,
      total_duration_ms: totalDuration
    },
    results,
    next_run: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  });
}

export async function POST(request: NextRequest) {
  // Allow manual trigger of specific phases
  try {
    const body = await request.json();
    const phase = body.phase;

    if (phase === 'external_data') {
      const { fetchAllSources } = await import('@/lib/autonomous-enhanced/external-data-fetcher');
      const results = await fetchAllSources();
      return NextResponse.json({ success: true, phase, results });
    }

    if (phase === 'embeddings') {
      const { updateAllMissingEmbeddings } = await import('@/lib/autonomous-enhanced/embeddings');
      const results = await updateAllMissingEmbeddings();
      return NextResponse.json({ success: true, phase, results });
    }

    if (phase === 'cleanup') {
      const { cleanupExpiredData } = await import('@/lib/autonomous-enhanced/external-data-fetcher');
      const { cleanupExpiredSuggestions } = await import('@/lib/autonomous-enhanced/proactive-suggestions');
      const dataCleanup = await cleanupExpiredData();
      const suggestionsCleanup = await cleanupExpiredSuggestions();
      return NextResponse.json({ 
        success: true, 
        phase, 
        data_removed: dataCleanup,
        suggestions_removed: suggestionsCleanup
      });
    }

    return NextResponse.json({ error: 'Unknown phase', valid_phases: ['external_data', 'embeddings', 'cleanup'] }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
