// lib/governance/governanceEngine.ts
// Purpose: Main governance engine orchestrator. Single entry point for all
//          ecosystem governance operations. Used by the /api/javari/governance
//          API route and by the autonomous executor before injecting new tasks.
// Date: 2026-03-09

import { checkForDuplication, runEcosystemDuplicationScan, DuplicationCheckInput } from "./duplicationDetector";
import { runArchitectureValidation }                                                 from "./architectureValidator";
import { registryStats, getCapabilitiesByOwner, CAPABILITY_REGISTRY }               from "./capabilityRegistry";
import { systemOwnershipReport, SYSTEM_REGISTRY }                                   from "./systemOwnership";
import { recordArtifact }                                                            from "@/lib/roadmap/artifactRecorder";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GovernanceCheckRequest {
  type              : "pre_build" | "full_scan" | "architecture" | "capability_lookup";
  proposedCapabilityId?  : string;
  proposedCapabilityLabel?: string;
  requestingSystem?  : string;
  description?       : string;
  task_id?           : string;   // for artifact recording
}

export interface GovernanceCheckResponse {
  ok              : boolean;
  checkType       : string;
  approved        : boolean;
  score           : number;
  summary         : string;
  details         : unknown;
  durationMs      : number;
  generatedAt     : string;
}

// ── Main governance engine ─────────────────────────────────────────────────

export async function runGovernanceCheck(
  req: GovernanceCheckRequest
): Promise<GovernanceCheckResponse> {
  const t0 = Date.now();
  const generatedAt = new Date().toISOString();

  let approved = true;
  let score    = 100;
  let summary  = "";
  let details: unknown = {};

  switch (req.type) {

    case "pre_build": {
      if (!req.proposedCapabilityId || !req.proposedCapabilityLabel || !req.requestingSystem) {
        return {
          ok: false, checkType: req.type, approved: false, score: 0,
          summary: "pre_build check requires proposedCapabilityId, proposedCapabilityLabel, requestingSystem",
          details: {}, durationMs: Date.now() - t0, generatedAt,
        };
      }
      const input: DuplicationCheckInput = {
        proposedCapabilityId  : req.proposedCapabilityId,
        proposedCapabilityLabel: req.proposedCapabilityLabel,
        requestingSystem      : req.requestingSystem as never,
        description           : req.description,
      };
      const result = checkForDuplication(input);
      approved = result.approved;
      score    = result.safe ? 100 : result.approved ? 60 : 0;
      summary  = result.approvalReason ?? "";
      details  = result;
      break;
    }

    case "full_scan": {
      const [dupScan, validation] = [
        runEcosystemDuplicationScan(),
        runArchitectureValidation(),
      ];
      approved = validation.overallStatus !== "fail";
      score    = Math.round((dupScan.architectureScore + validation.overallScore) / 2);
      summary  = `Architecture ${validation.overallStatus.toUpperCase()} (${validation.overallScore}/100). Duplication score: ${dupScan.architectureScore}/100. ${dupScan.conflicts.length} conflicts.`;
      details  = { duplication: dupScan, validation };
      break;
    }

    case "architecture": {
      const validation = runArchitectureValidation();
      approved = validation.overallStatus !== "fail";
      score    = validation.overallScore;
      summary  = `Architecture validation: ${validation.overallStatus.toUpperCase()} (${validation.overallScore}/100). ${validation.checks.filter(c => c.status === "fail").length} failures, ${validation.checks.filter(c => c.status === "warn").length} warnings.`;
      details  = validation;
      break;
    }

    case "capability_lookup": {
      const stats    = registryStats();
      const ownership = systemOwnershipReport();
      score    = 100;
      summary  = `${stats.total} capabilities registered across ${SYSTEM_REGISTRY.length} systems. ${stats.exclusiveCount} exclusive.`;
      details  = {
        registryStats    : stats,
        capabilityRegistry: CAPABILITY_REGISTRY,
        systemOwnership   : ownership,
      };
      break;
    }

    default:
      return {
        ok: false, checkType: req.type, approved: false, score: 0,
        summary: `Unknown check type: ${(req as GovernanceCheckRequest).type}`,
        details: {}, durationMs: Date.now() - t0, generatedAt,
      };
  }

  // Record artifact if task_id provided
  if (req.task_id) {
    try {
      await recordArtifact({
        task_id          : req.task_id,
        artifact_type    : "verification_report",
        artifact_location: `governance/${req.type}/${generatedAt}`,
        artifact_data    : { type: req.type, score, approved, summary } as Record<string, unknown>,
      });
    } catch { /* non-fatal */ }
  }

  return {
    ok: true, checkType: req.type, approved, score, summary, details,
    durationMs: Date.now() - t0, generatedAt,
  };
}

/**
 * quickPreBuildCheck — convenience wrapper called by autonomous executor
 * before injecting any new capability into the roadmap.
 */
export async function quickPreBuildCheck(
  capabilityId   : string,
  capabilityLabel: string,
  requestingSystem: string
): Promise<{ approved: boolean; message: string }> {
  const result = await runGovernanceCheck({
    type                   : "pre_build",
    proposedCapabilityId   : capabilityId,
    proposedCapabilityLabel: capabilityLabel,
    requestingSystem,
  });
  return { approved: result.approved, message: result.summary };
}
