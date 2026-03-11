// app/api/javari/chat/route.ts
// Purpose: Unified Javari Chat API — primary entry point for ALL user and system messages.
//          Routes through javariChatController for intent classification and multi-provider routing.
//          Supports single (routed) and team (Architect→Engineer→Validator→Documenter) modes.
// Date: 2026-03-11

import { NextRequest, NextResponse }    from "next/server";
import { createClient }                  from "@supabase/supabase-js";
import { handleChatMessage }             from "@/lib/javari/chat/javariChatController";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 120;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// GET — health + session stats
export async function GET(): Promise<NextResponse> {
  let sessionCount = 0;
  try {
    const { count } = await db()
      .from("chat_sessions")
      .select("*", { count: "exact", head: true });
    sessionCount = count ?? 0;
  } catch { /* table may not exist yet */ }

  return NextResponse.json({
    ok         : true,
    endpoint   : "Javari Chat Controller v2.0",
    modes      : ["single", "team"],
    intents    : ["chat", "plan_task", "execute_task", "generate_module", "query_system"],
    telemetry  : { totalSessions: sessionCount },
    timestamp  : new Date().toISOString(),
  });
}

// POST — process chat message through controller
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept message, input (legacy), or content
  const message = (
    (body.message as string | undefined) ??
    (body.input   as string | undefined) ??
    (body.content as string | undefined) ?? ""
  ).trim();

  if (!message) {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  const mode      = (body.mode as string) === "team" ? "team" as const : "single" as const;
  const userId    = (body.userId as string | undefined) ?? (body.user_id as string | undefined) ?? "anonymous";
  const sessionId = body.sessionId as string | undefined;
  const context   = body.context   as Record<string, unknown> | undefined;

  const result = await handleChatMessage({ message, mode, userId, sessionId, context });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, intent: result.intent, latencyMs: result.latencyMs },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok        : true,
    reply     : result.reply,
    // Legacy fields so existing normaliseReply() in frontend works without change
    output    : result.reply,
    answer    : result.reply,
    response  : result.reply,
    // Structured data
    intent    : result.intent,
    mode      : result.mode,
    provider  : result.provider,
    model     : result.model,
    costUsd   : result.costUsd,
    latencyMs : result.latencyMs,
    sessionId : result.sessionId,
    teamSteps : result.teamSteps,
    systemData: result.systemData,
    timestamp : new Date().toISOString(),
  });
}
