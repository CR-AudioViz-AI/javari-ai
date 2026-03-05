import { NextResponse } from "next/server";
import { getModelRankings } from "@/lib/routing/model-intelligence";

export async function GET() {
  try {
    console.log("[model-stats] Fetching model performance rankings");

    const rankings = await getModelRankings();

    console.log("[model-stats] Rankings retrieved:", rankings.length, "models");

    return NextResponse.json({
      ok: true,
      rankings,
      count: rankings.length,
    });
  } catch (err: any) {
    console.error("[model-stats] Error:", err.message);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "Failed to fetch model stats",
      },
      { status: 500 }
    );
  }
}
