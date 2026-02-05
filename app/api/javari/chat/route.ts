import { NextRequest, NextResponse } from "next/server";
import { runJavariChatRequest } from "@/javari/chat/runJavariChatRequest";

/**
 * JavariChat API Route
 * 
 * Frontend → Backend gateway for all Javari chat messages.
 * 
 * Handles:
 *  - JSON body parsing
 *  - Envelope creation (backend)
 *  - Routing (Mode A/B)
 *  - Optional execution
 *  - Clean UI-facing response
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await runJavariChatRequest(body, {
      userId: body.userId || "ui-user",
      source: "ui-chat",
      autoExecute: body.autoExecute ?? true,
      applyPolicy: body.applyPolicy ?? true,
      applyLearning: body.applyLearning ?? false,
    });

    return NextResponse.json(
      {
        ok: true,
        data: response,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
