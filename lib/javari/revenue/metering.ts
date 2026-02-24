// lib/javari/revenue/metering.ts
// Javari Usage Metering Engine
// 2026-02-20 — STEP 5 implementation
//
// Logs every Javari feature invocation and every AI model call.
// Builds Stripe-ready usage summaries for billing.
// All writes are non-blocking (fire-and-forget with error capture).

import { createAdminClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UsageEventType =
  | "chat"
  | "autonomy_goal"
  | "multi_ai_team"
  | "module_factory"
  | "factory_file"
  | "api_call"
  | "memory_write"
  | "heartbeat"
  | "billing_check";

export interface UsageEventPayload {
  userId:       string;
  eventType:    UsageEventType;
  feature:      string;
  creditsUsed:  number;
  success:      boolean;
  sessionId?:   string;
  goalId?:      string;
  moduleId?:    string;
  durationMs?:  number;
  errorCode?:   string;
  metadata?:    Record<string, unknown>;
}

export interface AICostPayload {
  userId?:          string;
  usageEventId?:    string;
  provider:         string;
  model:            string;
  inputTokens:      number;
  outputTokens:     number;
  costUsd:          number;
  creditsCharged:   number;
  tier:             string;
  marginMultiplier: number;
  goalId?:          string;
  moduleId?:        string;
  agentRole?:       string;
  latencyMs?:       number;
  success:          boolean;
  errorMsg?:        string;
  traceId?:         string;
  metadata?:        Record<string, unknown>;
}

export interface DailyUsageSummary {
  date:        string;
  totalEvents: number;
  totalCredits: number;
  byFeature:   Record<string, { count: number; credits: number }>;
  byProvider:  Record<string, { calls: number; costUsd: number; tokens: number }>;
  successRate: number;
}

export interface StripeUsageSummary {
  userId:        string;
  periodStart:   string;
  periodEnd:     string;
  totalCredits:  number;
  totalCostUsd:  number;
  lineItems: Array<{
    feature:     string;
    quantity:    number;
    unitAmount:  number;     // credits
    description: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowIso(): string { return new Date().toISOString(); }

function generateTraceId(): string {
  return `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Non-blocking fire-and-forget with error capture
async function fireAndForget(label: string, fn: () => Promise<void>): Promise<void> {
  fn().catch((err) => {
    console.warn(`[Metering] ${label} failed (non-fatal):`,
      err instanceof Error ? err.message : err
    );
  });
}

// ── Usage event logging ───────────────────────────────────────────────────────

/**
 * logUsageEvent — record a feature invocation.
 * Non-blocking: does not delay the AI response.
 * Returns a traceId for linking to ai_cost_events.
 */
export function logUsageEvent(payload: UsageEventPayload): string {
  const traceId = generateTraceId();

  if (!payload.userId || payload.userId === "system" || payload.userId === "anonymous") {
    return traceId; // skip DB write for system/anon
  }

  fireAndForget("logUsageEvent", async () => {
    const db = createAdminClient();
    const { error } = await db.from("usage_events").insert({
      user_id:      payload.userId,
      event_type:   payload.eventType,
      feature:      payload.feature,
      session_id:   payload.sessionId ?? null,
      goal_id:      payload.goalId    ?? null,
      module_id:    payload.moduleId  ?? null,
      credits_used: payload.creditsUsed,
      duration_ms:  payload.durationMs  ?? null,
      success:      payload.success,
      error_code:   payload.errorCode   ?? null,
      metadata:     { ...payload.metadata, traceId },
    });
    if (error) {
      console.warn("[Metering] usage_events insert:", error.message);
    }
  });

  return traceId;
}

/**
 * logAIModelCost — record an individual AI model call.
 * Non-blocking. Call after the model responds (actual token counts known).
 */
export function logAIModelCost(payload: AICostPayload): void {
  fireAndForget("logAIModelCost", async () => {
    const db = createAdminClient();
    const { error } = await db.from("ai_cost_events").insert({
      user_id:           payload.userId         ?? null,
      usage_event_id:    payload.usageEventId   ?? null,
      provider:          payload.provider,
      model:             payload.model,
      input_tokens:      payload.inputTokens,
      output_tokens:     payload.outputTokens,
      cost_usd:          payload.costUsd,
      credits_charged:   payload.creditsCharged,
      tier:              payload.tier,
      margin_multiplier: payload.marginMultiplier,
      goal_id:           payload.goalId    ?? null,
      module_id:         payload.moduleId  ?? null,
      agent_role:        payload.agentRole ?? null,
      latency_ms:        payload.latencyMs ?? null,
      success:           payload.success,
      error_msg:         payload.errorMsg  ?? null,
      trace_id:          payload.traceId   ?? null,
      metadata:          payload.metadata  ?? {},
    });
    if (error) {
      console.warn("[Metering] ai_cost_events insert:", error.message);
    }
  });
}

// ── Daily aggregation ─────────────────────────────────────────────────────────

/**
 * aggregateUsageDaily — compute daily usage summary for a user.
 * Used by billing API and Stripe metering.
 */
export async function aggregateUsageDaily(
  userId: string,
  date:   string   // YYYY-MM-DD
): Promise<DailyUsageSummary> {
  const startOf = `${date}T00:00:00Z`;
  const endOf   = `${date}T23:59:59Z`;

  const db = createAdminClient();

  // Usage events
  const { data: usageRows = [] } = await db
    .from("usage_events")
    .select("event_type, feature, credits_used, success")
    .eq("user_id", userId)
    .gte("created_at", startOf)
    .lte("created_at", endOf);

  // AI cost events
  const { data: costRows = [] } = await db
    .from("ai_cost_events")
    .select("provider, model, input_tokens, output_tokens, cost_usd")
    .eq("user_id", userId)
    .gte("created_at", startOf)
    .lte("created_at", endOf);

  const byFeature: Record<string, { count: number; credits: number }> = {};
  let totalCredits = 0;
  let successCount = 0;

  for (const row of usageRows as Array<{
    event_type: string; feature: string;
    credits_used: number; success: boolean
  }>) {
    const key = row.feature ?? row.event_type;
    if (!byFeature[key]) byFeature[key] = { count: 0, credits: 0 };
    byFeature[key].count++;
    byFeature[key].credits += row.credits_used ?? 0;
    totalCredits += row.credits_used ?? 0;
    if (row.success) successCount++;
  }

  const byProvider: Record<string, { calls: number; costUsd: number; tokens: number }> = {};
  for (const row of costRows as Array<{
    provider: string; model: string;
    input_tokens: number; output_tokens: number; cost_usd: number
  }>) {
    const key = `${row.provider}/${row.model}`;
    if (!byProvider[key]) byProvider[key] = { calls: 0, costUsd: 0, tokens: 0 };
    byProvider[key].calls++;
    byProvider[key].costUsd += Number(row.cost_usd ?? 0);
    byProvider[key].tokens  += (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
  }

  return {
    date,
    totalEvents:  usageRows.length,
    totalCredits,
    byFeature,
    byProvider,
    successRate:  usageRows.length > 0
      ? Math.round((successCount / usageRows.length) * 100)
      : 100,
  };
}

/**
 * buildStripeUsageSummary — Stripe-ready metered billing summary.
 * Input: billing period start/end ISO strings.
 */
export async function buildStripeUsageSummary(
  userId:      string,
  periodStart: string,
  periodEnd:   string
): Promise<StripeUsageSummary> {
  const db = createAdminClient();

  // Get aggregate credits by feature
  const { data: usageRows = [] } = await db
    .from("usage_events")
    .select("feature, credits_used")
    .eq("user_id", userId)
    .gte("created_at", periodStart)
    .lte("created_at", periodEnd);

  // Get total cost
  const { data: costRows = [] } = await db
    .from("ai_cost_events")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", periodStart)
    .lte("created_at", periodEnd);

  const byFeature: Record<string, { count: number; credits: number }> = {};
  let totalCredits = 0;

  for (const row of usageRows as Array<{ feature: string; credits_used: number }>) {
    if (!byFeature[row.feature]) byFeature[row.feature] = { count: 0, credits: 0 };
    byFeature[row.feature].count++;
    byFeature[row.feature].credits += row.credits_used ?? 0;
    totalCredits += row.credits_used ?? 0;
  }

  const totalCostUsd = (costRows as Array<{ cost_usd: number }>)
    .reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  const lineItems = Object.entries(byFeature).map(([feature, { count, credits }]) => ({
    feature,
    quantity:    count,
    unitAmount:  credits > 0 ? Math.ceil(credits / count) : 1,
    description: `${feature}: ${count} calls × ${Math.ceil(credits / Math.max(count, 1))} credits`,
  }));

  return { userId, periodStart, periodEnd, totalCredits, totalCostUsd, lineItems };
}
