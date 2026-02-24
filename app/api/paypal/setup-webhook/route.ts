// app/api/paypal/setup-webhook/route.ts
// Creates PayPal webhook programmatically
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
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('key');
    
    if (adminKey !== 'javari-setup-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await getAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com';

    // Create webhook
    const response = await fetch(`${PAYPAL_API_URL}/v1/notifications/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `${appUrl}/api/webhooks/paypal`,
        event_types: [
          { name: 'PAYMENT.CAPTURE.COMPLETED' },
          { name: 'PAYMENT.CAPTURE.DENIED' },
          { name: 'PAYMENT.CAPTURE.REFUNDED' },
          { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
          { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
          { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
          { name: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' },
          { name: 'PAYMENT.SALE.COMPLETED' },
        ],
      }),
    });

    const webhook = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Failed to create webhook', 
        details: webhook 
      }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      webhookId: webhook.id,
      url: webhook.url,
      events: webhook.event_types?.map((e: any) => e.name),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('key');
    
    if (adminKey !== 'javari-setup-2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await getAccessToken();

    // List existing webhooks
    const response = await fetch(`${PAYPAL_API_URL}/v1/notifications/webhooks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json({
      webhooks: data.webhooks?.map((w: any) => ({
        id: w.id,
        url: w.url,
        events: w.event_types?.map((e: any) => e.name),
      })) || [],
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
