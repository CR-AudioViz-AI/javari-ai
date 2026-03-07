// app/api/javari/execute/route.ts
// Purpose: Unified command console endpoint — chat, multi-AI, and system commands.
// Date: 2026-03-07 — v1.3: start_roadmap loads from R2 via ingestRoadmapFromR2 + seedTasksFromRoadmap

import { NextRequest, NextResponse } from "next/server";
import { executeGateway } from "@/lib/execution/gateway";
import { executeTask, ExecutableTask } from "@/lib/execution/taskExecutor";
import { ingestRoadmapFromR2 } from "@/lib/roadmap/ingestRoadmapFromR2";
import { seedTasksFromRoadmap } from "@/lib/roadmap/seedTasksFromRoadmap";
import { createClient } from "@supabase/supabase-js";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const maxDuration = 300; // R2 ingest can take time on large docs

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PREVIEW_BASE  = process.env.NEXT_PUBLIC_APP_URL
                    ?? "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";

function supabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Fetch next pending task from roadmap_tasks ─────────────────────────────
async function fetchNextPendingTask(): Promise<ExecutableTask | null> {
  try {
    const db = supabase();
    const { data, error } = await db
      .from("roadmap_tasks")
      .select("id, title, description, source")
      .eq("status", "pending")
      .order("updated_at", { ascending: true })
      .limit(1);

    if (error || !data?.length) return null;

    const row = data[0] as {
      id         : string;
      title      : string;
      description: string;
      source?    : string;
    };

    // task type is embedded in description as [type:X] tag by seedTasksFromRoadmap
    const typeTag = row.description?.match(/\[type:([^\]]+)\]/)?.[1] ?? "ai_task";

    return {
      id         : row.id,
      title      : row.title,
      description: row.description,
      type       : typeTag,
    };
  } catch {
    return null;
  }
}

// ── Mark task status ───────────────────────────────────────────────────────
// ── Task lifecycle: pending → in_progress → verifying → completed
//                                              ↘ retry → blocked
// CRITICAL: status="completed" may only be written by /api/javari/verify-task.
// This function intentionally does NOT accept "completed" as a status value.
async function updateTaskStatus(
  taskId : string,
  status : "in_progress" | "verifying" | "failed" | "retry" | "blocked",
  output?: string,
  error? : string
): Promise<void> {
  try {
    const db = supabase();
    await db
      .from("roadmap_tasks")
      .update({
        status,
        ...(output ? { result: output } : {}),
        ...(error  ? { error: error }   : {}),
        updated_at: Date.now(),   // bigint epoch ms
      })
      .eq("id", taskId);
  } catch { /* non-blocking */ }
}

