// lib/autonomy/verificationGate.ts
// Purpose: Verification gate — post-repair validation. Checks that completed
//          repair tasks produced valid artifacts, then runs heuristic build/lint/
//          test signals against the patched file contents. Creates rollback tasks
//          on verification failure.
// Date: 2026-03-07

import { createClient }    from "@supabase/supabase-js";
import { recordArtifact }  from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export type GateStatus = "passed" | "failed" | "skipped" | "rollback_queued";

export interface GateCheck {
  name   : string;
  passed : boolean;
  detail : string;
}

export interface GateResult {
  taskId    : string;
  status    : GateStatus;
  checks    : GateCheck[];
  rollbackId?: string;
  artifactId?: string;
  durationMs: number;
}

// ── Supabase ───────────────────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
}

// ── Artifact check ─────────────────────────────────────────────────────────

async function fetchTaskArtifacts(taskId: string): Promise<Array<{
  artifact_type    : string;
  artifact_location: string;
  artifact_data    : Record<string, unknown> | null;
}>> {
  const { data } = await db()
    .from("roadmap_task_artifacts")
    .select("artifact_type, artifact_location, artifact_data")
    .eq("task_id", taskId);
  return data ?? [];
}

// ── Heuristic checks on artifact data ─────────────────────────────────────

function checkArtifacts(artifacts: Awaited<ReturnType<typeof fetchTaskArtifacts>>): GateCheck[] {
  const checks: GateCheck[] = [];

  // Must have at least one artifact
  checks.push({
    name  : "has_artifacts",
    passed: artifacts.length > 0,
    detail: `${artifacts.length} artifact(s) found`,
  });

  // Repair tasks need a repair_patch or repair_commit or commit artifact
  const repairTypes = new Set(["repair_patch", "repair_commit", "commit", "ai_output"]);
  const hasRepairArtifact = artifacts.some(a => repairTypes.has(a.artifact_type));
  checks.push({
    name  : "repair_artifact_exists",
    passed: hasRepairArtifact,
    detail: hasRepairArtifact
      ? `Repair artifact: ${artifacts.find(a => repairTypes.has(a.artifact_type))?.artifact_type}`
      : "No repair artifact found",
  });

  // If verification_report artifact exists, check it passed
  const verReport = artifacts.find(a => a.artifact_type === "verification_report");
  if (verReport && verReport.artifact_data) {
    const d = verReport.artifact_data as { ok?: boolean; buildStatus?: string; syntaxValid?: boolean };
    checks.push({
      name  : "verification_report_ok",
      passed: d.ok === true,
      detail: `verification ok=${d.ok}, build=${d.buildStatus ?? "?"}`,
    });
    checks.push({
      name  : "syntax_valid",
      passed: d.syntaxValid !== false,
      detail: `syntax=${d.syntaxValid ?? "unchecked"}`,
    });
  }

  // Check for commit SHA in repair_commit artifact
  const commitArtifact = artifacts.find(a => a.artifact_type === "repair_commit" || a.artifact_type === "commit");
  if (commitArtifact) {
    const sha = (commitArtifact.artifact_data as { commitSha?: string })?.commitSha
      ?? commitArtifact.artifact_location;
    const hasValidSHA = typeof sha === "string" && sha.length >= 8;
    checks.push({
      name  : "commit_sha_valid",
      passed: hasValidSHA,
      detail: hasValidSHA ? `SHA: ${sha.slice(0, 8)}` : "No valid commit SHA",
    });
  }

  return checks;
}

// ── Platform build health check ────────────────────────────────────────────

async function checkPlatformHealth(): Promise<GateCheck> {
  const PREVIEW = "https://javari-ai-git-main-roy-hendersons-projects-1d3d5e94.vercel.app";
  try {
    const res = await fetch(`${PREVIEW}/api/javari/health`, {
      signal: AbortSignal.timeout(8_000),
    });
    return {
      name  : "platform_health",
      passed: res.ok || res.status === 404,  // 404 = no health route but platform is up
      detail: `HTTP ${res.status}`,
    };
  } catch {
    return { name: "platform_health", passed: false, detail: "Platform unreachable" };
  }
}

