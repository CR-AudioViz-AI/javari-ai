import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe with stable API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Valid Stripe Price IDs from your account
const VALID_PRICES = new Set([
  // CR AudioViz Plans
  'price_1SZxfD7YeQ1dZTUvujSxg2DV',    // $29/mo Starter
  'price_1SZxfM7YeQ1dZTUv3jK4awd0',    // $49/mo Pro
  'price_1SZxfU7YeQ1dZTUvN07nxBW1',    // $199/mo Business
  'price_1SZxfd7YeQ1dZTUv8IEjsDh5',    // $499/mo Enterprise
  // Credit Packs
  'price_1SZxfq7YeQ1dZTUvuspvv7io',    // $15 - 10 credits
  'price_1SZxg37YeQ1dZTUv5L4OQlei',    // $60 - 50 credits
  'price_1SZxgE7YeQ1dZTUvLC8r8X8u',    // $200 - 200 credits
  // JavariAI Credits
  'price_1SLZoF7YeQ1dZTUvp4n7ZlMt',    // $10 - 100 credits
  'price_1SLZoM7YeQ1dZTUvMmg4fx91',    // $40 - 500 credits
  'price_1SLZoA7YeQ1dZTUvTGlVh51G',    // $20/mo Basic
]);

// Friendly name mapping
const PRICE_MAP: Record<string, string> = {
  'price_starter_monthly': 'price_1SZxfD7YeQ1dZTUvujSxg2DV',
  'price_pro_monthly': 'price_1SZxfM7YeQ1dZTUv3jK4awd0',
  'price_business_monthly': 'price_1SZxfU7YeQ1dZTUvN07nxBW1',
  'price_enterprise_monthly': 'price_1SZxfd7YeQ1dZTUv8IEjsDh5',
  'price_credits_10': 'price_1SZxfq7YeQ1dZTUvuspvv7io',
  'price_credits_50': 'price_1SZxg37YeQ1dZTUv5L4OQlei',
  'price_credits_200': 'price_1SZxgE7YeQ1dZTUvLC8r8X8u',
  'price_javari_pro_monthly': 'price_1SZxfM7YeQ1dZTUv3jK4awd0',
  'price_javari_enterprise_monthly': 'price_1SZxfd7YeQ1dZTUv8IEjsDh5',
  'price_javari_credits_100': 'price_1SLZoF7YeQ1dZTUvp4n7ZlMt',
  'price_javari_credits_500': 'price_1SLZoM7YeQ1dZTUvMmg4fx91',
};

// Subscription prices (for mode detection)
const SUBSCRIPTION_PRICES = new Set([
  'price_1SZxfD7YeQ1dZTUvujSxg2DV',
  'price_1SZxfM7YeQ1dZTUv3jK4awd0',
  'price_1SZxfU7YeQ1dZTUvN07nxBW1',
  'price_1SZxfd7YeQ1dZTUv8IEjsDh5',
  'price_1SLZoA7YeQ1dZTUvTGlVh51G',
]);

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { priceId, userId, email, successUrl, cancelUrl } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Resolve the actual Stripe price ID
    const stripePriceId = PRICE_MAP[priceId] || priceId;

    // Validate against known prices
    if (!VALID_PRICES.has(stripePriceId)) {
      console.error('Unknown price ID:', stripePriceId);
      return NextResponse.json(
        { error: 'Invalid price ID', received: priceId, resolved: stripePriceId },
        { status: 400 }
      );
    }

    const isSubscription = SUBSCRIPTION_PRICES.has(stripePriceId);

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://javariai.com'}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        priceId: priceId,
        userId: userId || '',
        source: 'javari-ai',
      },
    };

    // Add customer email if provided
    if (email) {
      sessionParams.customer_email = email;
    }

    // If we have a userId, try to get their Stripe customer ID
    if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('stripe_customer_id, email')
          .eq('id', userId)
          .single();

        if (userData?.stripe_customer_id) {
          sessionParams.customer = userData.stripe_customer_id;
          delete sessionParams.customer_email;
        } else if (userData?.email && !email) {
          sessionParams.customer_email = userData.email;
        }
      } catch (dbError) {
        console.log('Could not fetch user data, continuing without:', dbError);
      }
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, type: error.type },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session', details: String(error) },
      { status: 500 }
    );
  }
}

// Handle GET for session status check
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription', 'payment_intent'],
    });

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
