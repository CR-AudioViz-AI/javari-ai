// app/api/subscription/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION STATUS API
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:23 PM EST
// Returns current subscription details
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_CREDITS = {
  free: 50,
  starter: 500,
  pro: 2000,
  business: 10000
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If no subscription, return free tier
    if (!user.stripe_subscription_id) {
      return NextResponse.json({
        subscription: null,
        plan: 'free',
        creditsPerMonth: PLAN_CREDITS.free
      });
    }

    // Get subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    
    // Get payment method
    let paymentMethod = null;
    if (subscription.default_payment_method) {
      const pm = await stripe.paymentMethods.retrieve(
        subscription.default_payment_method as string
      );
      if (pm.card) {
        paymentMethod = {
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        };
      }
    }

    const plan = user.subscription_tier || 'free';

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan: plan,
        priceMonthly: subscription.items.data[0]?.price?.unit_amount 
          ? subscription.items.data[0].price.unit_amount / 100 
          : 0,
        interval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : null,
        creditsPerMonth: PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 50
      },
      paymentMethod
    });

  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch subscription'
    }, { status: 500 });
  }
}

