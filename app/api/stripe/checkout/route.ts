// =============================================================================
// JAVARI AI - SELF-PROVISIONING STRIPE CHECKOUT API
// =============================================================================
// Monday, December 30, 2025 - Henderson Standard
// Auto-creates products and prices if they don't exist
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Henderson Bible v1.1 Pricing (exact)
const PRICING_CONFIG = {
  starter: {
    name: 'Javari AI Starter',
    description: '500 credits/month, all core tools, email support',
    monthlyPrice: 900, // $9.00 in cents
    yearlyPrice: 9000, // $90.00 in cents (save $18)
    credits: 500,
  },
  pro: {
    name: 'Javari AI Pro',
    description: '2,000 credits/month, priority AI, API access, advanced tools',
    monthlyPrice: 2900, // $29.00 in cents
    yearlyPrice: 29000, // $290.00 in cents (save $58)
    credits: 2000,
  },
  business: {
    name: 'Javari AI Business',
    description: '10,000 credits/month, dedicated support, white-label, custom integrations',
    monthlyPrice: 9900, // $99.00 in cents
    yearlyPrice: 99000, // $990.00 in cents (save $198)
    credits: 10000,
  },
};

type PlanId = keyof typeof PRICING_CONFIG;

// Cache for price IDs (in-memory, persists during function lifecycle)
const priceCache: Record<string, string> = {};

async function getOrCreateProduct(planId: PlanId): Promise<string> {
  const config = PRICING_CONFIG[planId];
  
  // Search for existing product
  const products = await stripe.products.search({
    query: `metadata['plan_id']:'${planId}'`,
    limit: 1,
  });

  if (products.data.length > 0) {
    return products.data[0].id;
  }

  // Create new product
  const product = await stripe.products.create({
    name: config.name,
    description: config.description,
    metadata: {
      plan_id: planId,
      credits: config.credits.toString(),
      created_by: 'javari-auto-provision',
    },
  });

  return product.id;
}

async function getOrCreatePrice(
  productId: string,
  planId: PlanId,
  interval: 'month' | 'year'
): Promise<string> {
  const cacheKey = `${planId}_${interval}`;
  
  if (priceCache[cacheKey]) {
    return priceCache[cacheKey];
  }

  const config = PRICING_CONFIG[planId];
  const unitAmount = interval === 'month' ? config.monthlyPrice : config.yearlyPrice;

  // Search for existing price
  const prices = await stripe.prices.search({
    query: `product:'${productId}' AND metadata['plan_id']:'${planId}' AND metadata['interval']:'${interval}'`,
    limit: 1,
  });

  if (prices.data.length > 0 && prices.data[0].active) {
    priceCache[cacheKey] = prices.data[0].id;
    return prices.data[0].id;
  }

  // Create new price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: 'usd',
    recurring: {
      interval: interval,
    },
    metadata: {
      plan_id: planId,
      interval: interval,
      credits: config.credits.toString(),
    },
  });

  priceCache[cacheKey] = price.id;
  return price.id;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, interval = 'month', successUrl, cancelUrl, customerId, email } = body;

    // Validate plan
    if (!planId || !PRICING_CONFIG[planId as PlanId]) {
      return NextResponse.json(
        { 
          error: 'Invalid plan selected',
          validPlans: Object.keys(PRICING_CONFIG),
        },
        { status: 400 }
      );
    }

    // Validate interval
    if (interval !== 'month' && interval !== 'year') {
      return NextResponse.json(
        { error: 'Invalid interval. Use "month" or "year"' },
        { status: 400 }
      );
    }

    // Get or create product and price
    const productId = await getOrCreateProduct(planId as PlanId);
    const priceId = await getOrCreatePrice(productId, planId as PlanId, interval);

    const config = PRICING_CONFIG[planId as PlanId];

    // Build checkout session
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
        trial_period_days: 7, // 7-day free trial per Henderson Bible
        metadata: {
          plan: planId,
          interval: interval,
          credits: config.credits.toString(),
        },
      },
      metadata: {
        plan: planId,
        interval: interval,
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
      plan: planId,
      interval: interval,
      priceId: priceId,
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, type: error.type },
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
    // Return available plans if no session ID
    return NextResponse.json({
      plans: Object.entries(PRICING_CONFIG).map(([id, config]) => ({
        id,
        name: config.name,
        description: config.description,
        monthlyPrice: config.monthlyPrice / 100,
        yearlyPrice: config.yearlyPrice / 100,
        credits: config.credits,
      })),
    });
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
      interval: session.metadata?.interval,
    });

  } catch (error) {
    console.error('Session retrieve error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
