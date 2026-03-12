// lib/javari/multi-ai/orchestrator.ts
// Javari Multi-AI Team Mode — Orchestration Engine
// 2026-02-20 — STEP 3 implementation
// Accepts a TaskGraph from the autonomous planner.
// Maps each task to the correct agent(s) via delegation rules.
// Executes per-role pipelines (architect/engineer/validator/bulk/json/signal).
// Merges multi-agent outputs via merge.ts.
// Streams orchestration events to caller.
// Integration: called by executeGraph() when multi_ai_team mode is active,
// or called directly from /api/autonomy when mode="multi_ai_team".
import { getProvider, getProviderApiKey } from "@/lib/javari/providers";
import { checkBudgetBeforeExecution, recordBudgetAfterExecution } from "@/lib/javari/telemetry/budget-governor";
import { isProviderAvailable, updateProviderHealth } from "@/lib/javari/telemetry/provider-health";
import { recordRouterExecution } from "@/lib/javari/telemetry/router-telemetry";
import {
import { mergeAgentOutputs, type AgentOutput } from "./merge";
import type { TaskNode, AutonomyEvent }         from "@/lib/javari/autonomy/types";
// Inline malformed-output guard (avoids duplicate validator.ts import in webpack)
// ── Orchestration event types (superset of AutonomyEvent types) ───────────────
// SSE EVENT MAP:
//   agent_start        → an agent has begun working on a task
//   agent_output       → streaming delta from an agent
//   agent_complete     → an agent finished (content + score)
//   agent_failed       → an agent failed (may fallback)
//   agent_fallback     → switching to fallback provider
//   validation_pass    → validator approved output
//   validation_fail    → validator flagged issues
//   validation_correct → validator rewrote output
//   merge_start        → merging agent outputs
//   merge_complete     → final merged output ready
//   conflict_detected  → architect/engineer disagreed
//   conflict_resolved  → conflict resolved, winner chosen
export type OrchestrationEventType =
export interface OrchestrationEvent {
export interface OrchestratorResult {
// ── Constants ─────────────────────────────────────────────────────────────────
// ── Prompt builders ───────────────────────────────────────────────────────────
// ── Single agent call (streaming → accumulated) ────────────────────────────────
  // ── Budget guard (pre-execution) ──────────────────────────────────────────
    // Non-fatal: budget system down → proceed
  // Try primary provider first, then fallback
    // ── Provider health guard ────────────────────────────────────────────────
      // Primary down → try fallback immediately
      // ── Post-execution: budget + health + telemetry (fire-and-forget) ──────
      // ── Record failure (fire-and-forget) ──────────────────────────────────
// ── Per-role pipelines ─────────────────────────────────────────────────────────
    // Parse score from JSON
    // Quick JSON validation
      // Strip fences and retry
  // signal_reader is optional — skip if xAI key unavailable
    // Graceful skip → delegate to architect instead
// ── orchestrateTask — public API ───────────────────────────────────────────────
  // Build TaskFlags from routing context
  // Determine agent assignment
  // ── Execute primary pipeline ─────────────────────────────────────────────
  // ── Execute support pipelines ────────────────────────────────────────────
    // Skip if primary already failed completely (but run validator regardless)
  // ── Conflict detection ────────────────────────────────────────────────────
    // Check similarity
  // ── Merge ──────────────────────────────────────────────────────────────────
  // Multi-agent when: high-risk, JSON+validation, reasoning+code, or explicitly set
export default {}
