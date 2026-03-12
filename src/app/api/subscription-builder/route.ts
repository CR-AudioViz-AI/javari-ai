```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { Redis } from 'ioredis';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const redis = new Redis(process.env.REDIS_URL!);

// Validation schemas
const UsageLimitSchema = z.object({
  type: z.enum(['api_calls', 'storage_gb', 'bandwidth_gb', 'transcription_minutes', 'ai_generations']),
  limit: z.number().min(0),
  overage_rate: z.number().min(0).optional(),
  reset_period: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
});

const FeatureGateSchema = z.object({
  feature_id: z.string(),
  enabled: z.boolean(),
  parameters: z.record(z.any()).optional(),
});

const PricingRuleSchema = z.object({
  type: z.enum(['fixed', 'usage_based', 'graduated', 'per_unit']),
  base_price: z.number().min(0),
  currency: z.string().length(3),
  tiers: z.array(z.object({
    up_to: z.number().nullable(),
    unit_price: z.number().min(0),
  })).optional(),
  billing_period: z.enum(['monthly', 'yearly', 'weekly', 'daily']),
});

const SubscriptionTierSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  pricing_rules: PricingRuleSchema,
  usage_limits: z.array(UsageLimitSchema),
  feature_gates: z.array(FeatureGateSchema),
  is_enterprise: z.boolean().default(false),
  is_active: z.boolean().default(true),
  trial_days: z.number().min(0).max(365).optional(),
  setup_fee: z.number().min(0).optional(),
});

const UpdateTierSchema = SubscriptionTierSchema.partial();

const PricingCalculationSchema = z.object({
  tier_id: z.string().uuid(),
  usage_data: z.record(z.number()),
  billing_period: z.enum(['monthly', 'yearly']).optional(),
});

const ValidationRequestSchema = z.object({
  tier_config: SubscriptionTierSchema,
  validate_pricing: z.boolean().default(true),
  validate_features: z.boolean().default(true),
});

// Helper functions
async function validateCreatorPermissions(userId: string, creatorId?: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('creators')
    .select('user_id, subscription_plan')
    .eq('id', creatorId || userId)
    .single();

  if (error || !data) return false;
  
  return data.user_id === userId && ['premium', 'enterprise'].includes(data.subscription_plan);
}

async function getCachedTierConfig(tierId: string) {
  const cached = await redis.get(`tier_config:${tierId}`);
  return cached ? JSON.parse(cached) : null;
}

async function setCachedTierConfig(tierId: string, config: any, ttl = 300) {
  await redis.setex(`tier_config:${tierId}`, ttl, JSON.stringify(config));
}

async function calculateGraduatedPricing(pricingRules: any, usage: number): Promise<number> {
  if (pricingRules.type !== 'graduated' || !pricingRules.tiers) {
    return pricingRules.base_price;
  }

  let totalCost = pricingRules.base_price;
  let remainingUsage = usage;

  for (const tier of pricingRules.tiers) {
    if (remainingUsage <= 0) break;

    const tierLimit = tier.up_to || Infinity;
    const usageInTier = Math.min(remainingUsage, tierLimit);
    totalCost += usageInTier * tier.unit_price;
    remainingUsage -= usageInTier;
  }

  return totalCost;
}

async function createStripeProduct(tierData: any): Promise<string> {
  const product = await stripe.products.create({
    name: tierData.name,
    description: tierData.description,
    metadata: {
      tier_id: tierData.id,
      is_enterprise: tierData.is_enterprise.toString(),
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(tierData.pricing_rules.base_price * 100),
    currency: tierData.pricing_rules.currency,
    recurring: {
      interval: tierData.pricing_rules.billing_period === 'yearly' ? 'year' : 'month',
    },
    metadata: {
      tier_id: tierData.id,
    },
  });

  return price.id;
}

// GET - Fetch tier templates
export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const userId = headersList.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'templates';
    const creatorId = searchParams.get('creator_id');

    if (type === 'templates') {
      const templates = [
        {
          id: 'basic',
          name: 'Basic Tier',
          description: 'Simple monthly subscription',
          pricing_rules: {
            type: 'fixed',
            base_price: 9.99,
            currency: 'usd',
            billing_period: 'monthly',
          },
          usage_limits: [
            {
              type: 'api_calls',
              limit: 1000,
              reset_period: 'monthly',
            },
          ],
          feature_gates: [
            { feature_id: 'basic_audio_processing', enabled: true },
            { feature_id: 'advanced_ai', enabled: false },
          ],
        },
        {
          id: 'pro',
          name: 'Professional Tier',
          description: 'Usage-based pricing with advanced features',
          pricing_rules: {
            type: 'graduated',
            base_price: 19.99,
            currency: 'usd',
            billing_period: 'monthly',
            tiers: [
              { up_to: 5000, unit_price: 0.01 },
              { up_to: null, unit_price: 0.008 },
            ],
          },
          usage_limits: [
            {
              type: 'api_calls',
              limit: 10000,
              overage_rate: 0.01,
              reset_period: 'monthly',
            },
          ],
          feature_gates: [
            { feature_id: 'basic_audio_processing', enabled: true },
            { feature_id: 'advanced_ai', enabled: true },
            { feature_id: 'custom_models', enabled: false },
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise Tier',
          description: 'Custom enterprise solution',
          pricing_rules: {
            type: 'usage_based',
            base_price: 99.99,
            currency: 'usd',
            billing_period: 'monthly',
          },
          usage_limits: [
            {
              type: 'api_calls',
              limit: 100000,
              overage_rate: 0.005,
              reset_period: 'monthly',
            },
          ],
          feature_gates: [
            { feature_id: 'basic_audio_processing', enabled: true },
            { feature_id: 'advanced_ai', enabled: true },
            { feature_id: 'custom_models', enabled: true },
            { feature_id: 'priority_support', enabled: true },
          ],
          is_enterprise: true,
        },
      ];

      return NextResponse.json({ templates });
    }

    if (type === 'tiers' && creatorId) {
      if (!(await validateCreatorPermissions(userId, creatorId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data: tiers, error } = await supabase
        .from('subscription_tiers')
        .select(`
          *,
          usage_limits (*),
          feature_gates (*),
          pricing_rules (*)
        `)
        .eq('creator_id', creatorId)
        .eq('is_active', true);

      if (error) {
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      return NextResponse.json({ tiers });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch (error) {
    console.error('GET /api/subscription-builder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create tier or calculate pricing
export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const userId = headersList.get('x-user-id');
    const clientIp = headersList.get('x-forwarded-for') || 'unknown';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(clientIp, 20, 300);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'create';
    const body = await request.json();

    if (action === 'pricing') {
      const validatedData = PricingCalculationSchema.parse(body);
      
      // Get tier configuration
      let tierConfig = await getCachedTierConfig(validatedData.tier_id);
      if (!tierConfig) {
        const { data, error } = await supabase
          .from('subscription_tiers')
          .select('*, pricing_rules (*)')
          .eq('id', validatedData.tier_id)
          .single();

        if (error || !data) {
          return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
        }

        tierConfig = data;
        await setCachedTierConfig(validatedData.tier_id, tierConfig);
      }

      // Calculate pricing based on usage
      const totalUsage = Object.values(validatedData.usage_data).reduce((sum, val) => sum + val, 0);
      const calculatedPrice = await calculateGraduatedPricing(tierConfig.pricing_rules, totalUsage);

      const breakdown = {
        base_price: tierConfig.pricing_rules.base_price,
        usage_charges: calculatedPrice - tierConfig.pricing_rules.base_price,
        total_price: calculatedPrice,
        currency: tierConfig.pricing_rules.currency,
        billing_period: validatedData.billing_period || tierConfig.pricing_rules.billing_period,
        usage_details: validatedData.usage_data,
      };

      return NextResponse.json({ pricing: breakdown });
    }

    if (action === 'validate') {
      const validatedData = ValidationRequestSchema.parse(body);
      
      const validationResults = {
        is_valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // Validate pricing configuration
      if (validatedData.validate_pricing) {
        const pricing = validatedData.tier_config.pricing_rules;
        if (pricing.type === 'graduated' && !pricing.tiers) {
          validationResults.errors.push('Graduated pricing requires tier configuration');
        }
        if (pricing.base_price < 0) {
          validationResults.errors.push('Base price cannot be negative');
        }
      }

      // Validate feature gates
      if (validatedData.validate_features) {
        const features = validatedData.tier_config.feature_gates;
        const duplicateFeatures = features
          .map(f => f.feature_id)
          .filter((id, index, arr) => arr.indexOf(id) !== index);
        
        if (duplicateFeatures.length > 0) {
          validationResults.errors.push(`Duplicate features: ${duplicateFeatures.join(', ')}`);
        }
      }

      // Check usage limits
      const limits = validatedData.tier_config.usage_limits;
      limits.forEach((limit, index) => {
        if (limit.overage_rate && limit.overage_rate < 0) {
          validationResults.errors.push(`Usage limit ${index + 1}: Overage rate cannot be negative`);
        }
      });

      validationResults.is_valid = validationResults.errors.length === 0;

      return NextResponse.json({ validation: validationResults });
    }

    // Create new tier
    const validatedData = SubscriptionTierSchema.parse(body);
    const creatorId = body.creator_id;

    if (!creatorId || !(await validateCreatorPermissions(userId, creatorId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create tier in database
    const { data: tier, error: tierError } = await supabase
      .from('subscription_tiers')
      .insert({
        creator_id: creatorId,
        name: validatedData.name,
        description: validatedData.description,
        is_enterprise: validatedData.is_enterprise,
        is_active: validatedData.is_active,
        trial_days: validatedData.trial_days,
        setup_fee: validatedData.setup_fee,
      })
      .select()
      .single();

    if (tierError || !tier) {
      return NextResponse.json({ error: 'Failed to create tier' }, { status: 500 });
    }

    // Insert pricing rules
    const { error: pricingError } = await supabase
      .from('pricing_rules')
      .insert({
        tier_id: tier.id,
        ...validatedData.pricing_rules,
      });

    if (pricingError) {
      // Rollback tier creation
      await supabase.from('subscription_tiers').delete().eq('id', tier.id);
      return NextResponse.json({ error: 'Failed to create pricing rules' }, { status: 500 });
    }

    // Insert usage limits
    if (validatedData.usage_limits.length > 0) {
      const { error: limitsError } = await supabase
        .from('usage_limits')
        .insert(
          validatedData.usage_limits.map(limit => ({
            tier_id: tier.id,
            ...limit,
          }))
        );

      if (limitsError) {
        console.error('Failed to create usage limits:', limitsError);
      }
    }

    // Insert feature gates
    if (validatedData.feature_gates.length > 0) {
      const { error: featuresError } = await supabase
        .from('feature_gates')
        .insert(
          validatedData.feature_gates.map(gate => ({
            tier_id: tier.id,
            ...gate,
          }))
        );

      if (featuresError) {
        console.error('Failed to create feature gates:', featuresError);
      }
    }

    // Create Stripe product and price
    try {
      const stripePriceId = await createStripeProduct({ ...tier, pricing_rules: validatedData.pricing_rules });
      await supabase
        .from('subscription_tiers')
        .update({ stripe_price_id: stripePriceId })
        .eq('id', tier.id);
    } catch (stripeError) {
      console.error('Stripe integration error:', stripeError);
    }

    return NextResponse.json({ 
      tier: { 
        ...tier, 
        pricing_rules: validatedData.pricing_rules,
        usage_limits: validatedData.usage_limits,
        feature_gates: validatedData.feature_gates 
      } 
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: error.errors 
      }, { status: 400 });
    }

    console.error('POST /api/subscription-builder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update tier
export async function PUT(request: NextRequest) {
  try {
    const headersList = headers();
    const userId = headersList.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get('tier_id');

    if (!tierId) {
      return NextResponse.json({ error: 'Tier ID required' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = UpdateTierSchema.parse(body);

    // Verify ownership
    const { data: existingTier, error: fetchError } = await supabase
      .from('subscription_tiers')
      .select('creator_id')
      .eq('id', tierId)
      .single();

    if (fetchError || !existingTier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    if (!(await validateCreatorPermissions(userId, existingTier.creator_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update tier
    const { data: updatedTier, error: updateError } = await supabase
      .from('subscription_tiers')
      .update({
        name: validatedData.name,
        description: validatedData.description,
        is_active: validatedData.is_active,
        trial_days: validatedData.trial_days,
        setup_fee: validatedData.setup_fee,
      })
      .eq('id', tierId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 });
    }

    // Update pricing rules if provided
    if (validatedData.pricing_rules) {
      await supabase
        .from('pricing_rules')
        .upsert({
          tier_id: tierId,
          ...validatedData.pricing_rules,
        });
    }

    // Update usage limits if provided
    if (validatedData.usage_limits) {
      await supabase.from('usage_limits').delete().eq('tier_id', tierId);
      if (validatedData.usage_limits.length > 0) {
        await supabase
          .from('usage_limits')
          .insert(
            validatedData.usage_limits.map(limit => ({
              tier_id: tierId,
              ...limit,
            }))
          );
      }
    }

    // Update feature gates if provided
    if (validatedData.feature_gates) {
      await supabase.from('feature_gates').delete().eq('tier_id', tierId);
      if (validatedData.feature_gates.length > 0) {
        await supabase
          .from('feature_gates')
          .insert(
            validatedData.feature_gates.map(gate => ({
              tier_id: tierId,
              ...gate,
            }))
          );
      }
    }

    // Clear cache
    await redis.del(`tier_config:${tierId}`);

    return NextResponse.json({ tier: updatedTier });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: error.errors 
      }, { status: 400 });
    }

    console.error('PUT /api/subscription-builder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deactivate tier
export async function DELETE(request: NextRequest) {
  try {
    const headersList = headers();
    const userId = headersList.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tierId = searchParams.get('tier_id');

    if (!tierId) {
      return NextResponse.json({ error: 'Tier ID required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existingTier, error: fetchError } = await supabase
      .from('subscription_tiers')
      .select('creator_id, stripe_price_id')
      .eq('id', tierId)
      .single();

    if (fetchError || !existingTier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }

    if (!(await validateCreatorPermissions(userId, existingTier.creator_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Deactivate tier (soft delete)
    const { error: deactivateError } = await supabase
      .from('subscription_tiers')
      .update({ is_active: false })
      .eq('id', tierId);

    if (deactivateError) {
      return NextResponse.json({ error: 'Failed to deactivate tier' }, { status: 500 });
    }

    // Deactivate Stripe price
    if (existingTier.stripe_price_id) {
      try {
        await stripe.prices.update(existingTier.stripe_price_id, {
          active: false,
        });
      } catch (stripeError) {
        console.error('Failed to deactivate Stripe price:', stripeError);
      }
    }

    // Clear cache
    await redis.del(`tier_config:${tierId}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('DELETE /api/subscription-builder error:', error);
    return NextResponse.json({