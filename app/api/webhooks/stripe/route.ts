import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// Initialize Supabase with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Credit amounts for one-time purchases
const CREDIT_AMOUNTS: Record<string, number> = {
  'price_1SZxfq7YeQ1dZTUvuspvv7io': 10,    // 10 Credit Pack
  'price_1SZxg37YeQ1dZTUv5L4OQlei': 50,    // 50 Credit Pack
  'price_1SZxgE7YeQ1dZTUvLC8r8X8u': 200,   // 200 Credit Pack
  'price_1SLZoF7YeQ1dZTUvp4n7ZlMt': 100,   // JavariAI 100 credits
  'price_1SLZoM7YeQ1dZTUvMmg4fx91': 500,   // JavariAI 500 credits
};

// Subscription tier mapping
const SUBSCRIPTION_TIERS: Record<string, string> = {
  'price_1SZxfD7YeQ1dZTUvujSxg2DV': 'starter',
  'price_1SZxfM7YeQ1dZTUv3jK4awd0': 'pro',
  'price_1SZxfU7YeQ1dZTUvN07nxBW1': 'business',
  'price_1SZxfd7YeQ1dZTUv8IEjsDh5': 'enterprise',
  'price_1SLZoA7YeQ1dZTUvTGlVh51G': 'basic',
};

// Monthly credits per subscription tier
const TIER_CREDITS: Record<string, number> = {
  'starter': 100,
  'pro': 500,
  'business': 2000,
  'enterprise': 10000,
  'basic': 100,
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('Missing Stripe signature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[Stripe Webhook] Event received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  console.log('[Stripe] Checkout completed:', session.id);

  const customerEmail = session.customer_details?.email;
  const customerId = session.customer as string;
  const userId = session.metadata?.userId;

  if (!customerEmail && !userId) {
    console.error('[Stripe] No customer email or userId found');
    return;
  }

  // Find or create user
  let user;
  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    user = data;
  } else if (customerEmail) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', customerEmail)
      .single();
    user = data;
  }

  // Update user with Stripe customer ID
  if (user && customerId) {
    await supabase
      .from('users')
      .update({ 
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
  }

  // Handle one-time payment (credit purchase)
  if (session.mode === 'payment') {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    
    for (const item of lineItems.data) {
      const priceId = item.price?.id;
      if (priceId && CREDIT_AMOUNTS[priceId]) {
        const credits = CREDIT_AMOUNTS[priceId];
        await addCreditsToUser(user?.id || userId, credits, 'purchase', session.id);
        console.log(`[Stripe] Added ${credits} credits for user ${user?.id || userId}`);
      }
    }
  }

  // Log the transaction
  await logTransaction({
    user_id: user?.id || userId,
    stripe_session_id: session.id,
    stripe_customer_id: customerId,
    amount: session.amount_total || 0,
    currency: session.currency || 'usd',
    status: 'completed',
    type: session.mode === 'subscription' ? 'subscription' : 'one_time',
    metadata: session.metadata,
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log('[Stripe] Subscription updated:', subscription.id);

  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const tier = SUBSCRIPTION_TIERS[priceId] || 'free';

  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error('[Stripe] User not found for customer:', customerId);
    return;
  }

  // Update user subscription
  await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // Grant monthly credits for new/renewed subscription
  if (subscription.status === 'active' && TIER_CREDITS[tier]) {
    await addCreditsToUser(user.id, TIER_CREDITS[tier], 'subscription', subscription.id);
    console.log(`[Stripe] Granted ${TIER_CREDITS[tier]} monthly credits for ${tier} tier`);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log('[Stripe] Subscription canceled:', subscription.id);

  const customerId = subscription.customer as string;

  // Find and update user
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    await supabase
      .from('users')
      .update({
        subscription_tier: 'free',
        subscription_status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('[Stripe] Invoice paid:', invoice.id);

  // For recurring subscription payments, grant monthly credits
  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const priceId = subscription.items.data[0]?.price.id;
    const tier = SUBSCRIPTION_TIERS[priceId];

    if (tier && TIER_CREDITS[tier]) {
      const customerId = invoice.customer as string;
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (user) {
        await addCreditsToUser(user.id, TIER_CREDITS[tier], 'subscription_renewal', invoice.id);
        console.log(`[Stripe] Renewed ${TIER_CREDITS[tier]} credits for user ${user.id}`);
      }
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Stripe] Payment failed:', invoice.id);

  const customerId = invoice.customer as string;

  // Find user and update status
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (user) {
    await supabase
      .from('users')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Log failed payment for follow-up
    await supabase.from('payment_events').insert({
      user_id: user.id,
      event_type: 'payment_failed',
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_due,
      created_at: new Date().toISOString(),
    });
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe] Payment succeeded:', paymentIntent.id);
}

async function addCreditsToUser(
  userId: string | undefined,
  credits: number,
  source: string,
  referenceId: string
) {
  if (!userId) return;

  const { data: user } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single();

  const currentCredits = user?.credits || 0;
  const newCredits = currentCredits + credits;

  await supabase
    .from('users')
    .update({ 
      credits: newCredits,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: credits,
    balance_after: newCredits,
    type: 'credit',
    source: source,
    reference_id: referenceId,
    created_at: new Date().toISOString(),
  });
}

async function logTransaction(data: {
  user_id?: string;
  stripe_session_id: string;
  stripe_customer_id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  metadata?: Stripe.Metadata | null;
}) {
  try {
    await supabase.from('transactions').insert({
      ...data,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Stripe] Failed to log transaction:', error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Stripe webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
