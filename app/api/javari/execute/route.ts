// app/api/javari/execute/route.ts
// Purpose: Unified command console endpoint — chat, multi-AI, and system commands.
//          Commands: run_next_task, start_roadmap, pause_execution, resume_execution,
//                    queue_status, memory_status
//          Connected: planner, queue, model router, MemoryOS (javari_knowledge)
//          DevOps: run_next_task now routes through taskExecutor which calls devopsExecutor
// Date: 2026-03-07 — v1.2: wired run_next_task → taskExecutor for type-aware dispatch

import { NextRequest, NextResponse } from "next/server";
import { executeGateway } from "@/lib/execution/gateway";
import { executeTask, ExecutableTask } from "@/lib/execution/taskExecutor";
import { createClient } from "@supabase/supabase-js";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PREVIEW_BASE  = process.env.NEXT_PUBLIC_APP_URL
                    ?? "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

function supabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function dbHeaders() {
  return {
    "apikey"       : SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type" : "application/json",
  };
}

// ── Fetch next pending task from roadmap_tasks ─────────────────────────────
async function fetchNextPendingTask(): Promise<ExecutableTask | null> {
  try {
    const db = supabase();
    const { data, error } = await db
      .from("roadmap_tasks")
      .select("id, title, description, type, metadata")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error || !data?.length) return null;

    const row = data[0] as {
      id         : string;
      title      : string;
      description: string;
      type?      : string;
      metadata?  : Record<string, unknown>;
    };

    return {
      id         : row.id,
      title      : row.title,
      description: row.description,
      type       : row.type,
      metadata   : row.metadata as ExecutableTask["metadata"],
    };
  } catch {
    return null;
  }
}

// ── Mark task status in roadmap_tasks ─────────────────────────────────────
async function updateTaskStatus(
  taskId : string,
  status : "running" | "completed" | "failed",
  output?: string,
  error? : string
): Promise<void> {
  try {
    const db = supabase();
    await db
      .from("roadmap_tasks")
      .update({
        status,
        ...(output ? { result: output }         : {}),
        ...(error  ? { error_message: error }   : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);
  } catch {
    // Non-blocking — log but don't throw
  }
}

// ── System command dispatcher ──────────────────────────────────────────────
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

    // ── run_next_task — TYPE-AWARE via taskExecutor ────────────────────
    case "run_next_task": {
      try {
        // 1. Pull next pending task from Supabase
        const task = await fetchNextPendingTask();

        if (!task) {
          return { ok: false, command, result: "No pending tasks in queue." };
        }

        // 2. Mark running
        await updateTaskStatus(task.id, "running");

        // 3. Dispatch through type-aware executor
        const result = await executeTask(task, userId);

        // 4. Persist result
        if (result.ok) {
          await updateTaskStatus(task.id, "completed", result.output);
        } else {
          await updateTaskStatus(task.id, "failed", undefined, result.error);
        }

        const actionsText = result.actions?.length
          ? ` | actions: ${result.actions.map(a => a.action + (a.ok ? "✓" : "✗")).join(", ")}`
          : "";

        return {
          ok    : result.ok,
          command,
          result: result.ok
            ? `✅ **${task.title}** [${result.type}]${actionsText} | ${result.durationMs}ms`
            : `❌ **${task.title}** failed: ${result.error}`,
          data  : result,
        };
      } catch (err) {
        return { ok: false, command, result: `run_next_task exception: ${String(err)}` };
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
          result: `🚀 Roadmap started. Executed ${d.executed ?? 0} tasks. Succeeded: ${d.succeeded ?? 0}. Failed: ${d.failed ?? 0}.`,
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
          ok: true, command,
          result: "⏸️ Execution paused. Kill switch activated. Use **resume_execution** to continue.",
          data: d,
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
          ok: true, command,
          result: "▶️ Execution resumed. Kill switch deactivated. Queue will process on next cycle.",
          data: d,
        };
      } catch (err) {
        return { ok: false, command, result: `resume_execution failed: ${String(err)}` };
      }
    }

    // ── queue_status ───────────────────────────────────────────────────
    case "queue_status": {
      try {
        const db = supabase();
        const { data: rows } = await db
          .from("roadmap_tasks")
          .select("status");

        const counts = { pending: 0, running: 0, completed: 0, failed: 0, total: 0 };
        for (const r of (rows ?? []) as { status: string }[]) {
          counts.total++;
          const s = r.status as keyof typeof counts;
          if (s in counts) counts[s]++;
        }

        return {
          ok    : true,
          command,
          result: `📊 Queue: completed=${counts.completed} pending=${counts.pending} running=${counts.running} failed=${counts.failed} total=${counts.total}`,
          data  : counts,
        };
      } catch (err) {
        return { ok: false, command, result: `queue_status failed: ${String(err)}` };
      }
    }

    // ── memory_status ──────────────────────────────────────────────────
    case "memory_status": {
      try {
        const db = supabase();

        const { count, error: countErr } = await db
          .from("javari_knowledge")
          .select("*", { count: "exact", head: true });

        if (countErr) {
          return { ok: false, command, records: 0, table: "javari_knowledge",
                   result: `MemoryOS query failed: ${countErr.message}` };
        }

        const total = count ?? 0;

        const { data: rows } = await db
          .from("javari_knowledge")
          .select("title, category, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        const preview = !rows?.length
          ? "none"
          : (rows as { title: string; category: string }[])
              .map(r => `${r.title} [${r.category}]`)
              .join(", ");

        return {
          ok: true, command,
          records: total,
          table  : "javari_knowledge",
          result : `🧠 MemoryOS online. ${total} records in javari_knowledge. Recent: ${preview}`,
          data   : rows ?? [],
        };
      } catch (err) {
        return { ok: false, command, records: 0, table: "javari_knowledge",
                 result: `memory_status exception: ${String(err)}` };
      }
    }

    default:
      return {
        ok: false, command,
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
    const snippets = (rows as { title: string; content: string }[])
      .map(r => `• ${r.title}: ${r.content?.slice(0, 120) ?? ""}`)
      .join("\n");
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

    // ── Command mode ──────────────────────────────────────────────────────
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

    const memCtx = await loadMemoryContext(message);

    // ── Chat mode ──────────────────────────────────────────────────────────
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

    // ── Multi mode ─────────────────────────────────────────────────────────
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
    ok        : true,
    endpoint  : "/api/javari/execute",
    version   : "1.2.0",
    modes     : ["chat", "multi", "command"],
    commands  : [
      "run_next_task", "start_roadmap",
      "pause_execution", "resume_execution",
      "queue_status", "memory_status",
    ],
    taskTypes : ["build_module", "create_api", "update_schema", "deploy_feature", "ai_task"],
    connected : ["planner", "queue", "model_router", "memoryos", "guardrails", "devops_executor"],
  });
}
