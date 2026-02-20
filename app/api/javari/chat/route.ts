// app/api/javari/chat/route.ts
// Javari Chat API v3 — XML System Command intercept layer
// Pipeline:
//   1. Detect JAVARI_COMMAND / JAVARI_SYSTEM_COMMAND / JAVARI_EXECUTE blocks
//   2. If found → bypass provider routing entirely → systemCommandEngine()
//   3. If not found → memory retrieval → unifiedJavariEngine (normal chat)
// 2026-02-19 — P1-003 System Command Engine

import { NextResponse } from "next/server";
import { detectXmlCommand } from "@/lib/javari/engine/commandDetector";
import { executeSystemCommand } from "@/lib/javari/engine/systemCommandEngine";
import { unifiedJavariEngine } from "@/lib/javari/engine/unified";
import { retrieveRelevantMemory } from "@/lib/javari/memory/retrieval";
import { JAVARI_SYSTEM_PROMPT } from "@/lib/javari/engine/systemPrompt";
import type { Message } from "@/lib/types";

// System commands can take much longer (module generation = 30-60s)
export const maxDuration = 90;

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

    // ── Extract last user message ────────────────────────────────────────────
    const userMessages = (messages ?? []).filter((m) => m.role === "user");
    const lastUserContent = userMessages[userMessages.length - 1]?.content ?? "";

    // ── STEP 1: Detect XML system command ────────────────────────────────────
    const detection = detectXmlCommand(lastUserContent);

    if (detection.isCommand && detection.command) {
      const cmd = detection.command;
      const detectMs = Date.now() - t0;

      console.info(`[ChatRoute] SystemCommandMode engaged | action=${cmd.action} | detectMs=${detectMs}`);

      // Execute through system command engine (bypasses all provider routing)
      const cmdResult = await executeSystemCommand(cmd);

      const totalMs = Date.now() - t0;
      console.info(`[ChatRoute] SystemCommand complete | action=${cmd.action} | success=${cmdResult.success} | totalMs=${totalMs}`);

      // Return structured JSON — not chat envelope
      return NextResponse.json({
        systemCommandMode: true,
        action: cmd.action,
        commandDetected: true,
        valid: cmd.valid,
        success: cmdResult.success,
        result: cmdResult.result,
        logs: cmdResult.logs,
        executionMs: cmdResult.executionMs,
        totalMs,
        timestamp: cmdResult.timestamp,
        error: cmdResult.error ?? null,
        // Include a human-readable assistant message for the chat UI
        messages: [
          {
            role: "assistant",
            content: cmdResult.success
              ? formatCommandSuccess(cmd.action, cmdResult.result)
              : formatCommandError(cmd.action, cmdResult.error ?? "Unknown error"),
          },
        ],
      });
    }

    // ── STEP 2: Normal chat path ─────────────────────────────────────────────

    // Retrieve R2 semantic memory (5s timeout — never block chat)
    let memoryContext = "";
    try {
      memoryContext = await Promise.race([
        retrieveRelevantMemory(lastUserContent),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 5_000)),
      ]);
    } catch {
      // Non-fatal
    }

    // Build augmented message list
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
    console.error("[ChatRoute] Error:", msg, `(${totalMs}ms)`);

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

// ── Format helpers for chat UI ────────────────────────────────────────────────

function formatCommandSuccess(action: string, result: Record<string, unknown>): string {
  switch (action) {
    case "ping_system": {
      const r = result as { status?: string; supabase?: string; moduleFactory?: string };
      return [
        "✅ **System Ping — All Systems Operational**",
        "",
        `- Platform: ${r.status ?? "operational"}`,
        `- Supabase: ${r.supabase === "connected" ? "✅" : "⚠️"} ${r.supabase}`,
        `- Module Factory: ${r.moduleFactory === "operational" ? "✅" : "⚠️"} ${r.moduleFactory}`,
      ].join("\n");
    }

    case "generate_module":
    case "implement_module_factory_engine": {
      const r = result as {
        slug?: string; name?: string; status?: string;
        validation?: { passed?: boolean; score?: number };
        artifacts?: { totalFiles?: number; files?: string[] };
        commit?: { sha?: string } | null;
        generationMs?: number;
      };
      const lines = [
        `✅ **Module Generated: ${r.name ?? r.slug}**`,
        "",
        `- Status: ${r.status}`,
        `- Validation: ${r.validation?.passed ? "✅ PASS" : "❌ FAIL"} (score ${r.validation?.score ?? 0}/100)`,
        `- Files: ${r.artifacts?.totalFiles ?? 0}`,
      ];
      if (r.artifacts?.files?.length) {
        lines.push("", "**Files:**");
        (r.artifacts.files as string[]).forEach((f) => lines.push(`  - \`${f}\``));
      }
      if (r.commit?.sha) {
        lines.push("", `- Commit: \`${(r.commit.sha as string).slice(0, 10)}\``);
      }
      lines.push("", `- Generation time: ${r.generationMs ?? 0}ms`);
      return lines.join("\n");
    }

    case "preview_module": {
      const r = result as {
        slug?: string; name?: string;
        validation?: { passed?: boolean; score?: number };
        artifacts?: { totalFiles?: number };
        generationMs?: number;
      };
      return [
        `✅ **Module Preview: ${r.name ?? r.slug}**`,
        "",
        `- Validation: ${r.validation?.passed ? "✅ PASS" : "❌ FAIL"} (score ${r.validation?.score ?? 0}/100)`,
        `- Files that would be generated: ${r.artifacts?.totalFiles ?? 0}`,
        `- Generation time: ${r.generationMs ?? 0}ms`,
        "",
        "To commit: re-run with \`auto_commit: true\`",
      ].join("\n");
    }

    case "get_status": {
      const r = result as {
        roadmap?: { progress?: number; completed_count?: number };
        tasks?: Record<string, number>;
        knowledgeBase?: { totalRows?: number };
      };
      return [
        "✅ **Platform Status**",
        "",
        `- Roadmap progress: ${r.roadmap?.progress ?? 0}%`,
        `- Tasks complete: ${r.roadmap?.completed_count ?? 0}`,
        `- Task breakdown: ${Object.entries(r.tasks ?? {}).map(([k,v]) => `${k}=${v}`).join(", ")}`,
        `- Knowledge base: ${r.knowledgeBase?.totalRows ?? 0} rows`,
      ].join("\n");
    }

    case "run_diagnostic": {
      const r = result as { allPass?: boolean; checks?: Record<string, boolean | string> };
      const lines = [
        `${r.allPass ? "✅" : "⚠️"} **Diagnostic ${r.allPass ? "PASSED" : "COMPLETED WITH ISSUES"}**`,
        "",
      ];
      Object.entries(r.checks ?? {}).forEach(([k, v]) => {
        lines.push(`- ${k}: ${v === true ? "✅" : `❌ ${v}`}`);
      });
      return lines.join("\n");
    }

    default: {
      return [
        `✅ **Command Executed: ${action}**`,
        "",
        "```json",
        JSON.stringify(result, null, 2).slice(0, 800),
        "```",
      ].join("\n");
    }
  }
}

function formatCommandError(action: string, error: string): string {
  return [
    `❌ **Command Failed: ${action}**`,
    "",
    `Error: ${error}`,
    "",
    "Please check the command structure and try again.",
  ].join("\n");
}
