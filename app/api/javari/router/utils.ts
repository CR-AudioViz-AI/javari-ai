import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { UserAuth, UsageLog, MODEL_COSTS } from "./types";

export const now = () => Date.now();

export const measure = async (fn: () => Promise<any>) => {
  const start = now();
  const output = await fn();
  return { output, duration: now() - start };
};

export const safe = async (fn: () => Promise<any>) => {
  try {
    return await fn();
  } catch (err: any) {
    return { error: err.message || "Unhandled routing error." };
  }
};

// Get Supabase client with user session
export async function getSupabaseUser(req: Request): Promise<UserAuth | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const cookieStore = cookies();
  const authCookie = cookieStore.get("sb-access-token");
  
  if (!authCookie) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authCookie.value}`
      }
    }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  // Get credit balance from user_accounts
  const { data: account, error: accountError } = await supabase
    .from("user_accounts")
    .select("credit_balance")
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    return null;
  }

  return {
    user_id: user.id,
    email: user.email || "",
    credit_balance: account.credit_balance || 0
  };
}

// Get user credit balance
export async function getUserCredits(user_id: string): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("user_accounts")
    .select("credit_balance")
    .eq("user_id", user_id)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.credit_balance || 0;
}

// Deduct credits using RPC
export async function deductCredits(
  user_id: string,
  amount: number
): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc("update_user_credit_balance", {
    p_user_id: user_id,
    p_amount: -amount
  });

  if (error) {
    throw new Error(`Credit deduction failed: ${error.message}`);
  }

  return data || 0;
}

// Log AI usage
export async function logUsage(
  user_id: string,
  details: UsageLog
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .insert({
      user_id,
      model: details.model,
      input_tokens: details.input_tokens,
      output_tokens: details.output_tokens,
      total_tokens: details.total_tokens,
      credit_cost: details.credit_cost,
      request_message: details.request_message,
      response_text: details.response_text,
      session_id: details.session_id
    })
    .select("id")
    .single();

  if (error) {
    console.error("Usage logging failed:", error);
    return null;
  }

  return data?.id || null;
}

// Compute model cost based on tokens
export function computeModelCost(model: string, tokens: number): number {
  const costPer1k = MODEL_COSTS[model as keyof typeof MODEL_COSTS] || 1.0;
  return Math.ceil((tokens / 1000) * costPer1k * 100) / 100; // Round to 2 decimals
}
