// app/api/webhooks/paypal/route.ts
// PayPal Webhook Handler for CR AudioViz AI
// Timestamp: 2025-12-02

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PRODUCT_CREDITS: Record<string, { credits: number; plan: string | null }> = {
  'P-STARTER': { credits: 100, plan: 'starter' },
  'P-PRO': { credits: 500, plan: 'pro' },
  'P-BUSINESS': { credits: 2000, plan: 'business' },
  'P-ENTERPRISE': { credits: 99999, plan: 'enterprise' },
  'CREDITS-10': { credits: 10, plan: null },
  'CREDITS-50': { credits: 50, plan: null },
  'CREDITS-200': { credits: 200, plan: null },
};

async function getAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

async function addCreditsToUser(userId: string, credits: number, plan: string | null, reference: string) {
  const { data: current } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();

  const newBalance = (current?.balance || 0) + credits;

  const updateData: any = { balance: newBalance, updated_at: new Date().toISOString() };
  if (plan) {
    updateData.plan = plan;
    updateData.plan_credits_monthly = credits;
  }

  await supabase.from('user_credits').update(updateData).eq('user_id', userId);

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: credits,
    description: plan ? `${plan.toUpperCase()} via PayPal` : `${credits} credits via PayPal`,
    balance_after: newBalance,
    build_id: reference,
  });

  console.log(`PayPal: Added ${credits} credits to ${userId}. Balance: ${newBalance}`);
}

async function handlePaymentCompleted(event: any) {
  console.log('Processing PAYMENT.CAPTURE.COMPLETED');
  const resource = event.resource;
  const customId = resource.custom_id;

  if (!customId) return;

  try {
    const { userId, productId, credits } = JSON.parse(customId);
    const config = PRODUCT_CREDITS[productId] || { credits, plan: null };
    await addCreditsToUser(userId, config.credits, config.plan, resource.id);
  } catch (error) {
    console.error('Error processing payment:', error);
  }
}

async function handleSubscriptionActivated(event: any) {
  console.log('Processing BILLING.SUBSCRIPTION.ACTIVATED');
  const resource = event.resource;
  const customId = resource.custom_id;

  if (!customId) return;

  try {
    const { userId, planId } = JSON.parse(customId);
    const config = PRODUCT_CREDITS[planId];

    if (config) {
      await addCreditsToUser(userId, config.credits, config.plan, resource.id);

      await supabase.from('subscriptions').insert({
        user_id: userId,
        paypal_subscription_id: resource.id,
        plan: config.plan,
        status: 'active',
        credits_monthly: config.credits,
        current_period_start: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error processing subscription:', error);
  }
}

async function handleSubscriptionPayment(event: any) {
  console.log('Processing PAYMENT.SALE.COMPLETED');
  const resource = event.resource;
  const subscriptionId = resource.billing_agreement_id;

  if (!subscriptionId) return;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id, plan, credits_monthly')
    .eq('paypal_subscription_id', subscriptionId)
    .single();

  if (subscription) {
    await addCreditsToUser(subscription.user_id, subscription.credits_monthly, null, resource.id);
  }
}

async function handleSubscriptionCancelled(event: any) {
  console.log('Processing BILLING.SUBSCRIPTION.CANCELLED');
  const resource = event.resource;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('paypal_subscription_id', resource.id)
    .single();

  if (subscription) {
    await supabase.from('user_credits')
      .update({ plan: 'free', plan_credits_monthly: 0 })
      .eq('user_id', subscription.user_id);

    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('paypal_subscription_id', resource.id);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event_type;

    console.log('PayPal webhook:', eventType);

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCompleted(body);
        break;
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(body);
        break;
      case 'PAYMENT.SALE.COMPLETED':
        await handleSubscriptionPayment(body);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionCancelled(body);
        break;
      default:
        console.log(`Unhandled: ${eventType}`);
    }

    await supabase.from('webhook_events').insert({
      stripe_event_id: `paypal_${body.id}`,
      event_type: eventType,
      processed: true,
      payload: body,
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'PayPal webhook ready' });
}
