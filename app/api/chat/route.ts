import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      message,
      mode,
      provider,
      sessionId,
      history
    } = body;

    if (!message || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400 }
      );
    }

    // Get base URL from request origin
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const routerRes = await fetch(
      `${baseUrl}/api/javari/router`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          mode,
          provider,
          sessionId,
          history
        })
      }
    );

    if (!routerRes.ok) {
      const errorText = await routerRes.text();
      return new Response(
        JSON.stringify({
          error: "Router request failed.",
          details: errorText
        }),
        { status: 500 }
      );
    }

    // Return the router response directly
    const data = await routerRes.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Server error.",
        details: err?.message || "Unknown"
      }),
      { status: 500 }
    );
  }
}
