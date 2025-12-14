// =============================================================================
// JAVARI AI - STRIPE CHECKOUT API
// =============================================================================
// Production Ready - Sunday, December 14, 2025
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Price IDs - Replace with your actual Stripe price IDs
const PRICE_MAP: Record<string, Record<string, string>> = {
  pro: {
    month: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    year: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
  },
  business: {
    month: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'price_business_monthly',
    year: process.env.STRIPE_PRICE_BUSINESS_YEARLY || 'price_business_yearly',
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, interval, successUrl, cancelUrl, customerId, email } = body;

    if (!planId || !PRICE_MAP[planId]) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
        { status: 400 }
      );
    }

    const priceId = PRICE_MAP[planId][interval || 'month'];

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          plan: planId,
          interval: interval || 'month',
        },
      },
      metadata: {
        plan: planId,
        interval: interval || 'month',
      },
    };

    // Add customer if provided
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// Get checkout session status
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID required' },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    return NextResponse.json({
      success: true,
      status: session.status,
      customerEmail: session.customer_details?.email,
      subscriptionId: typeof session.subscription === 'string' 
        ? session.subscription 
        : session.subscription?.id,
      plan: session.metadata?.plan,
    });

  } catch (error) {
    console.error('Session retrieve error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
