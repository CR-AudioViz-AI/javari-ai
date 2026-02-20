// lib/javari/autonomy/memory-writer.ts
// Javari Autonomous Engine — Memory Writer
// 2026-02-20 — STEP 2 implementation
//
// After each validated task output:
//   1. Generate embedding (text-embedding-3-small)
//   2. Save to javari_knowledge with task metadata tags
//   3. Return chunk ID for linking back to DbTaskState
//
// Integrates with existing semantic-store.ts + embedding-provider.ts.
// Never throws — returns null on failure (task execution continues).

import { generateEmbedding } from "@/lib/javari/memory/embedding-provider";
import type { TaskNode } from "./types";

// ── Supabase writer (mirrors semantic-store.ts pattern) ───────────────────────

function supabaseHeaders() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;
  if (!url || !key) return null;
  return {
    url,
    headers: {
      apikey: anonKey || key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MemoryWriteResult {
  chunkId: string;
  embedded: boolean;
  savedToDb: boolean;
  durationMs: number;
}

/**
 * writeTaskMemory — Persist a validated task output to javari_knowledge.
 * Links to the task via metadata.
 * Returns null on failure (caller continues without memory write).
 */
export async function writeTaskMemory(
  task: TaskNode,
  output: string,
  meta: {
    provider: string;
    model: string;
    validationScore?: number;
    goalId: string;
  }
): Promise<MemoryWriteResult | null> {
  const t0 = Date.now();
  const cfg = supabaseHeaders();
  if (!cfg) return null;

  // Build chunk text — context-rich for later retrieval
  const chunkText = [
    `[Autonomous Task: ${task.title}]`,
    `Goal: ${task.parentGoalId}`,
    `Type: ${task.type}`,
    `Task ID: ${task.id}`,
    "",
    `Instructions: ${task.description.slice(0, 500)}`,
    "",
    `Output:`,
    output.slice(0, 8_000),
  ].join("\n");

  const chunkId = `aut_${task.parentGoalId}_${task.id}_${Date.now()}`;

  // Generate embedding
  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(chunkText);
  } catch {
    // embedding failure is non-fatal
  }

  const vectorLiteral = embedding ? `[${embedding.join(",")}]` : null;

  // Build DB row
  const row = {
    category:        "autonomous_execution",
    subcategory:     task.type,
    title:           `[Auto] ${task.title}`,
    content:         chunkText,
    keywords:        [
      task.type,
      task.parentGoalId,
      meta.provider,
      "autonomous",
      "task_output",
    ],
    source_type:     "autonomous_task",
    source_id:       chunkId,
    confidence_score: meta.validationScore != null ? meta.validationScore / 100 : 0.8,
    metadata: {
      task_id:          task.id,
      goal_id:          meta.goalId,
      task_type:        task.type,
      provider:         meta.provider,
      model:            meta.model,
      validation_score: meta.validationScore ?? null,
      autonomous:       true,
    },
    ...(vectorLiteral
      ? {
          embedding:     vectorLiteral,  // TEXT — legacy compat
          embedding_vec: vectorLiteral,  // vector(1536) — pgvector
        }
      : {}),
  };

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/javari_knowledge?on_conflict=source_id`,
      {
        method: "POST",
        headers: {
          ...cfg.headers,
          Prefer: "return=minimal,resolution=merge-duplicates",
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(10_000),
      }
    );

    return {
      chunkId,
      embedded:   !!embedding,
      savedToDb:  res.ok,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    console.warn(
      "[MemoryWriter] DB write failed:",
      err instanceof Error ? err.message : err
    );
    return { chunkId, embedded: !!embedding, savedToDb: false, durationMs: Date.now() - t0 };
  }
}

/**
 * writeGoalSummary — After all tasks complete, write a high-level goal summary.
 * Used to surface the autonomous run in future memory retrieval.
 */
export async function writeGoalSummary(
  goalId: string,
  goal: string,
  finalOutput: string,
  stats: {
    totalTasks: number;
    doneTasks: number;
    failedTasks: number;
    durationMs: number;
    providers: string[];
  }
): Promise<string | null> {
  const cfg = supabaseHeaders();
  if (!cfg) return null;

  const summaryText = [
    `[Autonomous Goal Summary]`,
    `Goal ID: ${goalId}`,
    `Goal: ${goal}`,
    `Tasks: ${stats.doneTasks}/${stats.totalTasks} completed (${stats.failedTasks} failed)`,
    `Providers used: ${stats.providers.join(", ")}`,
    `Duration: ${(stats.durationMs / 1000).toFixed(1)}s`,
    "",
    "Final Output:",
    finalOutput.slice(0, 6_000),
  ].join("\n");

  const chunkId = `goal_summary_${goalId}`;

  let embedding: number[] | null = null;
  try {
    embedding = await generateEmbedding(summaryText);
  } catch { /* non-fatal */ }

  const vectorLiteral = embedding ? `[${embedding.join(",")}]` : null;

  const row = {
    category:        "autonomous_execution",
    subcategory:     "goal_summary",
    title:           `[Goal] ${goal.slice(0, 80)}`,
    content:         summaryText,
    keywords:        ["goal_summary", "autonomous", goalId],
    source_type:     "goal_summary",
    source_id:       chunkId,
    confidence_score: stats.doneTasks / Math.max(stats.totalTasks, 1),
    metadata: {
      goal_id:      goalId,
      total_tasks:  stats.totalTasks,
      done_tasks:   stats.doneTasks,
      failed_tasks: stats.failedTasks,
      duration_ms:  stats.durationMs,
      autonomous:   true,
    },
    ...(vectorLiteral ? { embedding: vectorLiteral, embedding_vec: vectorLiteral } : {}),
  };

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/javari_knowledge?on_conflict=source_id`,
      {
        method: "POST",
        headers: {
          ...cfg.headers,
          Prefer: "return=minimal,resolution=merge-duplicates",
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(10_000),
      }
    );
    return res.ok ? chunkId : null;
  } catch {
    return null;
  }
}
