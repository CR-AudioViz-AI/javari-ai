/**
 * Javari Observability and Telemetry System
 * Tracks system performance, costs, and model usage
 */

import { createAdminClient } from "@/lib/supabase/server";

export interface TelemetryData {
  taskId?: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  latencyMs?: number;
  cost?: number;
  success: boolean;
}

export interface TelemetryStats {
  totalExecutions: number;
  successRate: number;
  totalCost: number;
  totalTokens: number;
  averageLatency: number;
  modelBreakdown: {
    model: string;
    executions: number;
    totalCost: number;
    successRate: number;
  }[];
  providerBreakdown: {
    provider: string;
    executions: number;
    totalCost: number;
  }[];
}

/**
 * Log telemetry data
 */
export async function logTelemetry(data: TelemetryData): Promise<void> {
  try {
    const db = createAdminClient();

    const entry = {
      task_id: data.taskId || null,
      model: data.model,
      provider: data.provider,
      tokens_used: data.tokensUsed || 0,
      latency_ms: data.latencyMs || null,
      cost: data.cost || 0,
      success: data.success,
    };

    const { error } = await db
      .from("javari_telemetry_logs")
      .insert(entry);

    if (error) {
      console.error("[telemetry] Failed to log:", error.message);
    } else {
      console.log("[telemetry] ✅ Logged:", data.model, `(${data.provider})`);
    }
  } catch (err: any) {
    console.error("[telemetry] Unexpected error:", err.message);
  }
}

/**
 * Get comprehensive telemetry statistics
 */
export async function getTelemetryStats(
  since?: Date
): Promise<TelemetryStats | null> {
  try {
    const db = createAdminClient();

    let query = db.from("javari_telemetry_logs").select("*");

    if (since) {
      query = query.gte("created_at", since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("[telemetry] Failed to fetch stats:", error);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        totalCost: 0,
        totalTokens: 0,
        averageLatency: 0,
        modelBreakdown: [],
        providerBreakdown: [],
      };
    }

    // Calculate aggregate stats
    const totalExecutions = data.length;
    const successes = data.filter(r => r.success).length;
    const successRate = totalExecutions > 0 ? (successes / totalExecutions) * 100 : 0;
    const totalCost = data.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
    const totalTokens = data.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
    
    const latencies = data.filter(r => r.latency_ms !== null).map(r => r.latency_ms);
    const averageLatency = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

    // Model breakdown
    const modelMap = new Map<string, { executions: number; cost: number; successes: number }>();
    
    data.forEach(r => {
      const existing = modelMap.get(r.model) || { executions: 0, cost: 0, successes: 0 };
      existing.executions++;
      existing.cost += Number(r.cost) || 0;
      if (r.success) existing.successes++;
      modelMap.set(r.model, existing);
    });

    const modelBreakdown = Array.from(modelMap.entries()).map(([model, stats]) => ({
      model,
      executions: stats.executions,
      totalCost: stats.cost,
      successRate: stats.executions > 0 ? (stats.successes / stats.executions) * 100 : 0,
    }));

    // Provider breakdown
    const providerMap = new Map<string, { executions: number; cost: number }>();
    
    data.forEach(r => {
      const existing = providerMap.get(r.provider) || { executions: 0, cost: 0 };
      existing.executions++;
      existing.cost += Number(r.cost) || 0;
      providerMap.set(r.provider, existing);
    });

    const providerBreakdown = Array.from(providerMap.entries()).map(([provider, stats]) => ({
      provider,
      executions: stats.executions,
      totalCost: stats.cost,
    }));

    return {
      totalExecutions,
      successRate,
      totalCost,
      totalTokens,
      averageLatency,
      modelBreakdown,
      providerBreakdown,
    };
  } catch (err: any) {
    console.error("[telemetry] Error fetching stats:", err.message);
    return null;
  }
}

/**
 * Get recent telemetry logs
 */
export async function getRecentLogs(limit: number = 50) {
  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("javari_telemetry_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[telemetry] Failed to fetch logs:", error);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.error("[telemetry] Error fetching logs:", err.message);
    return [];
  }
}
