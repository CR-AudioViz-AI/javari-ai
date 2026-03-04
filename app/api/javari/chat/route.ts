import { NextResponse } from "next/server";
import { executeGateway } from "@/lib/execution/gateway";
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      mode = "auto",
      planTier = "free",
      allowedModels,
      excludedModels,
      routingPriority,
      roles,
    } = body;
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Missing message." },
        { status: 400 }
      );
    }
    const result = await executeGateway({
      input: message,
      mode,
      planTier,
      allowedModels,
      excludedModels,
      routingPriority,
      roles,
    });
    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Execution failed." },
      { status: 500 }
    );
  }
}
