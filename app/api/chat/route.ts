// app/api/chat/route.ts
// Javari Chat API — v2 STREAMING
// 2026-02-20 — STEP 0 repair:
//   - Removed 23s/25s timeout (was blocking long responses)
//   - True SSE streaming via ReadableStream passthrough
//   - Incremental chunk forwarding — no response buffering
//   - Null-safe chunk handling
//   - Graceful fallback to buffered JSON when streaming not requested
//   - Routes: POST /api/chat

import { NextRequest } from "next/server";

export const runtime = "nodejs";
// No maxDuration — streaming connections self-terminate when done
// (Vercel hobby: 10s, Pro: 60s, Enterprise: 300s)

interface ChatRequest {
  message?: string;
  messages?: Array<{ role: string; content: string }>;
  mode?: "single" | "super" | "advanced" | "roadmap";
  provider?: string;
  stream?: boolean;
  history?: Array<{ role: string; content: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errorResponse(msg: string, status = 200) {
  return new Response(
    JSON.stringify({ success: false, response: msg, error: msg }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

function extractMessage(body: ChatRequest): string {
  // Support both single-message and messages-array formats
  if (body.message && typeof body.message === "string") return body.message.trim();
  if (Array.isArray(body.messages)) {
    const last = [...body.messages].reverse().find((m) => m.role === "user");
    if (last?.content) return last.content.trim();
  }
  return "";
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON in request body");
  }

  const message = extractMessage(body);
  const { mode = "single", provider: requestedProvider = "groq", stream: wantsStream = false } = body;

  if (!message) {
    return errorResponse("Please provide a message");
  }

  // ── Resolve provider ──────────────────────────────────────────────────────
  let providerModule: Awaited<ReturnType<typeof import("@/lib/javari/providers").getProvider>> | null = null;
  let usedProvider = requestedProvider;

  const providerPriority = [requestedProvider, "groq", "openai", "anthropic", "mistral", "openrouter"];
  const seen = new Set<string>();

  for (const p of providerPriority) {
    if (seen.has(p)) continue;
    seen.add(p);
    try {
      const { getProvider, getProviderApiKey } = await import("@/lib/javari/providers");
      const key = getProviderApiKey(p as Parameters<typeof getProviderApiKey>[0]);
      if (!key) continue;
      providerModule = getProvider(p as Parameters<typeof getProvider>[0], key);
      usedProvider = p;
      break;
    } catch {
      continue;
    }
  }

  if (!providerModule) {
    return errorResponse("No AI provider available. Check API keys.");
  }

  console.log(`[Chat] provider=${usedProvider} mode=${mode} stream=${wantsStream} msgLen=${message.length}`);

  // ── STREAMING PATH ────────────────────────────────────────────────────────
  if (wantsStream) {
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const enqueue = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller may be closed if client disconnected
          }
        };

        try {
          const gen = providerModule!.generateStream(message);
          let accumulated = "";

          for await (const chunk of gen) {
            if (chunk == null) continue;
            const delta = typeof chunk === "string" ? chunk : String(chunk);
            if (!delta) continue;
            accumulated += delta;
            enqueue({ type: "delta", content: delta });
          }

          enqueue({
            type: "done",
            content: accumulated,
            provider: usedProvider,
            mode,
            durationMs: Date.now() - t0,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          console.error(`[Chat] Stream error: ${msg}`);
          enqueue({ type: "error", error: msg });
        } finally {
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  }

  // ── BUFFERED PATH (default — no stream flag) ──────────────────────────────
  try {
    let response = "";
    const gen = providerModule.generateStream(message);

    for await (const chunk of gen) {
      if (chunk == null) continue;
      response += typeof chunk === "string" ? chunk : String(chunk);
    }

    response = response.trim() || "No response generated";
    console.log(`[Chat] Done in ${Date.now() - t0}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        response,
        answer: response,
        content: response,
        provider: usedProvider,
        mode,
        messages: [{ role: "assistant", content: response }],
        durationMs: Date.now() - t0,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Chat] Buffered error: ${msg}`);
    return errorResponse(`I encountered an error: ${msg}. Please try again.`);
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({ success: false, error: "POST required" }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
