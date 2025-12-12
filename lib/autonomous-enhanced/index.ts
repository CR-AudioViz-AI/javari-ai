/**
 * Javari AI - Autonomous System Index
 * Central export point for all autonomous capabilities
 * 
 * Created: December 13, 2025
 */

// Embeddings & Semantic Search
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  searchKnowledge,
  hybridSearch,
  keywordSearch,
  updateKnowledgeEmbedding,
  updateAllMissingEmbeddings,
  searchExternalData,
  getRelevantContext,
} from './embeddings';
export type { EmbeddingResult, SearchResult, HybridSearchResult } from './embeddings';

// External Data Fetcher
export {
  fetchGNews,
  fetchHackerNews,
  fetchReddit,
  fetchAlphaVantage,
  fetchCoinGecko,
  fetchWeather,
  fetchWikipedia,
  fetchAllSources,
  cleanupExpiredData,
  getDataSourceStats,
} from './external-data-fetcher';
export type { DataSource, FetchResult, ExternalDataItem } from './external-data-fetcher';

// Feedback & Learning
export {
  recordFeedback,
  getFeedbackStats,
  updateProviderPerformance,
  getBestProvider,
  getProviderComparison,
  extractConversationLearnings,
  getLearningInsights,
  recordKnowledgeGap,
  getTopKnowledgeGaps,
  resolveKnowledgeGap,
} from './feedback-learning';
export type {
  ResponseFeedback,
  ConversationLearning,
  KnowledgeGap,
  ProviderPerformance,
} from './feedback-learning';

// Proactive Suggestions
export {
  generateSuggestions,
  generatePersonalizedInsight,
  generateNewsSuggestions,
  storeSuggestions,
  getSuggestionsForUser,
  getGlobalSuggestions,
  markSuggestionShown,
  markSuggestionClicked,
  dismissSuggestion,
  cleanupExpiredSuggestions,
  getWhatsNew,
} from './proactive-suggestions';
export type { Suggestion, UserContext } from './proactive-suggestions';

/**
 * Initialize all autonomous systems
 * Call this on application startup
 */
export async function initializeAutonomousSystems(): Promise<{
  success: boolean;
  systems: Record<string, boolean>;
  errors: string[];
}> {
  const result = {
    success: true,
    systems: {} as Record<string, boolean>,
    errors: [] as string[],
  };

  // Check embeddings system
  try {
    // Just import to verify it loads
    const embeddings = await import('./embeddings');
    result.systems['embeddings'] = !!embeddings.generateEmbedding;
  } catch (error: any) {
    result.systems['embeddings'] = false;
    result.errors.push(`Embeddings: ${error.message}`);
  }

  // Check data fetcher
  try {
    const fetcher = await import('./external-data-fetcher');
    result.systems['external_data'] = !!fetcher.fetchAllSources;
  } catch (error: any) {
    result.systems['external_data'] = false;
    result.errors.push(`External Data: ${error.message}`);
  }

  // Check feedback system
  try {
    const feedback = await import('./feedback-learning');
    result.systems['feedback'] = !!feedback.recordFeedback;
  } catch (error: any) {
    result.systems['feedback'] = false;
    result.errors.push(`Feedback: ${error.message}`);
  }

  // Check suggestions system
  try {
    const suggestions = await import('./proactive-suggestions');
    result.systems['suggestions'] = !!suggestions.generateSuggestions;
  } catch (error: any) {
    result.systems['suggestions'] = false;
    result.errors.push(`Suggestions: ${error.message}`);
  }

  result.success = result.errors.length === 0;

  return result;
}

/**
 * Get comprehensive system status
 */
export async function getAutonomousSystemStatus(): Promise<{
  healthy: boolean;
  components: Record<string, { status: string; details?: any }>;
  stats: Record<string, any>;
}> {
  const { getDataSourceStats } = await import('./external-data-fetcher');
  const { getFeedbackStats, getLearningInsights, getTopKnowledgeGaps } = await import('./feedback-learning');

  const components: Record<string, { status: string; details?: any }> = {};
  const stats: Record<string, any> = {};

  // Check data sources
  try {
    const dataStats = await getDataSourceStats();
    components['external_data'] = {
      status: dataStats.total_items > 0 ? 'healthy' : 'empty',
      details: dataStats,
    };
    stats.external_items = dataStats.total_items;
  } catch (error) {
    components['external_data'] = { status: 'error' };
  }

  // Check feedback
  try {
    const feedbackStats = await getFeedbackStats(7);
    components['feedback'] = {
      status: 'healthy',
      details: feedbackStats,
    };
    stats.feedback_total = feedbackStats.total;
  } catch (error) {
    components['feedback'] = { status: 'error' };
  }

  // Check learning
  try {
    const learningInsights = await getLearningInsights(30);
    components['learning'] = {
      status: 'healthy',
      details: {
        total_learnings: learningInsights.total_learnings,
        top_intents: learningInsights.top_intents.slice(0, 3),
      },
    };
    stats.learnings_total = learningInsights.total_learnings;
  } catch (error) {
    components['learning'] = { status: 'error' };
  }

  // Check knowledge gaps
  try {
    const gaps = await getTopKnowledgeGaps(5);
    components['knowledge_gaps'] = {
      status: gaps.length > 10 ? 'warning' : 'healthy',
      details: { pending_gaps: gaps.length },
    };
    stats.knowledge_gaps = gaps.length;
  } catch (error) {
    components['knowledge_gaps'] = { status: 'error' };
  }

  const healthy = Object.values(components).every(
    c => c.status === 'healthy' || c.status === 'empty' || c.status === 'warning'
  );

  return { healthy, components, stats };
}
