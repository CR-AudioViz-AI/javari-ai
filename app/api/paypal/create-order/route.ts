// app/api/paypal/create-order/route.ts
// PayPal Create Order API for CR AudioViz AI
// Timestamp: 2025-12-08

import { NextRequest, NextResponse } from 'next/server';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Product catalog matching Stripe prices
const PRODUCTS: Record<string, { name: string; price: string; credits: number; type: 'one_time' | 'subscription' }> = {
  // Credit Packs (one-time)
  'credits-10': { name: '10 AI Credits', price: '15.00', credits: 10, type: 'one_time' },
  'credits-50': { name: '50 AI Credits', price: '60.00', credits: 50, type: 'one_time' },
  'credits-100': { name: '100 AI Credits', price: '10.00', credits: 100, type: 'one_time' },
  'credits-200': { name: '200 AI Credits', price: '200.00', credits: 200, type: 'one_time' },
  'credits-500': { name: '500 AI Credits', price: '40.00', credits: 500, type: 'one_time' },
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
    const error = await response.text();
    throw new Error(`PayPal auth failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, userId, returnUrl, cancelUrl } = body;

    // Validate product
    const product = PRODUCTS[productId];
    if (!product) {
      return NextResponse.json(
        { error: 'Invalid product ID', validProducts: Object.keys(PRODUCTS) },
        { status: 400 }
      );
    }

    if (product.type === 'subscription') {
      return NextResponse.json(
        { error: 'Use /api/paypal/create-subscription for subscription products' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com';

    // Create PayPal order
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: productId,
        description: product.name,
        custom_id: JSON.stringify({ userId, productId, credits: product.credits }),
        amount: {
          currency_code: 'USD',
          value: product.price,
        },
      }],
      application_context: {
        brand_name: 'Javari AI',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: returnUrl || `${appUrl}/payment/success?provider=paypal`,
        cancel_url: cancelUrl || `${appUrl}/payment/cancelled`,
      },
    };

    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `order-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('PayPal create order error:', order);
      return NextResponse.json(
        { error: order.message || 'Failed to create PayPal order', details: order },
        { status: response.status }
      );
    }

    // Find approval URL
    const approvalUrl = order.links?.find((link: any) => link.rel === 'approve')?.href;

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      approvalUrl,
      product: {
        name: product.name,
        price: product.price,
        credits: product.credits,
      },
    });

  } catch (error: any) {
    console.error('PayPal create-order error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'PayPal Create Order',
    products: Object.entries(PRODUCTS).map(([id, p]) => ({
      id,
      name: p.name,
      price: `$${p.price}`,
      credits: p.credits,
    })),
  });
}
