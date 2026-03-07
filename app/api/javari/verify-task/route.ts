// app/api/javari/verify-task/route.ts
// Purpose: Verification gate endpoint.
//          POST { task_id } → runs verifyTask() → transitions to completed or retry.
//          Only this route may write status=completed on a roadmap_task.
// Date: 2026-03-07

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyTask } from "@/lib/roadmap/verifyTask";

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function db() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

// ── Status transitions (only this route may write "completed") ─────────────
// Lifecycle: pending → in_progress → verifying → completed
//                                              ↘ retry → verifying (loop)
//                                                      → blocked (after N retries)

const MAX_RETRIES = 3;

async function setCompleted(taskId: string, detail: string): Promise<void> {
  await db()
    .from("roadmap_tasks")
    .update({
      status    : "completed",
      result    : detail,
      updated_at: Date.now(),
    })
    .eq("id", taskId);
}

async function setRetry(taskId: string, reason: string): Promise<void> {
  // Increment retry_count (if column exists) or read and compare
  const client = await db();

  // Read current retry count from metadata or a dedicated field
  const { data } = await client
    .from("roadmap_tasks")
    .select("metadata")
    .eq("id", taskId)
    .single();

  const meta       = ((data as { metadata?: Record<string, unknown> })?.metadata ?? {}) as Record<string, unknown>;
  const retryCount = ((meta.retry_count as number) ?? 0) + 1;

  const newStatus  = retryCount >= MAX_RETRIES ? "blocked" : "retry";
  const newMeta    = { ...meta, retry_count: retryCount, last_fail_reason: reason };

  await client
    .from("roadmap_tasks")
    .update({
      status    : newStatus,
      metadata  : newMeta,
      result    : reason,
      updated_at: Date.now(),
    })
    .eq("id", taskId);
}

// ── POST handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const taskId = (body.task_id as string)?.trim();

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "task_id is required" },
        { status: 400 }
      );
    }

    // Run verification engine
    const result = await verifyTask(taskId);

    if (result.pass) {
      // ✅ All checks passed — transition to completed
      const detail = `Verified: ${result.checks.map(c => c.name).join(", ")}`;
      await setCompleted(taskId, detail);

      return NextResponse.json({
        ok        : true,
        taskId,
        verdict   : "completed",
        taskType  : result.taskType,
        checks    : result.checks,
        message   : `✅ Task ${taskId} verified and marked completed.`,
      });
    } else {
      // ❌ Verification failed — transition to retry (or blocked)
      const reason = result.failReason ?? "unknown_failure";
      await setRetry(taskId, reason);

      const client = await db();
      const { data: updated } = await client
        .from("roadmap_tasks")
        .select("metadata")
        .eq("id", taskId)
        .single();

      const meta        = ((updated as { metadata?: Record<string, unknown> })?.metadata ?? {}) as Record<string, unknown>;
      const retryCount  = (meta.retry_count as number) ?? 1;
      const finalStatus = retryCount >= MAX_RETRIES ? "blocked" : "retry";

      return NextResponse.json({
        ok        : false,
        taskId,
        verdict   : finalStatus,
        taskType  : result.taskType,
        checks    : result.checks,
        failReason: reason,
        retryCount,
        message   : finalStatus === "blocked"
          ? `🔴 Task ${taskId} BLOCKED after ${retryCount} failed verifications.`
          : `⚠️ Task ${taskId} failed verification (attempt ${retryCount}). Status → retry. Reason: ${reason}`,
      });
    }

  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

// ── GET: endpoint info ─────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    ok      : true,
    endpoint: "/api/javari/verify-task",
    purpose : "Verification gate — only this endpoint may mark roadmap_tasks.status = completed",
    usage   : "POST { task_id: string }",
    lifecycle: "pending → in_progress → verifying → [completed | retry → verifying | blocked]",
    maxRetries: MAX_RETRIES,
  });
}
