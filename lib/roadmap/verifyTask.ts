// lib/roadmap/verifyTask.ts
// Purpose: Verification engine for roadmap task completion gates.
//          A task may only reach "completed" if this function returns pass=true.
//          Checks artifact proof records AND runs type-specific live checks.
// Date: 2026-03-07

import { createClient } from "@supabase/supabase-js";
import { getSecret } from "@/lib/platform-secrets";

// ── Types ──────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "verifying"
  | "completed"
  | "retry"
  | "blocked";

export interface TaskArtifact {
  id               : string;
  task_id          : string;
  artifact_type    : string;   // "commit" | "deploy" | "sql_migration" | "ai_output" | "http_check"
  artifact_location: string | null;
  artifact_data    : Record<string, unknown> | null;
  created_at       : number;   // epoch ms
}

export interface VerificationResult {
  pass       : boolean;
  taskId     : string;
  taskType   : string;
  checks     : VerificationCheck[];
  failReason?: string;
}

export interface VerificationCheck {
  name   : string;
  pass   : boolean;
  detail?: string;
}

// ── Supabase client ────────────────────────────────────────────────────────

async function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? await getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? await getSecret("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Load artifacts for a task ──────────────────────────────────────────────

async function loadArtifacts(taskId: string): Promise<TaskArtifact[]> {
  const client = await db();
  const { data, error } = await client
    .from("roadmap_task_artifacts")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[verifyTask] artifact load failed: ${error.message}`);
  return (data ?? []) as TaskArtifact[];
}

// ── Load task record ───────────────────────────────────────────────────────

async function loadTask(taskId: string): Promise<{
  id: string; title: string; type: string; description: string;
  metadata: Record<string, unknown> | null;
} | null> {
  const client = await db();
  const { data } = await client
    .from("roadmap_tasks")
    .select("id, title, description, source")
    .eq("id", taskId)
    .single();
  if (!data) return null;
  const row = data as { id: string; title: string; description: string; source?: string };
  // type is embedded as [type:X] tag in description by seedTasksFromRoadmap
  const typeTag = row.description?.match(/\[type:([^\]]+)\]/)?.[1] ?? "ai_task";
  return {
    id         : row.id,
    title      : row.title,
    description: row.description,
    type       : typeTag,
    metadata   : null,
  };
}

// ── Verification checks by type ─────────────────────────────────────────────

/** build_module — requires at least one "commit" artifact */
function verifyBuildModule(artifacts: TaskArtifact[]): VerificationCheck[] {
  const commits = artifacts.filter(a => a.artifact_type === "commit");
  return [
    {
      name  : "git_commit_exists",
      pass  : commits.length > 0,
      detail: commits.length > 0
        ? `${commits.length} commit artifact(s): ${commits.map(c => c.artifact_location?.slice(0, 8) ?? "?").join(", ")}`
        : "No commit artifact recorded. Executor must record a commit SHA.",
    },
  ];
}

/** create_api — requires commit artifact + http_check artifact with status 200 */
function verifyCreateAPI(artifacts: TaskArtifact[]): VerificationCheck[] {
  const commits    = artifacts.filter(a => a.artifact_type === "commit");
  const httpChecks = artifacts.filter(a => a.artifact_type === "http_check");
  const passing200 = httpChecks.filter(
    a => (a.artifact_data?.status as number) === 200
  );

  return [
    {
      name  : "endpoint_commit_exists",
      pass  : commits.length > 0,
      detail: commits.length > 0 ? `commit: ${commits[0]?.artifact_location?.slice(0, 8)}` : "No commit artifact",
    },
    {
      name  : "endpoint_http_200",
      pass  : passing200.length > 0,
      detail: passing200.length > 0
        ? `HTTP 200 confirmed: ${passing200[0]?.artifact_location}`
        : httpChecks.length > 0
          ? `HTTP check recorded but status=${httpChecks[0]?.artifact_data?.status ?? "?"}`
          : "No http_check artifact recorded",
    },
  ];
}

/** update_schema — requires sql_migration artifact */
function verifyUpdateSchema(artifacts: TaskArtifact[]): VerificationCheck[] {
  const migrations = artifacts.filter(a => a.artifact_type === "sql_migration");
  return [
    {
      name  : "schema_migration_artifact",
      pass  : migrations.length > 0,
      detail: migrations.length > 0
        ? `Migration recorded: rows_affected=${migrations[0]?.artifact_data?.rows_affected ?? "?"}`
        : "No sql_migration artifact. Executor must record the migration result.",
    },
  ];
}

/** deploy_feature — accepts deploy_proof (health-check verification) OR deploy (triggered deploy).
 *  deploy_proof: recorded by Path B handler — verifies existing deployment health.
 *  deploy: recorded by Path A handler — triggered new Vercel deployment.
 */
function verifyDeployFeature(artifacts: TaskArtifact[]): VerificationCheck[] {
  // deploy_proof: health-check artifact — primary path for verification tasks
  const proofs = artifacts.filter(a => a.artifact_type === "deploy_proof");
  const healthyProof = proofs.filter(
    a => !!(a.artifact_data?.healthy as boolean) || /ready/i.test((a.artifact_data?.state as string) ?? "")
  );

  // deploy: triggered-deploy artifact — fallback for Path A tasks
  const deploys = artifacts.filter(a => a.artifact_type === "deploy");
  const readyDeploy = deploys.filter(
    a => /ready/i.test((a.artifact_data?.state as string) ?? "")
  );

  // Pass if either proof type shows healthy/ready deployment
  const anyProof  = proofs.length > 0 || deploys.length > 0;
  const anyHealthy = healthyProof.length > 0 || readyDeploy.length > 0;

  return [
    {
      name  : "deployment_artifact_exists",
      pass  : anyProof,
      detail: anyProof
        ? `${proofs.length} deploy_proof + ${deploys.length} deploy artifact(s)`
        : "No deploy_proof or deploy artifact recorded",
    },
    {
      name  : "deployment_verified",
      pass  : anyHealthy,
      detail: anyHealthy
        ? healthyProof.length > 0
            ? `deploy_proof: healthy=true url=${healthyProof[0]?.artifact_location} http=${healthyProof[0]?.artifact_data?.http_status ?? "?"}`
            : `deploy: state=READY url=${readyDeploy[0]?.artifact_location}`
        : proofs.length > 0
            ? `deploy_proof recorded but healthy=false (http=${proofs[0]?.artifact_data?.http_status ?? "?"})`
            : "No verified deployment artifact",
    },
  ];
}

/** ai_task — requires any artifact proving output was generated */
function verifyAITask(artifacts: TaskArtifact[]): VerificationCheck[] {
  const outputs = artifacts.filter(a =>
    ["ai_output", "commit", "deploy", "http_check", "sql_migration"].includes(a.artifact_type)
  );
  return [
    {
      name  : "artifact_generated",
      pass  : outputs.length > 0,
      detail: outputs.length > 0
        ? `${outputs.length} artifact(s): ${outputs.map(a => a.artifact_type).join(", ")}`
        : "No artifacts recorded. Executor must record at least one proof artifact.",
    },
  ];
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * verifyTask
 *
 * Loads a task and its proof artifacts, runs type-specific checks,
 * returns pass/fail with full check details.
 *
 * NEVER marks the task completed — only returns the verdict.
 * The caller (verify-task route) is responsible for the status write.
 */
export async function verifyTask(taskId: string): Promise<VerificationResult> {
  // Load task
  const task = await loadTask(taskId);
  if (!task) {
    return {
      pass      : false,
      taskId,
      taskType  : "unknown",
      checks    : [{ name: "task_exists", pass: false, detail: `Task ${taskId} not found in roadmap_tasks` }],
      failReason: "task_not_found",
    };
  }

  // Load artifacts
  const artifacts = await loadArtifacts(taskId);

  // Artifact presence guard — universal rule: zero artifacts = auto-fail
  if (artifacts.length === 0) {
    return {
      pass     : false,
      taskId,
      taskType : task.type,
      checks   : [{
        name  : "artifacts_present",
        pass  : false,
        detail: `Zero artifacts in roadmap_task_artifacts for task_id=${taskId}. Execution must record proof before verification.`,
      }],
      failReason: "no_artifacts",
    };
  }

  // Type-specific checks
  let checks: VerificationCheck[];
  switch (task.type) {
    case "build_module"  : checks = verifyBuildModule(artifacts);  break;
    case "create_api"    : checks = verifyCreateAPI(artifacts);    break;
    case "update_schema" : checks = verifyUpdateSchema(artifacts); break;
    case "deploy_feature": checks = verifyDeployFeature(artifacts);break;
    default              : checks = verifyAITask(artifacts);       break;
  }

  const allPass = checks.every(c => c.pass);
  const failing = checks.filter(c => !c.pass);

  return {
    pass      : allPass,
    taskId,
    taskType  : task.type,
    checks,
    failReason: allPass ? undefined : failing.map(c => c.name).join(", "),
  };
}
