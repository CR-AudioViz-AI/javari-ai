import { createAdminClient } from "@/lib/supabase/server";
import { PlanTier } from "./plans";

const db = createAdminClient();

const MONTHLY_LIMITS: Record<PlanTier, number> = {
  free: 25,
  pro: 1000,
  enterprise: 999999
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

export async function enforceMonthlyLimit(
  userId: string,
  tier: PlanTier
) {
  const month = currentMonth();
  const limit = MONTHLY_LIMITS[tier];

  const { data } = await db
    .from("user_monthly_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  if (data && data.execution_count >= limit) {
    throw new Error("Monthly execution limit reached.");
  }
}

export async function recordUsage(
  userId: string,
  cost: number
) {
  const month = currentMonth();

  const { data } = await db
    .from("user_monthly_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  if (!data) {
    await db.from("user_monthly_usage").insert({
      user_id: userId,
      month,
      execution_count: 1,
      total_cost: cost,
      updated_at: Date.now()
    });
  } else {
    await db.from("user_monthly_usage")
      .update({
        execution_count: data.execution_count + 1,
        total_cost: Number(data.total_cost) + cost,
        updated_at: Date.now()
      })
      .eq("id", data.id);
  }
}