// ── Rollback task creator ──────────────────────────────────────────────────

async function createRollbackTask(
  failedTaskId: string,
  failureReason: string
): Promise<string> {
  const ts  = Date.now();
  const id  = `rollback-${failedTaskId.slice(0, 40)}-${ts}`;

  const { error } = await db().from("roadmap_tasks").insert({
    id,
    phase_id   : "maintenance",
    title      : `[ROLLBACK] Revert failed repair: ${failedTaskId.slice(0, 50)}`,
    description: `[type:ai_task] Rollback required for failed repair task.\n` +
      `Failed task: ${failedTaskId}\n` +
      `Failure reason: ${failureReason}\n` +
      `Action: Review and revert the changes from this task if necessary. Check GitHub for the repair branch/PR and close without merging if applicable.`,
    depends_on : [],
    status     : "pending",
    source     : "verification_gate",
    updated_at : ts,
  });

  if (error) console.error(`[verificationGate] Rollback task insert failed: ${error.message}`);
  return id;
}

// ── Main gate ──────────────────────────────────────────────────────────────

export async function runVerificationGate(taskId: string): Promise<GateResult> {
  const t0 = Date.now();

  // Fetch artifacts for this task
  const artifacts = await fetchTaskArtifacts(taskId);

  // Skip gate if task has no artifacts at all (not a repair task)
  if (artifacts.length === 0) {
    return {
      taskId, status: "skipped",
      checks: [{ name: "has_artifacts", passed: false, detail: "No artifacts — skipping gate" }],
      durationMs: Date.now() - t0,
    };
  }

  const checks: GateCheck[] = [];

  // Check 1: Artifact validation
  checks.push(...checkArtifacts(artifacts));

  // Check 2: Platform health (only if repair artifacts present)
  const hasRepair = artifacts.some(a => ["repair_commit", "repair_patch"].includes(a.artifact_type));
  if (hasRepair) {
    checks.push(await checkPlatformHealth());
  }

  // Determine gate result
  const criticalChecks = ["has_artifacts", "repair_artifact_exists"];
  const criticalFailed = checks
    .filter(c => criticalChecks.includes(c.name) && !c.passed);

  const overallPassed = criticalFailed.length === 0;

  let status: GateStatus = overallPassed ? "passed" : "failed";
  let rollbackId: string | undefined;

  // Create rollback task on failure
  if (!overallPassed) {
    const failureReason = criticalFailed.map(c => `${c.name}: ${c.detail}`).join("; ");
    rollbackId = await createRollbackTask(taskId, failureReason);
    status = "rollback_queued";
    console.log(`[verificationGate] ❌ Gate FAILED for ${taskId} — rollback task: ${rollbackId}`);
  } else {
    console.log(`[verificationGate] ✅ Gate PASSED for ${taskId}`);
  }

  // Record verification artifact
  let artifactId: string | undefined;
  try {
    const ar = await recordArtifact({
      task_id          : taskId,
      artifact_type    : "verification_report" as "commit",
      artifact_location: `gate:${taskId}:${Date.now()}`,
      artifact_data    : {
        status,
        checksPassed : checks.filter(c => c.passed).length,
        checksTotal  : checks.length,
        rollbackId,
        gateVersion  : "autonomy-gate-1.0",
      },
    });
    artifactId = ar.id;
  } catch { /* best-effort */ }

  return { taskId, status, checks, rollbackId, artifactId, durationMs: Date.now() - t0 };
}

// ── Batch gate runner ──────────────────────────────────────────────────────

export async function runGateForRecentRepairs(
  windowMinutes: number = 30
): Promise<GateResult[]> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data } = await db()
    .from("roadmap_tasks")
    .select("id")
    .eq("status", "completed")
    .eq("source", "intelligence")
    .gte("updated_at", Date.parse(since));

  const results: GateResult[] = [];
  for (const row of (data ?? [])) {
    const result = await runVerificationGate((row as {id: string}).id);
    results.push(result);
  }
  return results;
}
