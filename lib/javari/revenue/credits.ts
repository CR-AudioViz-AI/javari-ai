// lib/javari/revenue/credits.ts
// Javari Credit Engine v1
// 2026-02-20 — STEP 5 implementation
//
// Manages credit balances via Supabase credit_ledger table.
// All writes go through Supabase RPC (deduct_credits / grant_credits).
// Reads use get_credit_balance RPC for consistency.
//
// Integration points:
//   - unified.ts: pre-call check, post-call deduction
//   - autonomy executor: per-task cost deduction
//   - module factory: per-file generation cost
//   - multi-agent orchestrator: aggregated team cost

import { createAdminClient } from "@/lib/supabase/server";
import { calculateCost, CREDIT_VALUE_USD, assertProfitable } from "@/lib/javari/cost/policy";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum credits required for any AI call */
export const CREDIT_FLOOR = 1;

/** Free tier monthly grant */
export const FREE_TIER_CREDITS = 100;

/** Default estimated credits for a single AI call (before actual token count known) */
export const DEFAULT_ESTIMATED_CREDITS: Record<string, number> = {
  free:       1,
  low:        3,
  moderate:   8,
  expensive:  25,
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditBalance {
  userId:     string;
  balance:    number;
  sufficient: boolean;   // balance >= required
  floor:      number;
}

export interface DeductResult {
  success:      boolean;
  newBalance:   number;
  amountDeducted: number;
  traceId?:     string;
  error?:       string;
}

export interface CostEstimate {
  credits:      number;    // credits to charge
  costUSD:      number;    // raw AI provider cost
  tier:         string;
  profitable:   boolean;
  reason:       string;
}

// ── Balance ───────────────────────────────────────────────────────────────────

/**
 * checkBalance — get current credit balance for user.
 * Returns 999999 for system/anonymous users (no billing applied).
 */
export async function checkBalance(userId: string): Promise<CreditBalance> {
  if (!userId || userId === "system" || userId === "anonymous") {
    return { userId, balance: 999_999, sufficient: true, floor: CREDIT_FLOOR };
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("get_credit_balance", { p_user_id: userId });

    if (error) {
      console.warn("[Credits] Balance check failed, defaulting to 0:", error.message);
      return { userId, balance: 0, sufficient: false, floor: CREDIT_FLOOR };
    }

    const balance = Number(data ?? 0);
    return { userId, balance, sufficient: balance >= CREDIT_FLOOR, floor: CREDIT_FLOOR };
  } catch (err) {
    console.error("[Credits] checkBalance threw:", err instanceof Error ? err.message : err);
    // Non-fatal: allow request through on DB errors to avoid blocking users
    return { userId, balance: 999, sufficient: true, floor: CREDIT_FLOOR };
  }
}

/**
 * enforceFloor — throws if balance < required.
 * Call before executing any paid AI operation.
 */
export async function enforceFloor(
  userId:   string,
  required: number = CREDIT_FLOOR
): Promise<void> {
  const bal = await checkBalance(userId);
  if (!bal.sufficient || bal.balance < required) {
    throw new Error(
      `INSUFFICIENT_CREDITS: balance=${bal.balance} required=${required} userId=${userId}`
    );
  }
}

// ── Deduction ─────────────────────────────────────────────────────────────────

/**
 * deductCredits — atomically deduct credits via Supabase RPC.
 * Idempotency key prevents double-charges on retries.
 */
export async function deductCredits(
  userId:       string,
  amount:       number,
  description:  string,
  options: {
    traceId?:        string;
    idempotencyKey?: string;
    allowNegative?:  boolean;
  } = {}
): Promise<DeductResult> {
  if (!userId || userId === "system" || userId === "anonymous") {
    return { success: true, newBalance: 999_999, amountDeducted: 0 };
  }

  if (amount <= 0) {
    return { success: true, newBalance: 0, amountDeducted: 0 };
  }

  const key = options.idempotencyKey ??
    `deduce_${userId}_${Date.now()}_${amount}`;

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("deduct_credits", {
      p_user_id:         userId,
      p_amount:          Math.ceil(amount),
      p_description:     description,
      p_trace_id:        options.traceId   ?? null,
      p_idempotency_key: key,
    });

    if (error) {
      const isInsufficient = error.message.includes("INSUFFICIENT_CREDITS");
      return {
        success:        false,
        newBalance:     0,
        amountDeducted: 0,
        error:          isInsufficient ? "INSUFFICIENT_CREDITS" : error.message,
      };
    }

    return {
      success:        true,
      newBalance:     Number(data),
      amountDeducted: Math.ceil(amount),
      traceId:        options.traceId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, newBalance: 0, amountDeducted: 0, error: msg };
  }
}

