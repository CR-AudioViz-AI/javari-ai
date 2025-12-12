/**
 * Javari AI - Continuous Learning Cron Job
 * Runs every 4 hours to:
 * - Fetch external data from APIs
 * - Update embeddings for new knowledge
 * - Generate proactive suggestions
 * - Cleanup expired data
 * 
 * Created: December 13, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllSources, cleanupExpiredData, getDataSourceStats } from '@/lib/external-data-fetcher';
import { updateAllMissingEmbeddings } from '@/lib/embeddings';
import { generateNewsSuggestions, storeSuggestions, cleanupExpiredSuggestions } from '@/lib/proactive-suggestions';
import { getLearningInsights, getTopKnowledgeGaps } from '@/lib/feedback-learning';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) return true; // No secret configured, allow
  
  if (authHeader === `Bearer ${cronSecret}`) return true;
  
  // Also check query param for Vercel cron
  const url = new URL(request.url);
  if (url.searchParams.get('cron_secret') === cronSecret) return true;
  
  return false;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    success: true,
    phases: {},
  };

  try {
    // ========================================================================
    // PHASE 1: FETCH EXTERNAL DATA
    // ========================================================================
    console.log('[Learning Cron] Phase 1: Fetching external data...');
    const fetchResults = await fetchAllSources();
    
    const totalFetched = fetchResults.reduce((sum, r) => sum + r.items_fetched, 0);
    const totalStored = fetchResults.reduce((sum, r) => sum + r.items_stored, 0);
    const fetchErrors = fetchResults.filter(r => !r.success);

    results.phases.external_data = {
      success: fetchErrors.length === 0,
      sources_processed: fetchResults.length,
      items_fetched: totalFetched,
      items_stored: totalStored,
      errors: fetchErrors.map(e => ({ source: e.source, errors: e.errors })),
      duration_ms: fetchResults.reduce((sum, r) => sum + r.duration_ms, 0),
    };

    // ========================================================================
    // PHASE 2: UPDATE EMBEDDINGS
    // ========================================================================
    console.log('[Learning Cron] Phase 2: Updating embeddings...');
    const embeddingResults = await updateAllMissingEmbeddings();

    results.phases.embeddings = {
      success: embeddingResults.failed === 0,
      updated: embeddingResults.updated,
      failed: embeddingResults.failed,
      errors: embeddingResults.errors.slice(0, 5), // Limit errors
    };

    // ========================================================================
    // PHASE 3: GENERATE SUGGESTIONS
    // ========================================================================
    console.log('[Learning Cron] Phase 3: Generating suggestions...');
    const newsSuggestions = await generateNewsSuggestions();
    const suggestionsStored = await storeSuggestions(newsSuggestions);

    results.phases.suggestions = {
      success: true,
      generated: newsSuggestions.length,
      stored: suggestionsStored,
    };

    // ========================================================================
    // PHASE 4: CLEANUP
    // ========================================================================
    console.log('[Learning Cron] Phase 4: Cleanup...');
    const expiredData = await cleanupExpiredData();
    const expiredSuggestions = await cleanupExpiredSuggestions();

    results.phases.cleanup = {
      success: true,
      expired_data_removed: expiredData,
      expired_suggestions_removed: expiredSuggestions,
    };

    // ========================================================================
    // PHASE 5: GATHER INSIGHTS
    // ========================================================================
    console.log('[Learning Cron] Phase 5: Gathering insights...');
    const insights = await getLearningInsights(7);
    const gaps = await getTopKnowledgeGaps(5);
    const dataStats = await getDataSourceStats();

    results.phases.insights = {
      success: true,
      learning_insights: insights,
      top_knowledge_gaps: gaps,
      data_source_stats: dataStats,
    };

    // ========================================================================
    // FINAL SUMMARY
    // ========================================================================
    results.duration_ms = Date.now() - startTime;
    results.summary = {
      external_items: totalStored,
      embeddings_updated: embeddingResults.updated,
      suggestions_generated: suggestionsStored,
      items_cleaned: expiredData + expiredSuggestions,
      knowledge_gaps_pending: gaps.length,
    };

    console.log(`[Learning Cron] Complete in ${results.duration_ms}ms`);

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('[Learning Cron] Error:', error);
    
    results.success = false;
    results.error = error.message;
    results.duration_ms = Date.now() - startTime;

    return NextResponse.json(results, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // POST endpoint for manual triggers with specific options
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { phase } = body;

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      phase: phase || 'all',
    };

    switch (phase) {
      case 'external_data':
        results.data = await fetchAllSources();
        break;
      case 'embeddings':
        results.data = await updateAllMissingEmbeddings();
        break;
      case 'suggestions':
        const suggestions = await generateNewsSuggestions();
        results.data = {
          generated: suggestions.length,
          stored: await storeSuggestions(suggestions),
        };
        break;
      case 'cleanup':
        results.data = {
          expired_data: await cleanupExpiredData(),
          expired_suggestions: await cleanupExpiredSuggestions(),
        };
        break;
      case 'insights':
        results.data = {
          learning: await getLearningInsights(7),
          gaps: await getTopKnowledgeGaps(10),
          stats: await getDataSourceStats(),
        };
        break;
      default:
        // Run all phases (same as GET)
        return GET(request);
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
