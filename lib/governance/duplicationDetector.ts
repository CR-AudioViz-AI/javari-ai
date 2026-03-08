// lib/governance/duplicationDetector.ts
// Purpose: Capability-level duplication detector. Checks proposed new features
//          against the CAPABILITY_REGISTRY to prevent re-implementing capabilities
//          already owned by another system. Wraps lib/ecosystem/deduplicationEngine
//          for code-level duplication checks.
// Date: 2026-03-09

import { CAPABILITY_REGISTRY, checkCapabilityConflict, CapabilityOwner } from "./capabilityRegistry";
import { SYSTEM_REGISTRY } from "./systemOwnership";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DuplicationCheckInput {
  proposedCapabilityId  : string;
  proposedCapabilityLabel: string;
  requestingSystem      : CapabilityOwner;
  description?          : string;
}

export interface DuplicationCheckResult {
  safe            : boolean;
  conflicts       : DuplicationConflict[];
  suggestion?     : string;
  approved        : boolean;
  approvalReason? : string;
}

export interface DuplicationConflict {
  capability_id  : string;
  capability_label: string;
  existing_owner : string;
  conflict_type  : "exact_match" | "overlap" | "exclusive_violation";
  severity       : "blocker" | "warning";
  message        : string;
}

export interface EcosystemDuplicationReport {
  generatedAt       : string;
  totalCapabilities : number;
  conflicts         : DuplicationConflict[];
  orphanedSystems   : string[];
  architectureScore : number;    // 0-100: higher = less duplication
  recommendations   : string[];
}

// ── Semantic overlap detection ─────────────────────────────────────────────
// Keywords that indicate semantic overlap with registered capabilities

const SEMANTIC_CLUSTERS: Record<string, string[]> = {
  auth            : ["login","signin","signup","oauth","session","token","jwt","permission","role","access control"],
  payments        : ["stripe","paypal","billing","invoice","checkout","subscription","charge","refund"],
  ai_reasoning    : ["llm","gpt","claude","gemini","groq","model","inference","completion","prompt","reasoning"],
  model_orchestration: ["orchestrat","ensemble","route model","model select","multi-model"],
  code_repair     : ["fix code","repair","patch","auto-fix","bug fix","heal"],
  learning_system : ["learn from","knowledge graph","skill score","domain score","experience"],
  memory_graph    : ["memory node","knowledge node","memory graph","graph store"],
  site_crawling   : ["crawl","spider","scrape site","web crawl"],
  audit_logging   : ["audit log","activity log","event log","tamper"],
  storage         : ["r2","s3","file upload","asset store","cdn"],
};

function detectSemanticOverlap(
  proposed: string,
  existing: typeof CAPABILITY_REGISTRY[number]
): boolean {
  const cluster = SEMANTIC_CLUSTERS[existing.id];
  if (!cluster) return false;
  const lower = proposed.toLowerCase();
  return cluster.some(keyword => lower.includes(keyword));
}

// ── Main checker ───────────────────────────────────────────────────────────

