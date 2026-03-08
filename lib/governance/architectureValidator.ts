// lib/governance/architectureValidator.ts
// Purpose: Validates that the current ecosystem conforms to the architectural
//          rules defined in systemOwnership.ts. Checks: hub-and-spoke communication,
//          capability ownership integrity, system registration, and API route structure.
//          Produces a scored validation report used by the governance dashboard.
// Date: 2026-03-09

import { SYSTEM_REGISTRY, validateCommunicationPath, systemOwnershipReport } from "./systemOwnership";
import { CAPABILITY_REGISTRY, registryStats }                                 from "./capabilityRegistry";
import { runEcosystemDuplicationScan }                                        from "./duplicationDetector";

// ── Types ──────────────────────────────────────────────────────────────────

export type ValidationStatus = "pass" | "warn" | "fail";

export interface ValidationCheck {
  id          : string;
  name        : string;
  description : string;
  status      : ValidationStatus;
  score       : number;   // 0-100
  detail?     : string;
  remediation?: string;
}

export interface ArchitectureValidationReport {
  generatedAt        : string;
  overallScore       : number;   // 0-100
  overallStatus      : ValidationStatus;
  checks             : ValidationCheck[];
  governanceSummary  : {
    totalCapabilities  : number;
    exclusiveCapabilities: number;
    registeredSystems  : number;
    architectureScore  : number;
    duplicationConflicts: number;
  };
}

// ── Validation checks ──────────────────────────────────────────────────────

function checkCapabilityRegistryIntegrity(): ValidationCheck {
  const stats = registryStats();
  const unownedCaps = CAPABILITY_REGISTRY.filter(c =>
    !SYSTEM_REGISTRY.some(s => s.id === c.owner)
  );
  const status: ValidationStatus = unownedCaps.length === 0 ? "pass" : "fail";
  return {
    id          : "cap_registry_integrity",
    name        : "Capability Registry Integrity",
    description : "Every capability must be owned by a registered system",
    status,
    score       : unownedCaps.length === 0 ? 100 : Math.max(0, 100 - unownedCaps.length * 20),
    detail      : unownedCaps.length === 0
      ? `${stats.total} capabilities, all owned by registered systems`
      : `${unownedCaps.length} capabilities have unregistered owners: ${unownedCaps.map(c => c.id).join(", ")}`,
    remediation : unownedCaps.length > 0 ? "Register the owning system in SYSTEM_REGISTRY" : undefined,
  };
}

function checkSystemOwnershipConsistency(): ValidationCheck {
  const mismatches: string[] = [];
  for (const sys of SYSTEM_REGISTRY) {
    for (const capId of sys.capabilities) {
      const cap = CAPABILITY_REGISTRY.find(c => c.id === capId);
      if (!cap) {
        mismatches.push(`${sys.id} claims capability "${capId}" which is not in CAPABILITY_REGISTRY`);
      } else if (cap.owner !== sys.id) {
        mismatches.push(`${sys.id} claims capability "${capId}" but CAPABILITY_REGISTRY says owner is ${cap.owner}`);
      }
    }
  }
  const status: ValidationStatus = mismatches.length === 0 ? "pass" : "fail";
  return {
    id          : "system_ownership_consistency",
    name        : "System Ownership Consistency",
    description : "System capability claims must match CAPABILITY_REGISTRY ownership",
    status,
    score       : mismatches.length === 0 ? 100 : Math.max(0, 100 - mismatches.length * 15),
    detail      : mismatches.length === 0 ? "All ownership claims consistent" : mismatches.slice(0, 5).join("; "),
    remediation : mismatches.length > 0 ? "Align system capability lists with CAPABILITY_REGISTRY" : undefined,
  };
}

