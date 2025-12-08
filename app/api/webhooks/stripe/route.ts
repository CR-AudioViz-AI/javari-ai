import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Credit amounts for each product
const CREDIT_AMOUNTS: Record<string, number> = {
  'prod_TX1jJUntv6mbS5': 10,      // 10 Credit Pack
  'prod_TX1jCgo0pVlNUk': 50,      // 50 Credit Pack
  'prod_TX1j5bYMlCDkwn': 200,     // 200 Credit Pack
  'prod_TI63IMdxRSMGKt': 100,     // JavariAI 100 Credits
  'prod_TI6861Obu8vfg7': 500,     // JavariAI 500 Credits
};

// Monthly credits for subscription plans
const SUBSCRIPTION_CREDITS: Record<string, number> = {
  'prod_TX1iwTUdlTE1Ku': 100,     // Starter - 100/mo
  'prod_TX1ixXF1tiYr7F': 500,     // Pro - 500/mo
  'prod_TX1irxT9gWLZI4': 2000,    // Business - 2000/mo
  'prod_TX1jTG2blyNVvG': 999999,  // Enterprise - Unlimited
  'prod_TI6896ICKs0DEL': 100,     // Basic Monthly
};

// Plan names for display
const PLAN_NAMES: Record<string, string> = {
  'prod_TX1iwTUdlTE1Ku': 'Starter',
  'prod_TX1ixXF1tiYr7F': 'Pro',
  'prod_TX1irxT9gWLZI4': 'Business',
  'prod_TX1jTG2blyNVvG': 'Enterprise',
  'prod_TI6896ICKs0DEL': 'Basic',
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('No Stripe signature found');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`[Stripe Webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
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

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[Checkout Completed]', session.id);

  const customerEmail = session.customer_details?.email;
  const customerId = session.customer as string;

  if (!customerEmail) {
    console.error('No customer email in session');
    return;
  }

  // Find or create user
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', customerEmail)
    .single();

  if (!user) {
    // Create user if doesn't exist
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: customerEmail,
        stripe_customer_id: customerId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return;
    }
    user = newUser;
  } else if (!user.stripe_customer_id) {
    // Update existing user with Stripe customer ID
    await supabase
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  // Handle one-time payment (credit purchase)
  if (session.mode === 'payment') {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    
    for (const item of lineItems.data) {
      const productId = item.price?.product as string;
      const credits = CREDIT_AMOUNTS[productId];

      if (credits) {
        await addCredits(user.id, credits, 'purchase', session.id);
        console.log(`[Credits Added] ${credits} credits to user ${user.id}`);
      }
    }
  }

  // Log the transaction
  await supabase.from('transactions').insert({
    user_id: user.id,
    stripe_session_id: session.id,
    stripe_customer_id: customerId,
    amount: session.amount_total,
    currency: session.currency,
    status: 'completed',
    type: session.mode,
    created_at: new Date().toISOString(),
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  console.log('[Subscription Change]', subscription.id, subscription.status);

  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Get product info
  const productId = subscription.items.data[0]?.price?.product as string;
  const planName = PLAN_NAMES[productId] || 'Unknown';
  const monthlyCredits = SUBSCRIPTION_CREDITS[productId] || 0;

  // Update user subscription status
  await supabase
    .from('users')
    .update({
      subscription_status: subscription.status,
      subscription_plan: planName,
      subscription_id: subscription.id,
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      monthly_credits: monthlyCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  // If subscription just became active, grant initial credits
  if (subscription.status === 'active') {
    await addCredits(user.id, monthlyCredits, 'subscription', subscription.id);
    console.log(`[Subscription Credits] ${monthlyCredits} credits to user ${user.id}`);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log('[Subscription Canceled]', subscription.id);

  const customerId = subscription.customer as string;

  await supabase
    .from('users')
    .update({
      subscription_status: 'canceled',
      subscription_plan: null,
      subscription_id: null,
      monthly_credits: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('[Invoice Paid]', invoice.id);

  // Only process subscription invoices (not first payment)
  if (!invoice.subscription || invoice.billing_reason === 'subscription_create') {
    return;
  }

  const customerId = invoice.customer as string;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!user) return;

  // Grant monthly credits for renewal
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
  const productId = subscription.items.data[0]?.price?.product as string;
  const monthlyCredits = SUBSCRIPTION_CREDITS[productId] || 0;

  if (monthlyCredits > 0) {
    await addCredits(user.id, monthlyCredits, 'renewal', invoice.id);
    console.log(`[Renewal Credits] ${monthlyCredits} credits to user ${user.id}`);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Payment Failed]', invoice.id);

  const customerId = invoice.customer as string;

  // Update user status
  await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  // TODO: Send payment failed email notification
}

async function addCredits(
  userId: string,
  amount: number,
  source: string,
  referenceId: string
) {
  // Get current credits
  const { data: user } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single();

  const currentCredits = user?.credits || 0;
  const newCredits = currentCredits + amount;

  // Update credits
  await supabase
    .from('users')
    .update({
      credits: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Log credit transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: amount,
    balance_after: newCredits,
    source: source,
    reference_id: referenceId,
    created_at: new Date().toISOString(),
  });
}
