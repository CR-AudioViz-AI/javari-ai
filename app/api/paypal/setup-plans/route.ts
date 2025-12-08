// app/api/paypal/setup-plans/route.ts
// PayPal Subscription Plans Setup - ONE TIME USE
// Timestamp: 2025-12-08

import { NextRequest, NextResponse } from 'next/server';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function createProduct(accessToken: string) {
  const response = await fetch(`${PAYPAL_API_URL}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `product-${Date.now()}`,
    },
    body: JSON.stringify({
      name: 'Javari AI Subscription',
      description: 'Monthly AI credits subscription for Javari AI platform',
      type: 'SERVICE',
      category: 'SOFTWARE',
    }),
  });

  const product = await response.json();
  if (!response.ok) {
    throw new Error(`Create product failed: ${JSON.stringify(product)}`);
  }
  return product;
}

async function createPlan(accessToken: string, productId: string, plan: {
  name: string;
  description: string;
  price: string;
  intervalCount?: number;
}) {
  const response = await fetch(`${PAYPAL_API_URL}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `plan-${plan.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    },
    body: JSON.stringify({
      product_id: productId,
      name: plan.name,
      description: plan.description,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: plan.intervalCount || 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite
          pricing_scheme: {
            fixed_price: {
              value: plan.price,
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    }),
  });

  const planData = await response.json();
  if (!response.ok) {
    throw new Error(`Create plan failed: ${JSON.stringify(planData)}`);
  }
  return planData;
}

export async function POST(request: NextRequest) {
  try {
    // Security: Check for admin secret
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('key');
    
    if (adminKey !== process.env.ADMIN_SECRET && adminKey !== 'javari-setup-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await getAccessToken();
    console.log('✅ Got PayPal access token');

    // Step 1: Create Product
    const product = await createProduct(accessToken);
    console.log('✅ Created product:', product.id);

    // Step 2: Create Plans
    const plans = [
      { name: 'Javari Starter', description: '100 AI credits per month + Basic features', price: '29.00', key: 'starter' },
      { name: 'Javari Pro', description: '500 AI credits per month + Priority support', price: '49.00', key: 'pro' },
      { name: 'Javari Business', description: '2000 AI credits per month + Team features', price: '199.00', key: 'business' },
      { name: 'Javari Enterprise', description: 'Unlimited AI credits + Custom integrations', price: '499.00', key: 'enterprise' },
    ];

    const createdPlans: Record<string, string> = {};

    for (const planConfig of plans) {
      const plan = await createPlan(accessToken, product.id, {
        name: planConfig.name,
        description: planConfig.description,
        price: planConfig.price,
      });
      createdPlans[planConfig.key] = plan.id;
      console.log(`✅ Created ${planConfig.key} plan:`, plan.id);
    }

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
      },
      plans: createdPlans,
      envVarsToAdd: {
        PAYPAL_PRODUCT_ID: product.id,
        PAYPAL_PLAN_STARTER: createdPlans.starter,
        PAYPAL_PLAN_PRO: createdPlans.pro,
        PAYPAL_PLAN_BUSINESS: createdPlans.business,
        PAYPAL_PLAN_ENTERPRISE: createdPlans.enterprise,
      },
      message: 'Add these environment variables to Vercel to enable subscriptions',
    });

  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: error.message || 'Setup failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'PayPal Subscription Setup',
    usage: 'POST /api/paypal/setup-plans?key=javari-setup-2025',
    warning: 'This creates PayPal products and plans. Run only once.',
  });
}
