// lib/javari/autonomy/executor.ts
// Javari Autonomous Engine — Execution Engine v3
// 2026-02-20 — STEP 3: Multi-AI Team Mode integration
// Changelog from v2 (STEP 2):
//   - Per-task decision: single-agent path OR multi-agent orchestration
//   - isMultiAgentMode() determines which path each task takes
//   - orchestrateTask() runs the full multi-agent pipeline for complex tasks
//   - OrchestrationEvents forwarded into AutonomyEvent stream (no SSE break)
//   - Agent identity logged per task (agentsUsed[] in task_done meta)
//   - All STEP 2 paths (retry, validator, memory, DB) preserved exactly
// Single-agent path:
//   callProvider() → validateResponse() → writeTaskMemory() → completeTask()
// Multi-agent path:
//   orchestrateTask() → mergeAgentOutputs() → writeTaskMemory() → completeTask()
// Both paths emit identical AutonomyEvent shapes to the SSE stream.
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { validateResponse, isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import { checkBudgetBeforeExecution, recordBudgetAfterExecution } from "@/lib/javari/telemetry/budget-governor";
import { isProviderAvailable, updateProviderHealth } from "@/lib/javari/telemetry/provider-health";
import { recordRouterExecution } from "@/lib/javari/telemetry/router-telemetry";
import {
import {
import { writeTaskMemory } from "./memory-writer";
import {
import type {
// ── Constants ─────────────────────────────────────────────────────────────────
// ── Helpers ───────────────────────────────────────────────────────────────────
// ── Forward orchestration events into autonomy event stream ───────────────────
// OrchestrationEvent → AutonomyEvent (agent_* events pass through as meta)
  // Map orchestration event types to AutonomyEvent meta payloads
  // agent_start/agent_output/agent_complete/merge_complete etc. live in meta
// ── Prompt builder ────────────────────────────────────────────────────────────
// ── Single-agent provider call ────────────────────────────────────────────────
  // ── Budget guard (pre-execution) ──────────────────────────────────────────
    // Non-fatal: budget system down → proceed with caution
    // ── Provider health guard ────────────────────────────────────────────────
      // ── Post-execution: budget + health + telemetry (fire-and-forget) ──────
      // ── Record failure (fire-and-forget) ──────────────────────────────────
// ── Execute a single task (with retries + multi-agent awareness) ───────────────
      // ── PATH DECISION: multi-agent OR single-agent ─────────────────────
        // ── MULTI-AGENT PATH ──────────────────────────────────────────────
        // Multi-agent path: no additional validator call (orchestrator already ran it)
        // ── SINGLE-AGENT PATH (STEP 2 logic, unchanged) ───────────────────
      // ── Write to memory (both paths) ───────────────────────────────────
      // ── DB: complete ────────────────────────────────────────────────────
  // All retries exhausted
// ── Main executor (unchanged from v2 — task loop is path-agnostic) ─────────────
export interface ExecutorResult {
export default {}