// ── Command dispatcher ─────────────────────────────────────────────────────
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
    // Lifecycle enforced:
    //   pending → in_progress (before execution)
    //   in_progress → verifying (after execution, regardless of result)
    //   verifying → completed | retry | blocked (via /api/javari/verify-task ONLY)
    case "run_next_task": {
      try {
        const task = await fetchNextPendingTask();
        if (!task) return { ok: false, command, result: "No pending tasks in queue." };

        // Step 1: mark in_progress
        await updateTaskStatus(task.id, "in_progress");

        // Step 2: execute — records artifacts internally
        const result = await executeTask(task, userId);

        // Step 3: always move to verifying — NEVER directly to completed
        // Failed executions also go to verifying so the artifact check
        // can formally record the failure reason before retry logic runs.
        await updateTaskStatus(
          task.id,
          "verifying",
          result.output,
          result.ok ? undefined : result.error
        );

        // Step 4: call verify-task gate
        const verifyRes = await fetch(`${base}/api/javari/verify-task`, {
          method : "POST",
          headers: { "Content-Type": "application/json" },
          body   : JSON.stringify({ task_id: task.id }),
        });
        const verifyData = await verifyRes.json().catch(() => ({})) as Record<string, unknown>;

        const verdict    = verifyData.verdict as string ?? "unknown";
        const actionsText = result.actions?.length
          ? ` | actions: ${result.actions.map(a => a.action + (a.ok ? "✓" : "✗")).join(", ")}`
          : "";

        return {
          ok    : verdict === "completed",
          command,
          result: verdict === "completed"
            ? `✅ **${task.title}** [${result.type}] verified → completed${actionsText} | ${result.durationMs}ms`
            : verdict === "blocked"
              ? `🔴 **${task.title}** BLOCKED after max retries. Reason: ${verifyData.failReason}`
              : `⚠️ **${task.title}** executed → verifying → ${verdict}. Reason: ${verifyData.failReason ?? result.error}`,
          data: { execution: result, verification: verifyData },
        };
      } catch (err) {
        return { ok: false, command, result: `run_next_task exception: ${String(err)}` };
      }
    }

    // ── start_roadmap — loads from R2 → seeds Supabase ────────────────
    case "start_roadmap": {
      try {
        // Step 1: Pull roadmap items from R2 canonical docs
        const ingestResult = await ingestRoadmapFromR2();

        if (!ingestResult.ok || !ingestResult.items.length) {
          // R2 ingest failed or returned nothing — fall back to queue execution
          const res = await fetch(`${base}/api/javari/queue`, {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({ maxTasks: 10, userId }),
          });
          const d = await res.json().catch(() => ({})) as Record<string, unknown>;
          return {
            ok    : true,
            command,
            result: `⚠️ R2 ingest returned no items (${ingestResult.error ?? "no roadmap files matched"}). Fell back to queue: ${d.executed ?? 0} tasks executed.`,
            data  : { ingestResult, queueResult: d },
          };
        }

        // Step 2: Seed extracted items into roadmap_tasks
        const seedResult = await seedTasksFromRoadmap(ingestResult.items);

        const summary = [
          `🚀 Roadmap loaded from R2.`,
          `Scanned ${ingestResult.filesScanned} files, used ${ingestResult.filesUsed}.`,
          `Extracted ${ingestResult.items.length} items.`,
          `Inserted ${seedResult.inserted} tasks, skipped ${seedResult.skipped} duplicates.`,
          seedResult.failed > 0 ? `⚠️ ${seedResult.failed} failed to insert.` : "",
        ].filter(Boolean).join(" ");

        return {
          ok    : seedResult.ok,
          command,
          result: summary,
          data  : { ingestResult, seedResult },
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
        const { data: rows } = await db.from("roadmap_tasks").select("status");
        const counts = {
          pending: 0, in_progress: 0, verifying: 0,
          completed: 0, retry: 0, blocked: 0, failed: 0, total: 0
        };
        for (const r of (rows ?? []) as { status: string }[]) {
          counts.total++;
          const s = r.status as keyof typeof counts;
          if (s in counts) counts[s]++;
        }
        return {
          ok: true, command,
          result: `📊 Queue: completed=${counts.completed} pending=${counts.pending} in_progress=${counts.in_progress} verifying=${counts.verifying} retry=${counts.retry} blocked=${counts.blocked} failed=${counts.failed} total=${counts.total}`,
          data: counts,
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
              .map(r => `${r.title} [${r.category}]`).join(", ");

        return {
          ok: true, command, records: total, table: "javari_knowledge",
          result: `🧠 MemoryOS online. ${total} records in javari_knowledge. Recent: ${preview}`,
          data: rows ?? [],
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

// ── Load MemoryOS context for chat ─────────────────────────────────────────
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
      .map(r => `• ${r.title}: ${r.content?.slice(0, 120) ?? ""}`).join("\n");
    return `\n\n[MemoryOS context]\n${snippets}`;
  } catch {
    return "";
  }
}

// ── POST /api/javari/execute ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message = "", mode = "chat", command = "", userId = "anonymous" } = body;

    if (command || mode === "command") {
      const cmd = (command || message.trim().toLowerCase().replace(/\s+/g, "_")).trim();
      if (!cmd) {
        return NextResponse.json({ ok: false, error: "command required" }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const memCtx = await loadMemoryContext(message);

    if (mode === "chat") {
      const result = await executeGateway({
        input: message + memCtx, mode: "auto", userId, routingPriority: "quality",
      });
      return NextResponse.json({
        ok: true, mode: "chat",
        reply: typeof result.output === "string" ? result.output : JSON.stringify(result.output),
        model: result.model, cost: result.estimatedCost,
      });
    }

    if (mode === "multi") {
      const result = await executeGateway({
        input: message + memCtx, mode: "multi", userId,
        roles: [
          { role: "architect", model: "claude-sonnet-4-20250514" },
          { role: "builder",   model: "gemini-2.0-flash-exp"     },
          { role: "validator", model: "claude-sonnet-4-20250514" },
        ],
        routingPriority: "quality",
      });
      return NextResponse.json({
        ok: true, mode: "multi",
        reply: typeof result.output === "string" ? result.output : JSON.stringify(result.output),
        models: result.model, cost: result.estimatedCost,
        phases: (result as Record<string, unknown>).phases ?? null,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown mode: ${mode}` }, { status: 400 }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// ── GET: capability manifest ───────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({
    ok        : true,
    endpoint  : "/api/javari/execute",
    version   : "1.4.0",
    modes     : ["chat", "multi", "command"],
    commands  : ["run_next_task", "start_roadmap", "pause_execution", "resume_execution", "queue_status", "memory_status"],
    lifecycle : "pending → in_progress → verifying → completed | retry → blocked",
    taskTypes : ["build_module", "create_api", "update_schema", "deploy_feature", "ai_task"],
    connected : ["planner", "queue", "model_router", "memoryos", "guardrails", "devops_executor", "r2_ingest", "verification_gate"],
  });
}
