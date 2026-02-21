// lib/autonomy-core/scheduler/cycle.ts
// CR AudioViz AI — Autonomous Cycle Scheduler
// 2026-02-21 — STEP 11: Javari Autonomous Ecosystem Mode
//
// Orchestrates the full crawl → detect → validate → fix → report pipeline.
// Called by /api/autonomy-core/run (Vercel Cron or manual trigger).
// All state is in Supabase — no in-process global state between invocations.
// Kill switch checked at every stage.

import { getAutonomyCoreConfig }      from "../crawler/types";
import { crawlCore }                   from "../crawler/crawl";
import { detectAnomalies }             from "../diff/detect";
import { runRing2Fixes, rollbackPatch } from "../fixer/ring2";
import { validatePatch }               from "../validator/validate";
import { generateCycleReport }         from "../reporter/report";
import { writeAuditEvent }             from "@/lib/enterprise/audit";
import { createLogger }                from "@/lib/observability/logger";
import type { CycleReport, CorePatch } from "../crawler/types";

const log = createLogger("autonomy");

// ── Supabase persistence ──────────────────────────────────────────────────────

async function persistCycleReport(report: CycleReport): Promise<void> {
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/autonomy_cycle_reports`, {
      method:  "POST",
      headers: {
        "apikey":        key,
        "Authorization": `Bearer ${key}`,
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
      },
      body: JSON.stringify({
        id:               report.id,
        started_at:       report.startedAt,
        completed_at:     report.completedAt,
        duration_ms:      report.durationMs,
        snapshot_id:      report.snapshotId,
        anomalies_found:  report.anomaliesFound,
        patches_applied:  report.patchesApplied,
        patches_rejected: report.patchesRejected,
        ring:             report.ring,
        mode:             report.mode,
        status:           report.status,
        halt_reason:      report.haltReason ?? null,
        summary:          JSON.stringify(report),
      }),
    });
  } catch (e) {
    log.warn(`Failed to persist cycle report: ${e instanceof Error ? e.message : e}`);
  }
}

async function persistPatches(patches: CorePatch[]): Promise<void> {
  try {
    const url   = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || patches.length === 0) return;
    for (const patch of patches) {
      await fetch(`${url}/rest/v1/autonomy_patches`, {
        method:  "POST",
        headers: {
          "apikey":        key,
          "Authorization": `Bearer ${key}`,
          "Content-Type":  "application/json",
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({
          id:             patch.id,
          snapshot_id:    patch.snapshotId,
          anomaly_id:     patch.anomalyId,
          file_path:      patch.filePath,
          fix_type:       patch.fixType,
          ring:           patch.ring,
          description:    patch.description,
          status:         patch.status,
          validator_score: patch.validatorScore ?? null,
          applied_at:     patch.appliedAt ?? null,
          rolled_back_at: patch.rolledBackAt ?? null,
          rollback_reason: patch.rolledBackReason ?? null,
          // Never persist old/new content to DB — too large + audit trail via GitHub
        }),
      });
    }
  } catch (e) {
    log.warn(`Failed to persist patches: ${e instanceof Error ? e.message : e}`);
  }
}

// ── Halting logic ─────────────────────────────────────────────────────────────

function shouldHalt(cfg: ReturnType<typeof getAutonomyCoreConfig>): string | null {
  if (cfg.killSwitch) return "AUTONOMOUS_CORE_KILL_SWITCH=true";
  if (!cfg.enabled)   return "AUTONOMOUS_CORE_ENABLED=false";
  return null;
}

// ── Main cycle runner ─────────────────────────────────────────────────────────

export async function runAutonomyCycle(opts?: {
  dryRun?: boolean;
  force?:  boolean;     // bypass enabled check (for manual trigger)
}): Promise<CycleReport> {
  const cycleId  = `cycle_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const startedAt = new Date().toISOString();
  const cfg      = getAutonomyCoreConfig();

  log.info(`Autonomy cycle started: ${cycleId}`, {
    meta: { ring: cfg.ring, mode: cfg.mode, dryRun: opts?.dryRun }
  });

  // Check halt conditions (unless forced by admin)
  if (!opts?.force) {
    const haltReason = shouldHalt(cfg);
    if (haltReason) {
      const report = generateCycleReport({
        id: cycleId, startedAt, status: "halted", haltReason,
        snapshotId: "", patches: [], anomaliesFound: 0, ring: cfg.ring, mode: cfg.mode,
      });
      log.warn(`Cycle halted: ${haltReason}`);
      return report;
    }
  }

  // Dry run if mode is dry_run
  const dryRun = opts?.dryRun ?? cfg.mode === "dry_run";

  let snapshotId = "";
  let patches:   CorePatch[] = [];
  let anomaliesFound = 0;

  try {
    // ── STAGE 1: Crawl ─────────────────────────────────────────────────────
    log.info(`[${cycleId}] Stage 1: crawling core`);
    const snapshot = await crawlCore();
    snapshotId = snapshot.id;

    await writeAuditEvent({
      action:   "module.generated",
      metadata: { system: "autonomy-core", stage: "crawl", cycleId, snapshotId, scope: cfg.scope },
      severity: "info",
    });

    // ── STAGE 2: Detect ────────────────────────────────────────────────────
    log.info(`[${cycleId}] Stage 2: detecting anomalies`);
    const anomalies = await detectAnomalies(snapshot);
    anomaliesFound  = anomalies.length;

    // Kill switch re-check
    if (getAutonomyCoreConfig().killSwitch) {
      const report = generateCycleReport({
        id: cycleId, startedAt, status: "halted", haltReason: "Kill switch activated mid-cycle",
        snapshotId, patches: [], anomaliesFound, ring: cfg.ring, mode: cfg.mode,
      });
      await persistCycleReport(report);
      return report;
    }

    // Degraded mode check: if critical anomalies found and flag set
    const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
    if (criticalCount > 0 && cfg.degradedOnAnomaly && !dryRun) {
      log.warn(`[${cycleId}] ${criticalCount} critical anomalies — halting Ring 2 auto-apply`);
      const report = generateCycleReport({
        id: cycleId, startedAt, status: "degraded",
        haltReason: `${criticalCount} critical anomalies detected — manual review required`,
        snapshotId, patches: [], anomaliesFound, ring: cfg.ring, mode: cfg.mode,
      });
      await persistCycleReport(report);
      return report;
    }

    // ── STAGE 3: Fix (Ring 2 only) ─────────────────────────────────────────
    if (cfg.ring >= 2) {
      log.info(`[${cycleId}] Stage 3: running Ring 2 fixes (max ${cfg.maxPatchesPerCycle})`);

      // If validator required, run it per patch first
      if (cfg.requireValidator) {
        const candidatePatches = await runRing2Fixes(anomalies, {
          maxPatches: cfg.maxPatchesPerCycle,
          dryRun:     true,  // generate patches without applying
          killSwitch: cfg.killSwitch,
        });

        for (const patch of candidatePatches) {
          if (patch.status !== "pending") { patches.push(patch); continue; }

          const validResult = await validatePatch(patch);
          patch.validatorScore = validResult.score;

          if (validResult.recommendation === "apply" && !dryRun) {
            // Re-run with dryRun=false for this single patch
            const applied = await runRing2Fixes([anomalies.find((a) => a.id === patch.anomalyId)!], {
              maxPatches: 1, dryRun: false, killSwitch: cfg.killSwitch,
            });
            if (applied[0]) {
              applied[0].validatorScore = validResult.score;
              patches.push(applied[0]);
            }
          } else if (validResult.recommendation === "reject") {
            patch.status = "rejected";
            patch.rolledBackReason = `Validator rejected (score=${validResult.score})`;
            patches.push(patch);
          } else {
            patches.push({ ...patch, status: dryRun ? "pending" : "rejected" });
          }
        }
      } else {
        // No validator — apply directly
        patches = await runRing2Fixes(anomalies, {
          maxPatches: cfg.maxPatchesPerCycle,
          dryRun,
          killSwitch: cfg.killSwitch,
        });
      }
    }

    // ── STAGE 4: Persist + report ──────────────────────────────────────────
    log.info(`[${cycleId}] Stage 4: persisting results`);
    await persistPatches(patches);

    const report = generateCycleReport({
      id: cycleId, startedAt, status: "completed",
      snapshotId, patches, anomaliesFound, ring: cfg.ring, mode: dryRun ? "dry_run" : cfg.mode,
    });
    await persistCycleReport(report);

    await writeAuditEvent({
      action:   "module.generated",
      metadata: {
        system: "autonomy-core", stage: "complete", cycleId,
        anomaliesFound, patchesApplied: report.patchesApplied,
      },
      severity: "info",
    });

    log.info(`Cycle complete: ${cycleId}`, {
      meta: { anomalies: anomaliesFound, applied: report.patchesApplied, durationMs: report.durationMs }
    });

    return report;

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown cycle error";
    log.error(`Cycle error: ${msg}`, { meta: { cycleId } });

    const report = generateCycleReport({
      id: cycleId, startedAt, status: "error", haltReason: msg,
      snapshotId, patches, anomaliesFound, ring: cfg.ring, mode: cfg.mode,
    });
    await persistCycleReport(report);
    return report;
  }
}
