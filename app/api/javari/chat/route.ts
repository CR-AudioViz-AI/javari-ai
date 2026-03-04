// app/api/javari/chat/route.ts
// Javari Chat API v5 — Parallel Multi-Agent Orchestration
// 2026-03-03 — True parallel architect + builder, sequential validator

import { NextResponse } from "next/server";
import { detectXmlCommand } from "@/lib/javari/engine/commandDetector";
import { executeSystemCommand } from "@/lib/javari/engine/systemCommandEngine";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import { JAVARI_SYSTEM_PROMPT } from "@/lib/javari/engine/systemPrompt";
import type { Message } from "@/lib/types";
import { executeWithFailover } from "@/lib/ai/executeWithFailover";

export const maxDuration = 120;

export async function POST(req: Request) {
  console.log("JAVARI CHAT ROUTE HIT");
  console.log("HIT /api/javari/chat");
  const t0 = Date.now();

  try {
    const body = await req.json();
    console.log("CHAT REQUEST BODY:", body);

    const { messages, persona, context, files, mode } = body as {
      messages?: Message[];
      persona?: string;
      context?: Record<string, unknown>;
      files?: unknown[];
      mode?: string;
    };

    const userMessages = (messages ?? []).filter((m) => m.role === "user");
    const lastUserContent = userMessages[userMessages.length - 1]?.content ?? "";

    // ── MULTI-AGENT MODE (PARALLEL ARCHITECT + BUILDER) ──────────────
    if (mode === "multi") {
      console.log("MULTI MODE ACTIVATED");
      
      try {
        const [architect, builder] = await Promise.all([
          executeWithFailover(
            `You are the Architect AI.
Analyze this task and produce a structured execution plan.
Task: ${lastUserContent}`,
            "architect"
          ),
          executeWithFailover(
            `You are the Builder AI.
Execute this task with full technical detail and production-ready implementation.
Task: ${lastUserContent}`,
            "builder"
          ),
        ]);

        const validator = await executeWithFailover(
          `You are the Validator AI.
Validate and reconcile the following outputs:

ARCHITECT:
${architect.content ?? "No architect output"}

BUILDER:
${builder.content ?? "No builder output"}

Provide final synthesis and recommended next steps.`,
          "validator"
        );

        return Response.json({
          mode: "multi",
          success: true,
          architect: architect.content,
          builder: builder.content,
          validator: validator.content,
          messages: [
            {
              role: "assistant",
              content: validator.content ?? builder.content ?? "Multi-agent execution completed.",
            },
          ],
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown multi-agent error";
        console.error("[ChatRoute v5] Multi-agent error:", msg);
        
        return Response.json({
          mode: "multi",
          success: false,
          error: msg,
          messages: [
            {
              role: "assistant",
              content: `Multi-agent orchestration failed: ${msg}`,
            },
          ],
        });
      }
    }

    // ── MODE LOGGING ───────────────────────────────────────────────────
    if (mode && mode !== "multi") {
      console.log(`MODE PROVIDED BUT NOT MULTI: ${mode}`);
    }

    if (!mode) {
      console.log("NO MODE PROVIDED - defaulting to single-agent");
    }

    // ── STEP 1: Detect XML system command ────────────────────────────────
    const detection = detectXmlCommand(lastUserContent);

    if (detection.isCommand && detection.command) {
      const cmd = detection.command;
      const detectMs = Date.now() - t0;

      console.info(
        `[ChatRoute v5] SystemCommandMode | tag=${cmd.tagName} action=${cmd.action} valid=${cmd.valid} detectMs=${detectMs}`
      );

      const cmdResult = await executeSystemCommand(cmd);
      const totalMs = Date.now() - t0;

      console.info(
        `[ChatRoute v5] SystemCommand complete | action=${cmd.action} success=${cmdResult.success} totalMs=${totalMs}`
      );

      const assistantContent = cmdResult.success
        ? cmdResult.finalReport
        : formatCommandError(cmd.action, cmdResult.error ?? "Unknown error");

      return NextResponse.json({
        systemCommandMode: true,
        action: cmd.action,
        commandDetected: true,
        tagName: cmd.tagName,
        valid: cmd.valid,
        success: cmdResult.success,
        result: cmdResult.result,
        progress: cmdResult.progress,
        finalReport: cmdResult.finalReport,
        structuredLogs: cmdResult.logs,
        parseLogs: cmd.parseLogs ?? [],
        executionMs: cmdResult.executionMs,
        totalMs,
        timestamp: cmdResult.timestamp,
        error: cmdResult.error ?? null,
        messages: [
          {
            role: "assistant",
            content: assistantContent,
          },
        ],
      });
    }

    // ── STEP 2: Normal single-agent chat path ─────────────────────────

    let memoryContext = "";
    try {
      memoryContext = await Promise.race([
        retrieveRelevantMemory(lastUserContent),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 5_000)),
      ]);
    } catch {
      // Non-fatal
    }

    const augmented: Message[] = [];
    if (memoryContext) {
      augmented.push({ role: "system", content: memoryContext } as Message);
    }
    augmented.push({ role: "system", content: JAVARI_SYSTEM_PROMPT } as Message);
    augmented.push(...(messages ?? []));

    const result = await executeWithFailover(lastUserContent);

    if (!result.success) {
      return NextResponse.json({
        systemCommandMode: false,
        success: false,
        messages: [
          {
            role: "assistant",
            content: result.content,
          },
        ],
      }, { status: 200 });
    }

    return NextResponse.json({
      systemCommandMode: false,
      success: true,
      provider: result.provider,
      messages: [
        {
          role: "assistant",
          content: result.content,
        },
      ],
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const totalMs = Date.now() - t0;
    console.error("[ChatRoute v5] Error:", msg, `(${totalMs}ms)`);

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
