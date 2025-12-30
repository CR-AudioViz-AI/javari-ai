// app/api/stripe/billing-portal/route.ts
// ═══════════════════════════════════════════════════════════════════════════════
// STRIPE BILLING PORTAL API
// ═══════════════════════════════════════════════════════════════════════════════
// Monday, December 30, 2025, 2:22 PM EST
// Creates Stripe Customer Portal session for self-service billing management
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
    // Get user from session/cookie
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    // Try to get from body first
    try {
      const body = await request.json();
      userId = body.userId;
    } catch {
      // No body, try auth header or cookie
    }

    if (!userId) {
      // In production, get from auth session
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    // Get user's Stripe customer ID from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let customerId = user.stripe_customer_id;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: userId,
          platform: 'javari-ai'
        }
      });
      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/settings/subscription`,
    });

    return NextResponse.json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create portal session'
    }, { status: 500 });
  }
}
