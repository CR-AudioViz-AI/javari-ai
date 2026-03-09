// app/api/credits/transactions/route.ts
// Javari AI — Credit Transactions History
// Purpose: Returns paginated credit transaction history for the user.
// Date: 2026-03-09

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 50);

  const admin = createAdminClient();
  const { data: transactions } = await admin
    .from("credit_transactions")
    .select("id, amount, transaction_type, app_id, description, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return Response.json({ transactions: transactions ?? [] });
}
