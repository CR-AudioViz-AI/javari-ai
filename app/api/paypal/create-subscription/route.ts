// app/api/paypal/create-subscription/route.ts
// PayPal Create Subscription API for CR AudioViz AI
// Timestamp: 2025-12-08

import { NextRequest, NextResponse } from 'next/server';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Subscription plans - requires PayPal Plan IDs created in PayPal Dashboard
// These need to be created in PayPal and the IDs added here
const SUBSCRIPTION_PLANS: Record<string, { 
  name: string; 
  price: string; 
  credits: number; 
  planId: string | null;
  description: string;
}> = {
  'starter': { 
    name: 'Starter Plan', 
    price: '29.00', 
    credits: 100, 
    planId: process.env.PAYPAL_PLAN_STARTER || null,
    description: '100 AI credits/month + Basic features'
  },
  'pro': { 
    name: 'Pro Plan', 
    price: '49.00', 
    credits: 500, 
    planId: process.env.PAYPAL_PLAN_PRO || null,
    description: '500 AI credits/month + Priority support'
  },
  'business': { 
    name: 'Business Plan', 
    price: '199.00', 
    credits: 2000, 
    planId: process.env.PAYPAL_PLAN_BUSINESS || null,
    description: '2000 AI credits/month + Team features'
  },
  'enterprise': { 
    name: 'Enterprise Plan', 
    price: '499.00', 
    credits: 99999, 
    planId: process.env.PAYPAL_PLAN_ENTERPRISE || null,
    description: 'Unlimited credits + Custom integrations'
  },
};

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('PayPal auth failed');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planKey, userId, returnUrl, cancelUrl } = body;

    // Validate plan
    const plan = SUBSCRIPTION_PLANS[planKey];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan', validPlans: Object.keys(SUBSCRIPTION_PLANS) },
        { status: 400 }
      );
    }

    if (!plan.planId) {
      return NextResponse.json(
        { 
          error: 'PayPal subscription plan not configured',
          message: `Plan "${planKey}" requires PAYPAL_PLAN_${planKey.toUpperCase()} environment variable`,
          hint: 'Create subscription plans in PayPal Dashboard and add Plan IDs to environment variables'
        },
        { status: 501 }
      );
    }

    const accessToken = await getAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com';

    // Create subscription
    const subscriptionPayload = {
      plan_id: plan.planId,
      custom_id: JSON.stringify({ userId, planId: planKey, credits: plan.credits }),
      application_context: {
        brand_name: 'Javari AI',
        locale: 'en-US',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: returnUrl || `${appUrl}/subscription/success?provider=paypal`,
        cancel_url: cancelUrl || `${appUrl}/subscription/cancelled`,
      },
    };

    const response = await fetch(`${PAYPAL_API_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `sub-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify(subscriptionPayload),
    });

    const subscription = await response.json();

    if (!response.ok) {
      console.error('PayPal create subscription error:', subscription);
      return NextResponse.json(
        { error: subscription.message || 'Failed to create subscription', details: subscription },
        { status: response.status }
      );
    }

    // Find approval URL
    const approvalUrl = subscription.links?.find((link: any) => link.rel === 'approve')?.href;

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      approvalUrl,
      plan: {
        name: plan.name,
        price: `$${plan.price}/month`,
        credits: plan.credits,
        description: plan.description,
      },
    });

  } catch (error: any) {
    console.error('PayPal create-subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const plansStatus = Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
    key,
    name: plan.name,
    price: `$${plan.price}/month`,
    credits: plan.credits,
    configured: !!plan.planId,
  }));

  return NextResponse.json({
    status: 'ok',
    endpoint: 'PayPal Create Subscription',
    plans: plansStatus,
    note: 'Subscription plans require PayPal Plan IDs in environment variables',
  });
}
