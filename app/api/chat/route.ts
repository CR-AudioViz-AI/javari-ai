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

    const routerRes = await fetch(
      `${process.env.NEXT_PUBLIC_JAVARI_HOST}/api/javari/router`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.get("Authorization") || ""
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

    const stream = new ReadableStream({
      async start(controller) {
        const reader = routerRes.body!.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }

        controller.close();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
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
