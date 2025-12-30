/**
 * STRIPE WEBHOOK HANDLER
 * CR AudioViz AI - Henderson Standard
 * 
 * Handles all Stripe events:
 * - Successful payments → Add credits
 * - Subscription changes → Update tier
 * - Failed payments → Notify user
 * - Refunds → Adjust credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

// Credit packages
const CREDIT_PACKAGES: Record<string, number> = {
  'price_credits_100': 100,
  'price_credits_500': 500,
  'price_credits_1000': 1000,
  'price_credits_5000': 5000,
};

// Subscription tiers and their monthly credits
const SUBSCRIPTION_CREDITS: Record<string, number> = {
  // Henderson Bible v1.1 Pricing
  'free': 50,  // 50 credits (expire monthly)
  'starter': 500,  // $9/mo = 500 credits (never expire)
  'pro': 2000,  // $29/mo = 2,000 credits (never expire)
  'business': 10000,  // $99/mo = 10,000 credits (never expire)
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Log webhook event
    await supabase.from('webhook_logs').insert({
      provider: 'stripe',
      event_type: event.type,
      event_id: event.id,
      payload: event.data.object,
      processed_at: new Date().toISOString()
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const metadata = session.metadata || {};
  
  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('id, credits_balance')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Check if this was a credit purchase
  if (metadata.type === 'credits') {
    const credits = parseInt(metadata.credits || '0');
    if (credits > 0) {
      await supabase
        .from('users')
        .update({ credits_balance: user.credits_balance + credits })
        .eq('id', user.id);

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: credits,
        type: 'purchase',
        action: 'stripe_checkout',
        balance_before: user.credits_balance,
        balance_after: user.credits_balance + credits
      });
    }
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  
  // Determine tier from price
  let tier = 'free';
  if (priceId?.includes('starter')) tier = 'starter';
  else if (priceId?.includes('pro')) tier = 'pro';
  else if (priceId?.includes('enterprise')) tier = 'enterprise';

  await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      subscription_id: subscription.id,
      subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_customer_id', customerId);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  await supabase
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString()
    })
    .eq('stripe_customer_id', customerId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Add monthly credits for subscription
  const { data: user } = await supabase
    .from('users')
    .select('id, subscription_tier, credits_balance')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user && user.subscription_tier !== 'free') {
    const monthlyCredits = SUBSCRIPTION_CREDITS[user.subscription_tier] || 0;
    if (monthlyCredits > 0) {
      await supabase
        .from('users')
        .update({ credits_balance: user.credits_balance + monthlyCredits })
        .eq('id', user.id);

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: monthlyCredits,
        type: 'subscription',
        action: `monthly_${user.subscription_tier}`,
        balance_before: user.credits_balance,
        balance_after: user.credits_balance + monthlyCredits
      });
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  // Log failed payment and notify user
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    // Create support ticket
    await supabase.from('tickets').insert({
      user_id: user.id,
      type: 'billing',
      priority: 'high',
      status: 'open',
      subject: 'Payment Failed',
      description: `Payment failed for invoice ${invoice.id}. Amount: $${(invoice.amount_due / 100).toFixed(2)}`,
      auto_created: true
    });
  }
}

async function handleRefund(charge: Stripe.Charge) {
  const customerId = charge.customer as string;
  const refundAmount = charge.amount_refunded / 100;
  
  // Calculate credits to remove (approximate)
  const creditsToRemove = Math.floor(refundAmount * 10); // $1 = 10 credits
  
  const { data: user } = await supabase
    .from('users')
    .select('id, credits_balance')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user && creditsToRemove > 0) {
    const newBalance = Math.max(0, user.credits_balance - creditsToRemove);
    
    await supabase
      .from('users')
      .update({ credits_balance: newBalance })
      .eq('id', user.id);

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: -creditsToRemove,
      type: 'refund_adjustment',
      action: 'stripe_refund',
      balance_before: user.credits_balance,
      balance_after: newBalance
    });
  }
}
