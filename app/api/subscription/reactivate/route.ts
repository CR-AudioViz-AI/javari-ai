// app/api/subscription/reactivate/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION REACTIVATE API
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:25 PM EST
// Reactivates a subscription that was set to cancel
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get user's subscription ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.stripe_subscription_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Reactivate subscription (remove cancel_at_period_end)
    const subscription = await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: false
    });

    // Log the reactivation
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'reactivated',
      subscription_id: subscription.id,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      status: subscription.status
    });

  } catch (error) {
    console.error('Reactivate subscription error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reactivate'
    }, { status: 500 });
  }
}
