// app/api/javari/execute/route.ts
// Purpose: Unified command console endpoint — chat, multi-AI, and system commands.
//          Commands: run_next_task, start_roadmap, pause_execution, resume_execution,
//                    queue_status, memory_status
//          Connected: planner, queue, model router, MemoryOS (javari_knowledge)
// Date: 2026-03-07 — v1.1: hardened memory_status handler, added per-case try/catch

import { NextRequest, NextResponse } from "next/server";
import { executeGateway } from "@/lib/execution/gateway";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PREVIEW_BASE  = process.env.NEXT_PUBLIC_APP_URL
                    ?? "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

// Supabase client — used by memory_status and loadMemoryContext
function supabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// Raw PostgREST helper for commands that hit other API routes
function postgrest(table: string, qs = "") {
  return `${SUPABASE_URL}/rest/v1/${table}${qs ? "?" + qs : ""}`;
}

function dbHeaders() {
  return {
    "apikey"       : SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type" : "application/json",
  };
}

// ── System command dispatcher ──────────────────────────────────────────────
// Every case has its own try/catch so a failure in one command cannot
// crash the entire POST handler.
async function handleCommand(command: string, userId: string): Promise<{
  ok      : boolean;
  command : string;
  result  : string;
  records?: number;
  table?  : string;
  data?   : unknown;
}> {
  const base = PREVIEW_BASE;

  switch (command) {

    // ── run_next_task ──────────────────────────────────────────────────
    case "run_next_task": {
      try {
        const res = await fetch(`${base}/api/javari/queue`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ maxTasks: 1, userId }),
        });
        const d = await res.json();
        const log = d.logs?.[0];
        if (!log) {
          return { ok: false, command, result: "No executable tasks in queue." };
        }
        return {
          ok    : true,
          command,
          result: `✅ Executed: **${log.task_id}** | model: ${log.model_used} | ${log.execution_time}ms | status: ${log.status}`,
          data  : d,
        };
      } catch (err) {
        return { ok: false, command, result: `run_next_task failed: ${String(err)}` };
      }
    }

    // ── start_roadmap ──────────────────────────────────────────────────
    case "start_roadmap": {
      try {
        const res = await fetch(`${base}/api/javari/queue`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ maxTasks: 10, userId }),
        });
        const d = await res.json();
        return {
          ok    : d.executed > 0,
          command,
          result: `🚀 Roadmap execution started. Executed ${d.executed ?? 0} tasks. Succeeded: ${d.succeeded ?? 0}. Failed: ${d.failed ?? 0}.`,
          data  : d,
        };
      } catch (err) {
        return { ok: false, command, result: `start_roadmap failed: ${String(err)}` };
      }
    }

    // ── pause_execution ────────────────────────────────────────────────
    case "pause_execution": {
      try {
        const res = await fetch(`${base}/api/admin/kill-switch`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ action: "activate", reason: "Paused via command console", userId }),
        });
        const d = await res.json().catch(() => ({}));
        return {
          ok    : true,
          command,
          result: "⏸️ Execution paused. Kill switch activated. Use **resume_execution** to continue.",
          data  : d,
        };
      } catch (err) {
        return { ok: false, command, result: `pause_execution failed: ${String(err)}` };
      }
    }

    // ── resume_execution ───────────────────────────────────────────────
    case "resume_execution": {
      try {
        const res = await fetch(`${base}/api/admin/kill-switch`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ action: "deactivate", userId }),
        });
        const d = await res.json().catch(() => ({}));
        return {
          ok    : true,
          command,
          result: "▶️ Execution resumed. Kill switch deactivated. Queue will process on next cycle.",
          data  : d,
        };
      } catch (err) {
        return { ok: false, command, result: `resume_execution failed: ${String(err)}` };
      }
    }

    // ── queue_status ───────────────────────────────────────────────────
    case "queue_status": {
      try {
        const res = await fetch(`${base}/api/javari/queue`, {
          headers: { "Content-Type": "application/json" },
        });
        const d = await res.json();
        const s = d.stats ?? {};
        return {
          ok    : true,
          command,
          result: `📊 Queue: completed=${s.completed ?? 0} pending=${s.pending ?? 0} failed=${s.failed ?? 0} total=${s.total ?? 0}`,
          data  : s,
        };
      } catch (err) {
        return { ok: false, command, result: `queue_status failed: ${String(err)}` };
      }
    }

    // ── memory_status ──────────────────────────────────────────────────
    // Uses supabase-js directly — no raw fetch, no column filter assumptions.
    // Counts all rows then fetches 5 most recent for preview.
    case "memory_status": {
      try {
        const db = supabase();

        // Count total rows — head:true returns only the count header
        const { count, error: countErr } = await db
          .from("javari_knowledge")
          .select("*", { count: "exact", head: true });

        if (countErr) {
          return {
            ok     : false,
            command,
            records: 0,
            table  : "javari_knowledge",
            result : `MemoryOS query failed: ${countErr.message}`,
          };
        }

        const total = count ?? 0;

        // Fetch 5 most recent titles for the summary preview
        const { data: rows, error: rowErr } = await db
          .from("javari_knowledge")
          .select("title, category, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        const preview = rowErr || !rows?.length
          ? "none"
          : rows.map((r: { title: string; category: string }) =>
              `${r.title} [${r.category}]`
            ).join(", ");

        return {
          ok     : true,
          command,
          records: total,
          table  : "javari_knowledge",
          result : `🧠 MemoryOS online. ${total} records in javari_knowledge. Recent: ${preview}`,
          data   : rows ?? [],
        };
      } catch (err) {
        return {
          ok     : false,
          command,
          records: 0,
          table  : "javari_knowledge",
          result : `memory_status exception: ${String(err)}`,
        };
      }
    }

    // ── default ────────────────────────────────────────────────────────
    default:
      return {
        ok    : false,
        command,
        result: `Unknown command: ${command}. Available: run_next_task, start_roadmap, pause_execution, resume_execution, queue_status, memory_status`,
      };
  }
}

