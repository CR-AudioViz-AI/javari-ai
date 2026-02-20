// app/api/javari/chat/route.ts
// Javari Chat API v4 — XML System Command intercept layer
// 2026-02-20 — JAVARI_PATCH upgrade_system_command_engine
//
// Pipeline:
//   1. Detect JAVARI_COMMAND / JAVARI_SYSTEM_COMMAND / JAVARI_EXECUTE / JAVARI_PATCH / JAVARI_SYSTEM_REPAIR
//   2. If found → bypass all provider routing → systemCommandEngine v2
//   3. If not found → memory retrieval → unifiedJavariEngine (normal chat)
//
// Response additions (v4):
//   - progress[]       — step-by-step progress events
//   - finalReport      — human-readable formatted summary
//   - structuredLogs   — leveled timestamped log array
//   - parseLogs        — XML parser trace for debugging

import { NextResponse } from "next/server";
import { detectXmlCommand } from "@/lib/javari/engine/commandDetector";
import { executeSystemCommand } from "@/lib/javari/engine/systemCommandEngine";
import { unifiedJavariEngine } from "@/lib/javari/engine/unified";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import { JAVARI_SYSTEM_PROMPT } from "@/lib/javari/engine/systemPrompt";
import type { Message } from "@/lib/types";

// System commands can run long (diagnostics = 30-60s, module gen = 60-90s)
export const maxDuration = 120;

export async function POST(req: Request) {
  const t0 = Date.now();

  try {
    const body = await req.json();
    const { messages, persona, context, files } = body as {
      messages?: Message[];
      persona?: string;
      context?: Record<string, unknown>;
      files?: unknown[];
    };

    // ── Extract last user message ──────────────────────────────────────────
    const userMessages = (messages ?? []).filter((m) => m.role === "user");
    const lastUserContent = userMessages[userMessages.length - 1]?.content ?? "";

    // ── STEP 1: Detect XML system command ────────────────────────────────
    const detection = detectXmlCommand(lastUserContent);

    if (detection.isCommand && detection.command) {
      const cmd = detection.command;
      const detectMs = Date.now() - t0;

      console.info(
        `[ChatRoute v4] SystemCommandMode | tag=${cmd.tagName} action=${cmd.action} valid=${cmd.valid} detectMs=${detectMs}`
      );

      // Execute through system command engine v2 — bypasses ALL provider routing
      const cmdResult = await executeSystemCommand(cmd);
      const totalMs = Date.now() - t0;

      console.info(
        `[ChatRoute v4] SystemCommand complete | action=${cmd.action} success=${cmdResult.success} totalMs=${totalMs}`
      );

      // ── Build assistant message for chat UI ──────────────────────────
      // finalReport is the primary human-readable output from SCE v2
      const assistantContent = cmdResult.success
        ? cmdResult.finalReport
        : formatCommandError(cmd.action, cmdResult.error ?? "Unknown error");

      return NextResponse.json({
        // Core command metadata
        systemCommandMode: true,
        action: cmd.action,
        commandDetected: true,
        tagName: cmd.tagName,
        valid: cmd.valid,
        success: cmdResult.success,
        // Payload
        result: cmdResult.result,
        // Observability
        progress: cmdResult.progress,
        finalReport: cmdResult.finalReport,
        structuredLogs: cmdResult.logs,
        parseLogs: cmd.parseLogs ?? [],
        // Timing
        executionMs: cmdResult.executionMs,
        totalMs,
        timestamp: cmdResult.timestamp,
        // Error (if any)
        error: cmdResult.error ?? null,
        // Chat UI message
        messages: [
          {
            role: "assistant",
            content: assistantContent,
          },
        ],
      });
    }

    // ── STEP 2: Normal chat path ─────────────────────────────────────────

    // Retrieve R2 semantic memory (5s timeout — never block chat)
    let memoryContext = "";
    try {
      memoryContext = await Promise.race([
        retrieveRelevantMemory(lastUserContent),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 5_000)),
      ]);
    } catch {
      // Non-fatal — memory retrieval failure never blocks chat
    }

    // Build augmented message list with memory + system prompt
    const augmented: Message[] = [];
    if (memoryContext) {
      augmented.push({ role: "system", content: memoryContext } as Message);
    }
    augmented.push({ role: "system", content: JAVARI_SYSTEM_PROMPT } as Message);
    augmented.push(...(messages ?? []));

    const result = await unifiedJavariEngine({
      messages: augmented,
      persona,
      context,
      files,
      _memoryAlreadyInjected: true,
    });

    return NextResponse.json(result, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const totalMs = Date.now() - t0;
    console.error("[ChatRoute v4] Error:", msg, `(${totalMs}ms)`);

    return NextResponse.json(
      {
        systemCommandMode: false,
        success: false,
        error: msg,
        totalMs,
        messages: [
          {
            role: "assistant",
            content: "I'm Javari — an internal error occurred. Please try again.",
          },
        ],
      },
      { status: 200 }
    );
  }
}

// ── Error formatter (kept for non-SCE errors) ────────────────────────────────

function formatCommandError(action: string, error: string): string {
  return [
    `❌ **Command Failed: \`${action}\`**`,
    "",
    `**Error:** ${error}`,
    "",
    "Check command structure and try again. Valid actions:",
    "`ping_system` · `run_diagnostic` · `get_status` · `generate_module` · `preview_module` · `update_roadmap` · `ingest_docs`",
  ].join("\n");
}
