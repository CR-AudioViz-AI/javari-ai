// lib/orchestrator/modelRouter.ts
// Purpose: Routes task types to optimal model combinations. Deterministic:
//          same task_type + priority → same selection.
// Routing rules per spec: security_audit, code_repair, architecture_design,
//   documentation_generation, performance_optimization, + all existing types.
// Date: 2026-03-08 — added documentation_generation, performance_optimization,
//   fixed groq:qwen-2.5-coder-32b-instruct model ID
import {
export type TaskType =
export type RoutingPriority = "quality" | "cost" | "speed" | "balanced";
export interface ModelSelection {
export default {}