// ── Load MemoryOS context for chat prompts ─────────────────────────────────
async function loadMemoryContext(_query: string): Promise<string> {
  try {
    const db = supabase();
    const { data: rows } = await db
      .from("javari_knowledge")
      .select("title, content")
      .order("created_at", { ascending: false })
      .limit(3);

    if (!rows?.length) return "";
    const snippets = rows.map((r: { title: string; content: string }) =>
      `• ${r.title}: ${r.content?.slice(0, 120) ?? ""}`
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
      mode      = "chat",
      command   = "",
      userId    = "anonymous",
    } = body;

    // ── Command mode ─────────────────────────────────────────────────────
    if (command || mode === "command") {
      const cmd = (command || message.trim().toLowerCase().replace(/\s+/g, "_")).trim();

      if (!cmd) {
        return NextResponse.json(
          { ok: false, error: "command or message required in command mode" },
          { status: 400 }
        );
      }

      const result = await handleCommand(cmd, userId);

      return NextResponse.json({
        ok     : result.ok,
        mode   : "command",
        command: result.command,
        reply  : result.result,
        // Include structured fields when present so UI can use them
        ...(result.records !== undefined ? { records: result.records } : {}),
        ...(result.table   !== undefined ? { table  : result.table   } : {}),
        data   : result.data ?? null,
      });
    }

    if (!message.trim()) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 }
      );
    }

    // ── MemoryOS context injection ────────────────────────────────────────
    const memCtx = await loadMemoryContext(message);

    // ── Chat mode ─────────────────────────────────────────────────────────
    if (mode === "chat") {
      const result = await executeGateway({
        input          : message + memCtx,
        mode           : "auto",
        userId,
        routingPriority: "quality",
      });
      return NextResponse.json({
        ok   : true,
        mode : "chat",
        reply: typeof result.output === "string"
                 ? result.output
                 : JSON.stringify(result.output),
        model: result.model,
        cost : result.estimatedCost,
      });
    }

    // ── Multi mode ────────────────────────────────────────────────────────
    if (mode === "multi") {
      const result = await executeGateway({
        input  : message + memCtx,
        mode   : "multi",
        userId,
        roles  : [
          { role: "architect", model: "claude-sonnet-4-20250514" },
          { role: "builder",   model: "gemini-2.0-flash-exp"     },
          { role: "validator", model: "claude-sonnet-4-20250514" },
        ],
        routingPriority: "quality",
      });
      return NextResponse.json({
        ok    : true,
        mode  : "multi",
        reply : typeof result.output === "string"
                  ? result.output
                  : JSON.stringify(result.output),
        models: result.model,
        cost  : result.estimatedCost,
        phases: (result as Record<string, unknown>).phases ?? null,
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

// ── GET: health + capability manifest ─────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    ok       : true,
    endpoint : "/api/javari/execute",
    version  : "1.1.0",
    modes    : ["chat", "multi", "command"],
    commands : [
      "run_next_task", "start_roadmap",
      "pause_execution", "resume_execution",
      "queue_status", "memory_status",
    ],
    connected: ["planner", "queue", "model_router", "memoryos", "guardrails"],
  });
}