function checkHubAndSpoke(): ValidationCheck {
  const violations: string[] = [];
  for (const sys of SYSTEM_REGISTRY) {
    if (sys.type === "app") {
      for (const dep of sys.allowedDeps) {
        const targetSys = SYSTEM_REGISTRY.find(s => s.id === dep);
        if (targetSys && targetSys.type === "app") {
          violations.push(`${sys.name} has direct dependency on ${targetSys.name} (app-to-app — must route through Core)`);
        }
      }
      if (sys.communicatesVia !== "api_gateway") {
        violations.push(`${sys.name} (app) communicatesVia="${sys.communicatesVia}" — must be "api_gateway"`);
      }
    }
  }
  const status: ValidationStatus = violations.length === 0 ? "pass" : "fail";
  return {
    id          : "hub_and_spoke",
    name        : "Hub-and-Spoke Architecture",
    description : "Apps must route through CRAudioVizAI Core; no direct app-to-app calls",
    status,
    score       : violations.length === 0 ? 100 : Math.max(0, 100 - violations.length * 20),
    detail      : violations.length === 0 ? "All communication paths follow hub-and-spoke" : violations.join("; "),
    remediation : violations.length > 0 ? "Update allowedDeps: apps may only call CRAudioVizAI_Core or Javari_AI" : undefined,
  };
}

function checkNoDuplication(): ValidationCheck {
  const scanResult = runEcosystemDuplicationScan();
  const blockers = scanResult.conflicts.filter(c => c.severity === "blocker");
  const status: ValidationStatus = blockers.length === 0 ? "pass" : (scanResult.conflicts.length === 0 ? "pass" : "warn");
  return {
    id          : "no_duplication",
    name        : "No Capability Duplication",
    description : "No system should re-implement capabilities exclusively owned by another",
    status,
    score       : scanResult.architectureScore,
    detail      : `${scanResult.conflicts.length} conflicts (${blockers.length} blockers). ${scanResult.recommendations[0]}`,
    remediation : blockers.length > 0 ? "Remove duplicate capability registrations" : undefined,
  };
}

function checkExclusiveCapabilities(): ValidationCheck {
  const stats = registryStats();
  const exclusiveViolations: string[] = [];

  // Check any exclusive cap registered under multiple owners
  const seen = new Map<string, string>();
  for (const cap of CAPABILITY_REGISTRY) {
    if (!cap.exclusive) continue;
    if (seen.has(cap.id)) {
      exclusiveViolations.push(`Exclusive capability "${cap.id}" registered twice`);
    }
    seen.set(cap.id, cap.owner);
  }

  const status: ValidationStatus = exclusiveViolations.length === 0 ? "pass" : "fail";
  return {
    id          : "exclusive_capabilities",
    name        : "Exclusive Capability Enforcement",
    description : "Each exclusive capability must have exactly one registered owner",
    status,
    score       : exclusiveViolations.length === 0 ? 100 : 0,
    detail      : exclusiveViolations.length === 0
      ? `${stats.exclusiveCount} exclusive capabilities all have unique owners`
      : exclusiveViolations.join("; "),
    remediation : exclusiveViolations.length > 0 ? "Deduplicate exclusive capability entries in CAPABILITY_REGISTRY" : undefined,
  };
}

// ── Main validator ─────────────────────────────────────────────────────────

export function runArchitectureValidation(): ArchitectureValidationReport {
  const generatedAt = new Date().toISOString();
  const stats       = registryStats();
  const dupScan     = runEcosystemDuplicationScan();

  const checks: ValidationCheck[] = [
    checkCapabilityRegistryIntegrity(),
    checkSystemOwnershipConsistency(),
    checkHubAndSpoke(),
    checkNoDuplication(),
    checkExclusiveCapabilities(),
  ];

  const avgScore     = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
  const failCount    = checks.filter(c => c.status === "fail").length;
  const warnCount    = checks.filter(c => c.status === "warn").length;
  const overallStatus: ValidationStatus =
    failCount > 0 ? "fail" : (warnCount > 0 ? "warn" : "pass");

  return {
    generatedAt,
    overallScore: avgScore,
    overallStatus,
    checks,
    governanceSummary: {
      totalCapabilities    : stats.total,
      exclusiveCapabilities: stats.exclusiveCount,
      registeredSystems    : SYSTEM_REGISTRY.length,
      architectureScore    : dupScan.architectureScore,
      duplicationConflicts : dupScan.conflicts.length,
    },
  };
}
