// app/api/javari/chat/route.ts
// Javari Chat API — memory-augmented with R2 Canonical knowledge retrieval

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

    // ── Retrieve relevant R2 memory at API layer ──────────────────────────
    const userMessages = (messages ?? []).filter((m) => m.role === "user");
    const lastUserContent = userMessages[userMessages.length - 1]?.content ?? "";
    const memoryContext = await retrieveRelevantMemory(lastUserContent);

    // ── Build augmented message list ──────────────────────────────────────
    // Order: [memory context system] → [identity system] → [conversation]
    const augmented: Message[] = [];

    if (memoryContext) {
      augmented.push({ role: "system", content: memoryContext } as Message);
    }

    // Identity guard — always present
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
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ChatRoute] Error:", msg);
    return NextResponse.json({
      messages: [{
        role: "assistant",
        content: "I\'m Javari — an internal error occurred. Please try again.",
      }],
      error: msg,
      success: false,
    }, { status: 200 });
  }
}
