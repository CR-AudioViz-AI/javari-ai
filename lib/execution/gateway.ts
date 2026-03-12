// lib/execution/gateway.ts
// Purpose: Execution gateway with tiered cost limits for system vs user execution
// Date: 2026-03-06
import { enforceRoadmapBudget } from "@/lib/billing/enforcement";
import { executeWithRouting } from "@/lib/router/executeWithRouting";
import {
import { classifyCapability } from "@/lib/router/capability-classifier";
import { enforceRequestCost } from "@/lib/billing/profit-guard";
import { enforceMonthlyLimit, recordUsage } from "@/lib/billing/usage-meter";
import { enforceModeEntitlement } from "@/lib/billing/entitlements";
import { getUserPlan } from "@/lib/billing/subscription-service";
import { PlanTier } from "@/lib/billing/plans";
import { logTelemetry } from "@/lib/telemetry/telemetry";
export type ExecutionMode = "auto" | "multi";
// Tier system: system tier for autonomous roadmap execution, user tiers for human requests
export type ExecutionTier = "system" | "pro" | "free";
export interface ExecutionRequest {
export interface TaskSchema {
export interface RoleTaskResponse {
  // System-tier autonomous tasks skip user entitlement and monthly limit checks
    // Henderson Standard routing:
    // System-tier autonomous tasks → builder model (cheapest capable)
    // User requests with explicit quality requirement → validator model
    // Default user requests → auto-classify
      // Autonomous roadmap execution — cost-optimize with builder model
      // Human-initiated request — auto-classify for quality
    // 40s timeout: leaves 20s buffer before Vercel's 60s serverless hard limit.
    // Tasks that exceed this are retried — they won't be killed mid-write by Vercel.
export default {}
