// lib/repair/index.ts
// Purpose: Repair engine public API — runs the full repair pipeline for one or
//          more CodeIssues: Plan → Patch → PR/Commit → Verify → Artifacts.
//          Called directly by the repair_code executor in taskExecutor.ts.
// Date: 2026-03-07
import { planRepairs, prioritizePlans }  from "./repairPlanner";
import { generatePatch }                 from "./patchGenerator";
import { createRepairPR }                from "./pullRequestCreator";
import { runVerification }               from "./verificationRunner";
import { recordArtifact }                from "@/lib/roadmap/artifactRecorder";
import { buildRepairContext }             from "@/lib/memory/memorySearch";
import { ingestRepair }                   from "@/lib/memory/knowledgeNodeBuilder";
import type { CodeIssue }                from "@/lib/intelligence/codeAnalyzer";
export type { RepairPlan }               from "./repairPlanner";
export type { PatchResult }              from "./patchGenerator";
export type { PRResult }                 from "./pullRequestCreator";
export type { VerificationReport }       from "./verificationRunner";
// ── Types ──────────────────────────────────────────────────────────────────
export interface RepairInput {
export interface RepairResult {
// ── Repair artifact recorder ───────────────────────────────────────────────
  // repair_patch artifact
  // repair_commit artifact
// ── Main repair runner ─────────────────────────────────────────────────────
  // Phase 1: Plan
  // Phase 2: Process each plan sequentially (avoid race conditions on same file)
      // Phase 2a: Generate patch
      // Phase 2b: Create PR or direct commit
      // Phase 2c: Record repair artifacts
      // Phase 2d: Run verification
export default {}
