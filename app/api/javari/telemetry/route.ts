import { NextResponse } from "next/server";
import { getTelemetryStats, getRecentLogs } from "@/lib/telemetry/telemetry";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");
    const logsOnly = searchParams.get("logs") === "true";

    console.log("[telemetry] Fetching telemetry data");

    if (logsOnly) {
      const logs = await getRecentLogs(50);
      return NextResponse.json({
        ok: true,
        logs,
      });
    }

    const sinceDate = since ? new Date(since) : undefined;
    const stats = await getTelemetryStats(sinceDate);

    if (!stats) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch telemetry stats" },
        { status: 500 }
      );
    }

    console.log("[telemetry] Stats retrieved:");
    console.log("  Total executions:", stats.totalExecutions);
    console.log("  Success rate:", stats.successRate.toFixed(2), "%");
    console.log("  Total cost: $", stats.totalCost.toFixed(4));

    return NextResponse.json({
      ok: true,
      stats,
    });
  } catch (err: any) {
    console.error("[telemetry] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to fetch telemetry",
      },
      { status: 500 }
    );
  }
}
