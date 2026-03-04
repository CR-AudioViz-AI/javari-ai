import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});
const db = createAdminClient();
function mapStripePlanToTier(priceId: string): string {
  if (priceId.includes("pro")) return "pro";
  if (priceId.includes("enterprise")) return "enterprise";
  return "free";
}
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated") {
    const subscription = event.data.object as any;
    const userId = subscription.metadata.userId;
    const priceId = subscription.items.data[0].price.id;
    const tier = mapStripePlanToTier(priceId);
    await db.from("user_subscriptions").upsert({
      user_id: userId,
      provider: "stripe",
      provider_subscription_id: subscription.id,
      plan_tier: tier,
      status: subscription.status,
      current_period_end: subscription.current_period_end * 1000,
      created_at: Date.now(),
      updated_at: Date.now()
    });
  }
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as any;
    const userId = subscription.metadata.userId;
    await db.from("user_subscriptions")
      .update({ status: "canceled", updated_at: Date.now() })
      .eq("user_id", userId);
  }
  return NextResponse.json({ received: true });
}
