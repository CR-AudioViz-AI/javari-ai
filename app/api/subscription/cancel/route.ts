// app/api/subscription/cancel/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CANCEL API
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:24 PM EST
// Cancels subscription at end of billing period
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
      .select('stripe_subscription_id, email')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
    }

    // Cancel at period end (not immediately)
    const subscription = await stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    // Log the cancellation
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'cancellation_scheduled',
      subscription_id: subscription.id,
      metadata: {
        cancel_at: new Date(subscription.current_period_end * 1000).toISOString()
      },
      created_at: new Date().toISOString()
    }); // Don't fail if logging fails

    // Send cancellation email
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/user-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription_cancelled',
          to: user.email,
          data: {
            name: user.email.split('@')[0],
            planName: 'Current Plan',
            endDate: new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            }),
            remainingCredits: 0 // Would need to fetch actual balance
          }
        })
      });
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      cancelAt: new Date(subscription.current_period_end * 1000).toISOString()
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel'
    }, { status: 500 });
  }
}
