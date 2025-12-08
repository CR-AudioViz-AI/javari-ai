// app/api/paypal/capture-order/route.ts
// PayPal Capture Order API for CR AudioViz AI
// Timestamp: 2025-12-08

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function addCreditsToUser(userId: string, credits: number, reference: string, productName: string) {
  // Get current balance
  const { data: current } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();

  const newBalance = (current?.balance || 0) + credits;

  // Update or insert user credits
  if (current) {
    await supabase
      .from('user_credits')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_credits')
      .insert({ user_id: userId, balance: newBalance });
  }

  // Log transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: credits,
    description: `${productName} via PayPal`,
    balance_after: newBalance,
    build_id: reference,
  });

  return newBalance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    // Capture the order
    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const capture = await response.json();

    if (!response.ok) {
      console.error('PayPal capture error:', capture);
      return NextResponse.json(
        { error: capture.message || 'Failed to capture payment', details: capture },
        { status: response.status }
      );
    }

    // Process successful payment
    if (capture.status === 'COMPLETED') {
      const purchaseUnit = capture.purchase_units?.[0];
      const customId = purchaseUnit?.payments?.captures?.[0]?.custom_id;

      if (customId) {
        try {
          const { userId, productId, credits } = JSON.parse(customId);
          const productName = purchaseUnit.description || `${credits} credits`;

          const newBalance = await addCreditsToUser(userId, credits, orderId, productName);

          // Store payment record
          await supabase.from('payments').insert({
            user_id: userId,
            provider: 'paypal',
            provider_payment_id: orderId,
            amount: parseFloat(purchaseUnit.amount?.value || '0'),
            currency: purchaseUnit.amount?.currency_code || 'USD',
            status: 'completed',
            credits_granted: credits,
            metadata: { capture, productId },
          });

          return NextResponse.json({
            success: true,
            status: capture.status,
            orderId: capture.id,
            credits: credits,
            newBalance: newBalance,
            payer: capture.payer?.email_address,
          });

        } catch (parseError) {
          console.error('Error parsing custom_id:', parseError);
        }
      }

      // Return success even if we couldn't parse custom_id (webhook will handle it)
      return NextResponse.json({
        success: true,
        status: capture.status,
        orderId: capture.id,
        message: 'Payment captured. Credits will be added shortly.',
      });
    }

    return NextResponse.json({
      success: false,
      status: capture.status,
      orderId: capture.id,
      message: 'Payment not completed',
    });

  } catch (error: any) {
    console.error('PayPal capture-order error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'PayPal Capture Order',
    usage: 'POST with { orderId: "PAYPAL_ORDER_ID" }',
  });
}
