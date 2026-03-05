import { NextResponse } from "next/server";
import { executeGateway } from "@/lib/execution/gateway";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      message,
      mode = "auto",
      userId,
      allowedModels,
      excludedModels,
      routingPriority,
      roles,
    } = body;

    console.log("[chat-route] Request received:", {
      userId,
      mode,
      hasMessage: !!message,
      hasRoles: !!roles,
    });

    if (!message || !userId) {
      return NextResponse.json(
        { ok: false, error: "Missing message or userId." },
        { status: 400 }
      );
    }

    const result = await executeGateway({
      input: message,
      mode,
      userId,
      allowedModels,
      excludedModels,
      routingPriority,
      roles,
    });

    console.log("[chat-route] Execution complete:", {
      userId,
      mode,
      model: result.model,
      provider: result.provider,
    });

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (err: any) {
    console.error("[chat-route] Execution error:", {
      message: err?.message,
      stack: err?.stack?.split('\n')[0],
    });

    return NextResponse.json(
      { ok: false, error: err?.message ?? "Execution failed." },
      { status: 500 }
    );
  }
}
