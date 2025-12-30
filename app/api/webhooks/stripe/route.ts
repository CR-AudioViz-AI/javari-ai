// app/api/webhooks/stripe/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK HANDLER WITH EMAIL TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:37 PM EST
// Handles all Stripe events and sends appropriate emails
// ═══════════════════════════════════════════════════════════════════════════════

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com';

// Plan configuration
const PLANS: Record<string, { name: string; credits: number }> = {
  'price_starter_monthly': { name: 'Starter', credits: 500 },
  'price_starter_yearly': { name: 'Starter', credits: 500 },
  'price_pro_monthly': { name: 'Pro', credits: 2000 },
  'price_pro_yearly': { name: 'Pro', credits: 2000 },
  'price_business_monthly': { name: 'Business', credits: 10000 },
  'price_business_yearly': { name: 'Business', credits: 10000 },
};

// Credit packages
const CREDIT_PACKS: Record<number, { name: string; credits: number }> = {
  500: { name: 'Basic Pack', credits: 100 },
  2000: { name: 'Plus Pack', credits: 550 },
  3500: { name: 'Pro Pack', credits: 1150 },
  15000: { name: 'Business Pack', credits: 6000 },
  25000: { name: 'Enterprise Pack', credits: 12500 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`Processing Stripe event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT COMPLETED - New subscription or one-time purchase
// ═══════════════════════════════════════════════════════════════════════════════
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const customerEmail = session.customer_email || session.customer_details?.email;

  if (!customerEmail) {
    console.error('No customer email in checkout session');
    return;
  }

  // Get or create user
  let userId = session.metadata?.user_id;
  
  if (!userId) {
    // Find user by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', customerEmail)
      .single();
    
    userId = user?.id;
  }

  // Handle one-time credit purchase
  if (session.mode === 'payment') {
    const amount = session.amount_total || 0;
    const pack = CREDIT_PACKS[amount];
    
    if (pack && userId) {
      // Add credits
      await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: pack.credits,
        p_type: 'purchase',
        p_description: `Purchased ${pack.name}`
      });

      // Send purchase receipt email
      await sendEmail('purchase_receipt', customerEmail, {
        name: customerEmail.split('@')[0],
        planName: pack.name,
        amount: (amount / 100).toFixed(2),
        credits: pack.credits.toLocaleString(),
        transactionId: session.id,
        date: new Date().toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
      });
    }
  }

  // Update user's Stripe customer ID
  if (userId) {
    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION UPDATE - New or changed subscription
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price?.id;
  
  // Get user by customer ID
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Determine plan from price ID
  const plan = PLANS[priceId] || { name: 'Starter', credits: 500 };
  const tierKey = plan.name.toLowerCase() as 'starter' | 'pro' | 'business';

  // Update user subscription
  await supabase
    .from('users')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_tier: tierKey,
      subscription_status: subscription.status
    })
    .eq('id', user.id);

  // Add monthly credits if subscription just started or renewed
  if (subscription.status === 'active') {
    await supabase.rpc('add_credits', {
      p_user_id: user.id,
      p_amount: plan.credits,
      p_type: 'subscription',
      p_description: `${plan.name} monthly credits`
    });

    // Update credits table
    await supabase
      .from('user_credits')
      .upsert({
        user_id: user.id,
        subscription_tier: tierKey,
        monthly_credits: plan.credits,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    // Send subscription confirmation email
    const nextBilling = new Date(subscription.current_period_end * 1000);
    const amount = (subscription.items.data[0]?.price?.unit_amount || 0) / 100;

    await sendEmail('subscription_confirmed', user.email, {
      name: user.email.split('@')[0],
      planName: plan.name,
      monthlyCredits: plan.credits.toLocaleString(),
      nextBillingDate: nextBilling.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      }),
      amount: `$${amount.toFixed(2)}`
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION DELETED - Cancelled or expired
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Get current credit balance
  const { data: credits } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', user.id)
    .single();

  // Downgrade to free tier
  await supabase
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null
    })
    .eq('id', user.id);

  await supabase
    .from('user_credits')
    .update({
      subscription_tier: 'free',
      monthly_credits: 50,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  // Send cancellation email
  await sendEmail('subscription_cancelled', user.email, {
    name: user.email.split('@')[0],
    planName: 'Your Plan',
    endDate: new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    }),
    remainingCredits: credits?.balance?.toLocaleString() || '0'
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE PAID - Recurring payment succeeded
// ═══════════════════════════════════════════════════════════════════════════════
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Skip if not a subscription invoice
  if (!invoice.subscription) return;

  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id, email, subscription_tier')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Get plan credits
  const tierCredits: Record<string, number> = {
    starter: 500,
    pro: 2000,
    business: 10000
  };

  const credits = tierCredits[user.subscription_tier] || 500;
  const tierName = user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1);

  // Add monthly credits
  await supabase.rpc('add_credits', {
    p_user_id: user.id,
    p_amount: credits,
    p_type: 'subscription_renewal',
    p_description: `${tierName} monthly credits renewal`
  });

  // Send receipt email
  await sendEmail('purchase_receipt', user.email, {
    name: user.email.split('@')[0],
    planName: `${tierName} Plan (Monthly Renewal)`,
    amount: ((invoice.amount_paid || 0) / 100).toFixed(2),
    credits: credits.toLocaleString(),
    transactionId: invoice.id,
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT FAILED - Recurring payment failed
// ═══════════════════════════════════════════════════════════════════════════════
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Update subscription status
  await supabase
    .from('users')
    .update({ subscription_status: 'past_due' })
    .eq('id', user.id);

  // Send payment failed email
  await sendEmail('payment_failed', user.email, {
    name: user.email.split('@')[0],
    amount: ((invoice.amount_due || 0) / 100).toFixed(2),
    retryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric'
    })
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Send email via our email API
// ═══════════════════════════════════════════════════════════════════════════════
async function sendEmail(type: string, to: string, data: Record<string, string | number>) {
  try {
    const res = await fetch(`${APP_URL}/api/notifications/user-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, to, data })
    });
    
    if (!res.ok) {
      console.error(`Failed to send ${type} email to ${to}`);
    } else {
      console.log(`Sent ${type} email to ${to}`);
    }
  } catch (error) {
    console.error(`Email error (${type}):`, error);
  }
}
