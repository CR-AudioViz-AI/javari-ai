/**
 * PAYPAL WEBHOOK HANDLER
 * CR AudioViz AI - Henderson Standard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

async function verifyWebhookSignature(
  body: string,
  headers: Headers
): Promise<boolean> {
  try {
    // Get access token
    const authResponse = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const { access_token } = await authResponse.json();

    // Verify signature
    const verifyResponse = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_algo: headers.get('paypal-auth-algo'),
        cert_url: headers.get('paypal-cert-url'),
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        transmission_time: headers.get('paypal-transmission-time'),
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(body)
      })
    });

    const result = await verifyResponse.json();
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal verification error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify signature in production
    if (process.env.PAYPAL_MODE === 'live') {
      const isValid = await verifyWebhookSignature(body, request.headers);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(body);
    console.log(`Processing PayPal event: ${event.event_type}`);

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        await handlePaymentCompleted(event.resource);
        break;
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        await handleSubscriptionActivated(event.resource);
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED': {
        await handleSubscriptionCancelled(event.resource);
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        await handleRefund(event.resource);
        break;
      }
    }

    // Log webhook
    await supabase.from('webhook_logs').insert({
      provider: 'paypal',
      event_type: event.event_type,
      event_id: event.id,
      payload: event.resource,
      processed_at: new Date().toISOString()
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCompleted(resource: any) {
  const customRef = resource.custom_id || resource.invoice_id;
  
  // Parse user ID and credits from custom reference
  // Format: "user_xxx_credits_100"
  const match = customRef?.match(/user_(\w+)_credits_(\d+)/);
  if (match) {
    const userId = match[1];
    const credits = parseInt(match[2]);

    const { data: user } = await supabase
      .from('users')
      .select('id, credits_balance')
      .eq('id', userId)
      .single();

    if (user) {
      await supabase
        .from('users')
        .update({ credits_balance: user.credits_balance + credits })
        .eq('id', userId);

      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: credits,
        type: 'purchase',
        action: 'paypal_payment',
        balance_before: user.credits_balance,
        balance_after: user.credits_balance + credits
      });
    }
  }
}

async function handleSubscriptionActivated(resource: any) {
  const subscriberId = resource.subscriber?.payer_id;
  const planId = resource.plan_id;
  
  let tier = 'starter';
  if (planId?.includes('pro')) tier = 'pro';
  else if (planId?.includes('enterprise')) tier = 'enterprise';

  await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: 'active',
      paypal_subscription_id: resource.id
    })
    .eq('paypal_payer_id', subscriberId);
}

async function handleSubscriptionCancelled(resource: any) {
  await supabase
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled'
    })
    .eq('paypal_subscription_id', resource.id);
}

async function handleRefund(resource: any) {
  // Similar to Stripe refund handling
  const amount = parseFloat(resource.amount?.value || '0');
  const creditsToRemove = Math.floor(amount * 10);
  
  // Log for manual review
  await supabase.from('tickets').insert({
    type: 'billing',
    priority: 'medium',
    status: 'open',
    subject: 'PayPal Refund Processed',
    description: `Refund of $${amount} processed. Credits adjustment: ${creditsToRemove}`,
    auto_created: true
  });
}
