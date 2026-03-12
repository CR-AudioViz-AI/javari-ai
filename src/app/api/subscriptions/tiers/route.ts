```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import Stripe from 'stripe';
import { z } from 'zod';
import { ratelimit } from '@/lib/rate-limit';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Validation schemas
const createTierSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  base_price: z.number().min(0),
  usage_limits: z.object({
    audio_minutes: z.number().min(0),
    visualizations: z.number().min(0),
    exports: z.number().min(0),
    api_calls: z.number().min(0)
  }),
  overage_pricing: z.object({
    audio_minutes: z.number().min(0),
    visualizations: z.number().min(0),
    exports: z.number().min(0),
    api_calls: z.number().min(0)
  }),
  features: z.array(z.string()),
  auto_upgrade_threshold: z.number().min(0).max(100).optional(),
  billing_interval: z.enum(['month', 'year']),
  priority: z.number().min(0).default(0),
  is_active: z.boolean().default(true),
  stripe_price_id: z.string().optional()
});

const updateTierSchema = createTierSchema.partial();

const tierQuerySchema = z.object({
  include_inactive: z.string().optional().transform(val => val === 'true'),
  billing_interval: z.enum(['month', 'year']).optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
});

interface SubscriptionTier {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  usage_limits: {
    audio_minutes: number;
    visualizations: number;
    exports: number;
    api_calls: number;
  };
  overage_pricing: {
    audio_minutes: number;
    visualizations: number;
    exports: number;
    api_calls: number;
  };
  features: string[];
  auto_upgrade_threshold?: number;
  billing_interval: 'month' | 'year';
  priority: number;
  is_active: boolean;
  stripe_price_id?: string;
  created_at: string;
  updated_at: string;
}

interface PricingCalculation {
  base_cost: number;
  overage_cost: number;
  total_cost: number;
  proration_amount: number;
  effective_date: string;
}

// Rate limiting
const limiter = ratelimit({
  requests: 20,
  window: '1m'
});

// Helper functions
async function validateUserPermissions(supabase: any, userId: string) {
  const { data: user, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !user || user.role !== 'admin') {
    throw new Error('Insufficient permissions');
  }
}

async function createStripePrice(tier: Partial<SubscriptionTier>) {
  try {
    const price = await stripe.prices.create({
      unit_amount: Math.round(tier.base_price! * 100),
      currency: 'usd',
      recurring: {
        interval: tier.billing_interval!
      },
      product_data: {
        name: tier.name!,
        description: tier.description
      },
      metadata: {
        tier_id: tier.id || 'pending',
        usage_based: 'true'
      }
    });

    return price.id;
  } catch (error) {
    console.error('Stripe price creation error:', error);
    throw new Error('Failed to create Stripe price');
  }
}

async function calculatePricing(
  tier: SubscriptionTier,
  usage: Record<string, number>
): Promise<PricingCalculation> {
  let overage_cost = 0;
  
  // Calculate overage costs
  Object.entries(usage).forEach(([key, value]) => {
    const limit = tier.usage_limits[key as keyof typeof tier.usage_limits];
    const overageRate = tier.overage_pricing[key as keyof typeof tier.overage_pricing];
    
    if (value > limit) {
      overage_cost += (value - limit) * overageRate;
    }
  });

  // Calculate proration for mid-cycle changes
  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const remainingDays = Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = Math.ceil((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
  
  const proration_amount = (tier.base_price * remainingDays) / totalDays;

  return {
    base_cost: tier.base_price,
    overage_cost,
    total_cost: tier.base_price + overage_cost,
    proration_amount,
    effective_date: now.toISOString()
  };
}

async function checkAutoUpgrade(
  supabase: any,
  userId: string,
  currentTier: SubscriptionTier,
  usage: Record<string, number>
) {
  if (!currentTier.auto_upgrade_threshold) return null;

  // Calculate usage percentage
  const usagePercentages = Object.entries(usage).map(([key, value]) => {
    const limit = currentTier.usage_limits[key as keyof typeof currentTier.usage_limits];
    return limit > 0 ? (value / limit) * 100 : 0;
  });

  const maxUsage = Math.max(...usagePercentages);

  if (maxUsage >= currentTier.auto_upgrade_threshold) {
    // Find next tier
    const { data: nextTier } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('billing_interval', currentTier.billing_interval)
      .eq('is_active', true)
      .gt('priority', currentTier.priority)
      .order('priority', { ascending: true })
      .limit(1)
      .single();

    return nextTier;
  }

  return null;
}

// GET - Retrieve subscription tiers
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await limiter.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = tierQuerySchema.parse(Object.fromEntries(searchParams));

    const supabase = createRouteHandlerClient({ cookies });

    // Build query
    let dbQuery = supabase
      .from('subscription_tiers')
      .select('*')
      .order('priority', { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);

    if (!query.include_inactive) {
      dbQuery = dbQuery.eq('is_active', true);
    }

    if (query.billing_interval) {
      dbQuery = dbQuery.eq('billing_interval', query.billing_interval);
    }

    const { data: tiers, error, count } = await dbQuery;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tiers' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: tiers,
      meta: {
        total: count,
        limit: query.limit,
        offset: query.offset
      }
    });

  } catch (error) {
    console.error('GET tiers error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new subscription tier
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await limiter.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate admin permissions
    await validateUserPermissions(supabase, session.user.id);

    // Parse and validate request body
    const body = await request.json();
    const tierData = createTierSchema.parse(body);

    // Create Stripe price if not provided
    let stripePrice = tierData.stripe_price_id;
    if (!stripePrice) {
      stripePrice = await createStripePrice(tierData);
    }

    // Insert tier into database
    const { data: tier, error } = await supabase
      .from('subscription_tiers')
      .insert([{
        ...tierData,
        stripe_price_id: stripePrice,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create tier' },
        { status: 500 }
      );
    }

    // Update Stripe price metadata with tier ID
    await stripe.prices.update(stripePrice, {
      metadata: { tier_id: tier.id }
    });

    return NextResponse.json({
      data: tier,
      message: 'Tier created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('POST tier error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid tier data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update subscription tier
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await limiter.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate admin permissions
    await validateUserPermissions(supabase, session.user.id);

    const body = await request.json();
    const { tier_id, ...updateData } = body;

    if (!tier_id) {
      return NextResponse.json(
        { error: 'Tier ID is required' },
        { status: 400 }
      );
    }

    // Validate update data
    const validatedData = updateTierSchema.parse(updateData);

    // Get existing tier
    const { data: existingTier, error: fetchError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', tier_id)
      .single();

    if (fetchError || !existingTier) {
      return NextResponse.json(
        { error: 'Tier not found' },
        { status: 404 }
      );
    }

    // Update Stripe price if pricing changed
    if (validatedData.base_price && validatedData.base_price !== existingTier.base_price) {
      const newStripePrice = await createStripePrice({
        ...existingTier,
        ...validatedData
      });
      validatedData.stripe_price_id = newStripePrice;
    }

    // Update tier in database
    const { data: updatedTier, error } = await supabase
      .from('subscription_tiers')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', tier_id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update tier' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: updatedTier,
      message: 'Tier updated successfully'
    });

  } catch (error) {
    console.error('PUT tier error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid update data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete subscription tier
export async function DELETE(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await limiter.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate admin permissions
    await validateUserPermissions(supabase, session.user.id);

    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get('tier_id');

    if (!tierId) {
      return NextResponse.json(
        { error: 'Tier ID is required' },
        { status: 400 }
      );
    }

    // Check if tier has active subscriptions
    const { data: activeSubscriptions, error: checkError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('tier_id', tierId)
      .eq('status', 'active');

    if (checkError) {
      console.error('Database error:', checkError);
      return NextResponse.json(
        { error: 'Failed to check active subscriptions' },
        { status: 500 }
      );
    }

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete tier with active subscriptions' },
        { status: 400 }
      );
    }

    // Soft delete - mark as inactive instead of hard delete
    const { error } = await supabase
      .from('subscription_tiers')
      .update({ 
        is_active: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', tierId);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete tier' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Tier deleted successfully'
    });

  } catch (error) {
    console.error('DELETE tier error:', error);
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```