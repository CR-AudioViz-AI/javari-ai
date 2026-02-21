// app/api/billing/portal/route.ts
// Javari Billing — Customer Portal Redirect
// 2026-02-20 — STEP 6 Productization
//
// GET /api/billing/portal
// → Redirects to Stripe Customer Portal (or /account/billing placeholder)

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  let userId: string | null = null;
  try {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* no session */ }

  if (!userId) {
    return Response.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL ?? "https://javariai.com"));
  }

  // TODO: create Stripe customer portal session and redirect
  // For now redirect to billing page
  return Response.redirect(
    new URL("/account/billing", process.env.NEXT_PUBLIC_APP_URL ?? "https://javariai.com")
  );
}