export function checkForDuplication(input: DuplicationCheckInput): DuplicationCheckResult {
  const conflicts: DuplicationConflict[] = [];

  // 1. Exact capability ID match
  const exactConflict = checkCapabilityConflict(input.proposedCapabilityId, input.requestingSystem);
  if (exactConflict.conflict) {
    conflicts.push({
      capability_id  : input.proposedCapabilityId,
      capability_label: input.proposedCapabilityLabel,
      existing_owner : exactConflict.existingOwner ?? "unknown",
      conflict_type  : "exclusive_violation",
      severity       : "blocker",
      message        : exactConflict.message ?? `Exclusive capability conflict`,
    });
  }

  // 2. Semantic overlap scan
  const proposed = `${input.proposedCapabilityId} ${input.proposedCapabilityLabel} ${input.description ?? ""}`;
  for (const cap of CAPABILITY_REGISTRY) {
    if (cap.id === input.proposedCapabilityId) continue; // already caught above
    if (cap.owner === input.requestingSystem)  continue; // same owner = fine
    if (!detectSemanticOverlap(proposed, cap)) continue;

    conflicts.push({
      capability_id  : cap.id,
      capability_label: cap.label,
      existing_owner : cap.owner,
      conflict_type  : cap.exclusive ? "exclusive_violation" : "overlap",
      severity       : cap.exclusive ? "blocker" : "warning",
      message        : cap.exclusive
        ? `"${input.proposedCapabilityLabel}" overlaps with exclusive capability "${cap.label}" owned by ${cap.owner}`
        : `Consider reusing ${cap.owner}'s "${cap.label}" instead of building new`,
    });
  }

  const blockers  = conflicts.filter(c => c.severity === "blocker");
  const safe      = conflicts.length === 0;
  const approved  = blockers.length === 0;

  let suggestion: string | undefined;
  if (conflicts.length > 0) {
    const firstConflict = conflicts[0];
    const owner = SYSTEM_REGISTRY.find(s => s.id === firstConflict.existing_owner);
    suggestion = owner
      ? `Delegate "${input.proposedCapabilityLabel}" to ${owner.name} via ${owner.communicatesVia === "api_gateway" ? "API Gateway" : "direct call"}.`
      : `Reuse the existing capability "${firstConflict.capability_label}" instead of building new.`;
  }

  return {
    safe,
    conflicts,
    suggestion,
    approved,
    approvalReason: approved
      ? "No exclusive conflicts found. Proceed with implementation."
      : `${blockers.length} blocker(s) found. Resolve before building.`,
  };
}

// ── Full ecosystem duplication scan ───────────────────────────────────────

export function runEcosystemDuplicationScan(): EcosystemDuplicationReport {
  const generatedAt = new Date().toISOString();
  const allConflicts: DuplicationConflict[] = [];
  const recommendations: string[] = [];

  // Check for systems with overlapping capabilities
  const capabilityOwnerMap = new Map<string, string[]>();
  for (const cap of CAPABILITY_REGISTRY) {
    if (!capabilityOwnerMap.has(cap.id)) capabilityOwnerMap.set(cap.id, []);
    capabilityOwnerMap.get(cap.id)!.push(cap.owner);
  }

  // Multi-owner capabilities (non-exclusive ones that could drift)
  for (const [capId, owners] of capabilityOwnerMap) {
    if (owners.length > 1) {
      const cap = CAPABILITY_REGISTRY.find(c => c.id === capId);
      if (cap?.exclusive) {
        allConflicts.push({
          capability_id   : capId,
          capability_label: cap.label,
          existing_owner  : owners[0],
          conflict_type   : "exclusive_violation",
          severity        : "blocker",
          message         : `Exclusive capability "${cap.label}" registered to multiple owners: ${owners.join(", ")}`,
        });
      }
    }
  }

  // Find systems with no registered capabilities (orphaned)
  const orphanedSystems = SYSTEM_REGISTRY
    .filter(s => s.capabilities.length === 0)
    .map(s => s.name);

  // Architecture score: 100 - (conflicts * 10), floor 0
  const architectureScore = Math.max(0, 100 - allConflicts.length * 10);

  // Recommendations
  if (allConflicts.length === 0) {
    recommendations.push("Ecosystem architecture is clean. No capability duplication detected.");
  } else {
    for (const c of allConflicts) {
      if (c.severity === "blocker") {
        recommendations.push(`BLOCKER: Resolve exclusive conflict for "${c.capability_label}" — remove from all but the canonical owner.`);
      }
    }
  }

  recommendations.push(
    "Architecture Rule: Apps must route through CRAudioVizAI Core API Gateway.",
    "Before building any feature: check CAPABILITY_REGISTRY first.",
    "If a capability already exists: delegate, don't rebuild."
  );

  return {
    generatedAt,
    totalCapabilities: CAPABILITY_REGISTRY.length,
    conflicts: allConflicts,
    orphanedSystems,
    architectureScore,
    recommendations,
  };
}
