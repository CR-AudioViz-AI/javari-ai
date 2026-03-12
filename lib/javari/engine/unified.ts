// lib/javari/engine/unified.ts
// Javari Unified AI Engine — v11
// 2026-02-21 — STEP 10: enterprise org/team routing, region-aware fallback, audit events
// Changelog from v5 (STEP 1):
//   - New mode: "multi_ai_team" — orchestrates multiple specialist agents
//   - orchestrateTask() called when mode=multi_ai_team or prompt is complex
//   - Agent assignment via determineAgentForTask() delegation rules
//   - OrchestrationEvents logged to console + passed through in routingMeta
//   - All v5 paths (single-agent, validator, memory) preserved exactly
//   - Zero regressions to STEP 0/1/2
import { normalizeEnvelope }                from "@/lib/normalize-envelope";
import { routeRequest, buildFallbackChain } from "@/lib/javari/multi-ai/router";
import { analyzeRoutingContext }             from "@/lib/javari/multi-ai/routing-context";
import { validateResponse, isOutputMalformed } from "@/lib/javari/multi-ai/validator";
import { getProvider, getProviderApiKey }   from "@/lib/javari/providers";
import { JAVARI_SYSTEM_PROMPT }             from "./systemPrompt";
import { retrieveRelevantMemory }           from "@/lib/javari/memory/retrieval";
import {
import { determineAgentForTask }            from "@/lib/javari/multi-ai/roles";
import type { Message }                     from "@/lib/types";
import type { RoutingContext as LegacyRoutingContext } from "@/lib/javari/multi-ai/router";
import { runModuleFactory } from "@/lib/javari/factory/module-factory";
import { enforceEntitlement, type Feature } from "@/lib/javari/revenue/entitlements";
import { checkBalance, deductCredits, estimateCallCost } from "@/lib/javari/revenue/credits";
import { logUsageEvent, logAIModelCost } from "@/lib/javari/revenue/metering";
import { routingLog, autonomyLog }           from "@/lib/observability/logger";
import { recordLatency, recordError, recordModelCost } from "@/lib/observability/metrics";
import { isCanaryEnabled, recordCanaryOutcome } from "@/lib/canary/feature-canary";
import { track }                             from "@/lib/analytics/track";
import { writeAuditEvent }                   from "@/lib/enterprise/audit";
import { getTeamConfig, resolveTeamFromWorkspace } from "@/lib/enterprise/ai-teams";
import type { TeamType }                     from "@/lib/enterprise/ai-teams";
// ── Region-aware routing ───────────────────────────────────────────────────────
// Maps deployment region (Vercel VERCEL_REGION env) to provider preference.
// ── Constants (unchanged from v5) ─────────────────────────────────────────────
// ── Helpers (unchanged) ───────────────────────────────────────────────────────
// ── Provider chain builder (unchanged from v5) ─────────────────────────────────
// ── Build a synthetic TaskNode for multi_ai_team mode ─────────────────────────
// (Allows orchestrateTask() to work without a full task graph)
// ── Multi-AI Team execution ───────────────────────────────────────────────────
    // @ts-expect-error extended metadata
// ── Main engine ───────────────────────────────────────────────────────────────
  // ── v11 STEP 10: Region + enterprise team routing ──────────────────────────
  // Team-level system prompt suffix (injected later)
  // Team preferred providers override region order (enterprise only)
  // ── Determine mode ─────────────────────────────────────────────────────────
  // ── STEP 1: Routing context analysis ──────────────────────────────────────
  // ── STEP 5: Entitlement + balance guard ────────────────────────────────────
      // Feature gate: pick narrowest feature for this mode
      // Balance gate
      // Non-entitlement errors: log and continue (fail open)
  // ── STEP 6: Cost preview mode (estimate only, no execution) ─────────────
        // @ts-expect-error extended metadata
  // ── STEP 4: module_factory mode ────────────────────────────────────────────
    // Parse "module: <name> | <description>" or fall back to userPrompt as description
          // @ts-expect-error extended metadata
    // Fallback to single-agent if factory fails
  // ── STEP 3: Determine if multi_ai_team mode should activate ───────────────
    // ── MULTI-AI TEAM PATH ─────────────────────────────────────────────────
    // Memory retrieval still applies (injected into system prompt context)
  // ── SINGLE-AGENT PATH (identical to v5) ────────────────────────────────────
    // STEP 7: Record outage metrics + analytics
  // ── STEP 7: Record latency + canary outcome ─────────────────────────────────
  // ── STEP 5: Post-call billing deduction + metering ────────────────────────
      // Non-blocking: fire-and-forget deduction to not delay response
  // ── STEP 6: Annotate response with entitlement + cost metadata for UI ──
  // v11: Enterprise audit event (fire-and-forget, only for org users)
    // @ts-expect-error extended metadata
export default {}
