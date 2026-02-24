// lib/paypal-client.ts
// CR AudioViz AI - PayPal Client for Javari
// Timestamp: 2025-12-02

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

const PRODUCT_CREDITS: Record<string, { credits: number; plan: string | null; type: string }> = {
  'P-STARTER': { credits: 100, plan: 'starter', type: 'subscription' },
  'P-PRO': { credits: 500, plan: 'pro', type: 'subscription' },
  'P-BUSINESS': { credits: 2000, plan: 'business', type: 'subscription' },
  'P-ENTERPRISE': { credits: 99999, plan: 'enterprise', type: 'subscription' },
  'CREDITS-10': { credits: 10, plan: null, type: 'credits' },
  'CREDITS-50': { credits: 50, plan: null, type: 'credits' },
  'CREDITS-200': { credits: 200, plan: null, type: 'credits' },
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

export async function createPayPalOrder(
  userId: string,
  productId: string,
  amountUSD: number,
  description: string
): Promise<{ orderId: string; approvalUrl: string }> {
  const accessToken = await getAccessToken();
  const config = PRODUCT_CREDITS[productId];

  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: userId,
        description: description,
        custom_id: JSON.stringify({ userId, productId, credits: config?.credits }),
        amount: { currency_code: 'USD', value: amountUSD.toFixed(2) },
      }],
      application_context: {
        brand_name: 'CR AudioViz AI',
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel`,
      },
    }),
  });

  const order = await response.json();
  const approvalUrl = order.links?.find((l: any) => l.rel === 'approve')?.href;

  await supabase.from('payment_transactions').insert({
    user_id: userId,
    amount_cents: Math.round(amountUSD * 100),
    payment_method: 'paypal',
    paypal_order_id: order.id,
    status: 'pending',
    description,
    metadata: { productId, credits: config?.credits },
  });

  return { orderId: order.id, approvalUrl };
}

export async function capturePayPalOrder(orderId: string): Promise<{
  success: boolean;
  captureId?: string;
  customData?: any;
  error?: string;
}> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const order = await response.json();

  if (order.status === 'COMPLETED') {
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    const customData = JSON.parse(order.purchase_units?.[0]?.custom_id || '{}');

    await supabase
      .from('payment_transactions')
      .update({ status: 'succeeded', paypal_capture_id: capture?.id })
      .eq('paypal_order_id', orderId);

    return { success: true, captureId: capture?.id, customData };
  }

  return { success: false, error: `Order status: ${order.status}` };
}

export async function addCreditsFromPayPal(
  userId: string,
  credits: number,
  plan: string | null,
  paypalOrderId: string
): Promise<void> {
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
    description: plan ? `${plan.toUpperCase()} subscription via PayPal` : `Purchased ${credits} credits via PayPal`,
    balance_after: newBalance,
    build_id: paypalOrderId,
  });

  console.log(`PayPal: Added ${credits} credits to user ${userId}`);
}

export default { createPayPalOrder, capturePayPalOrder, addCreditsFromPayPal };
