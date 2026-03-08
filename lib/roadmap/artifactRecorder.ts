// lib/roadmap/artifactRecorder.ts
// Purpose: Insert proof artifacts into roadmap_task_artifacts during task execution.
//          Called by taskExecutor after each action — commit, deploy, SQL, AI output.
//          Without recorded artifacts, verifyTask() will auto-fail.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface ArtifactInsert {
  task_id          : string;
  artifact_type    : "commit" | "deploy" | "sql_migration" | "ai_output" | "http_check"
                   | "deploy_proof" | "repair_patch" | "repair_commit" | "verification_report" | "ecosystem_report" | "brand_fix" | "dedupe_plan" | "ux_analysis" | "operations_report" | "learning_report" | "model_usage" | "model_consensus" | "benchmark_result" | "memory_graph_node" | "memory_repair_context" | "company_blueprint" | "product_architecture" | "generated_repo" | "deployment_report" | "analysis_report";
  artifact_location: string;                    // commit SHA, deploy URL, table name, etc.
  artifact_data?   : Record<string, unknown>;   // structured proof data
}

export interface ArtifactResult {
  ok    : boolean;
  id?   : string;
  error?: string;
}

/**
 * recordArtifact — insert one proof artifact for a task.
 * Non-blocking: errors are returned, never thrown.
 */
export async function recordArtifact(a: ArtifactInsert): Promise<ArtifactResult> {
  try {
    const { data, error } = await db()
      .from("roadmap_task_artifacts")
      .insert({
        task_id          : a.task_id,
        artifact_type    : a.artifact_type,
        artifact_location: a.artifact_location,
        artifact_data    : a.artifact_data ?? null,
        created_at       : Date.now(),
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as { id: string })?.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * recordArtifacts — batch insert multiple artifacts.
 * Runs concurrently; partial success is allowed.
 */
export async function recordArtifacts(
  artifacts: ArtifactInsert[]
): Promise<{ ok: boolean; inserted: number; failed: number }> {
  const results = await Promise.allSettled(artifacts.map(a => recordArtifact(a)));
  const inserted = results.filter(r => r.status === "fulfilled" && (r.value as ArtifactResult).ok).length;
  const failed   = results.length - inserted;
  return { ok: failed === 0, inserted, failed };
}
