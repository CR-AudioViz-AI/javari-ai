// app/api/javari/chat/route.ts
// Javari Chat API — memory-augmented
// Memory retrieval runs both here (API layer) and in unified engine (belt+suspenders)

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

    // ── Retrieve memory at API layer (transparent to client) ───────────────
    // Extract user query for retrieval
    const userMessages = (messages ?? []).filter((m) => m.role === "user");
    const lastUserContent =
      userMessages[userMessages.length - 1]?.content ?? "";

    // Retrieve relevant R2 / knowledge base context
    // Returns "" on failure — never throws
    const memoryContext = await retrieveRelevantMemory(lastUserContent);

    // ── Build augmented messages with identity guard ───────────────────────
    // Always ensure identity is present even if unified engine fails
    const augmentedMessages: Message[] = [];

    if (memoryContext) {
      augmentedMessages.push({
        id: "memory-context",
        role: "system" as const,
        content: memoryContext,
      } as unknown as Message);
    }

    augmentedMessages.push({
      id: "identity",
      role: "system" as const,
      content: JAVARI_SYSTEM_PROMPT,
    } as unknown as Message);

    // Add the actual conversation messages
    augmentedMessages.push(...(messages ?? []));

    // ── Call unified engine ────────────────────────────────────────────────
    const result = await unifiedJavariEngine({
      messages: augmentedMessages,
      persona,
      context,
      files,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[ChatRoute] Error:", msg);
    return NextResponse.json(
      {
        messages: [
          {
            id: "error",
            role: "assistant",
            content:
              "I\'m Javari — an internal error occurred. Please try again.",
          },
        ],
        error: msg,
        success: false,
      },
      { status: 200 } // keep 200 so client doesn\'t show network error
    );
  }
}
