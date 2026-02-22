// lib/autonomy-core/planner/task-executor.ts
// CR AudioViz AI — Task Executor with Canonical Context
// 2026-02-22 — Step 13: Autonomous Roadmap Engine

// Executes a single JavariTask by:
//   1. Fetching canonical context relevant to the task description
//   2. Building a task-specific system prompt (context + verification criteria)
//   3. Routing to the best AI provider via fetch to /api/javari/chat
//   4. Persisting result to javari_tasks table
//   5. Returning a typed TaskExecutionResult

import type { JavariTask }       from "./dependency-resolver";
import { createLogger }          from "@/lib/observability/logger";
import { writeAuditEvent }       from "@/lib/enterprise/audit";
import { retrieveCanonicalContext } from "@/lib/javari/memory/canonical-retrieval";

const log = createLogger("autonomy");

export interface TaskExecutionResult {
  taskId:       string;
  status:       "complete" | "failed" | "skipped";
  result?:      string;
  error?:       string;
  durationMs:   number;
  provider?:    string;
  canonicalChunksUsed: number;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function sbPatch(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  const url = SB_URL(); const key = SB_KEY();
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method:  "PATCH",
    headers: {
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(data),
  });
}

// ── Build task prompt ─────────────────────────────────────────────────────────

function buildTaskPrompt(task: JavariTask, canonicalCtx: string): string {
  const lines: string[] = [];

  if (canonicalCtx) {
    lines.push("=== PLATFORM DOCUMENTATION (use this to inform your work) ===");
    lines.push(canonicalCtx);
    lines.push("=== END PLATFORM DOCUMENTATION ===\n");
  }

  lines.push(`TASK: ${task.title}`);
  lines.push(`PHASE: ${task.phase_id} | ORDER: ${task.task_order} | PRIORITY: ${task.priority}`);
  lines.push(`\nDESCRIPTION:\n${task.description}`);

  if (task.verification_criteria) {
    const vc = typeof task.verification_criteria === "string"
      ? task.verification_criteria
      : JSON.stringify(task.verification_criteria, null, 2);
    lines.push(`\nVERIFICATION CRITERIA:\n${vc}`);
  }

  if (task.tags && (task.tags as string[]).length > 0) {
    lines.push(`\nTAGS: ${(task.tags as string[]).join(", ")}`);
  }

  lines.push("\nProvide a complete, actionable response that satisfies all verification criteria.");
  lines.push("Reference specific platform documentation above where relevant.");
  lines.push("Be precise. Be complete. No placeholders.");

  return lines.join("\n");
}

// ── Execute single task ───────────────────────────────────────────────────────

export async function executeTask(
  task: JavariTask,
  opts: {
    dryRun?:    boolean;
    cycleId?:   string;
    baseUrl?:   string;
    adminSecret?: string;
  } = {}
): Promise<TaskExecutionResult> {
  const start = Date.now();

  if (task.status === "complete" || task.status === "skipped") {
    return { taskId: task.id, status: "skipped", durationMs: 0, canonicalChunksUsed: 0 };
  }

  log.info(`[${opts.cycleId ?? "manual"}] Executing task: ${task.id} — ${task.title}`);

  // Mark as running
  if (!opts.dryRun) {
    await sbPatch("javari_tasks", task.id, {
      status:     "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  try {
    // ── 1. Fetch canonical context for this task ──────────────────────────
    let canonicalCtx = "";
    let canonicalChunksUsed = 0;
    try {
      canonicalCtx = await retrieveCanonicalContext(task.title + " " + task.description.slice(0, 200));
      // Count chunks (rough estimate by separator)
      canonicalChunksUsed = (canonicalCtx.match(/\n---\n/g) ?? []).length;
    } catch (e) {
      log.warn(`Canonical context load failed for task ${task.id}: ${e instanceof Error ? e.message : e}`);
    }

    // ── 2. Build prompt ───────────────────────────────────────────────────
    const prompt = buildTaskPrompt(task, canonicalCtx);

    if (opts.dryRun) {
      log.info(`DRY RUN: would execute task ${task.id} with ${canonicalChunksUsed} canonical chunks`);
      return {
        taskId:  task.id,
        status:  "complete",
        result:  `[DRY RUN] Task ${task.id} would be executed with ${canonicalChunksUsed} canonical chunks`,
        durationMs: Date.now() - start,
        canonicalChunksUsed,
      };
    }

    // ── 3. Execute via Javari chat endpoint ───────────────────────────────
    const baseUrl = opts.baseUrl ?? process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

    const chatRes = await fetch(`${baseUrl}/api/javari/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-autonomy": opts.adminSecret ?? "",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        persona:  "engineer",
        _memoryAlreadyInjected: canonicalCtx.length > 0,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!chatRes.ok) {
      throw new Error(`Javari chat failed: HTTP ${chatRes.status}`);
    }

    const chatData = await chatRes.json() as {
      success?: boolean;
      messages?: Array<{ role: string; content: string }>;
      provider?: string;
      error?: string;
    };

    if (!chatData.success) {
      throw new Error(chatData.error ?? "Javari chat returned success=false");
    }

    const msgs      = chatData.messages ?? [];
    const lastMsg   = msgs[msgs.length - 1];
    const result    = (lastMsg as { content?: string })?.content ?? "";
    const provider  = chatData.provider ?? "unknown";

    // ── 4. Persist result ─────────────────────────────────────────────────
    await sbPatch("javari_tasks", task.id, {
      status:       "complete",
      result:       result.slice(0, 10_000), // DB column limit
      provider:     provider,
      completed_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    });

    // ── 5. Audit ──────────────────────────────────────────────────────────
    await writeAuditEvent({
      action:   "module.generated",
      metadata: {
        system:     "autonomy-core-planner",
        taskId:     task.id,
        roadmapId:  task.roadmap_id,
        cycleId:    opts.cycleId,
        provider,
        canonicalChunksUsed,
        durationMs: Date.now() - start,
      },
      severity: "info",
    });

    log.info(`Task complete: ${task.id} via ${provider} (${Date.now() - start}ms)`);

    return {
      taskId:   task.id,
      status:   "complete",
      result,
      provider,
      durationMs: Date.now() - start,
      canonicalChunksUsed,
    };

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown execution error";
    log.error(`Task failed: ${task.id} — ${msg}`);

    const retryCount = (task.retry_count ?? 0) + 1;
    const finalStatus = retryCount >= (task.max_retries ?? 3) ? "failed" : "pending";

    await sbPatch("javari_tasks", task.id, {
      status:      finalStatus,
      error:       msg.slice(0, 2000),
      retry_count: retryCount,
      updated_at:  new Date().toISOString(),
    });

    return {
      taskId: task.id,
      status: "failed",
      error:  msg,
      durationMs: Date.now() - start,
      canonicalChunksUsed: 0,
    };
  }
}