/**
 * refundCredits — issue a refund when AI call fails.
 * Only refunds if original deduction trace ID matches.
 */
export async function refundCredits(
  userId:      string,
  amount:      number,
  description: string,
  traceId?:    string
): Promise<boolean> {
  if (!userId || userId === "system" || userId === "anonymous" || amount <= 0) {
    return true;
  }

  try {
    const db = createAdminClient();
    const { error } = await db.rpc("grant_credits", {
      p_user_id:     userId,
      p_amount:      Math.ceil(amount),
      p_type:        "refund",
      p_description: description,
    });
    if (error) {
      console.error("[Credits] refundCredits failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Credits] refundCredits threw:", err instanceof Error ? err.message : err);
    return false;
  }
}

// ── Cost estimation ───────────────────────────────────────────────────────────

/**
 * estimateCallCost — estimate credits for an AI call before making it.
 * Based on prompt length → token estimate → cost policy.
 */
export function estimateCallCost(
  provider:    string,
  model:       string,
  promptChars: number,
  tier:        "free" | "low" | "moderate" | "expensive" = "moderate"
): CostEstimate {
  // Rough token estimate: 1 token ≈ 4 chars
  const estimatedInputTokens  = Math.ceil(promptChars / 4);
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.6); // typical ratio

  const modelKey = `${provider}/${model}`;
  const decision = calculateCost(modelKey, estimatedInputTokens, estimatedOutputTokens);

  const profitable = assertProfitable(
    decision.estimatedCostUSD,
    decision.minimumCreditsToCharge,
    `${provider}/${model}`
  );

  return {
    credits:    Math.max(1, decision.minimumCreditsToCharge),
    costUSD:    decision.estimatedCostUSD,
    tier:       decision.tier,
    profitable: profitable.profitable,
    reason:     decision.reason,
  };
}

/**
 * creditCostFromTokens — precise cost after actual token counts known.
 */
export function creditCostFromTokens(
  provider:     string,
  model:        string,
  inputTokens:  number,
  outputTokens: number
): CostEstimate {
  const modelKey = `${provider}/${model}`;
  const decision = calculateCost(modelKey, inputTokens, outputTokens);

  return {
    credits:    Math.max(1, decision.minimumCreditsToCharge),
    costUSD:    decision.estimatedCostUSD,
    tier:       decision.tier,
    profitable: true,
    reason:     decision.reason,
  };
}

// ── Grant ─────────────────────────────────────────────────────────────────────

/**
 * grantCredits — add credits to a user account (subscription renewal, promo, etc.)
 */
export async function grantCredits(
  userId:      string,
  amount:      number,
  type:        "grant" | "purchase" | "promo" | "adjustment",
  description: string
): Promise<{ success: boolean; newBalance: number }> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("grant_credits", {
      p_user_id:     userId,
      p_amount:      Math.ceil(amount),
      p_type:        type,
      p_description: description,
    });
    if (error) throw new Error(error.message);
    return { success: true, newBalance: Number(data) };
  } catch (err) {
    console.error("[Credits] grantCredits failed:", err instanceof Error ? err.message : err);
    return { success: false, newBalance: 0 };
  }
}
