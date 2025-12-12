/**
 * Javari AI - Autonomous System Index
 * 
 * Central export point for all autonomous learning capabilities.
 * 
 * Created: December 13, 2025
 */

// Embeddings & Semantic Search
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  searchKnowledge,
  keywordSearch,
  hybridSearch,
  updateKnowledgeEmbedding,
  updateAllMissingEmbeddings,
  searchExternalData,
  getRelevantContext
} from './embeddings';

// External Data Fetcher
export {
  fetchHackerNews,
  fetchReddit,
  fetchCryptoData,
  fetchWeather,
  storeExternalData,
  cleanupExpiredData,
  fetchAllSources,
  getDataSourceStats
} from './external-data-fetcher';

// Feedback & Learning
export {
  recordFeedback,
  getFeedbackStats,
  updateProviderPerformance,
  getBestProvider,
  extractConversationLearnings,
  getLearningInsights,
  recordKnowledgeGap,
  getTopKnowledgeGaps,
  resolveKnowledgeGap
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
  markSuggestionDismissed,
  getWhatsNew,
  cleanupExpiredSuggestions
} from './proactive-suggestions';

/**
 * Initialize all autonomous systems
 */
export async function initializeAutonomousSystems(): Promise<{
  success: boolean;
  systems: string[];
  errors: string[];
}> {
  const systems: string[] = [];
  const errors: string[] = [];

  try {
    systems.push('embeddings');
  } catch (e) {
    errors.push('embeddings: ' + (e as Error).message);
  }

  try {
    systems.push('external-data');
  } catch (e) {
    errors.push('external-data: ' + (e as Error).message);
  }

  try {
    systems.push('feedback');
  } catch (e) {
    errors.push('feedback: ' + (e as Error).message);
  }

  try {
    systems.push('suggestions');
  } catch (e) {
    errors.push('suggestions: ' + (e as Error).message);
  }

  return {
    success: errors.length === 0,
    systems,
    errors
  };
}

/**
 * Get comprehensive autonomous system status
 */
export async function getAutonomousSystemStatus(): Promise<{
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  systems: {
    name: string;
    status: string;
    details?: any;
  }[];
}> {
  const systems: { name: string; status: string; details?: any }[] = [];

  try {
    const { getDataSourceStats } = await import('./external-data-fetcher');
    const stats = await getDataSourceStats();
    systems.push({
      name: 'External Data',
      status: stats.total > 0 ? 'healthy' : 'no_data',
      details: stats
    });
  } catch (e) {
    systems.push({ name: 'External Data', status: 'error', details: (e as Error).message });
  }

  try {
    const { getFeedbackStats } = await import('./feedback-learning');
    const stats = await getFeedbackStats();
    systems.push({
      name: 'Feedback System',
      status: 'healthy',
      details: stats
    });
  } catch (e) {
    systems.push({ name: 'Feedback System', status: 'error', details: (e as Error).message });
  }

  try {
    const { getLearningInsights } = await import('./feedback-learning');
    const insights = await getLearningInsights();
    systems.push({
      name: 'Learning System',
      status: 'healthy',
      details: insights
    });
  } catch (e) {
    systems.push({ name: 'Learning System', status: 'error', details: (e as Error).message });
  }

  try {
    const { getTopKnowledgeGaps } = await import('./feedback-learning');
    const gaps = await getTopKnowledgeGaps(5);
    systems.push({
      name: 'Knowledge Gaps',
      status: 'healthy',
      details: { count: gaps.length, top_gaps: gaps }
    });
  } catch (e) {
    systems.push({ name: 'Knowledge Gaps', status: 'error', details: (e as Error).message });
  }

  const healthyCount = systems.filter(s => s.status === 'healthy').length;
  const overallStatus = healthyCount === systems.length 
    ? 'healthy' 
    : healthyCount > 0 
      ? 'degraded' 
      : 'unhealthy';

  return {
    timestamp: new Date().toISOString(),
    status: overallStatus,
    systems
  };
}
