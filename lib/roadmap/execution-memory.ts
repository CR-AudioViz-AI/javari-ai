/**
 * Javari Execution Memory System
 * Persists and retrieves task execution results
 */

import { createAdminClient } from "@/lib/supabase/server";

export interface ExecutionLog {
  id: string;
  task_id: string;
  title: string;
  status: "completed" | "failed";
  output?: string;
  error?: string;
  estimated_cost?: number;
  roles_executed?: string[];
  created_at: string;
}

/**
 * Store execution result in memory
 */
export async function storeExecutionResult(
  taskId: string,
  title: string,
  result: {
    success: boolean;
    output?: string;
    error?: string;
    estimatedCost?: number;
    rolesExecuted?: string[];
  }
): Promise<{ success: boolean; logId?: string; error?: string }> {
  console.log("[execution-memory] Storing execution result for task:", taskId);

  try {
    const db = createAdminClient();

    const logEntry = {
      task_id: taskId,
      title,
      status: result.success ? "completed" : "failed",
      output: result.output || null,
      error: result.error || null,
      estimated_cost: result.estimatedCost || 0,
      roles_executed: result.rolesExecuted || null,
    };

    const { data, error } = await db
      .from("javari_execution_logs")
      .insert(logEntry)
      .select("id")
      .single();

    if (error) {
      console.error("[execution-memory] Failed to store result:", error);
      return { success: false, error: error.message };
    }

    console.log("[execution-memory] ✅ Stored execution log:", data.id);
    return { success: true, logId: data.id };
  } catch (err: any) {
    console.error("[execution-memory] Unexpected error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get execution history (most recent first)
 */
export async function getExecutionHistory(
  limit: number = 50
): Promise<ExecutionLog[]> {
  console.log("[execution-memory] Fetching execution history, limit:", limit);

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("javari_execution_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[execution-memory] Failed to fetch history:", error);
      return [];
    }

    console.log("[execution-memory] Retrieved", data.length, "execution logs");
    return data as ExecutionLog[];
  } catch (err: any) {
    console.error("[execution-memory] Unexpected error:", err.message);
    return [];
  }
}

/**
 * Get execution logs for a specific task
 */
export async function getExecutionByTask(taskId: string): Promise<ExecutionLog[]> {
  console.log("[execution-memory] Fetching executions for task:", taskId);

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("javari_execution_logs")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[execution-memory] Failed to fetch task executions:", error);
      return [];
    }

    console.log("[execution-memory] Found", data.length, "executions for task:", taskId);
    return data as ExecutionLog[];
  } catch (err: any) {
    console.error("[execution-memory] Unexpected error:", err.message);
    return [];
  }
}

/**
 * Get execution statistics
 */
export async function getExecutionStats(): Promise<{
  total: number;
  completed: number;
  failed: number;
  totalCost: number;
}> {
  console.log("[execution-memory] Fetching execution statistics");

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("javari_execution_logs")
      .select("status, estimated_cost");

    if (error) {
      console.error("[execution-memory] Failed to fetch stats:", error);
      return { total: 0, completed: 0, failed: 0, totalCost: 0 };
    }

    const stats = {
      total: data.length,
      completed: data.filter(r => r.status === "completed").length,
      failed: data.filter(r => r.status === "failed").length,
      totalCost: data.reduce((sum, r) => sum + (Number(r.estimated_cost) || 0), 0),
    };

    console.log("[execution-memory] Stats:", stats);
    return stats;
  } catch (err: any) {
    console.error("[execution-memory] Unexpected error:", err.message);
    return { total: 0, completed: 0, failed: 0, totalCost: 0 };
  }
}

/**
 * Search execution logs by title
 */
export async function searchExecutions(query: string): Promise<ExecutionLog[]> {
  console.log("[execution-memory] Searching executions for:", query);

  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from("javari_execution_logs")
      .select("*")
      .ilike("title", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[execution-memory] Search failed:", error);
      return [];
    }

    console.log("[execution-memory] Found", data.length, "matching executions");
    return data as ExecutionLog[];
  } catch (err: any) {
    console.error("[execution-memory] Unexpected error:", err.message);
    return [];
  }
}
