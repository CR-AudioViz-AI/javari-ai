// app/api/chat/multi/route.ts
// Purpose: Multi-AI Chat endpoint — streaming + non-streaming, guardrail-protected
// Connects lib/chat/router.ts to the HTTP layer
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import { route, streamRouter, detectAvailableProviders, ROUTER_VERSION } from "@/lib/chat/router";
import { ChatMessage, RouterConfig } from "@/lib/chat/types";
import { checkKillSwitch } from "@/lib/execution/guardrails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MultiChatRequest {
  message?: string;
  messages?: ChatMessage[];
  mode?: "single" | "multi" | "auto";
  strategy?: RouterConfig["strategy"];
  stream?: boolean;
  maxCost?: number;
  timeoutMs?: number;
  systemPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    // Guardrail: kill switch
    const killCheck = checkKillSwitch();
    if (killCheck.outcome !== "pass") {
      return NextResponse.json({ ok: false, error: killCheck.reason }, { status: 503 });
    }

    const body = await req.json() as MultiChatRequest;

    // Normalize messages
    let messages: ChatMessage[];
    if (body.messages && body.messages.length > 0) {
      messages = body.messages;
    } else if (body.message) {
      messages = [{ role: "user", content: body.message }];
    } else {
      return NextResponse.json({ ok: false, error: "message or messages required" }, { status: 400 });
    }

    const config: RouterConfig = {
      mode:      body.mode      ?? "auto",
      strategy:  body.strategy  ?? "balanced",
      maxCost:   body.maxCost   ?? 0.50,
      timeoutMs: body.timeoutMs ?? 30000,
      stream:    body.stream    ?? false,
      guardrailsEnabled: true,
    };

    // ── Streaming mode ─────────────────────────────────────────────────────
    if (config.stream) {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamRouter(messages, config)) {
              const data = `data: ${JSON.stringify(chunk)}\n\n`;
              controller.enqueue(encoder.encode(data));
              if (chunk.type === "done" || chunk.type === "error") break;
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (err: unknown) {
            const msg = (err as Error).message;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Router-Version": ROUTER_VERSION,
        },
      });
    }

    // ── Non-streaming mode ─────────────────────────────────────────────────
    const result = await route(messages, config);

    return NextResponse.json({
      ok: true,
      router_version: ROUTER_VERSION,
      result,
    }, {
      headers: { "X-Router-Version": ROUTER_VERSION },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat/multi] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// GET: router health check — shows available providers and models
export async function GET() {
  const killCheck = checkKillSwitch();
  const providers = detectAvailableProviders();

  return NextResponse.json({
    ok: true,
    router_version: ROUTER_VERSION,
    guardrails: killCheck.outcome === "pass" ? "active" : "blocked",
    providers,
    modes: ["single", "multi", "auto"],
    strategies: ["fastest", "cheapest", "highest_quality", "balanced"],
  });
}
