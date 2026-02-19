// app/api/javari/chat/route.ts
// Javari Chat API — memory-augmented with R2 Canonical knowledge retrieval
// v2: memory retrieved once here, not duplicated inside unifiedJavariEngine
//     passes _memoryAlreadyInjected=true to prevent double embedding calls
// 2026-02-19

import { NextResponse } from "next/server";
import { unifiedJavariEngine } from "@/lib/javari/engine/unified";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import { JAVARI_SYSTEM_PROMPT } from "@/lib/javari/engine/systemPrompt";
import type { Message } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { messages, persona, context, files } = json as {
      messages?: Message[];
      persona?: string;
      context?: Record<string, unknown>;
      files?: unknown[];
    };

    // ── Retrieve relevant R2 memory (ONCE — deduped from unified engine) ──
    const userMessages = (messages ?? []).filter((m) => m.role === "user");
    const lastUserContent = userMessages[userMessages.length - 1]?.content ?? "";

    // Run memory retrieval with a 5s timeout — never block the chat pipeline
    let memoryContext = "";
    try {
      const memPromise = retrieveRelevantMemory(lastUserContent);
      const timeoutPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve(""), 5_000)
      );
      memoryContext = await Promise.race([memPromise, timeoutPromise]);
    } catch {
      // Non-fatal — chat works without memory context
    }

    // ── Build augmented message list ──────────────────────────────────────
    // Order: [memory context system msg] → [identity system msg] → [conversation]
    const augmented: Message[] = [];

    if (memoryContext) {
      augmented.push({ role: "system", content: memoryContext } as Message);
    }

    // Identity guard — always present, always last system msg before conversation
    augmented.push({
      role: "system",
      content: JAVARI_SYSTEM_PROMPT,
    } as Message);

    // Conversation history
    augmented.push(...(messages ?? []));

    const result = await unifiedJavariEngine({
      messages: augmented,
      persona,
      context,
      files,
      _memoryAlreadyInjected: true, // ← prevents double embedding in unified engine
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ChatRoute] Error:", msg);
    return NextResponse.json(
      {
        messages: [
          {
            role: "assistant",
            content: "I'm Javari — an internal error occurred. Please try again.",
          },
        ],
        error: msg,
        success: false,
      },
      { status: 200 }
    );
  }
}
