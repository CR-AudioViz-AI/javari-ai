// app/api/javari/execute/route.ts
// Purpose: Unified command console endpoint for Javari chat interface.
//          Handles: chat, multi-AI collaboration, and system commands
//          (run_next_task, start_roadmap, pause_execution, resume_execution).
//          Connected to: planner, queue, model router, MemoryOS.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import { executeGateway } from "@/lib/execution/gateway";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PREVIEW_BASE  = process.env.NEXT_PUBLIC_APP_URL
                    ?? "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

function postgrest(table: string, qs = "") {
  return `${SUPABASE_URL}/rest/v1/${table}${qs ? "?" + qs : ""}`;
}

function dbHeaders() {
  return {
    "apikey"       : SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type" : "application/json",
    "Prefer"       : "return=representation",
  };
}

// ── System command dispatcher ──────────────────────────────────────────────
async function handleCommand(command: string, userId: string): Promise<{
  ok: boolean;
  result: string;
  data?: unknown;
}> {
  const base = PREVIEW_BASE;

  switch (command) {

    case "run_next_task": {
      const res = await fetch(`${base}/api/javari/queue`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ maxTasks: 1, userId }),
      });
      const d = await res.json();
      const log = d.logs?.[0];
      if (!log) return { ok: false, result: "No executable tasks in queue." };
      return {
        ok    : true,
        result: `✅ Executed: **${log.task_id}** | model: ${log.model_used} | ${log.execution_time}ms | status: ${log.status}`,
        data  : d,
      };
    }

    case "start_roadmap": {
      const res = await fetch(`${base}/api/javari/queue`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ maxTasks: 10, userId }),
      });
      const d = await res.json();
      return {
        ok    : d.executed > 0,
        result: `🚀 Roadmap execution started. Executed ${d.executed} tasks. Succeeded: ${d.succeeded}. Failed: ${d.failed}.`,
        data  : d,
      };
    }

    case "pause_execution": {
      // Activate kill switch to halt autonomous execution
      const res = await fetch(`${base}/api/admin/kill-switch`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ action: "activate", reason: "Paused via command console", userId }),
      });
      const d = await res.json().catch(() => ({}));
      return {
        ok    : true,
        result: "⏸️ Execution paused. Kill switch activated. Use **resume_execution** to continue.",
        data  : d,
      };
    }

    case "resume_execution": {
      // Deactivate kill switch
      const res = await fetch(`${base}/api/admin/kill-switch`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ action: "deactivate", userId }),
      });
      const d = await res.json().catch(() => ({}));
      return {
        ok    : true,
        result: "▶️ Execution resumed. Kill switch deactivated. Queue will process on next cycle.",
        data  : d,
      };
    }

    case "queue_status": {
      const res = await fetch(`${base}/api/javari/queue`, {
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      const s = d.stats ?? {};
      return {
        ok    : true,
        result: `📊 Queue: completed=${s.completed} pending=${s.pending} failed=${s.failed} total=${s.total}`,
        data  : s,
      };
    }

    case "memory_status": {
      const res = await fetch(postgrest("javari_knowledge",
        "category=eq.roadmap_execution&order=created_at.desc&limit=5"),
        { headers: dbHeaders() }
      );
      const rows = await res.json().catch(() => []);
      return {
        ok    : true,
        result: `🧠 MemoryOS: ${rows.length} recent records in javari_knowledge.
Latest: ${rows[0]?.title ?? "none"}`,
        data  : rows,
      };
    }

    default:
      return {
        ok    : false,
        result: `Unknown command: ${command}. Available: run_next_task, start_roadmap, pause_execution, resume_execution, queue_status, memory_status`,
      };
  }
}

// ── Load MemoryOS context for chat ─────────────────────────────────────────
async function loadMemoryContext(query: string): Promise<string> {
  try {
    const res = await fetch(
      postgrest("javari_knowledge",
        `category=eq.roadmap_execution&order=confidence_score.desc&limit=3`),
      { headers: dbHeaders() }
    );
    const rows = await res.json().catch(() => []);
    if (!rows.length) return "";
    const snippets = rows.map((r: { title: string; content: string }) =>
      `• ${r.title}: ${r.content.slice(0, 120)}`
    ).join("\n");
    return `\n\n[MemoryOS context]\n${snippets}`;
  } catch {
    return "";
  }
}

// ── POST /api/javari/execute ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message   = "",
      mode      = "chat",     // "chat" | "multi" | "command"
      command   = "",         // system command override
      userId    = "anonymous",
      contextId = "",
    } = body;

    // ── Command mode: system action, no AI call ──────────────────────────
    if (command || mode === "command") {
      const cmd = command || message.trim().toLowerCase().replace(/\s+/g, "_");
      const result = await handleCommand(cmd, userId);
      return NextResponse.json({
        ok      : result.ok,
        mode    : "command",
        command : cmd,
        reply   : result.result,
        data    : result.data ?? null,
      });
    }

    if (!message.trim()) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 }
      );
    }

    // ── Load MemoryOS context ────────────────────────────────────────────
    const memCtx = await loadMemoryContext(message);

    // ── Chat mode: single AI response ────────────────────────────────────
    if (mode === "chat") {
      const result = await executeGateway({
        input            : message + memCtx,
        mode             : "auto",
        userId,
        routingPriority  : "quality",
      });
      return NextResponse.json({
        ok    : true,
        mode  : "chat",
        reply : typeof result.output === "string"
                  ? result.output
                  : JSON.stringify(result.output),
        model : result.model,
        cost  : result.estimatedCost,
      });
    }

    // ── Multi mode: multi-AI collaboration ───────────────────────────────
    if (mode === "multi") {
      const result = await executeGateway({
        input  : message + memCtx,
        mode   : "multi",
        userId,
        roles  : [
          { role: "architect",  model: "claude-sonnet-4-20250514" },
          { role: "builder",    model: "gemini-2.0-flash-exp" },
          { role: "validator",  model: "claude-sonnet-4-20250514" },
        ],
        routingPriority: "quality",
      });
      return NextResponse.json({
        ok     : true,
        mode   : "multi",
        reply  : typeof result.output === "string"
                   ? result.output
                   : JSON.stringify(result.output),
        models : result.model,
        cost   : result.estimatedCost,
        phases : (result as Record<string, unknown>).phases ?? null,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown mode: ${mode}. Use chat, multi, or command.` },
      { status: 400 }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ── GET: route health + capabilities ──────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    ok        : true,
    endpoint  : "/api/javari/execute",
    version   : "1.0.0",
    modes     : ["chat", "multi", "command"],
    commands  : ["run_next_task", "start_roadmap", "pause_execution", "resume_execution", "queue_status", "memory_status"],
    connected : ["planner", "queue", "model_router", "memoryos", "guardrails"],
  });
}
