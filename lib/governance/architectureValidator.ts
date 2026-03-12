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
export interface ArchitectureValidationReport {
// ── Validation checks ──────────────────────────────────────────────────────
  // Check any exclusive cap registered under multiple owners
// ── Main validator ─────────────────────────────────────────────────────────
export default {}
