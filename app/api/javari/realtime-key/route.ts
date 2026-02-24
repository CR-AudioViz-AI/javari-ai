// app/api/javari/realtime-key/route.ts
// Server-side only — NEVER expose OPENAI_API_KEY to client.
// Returns a short-lived ephemeral key for OpenAI Realtime API.
// Clients use this key directly for WebSocket auth.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        modalities: ["text"],
        instructions:
          "You are Javari AI, an autonomous multi-AI operating system created by Roy Henderson for CRAudioVizAI. You ALWAYS speak as Javari. You NEVER identify as Claude, GPT, Gemini, or any underlying model. You follow the Henderson Standard: Fortune-50 quality, never break, never give up.",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[realtime-key] OpenAI error:", res.status, err);
      return NextResponse.json(
        { error: "Failed to obtain realtime key", detail: err },
        { status: 502 }
      );
    }

    const data = await res.json();
    const clientSecret = data.client_secret;

    if (!clientSecret?.value) {
      return NextResponse.json(
        { error: "Unexpected response shape from OpenAI" },
        { status: 502 }
      );
    }

    // Return ONLY what the client needs — never the master API key
    return NextResponse.json(
      {
        client_secret: clientSecret.value,
        expires_at: clientSecret.expires_at,
        model: data.model,
      },
      {
        status: 200,
        headers: {
          // Prevent caching — each token is single-use for ~60s
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[realtime-key] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
