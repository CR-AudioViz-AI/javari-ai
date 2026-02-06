/**
 * Provider History Engine (Step 89)
 * 
 * Long-term memory of provider performance across all executions.
 * Tracks success rates, latency, token usage over time.
 * Feeds into learning system for improved routing decisions.
 */

export interface ProviderHistoryRecord {
  timestamp: number;
  providerId: string;
  ok: boolean;
  latencyMs: number;
  tokensUsed: number;
  capability: string | null;
}

export interface ProviderHistoryAggregate {
  providerId: string;
  windowSize: number;
  successRate: number;       // 0–1
  avgLatencyMs: number;
  avgTokens: number;
  score: number;             // deterministic aggregate score
}

// In-memory history store (could be persisted to DB in production)
const HISTORY: ProviderHistoryRecord[] = [];

/**
 * Add a new history record
 */
export function addHistoryRecord(record: ProviderHistoryRecord): void {
  HISTORY.push(record);
  
  // Keep only last 10,000 records to prevent memory bloat
  if (HISTORY.length > 10000) {
    HISTORY.shift();
  }
}

/**
 * Get recent history for a specific provider
 */
export function getRecentHistory(providerId: string, n: number): ProviderHistoryRecord[] {
  return HISTORY
    .filter(r => r.providerId === providerId)
    .slice(-n);
}

/**
 * Aggregate recent history into performance metrics
 */
export function aggregateHistory(providerId: string, n: number): ProviderHistoryAggregate {
  const recent = getRecentHistory(providerId, n);
  
  if (recent.length === 0) {
    return {
      providerId,
      windowSize: 0,
      successRate: 1.0,  // Optimistic default
      avgLatencyMs: 0,
      avgTokens: 0,
      score: 1.0,
    };
  }

  const successCount = recent.filter(r => r.ok).length;
  const successRate = successCount / recent.length;
  
  const totalLatency = recent.reduce((sum, r) => sum + r.latencyMs, 0);
  const avgLatencyMs = totalLatency / recent.length;
  
  const totalTokens = recent.reduce((sum, r) => sum + r.tokensUsed, 0);
  const avgTokens = totalTokens / recent.length;
  
  // Deterministic aggregate score
  // Higher success rate + lower latency = higher score
  const latencyScore = Math.max(0, 1 - (avgLatencyMs / 2000)); // Normalize to 0-1
  const score = (successRate * 0.7) + (latencyScore * 0.3);
  
  return {
    providerId,
    windowSize: recent.length,
    successRate,
    avgLatencyMs,
    avgTokens,
    score,
  };
}

/**
 * Get all history (for debugging/analysis)
 */
export function getAllHistory(): ProviderHistoryRecord[] {
  return [...HISTORY];
}

/**
 * Clear history (for testing)
 */
export function clearHistory(): void {
  HISTORY.length = 0;
}
