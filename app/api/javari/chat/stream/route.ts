import { NextResponse } from "next/server";
import { runJavariChatRequest } from "@/javari/chat/runJavariChatRequest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { message, userId } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Initial acknowledgement event
        controller.enqueue(
          encoder.encode(`event: status\ndata: ${JSON.stringify({ status: "started" })}\n\n`)
        );

        // Run non-streaming routing/execution
        const result = await runJavariChatRequest(
          { message },
          {
            userId,
            autoExecute: true,
            applyPolicy: true,
            applyLearning: false,
          }
        );

        // Simulate token streaming from result text
        const output = result?.executionResult?.outputs?.message ?? "No response generated.";
        const tokens = output.split(" ");

        for (let t of tokens) {
          controller.enqueue(
            encoder.encode(`event: token\ndata: ${JSON.stringify({ token: t })}\n\n`)
          );
          await new Promise((r) => setTimeout(r, 20));
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ complete: true, metadata: result })}\n\n`
          )
        );

        controller.close();
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: err?.message || "stream error" })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
