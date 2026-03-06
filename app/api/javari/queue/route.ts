import { NextRequest, NextResponse } from "next/server";
import { processQueue, getQueueStats } from "@/lib/execution/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/javari/queue
 * Process the execution queue
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { maxTasks = 5, userId = "queue-executor" } = body;

    const result = await processQueue(maxTasks, userId);

    return NextResponse.json({
      ok: true,
      ...result,
    });

  } catch (error: any) {
    console.error("[queue-api] Error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/javari/queue
 * Get queue statistics
 */
export async function GET(req: NextRequest) {
  try {
    const stats = await getQueueStats();

    return NextResponse.json({
      ok: true,
      stats,
    });

  } catch (error: any) {
    console.error("[queue-api] Error:", error.message);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
