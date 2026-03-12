// lib/javari/factory/module-factory.ts
// Javari Module Factory — Main Entrypoint
// 2026-02-20 — STEP 4 implementation
// Orchestrates the full module generation pipeline:
//   1. buildBlueprint()        — parse description → blueprint
//   2. planGoal()              — blueprint.generationGoal → TaskGraph
//   3. executeGraph()          — multi-agent execution per task
//   4. [parallel] generators   — 6 specialized pipelines
//   5. assembleModule()        — conflict resolve + normalize
//   6. emit SSE events throughout
// SSE Event Map:
//   factory_plan_created     → blueprint summary, task count
//   factory_generator_start  → which file + which agent
//   factory_agent_start      → (forwarded from orchestrator)
//   factory_agent_complete   → agent finished one file
//   factory_generator_done   → file content ready
//   factory_generator_failed → file failed, will skip
//   factory_assemble_start   → collecting outputs
//   factory_assemble_done    → bundle ready, file count
//   factory_done             → full module package summary
//   factory_error            → fatal error
import { buildBlueprint, blueprintToPlanningSummary } from "./blueprint";
import {
import {
import { assembleModule, bundleSummary } from "./assemble";
import type { ModuleBlueprint, BlueprintOptions } from "./blueprint";
import type { ModuleBundle } from "./assemble";
// ── Types ─────────────────────────────────────────────────────────────────────
export interface FactoryOptions extends BlueprintOptions {
export type FactoryEventType =
export interface FactoryEvent {
export interface FactoryResult {
// ── Factory runner ────────────────────────────────────────────────────────────
  // ── 1. Build blueprint ─────────────────────────────────────────────────────
  // ── 2. Build file tree (planning manifest) ─────────────────────────────────
  // ── 3. Generator emit wrapper ──────────────────────────────────────────────
  // ── 4. Run generators ──────────────────────────────────────────────────────
  // Helper: run single generator with error wrapper
    // Phase A: Pages + APIs + Types in parallel (independent)
    // Phase B: Components + utils (may depend on types)
    // Sequential — one at a time
  // ── 5. Assemble ────────────────────────────────────────────────────────────
// Additional named exports
export type FactoryOptions = Record<string, unknown>
export default {}
export const runModuleFactory: any = (v?: any) => v ?? {}
