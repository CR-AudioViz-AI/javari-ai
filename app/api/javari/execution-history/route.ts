import { NextResponse } from "next/server";
import {
  getExecutionHistory,
  getExecutionByTask,
  getExecutionStats,
  searchExecutions,
} from "@/lib/roadmap/execution-memory";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "50");

    console.log("[execution-history] Request:", { taskId, query, limit });

    // Search by query
    if (query) {
      const results = await searchExecutions(query);
      return NextResponse.json({
        ok: true,
        results,
        count: results.length,
      });
    }

    // Get by task ID
    if (taskId) {
      const results = await getExecutionByTask(taskId);
      return NextResponse.json({
        ok: true,
        results,
        count: results.length,
        taskId,
      });
    }

    // Get recent history
    const history = await getExecutionHistory(limit);
    const stats = await getExecutionStats();

    return NextResponse.json({
      ok: true,
      history,
      count: history.length,
      stats,
    });
  } catch (err: any) {
    console.error("[execution-history] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to fetch execution history",
      },
      { status: 500 }
    );
  }
}
