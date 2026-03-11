```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Validation schemas
const calculatePricingSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string(),
  currency: z.string().length(3).default('USD'),
  billingPeriod: z.enum(['monthly', 'yearly']).default('monthly'),
  discountCode: z.string().optional(),
  paymentMethodId: z.string().optional(),
  usageOverrides: z.record(z.number()).optional(),
});

const previewSchema = z.object({
  userId: z.string().uuid(),
  newPlanId: z.string(),
  currency: z.string().length(3).default('USD'),
  billingPeriod: z.enum(['monthly', 'yearly']).default('monthly'),
  effectiveDate: z.string().datetime().optional(),
});

const discountSchema = z.object({
  userId: z.string().uuid(),
  discountCode: z.string().min(1),
  subscriptionId: z.string(),
});

const usageSchema = z.object({
  userId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Types
interface PricingTier {
  id: string;
  name: string;
  base_price: number;
  currency: string;
  billing_period: string;
  usage_limits: Record<string, number>;
  overage_rates: Record<string, number>;
  features: string[];
  is_active: boolean;
}

interface UsageMetric {
  metric_name: string;
  usage_amount: number;
  limit: number;
  overage_rate: number;
  overage_amount: number;
}

interface DiscountInfo {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  currency: string;
  valid_until: string;
  max_uses: number;
  current_uses: number;
  applicable_plans: string[];
}

interface PricingBreakdown {
  basePrice: number;
  usageCharges: UsageMetric[];
  totalUsageCharge: number;
  discount: {
    applied: boolean;
    code?: string;
    amount: number;
    type?: string;
  };
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

// Currency conversion rates (in production, use a real service)
const CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.85,
  GBP: 0.73,
  CAD: 1.25,
  AUD: 1.35,
};

class PricingEngine {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async calculatePricing(params: z.infer<typeof calculatePricingSchema>): Promise<PricingBreakdown> {
    try {
      // Get pricing tier
      const { data: tier, error: tierError } = await this.supabase
        .from('pricing_tiers')
        .select('*')
        .eq('id', params.planId)
        .eq('is_active', true)
        .single();

      if (tierError || !tier) {
        throw new Error('Pricing tier not found');
      }

      // Get user usage
      const usage = await this.getUserUsage(params.userId);
      
      // Apply usage overrides if provided
      const finalUsage = { ...usage, ...(params.usageOverrides || {}) };

      // Calculate base price with currency conversion
      const basePrice = this.convertCurrency(tier.base_price, tier.currency, params.currency);

      // Calculate usage charges
      const usageCharges = this.calculateUsageCharges(finalUsage, tier, params.currency);
      const totalUsageCharge = usageCharges.reduce((sum, charge) => sum + charge.overage_amount, 0);

      // Apply discount if provided
      let discount = { applied: false, amount: 0 };
      if (params.discountCode) {
        discount = await this.applyDiscount(params.discountCode, params.planId, basePrice + totalUsageCharge);
      }

      // Calculate totals
      const subtotal = basePrice + totalUsageCharge - discount.amount;
      const tax = this.calculateTax(subtotal, params.currency);
      const total = subtotal + tax;

      return {
        basePrice,
        usageCharges,
        totalUsageCharge,
        discount,
        subtotal,
        tax,
        total,
        currency: params.currency,
      };
    } catch (error) {
      throw new Error(`Pricing calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getUserUsage(userId: string): Promise<Record<string, number>> {
    const { data: usage, error } = await this.supabase
      .from('user_usage')
      .select('metric_name, usage_amount')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw new Error('Failed to fetch user usage');
    }

    return usage.reduce((acc: Record<string, number>, item: any) => {
      acc[item.metric_name] = (acc[item.metric_name] || 0) + item.usage_amount;
      return acc;
    }, {});
  }

  private calculateUsageCharges(usage: Record<string, number>, tier: PricingTier, currency: string): UsageMetric[] {
    const charges: UsageMetric[] = [];

    Object.entries(usage).forEach(([metricName, usageAmount]) => {
      const limit = tier.usage_limits[metricName] || 0;
      const overageRate = tier.overage_rates[metricName] || 0;
      
      if (usageAmount > limit) {
        const overage = usageAmount - limit;
        const convertedRate = this.convertCurrency(overageRate, tier.currency, currency);
        
        charges.push({
          metric_name: metricName,
          usage_amount: usageAmount,
          limit,
          overage_rate: convertedRate,
          overage_amount: overage * convertedRate,
        });
      } else {
        charges.push({
          metric_name: metricName,
          usage_amount: usageAmount,
          limit,
          overage_rate: 0,
          overage_amount: 0,
        });
      }
    });

    return charges;
  }

  private async applyDiscount(code: string, planId: string, amount: number): Promise<any> {
    const { data: discount, error } = await this.supabase
      .from('discounts')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .single();

    if (error || !discount) {
      return { applied: false, amount: 0 };
    }

    // Check if discount applies to this plan
    if (discount.applicable_plans && !discount.applicable_plans.includes(planId)) {
      return { applied: false, amount: 0 };
    }

    // Check usage limits
    if (discount.max_uses && discount.current_uses >= discount.max_uses) {
      return { applied: false, amount: 0 };
    }

    const discountAmount = discount.type === 'percentage' 
      ? (amount * discount.value) / 100
      : discount.value;

    return {
      applied: true,
      code: discount.code,
      amount: Math.min(discountAmount, amount),
      type: discount.type,
    };
  }

  private convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;
    
    const fromRate = CURRENCY_RATES[fromCurrency] || 1;
    const toRate = CURRENCY_RATES[toCurrency] || 1;
    
    return (amount / fromRate) * toRate;
  }

  private calculateTax(amount: number, currency: string): number {
    // Simple tax calculation - in production, use proper tax service
    const taxRates: Record<string, number> = {
      USD: 0.08,
      EUR: 0.20,
      GBP: 0.20,
      CAD: 0.13,
      AUD: 0.10,
    };
    
    return amount * (taxRates[currency] || 0);
  }

  async getTiers(currency: string = 'USD'): Promise<PricingTier[]> {
    const { data: tiers, error } = await this.supabase
      .from('pricing_tiers')
      .select('*')
      .eq('is_active', true)
      .order('base_price', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch pricing tiers');
    }

    return tiers.map((tier: any) => ({
      ...tier,
      base_price: this.convertCurrency(tier.base_price, tier.currency, currency),
      currency,
    }));
  }

  async previewSubscriptionChange(params: z.infer<typeof previewSchema>) {
    try {
      // Get current subscription
      const { data: currentSub, error: subError } = await this.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', params.userId)
        .eq('status', 'active')
        .single();

      if (subError) {
        throw new Error('Current subscription not found');
      }

      // Calculate new pricing
      const newPricing = await this.calculatePricing({
        userId: params.userId,
        planId: params.newPlanId,
        currency: params.currency,
        billingPeriod: params.billingPeriod,
      });

      // Calculate prorated amount
      const effectiveDate = params.effectiveDate ? new Date(params.effectiveDate) : new Date();
      const nextBillingDate = new Date(currentSub.current_period_end);
      const daysRemaining = Math.ceil((nextBillingDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((nextBillingDate.getTime() - new Date(currentSub.current_period_start).getTime()) / (1000 * 60 * 60 * 24));
      
      const prorationFactor = daysRemaining / totalDays;
      const proratedAmount = newPricing.total * prorationFactor;

      return {
        currentPlan: currentSub.plan_id,
        newPlan: params.newPlanId,
        effectiveDate: effectiveDate.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(),
        proratedAmount,
        fullAmount: newPricing.total,
        savings: currentSub.amount - newPricing.total,
        pricing: newPricing,
      };
    } catch (error) {
      throw new Error(`Preview calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Route handlers
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const engine = new PricingEngine(supabase);
    
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    switch (action) {
      case 'calculate': {
        const body = await request.json();
        const params = calculatePricingSchema.parse(body);
        const pricing = await engine.calculatePricing(params);
        
        return NextResponse.json({
          success: true,
          data: pricing,
        });
      }
      
      case 'preview': {
        const body = await request.json();
        const params = previewSchema.parse(body);
        const preview = await engine.previewSubscriptionChange(params);
        
        return NextResponse.json({
          success: true,
          data: preview,
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Pricing API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const engine = new PricingEngine(supabase);
    
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const currency = url.searchParams.get('currency') || 'USD';
    
    switch (action) {
      case 'tiers': {
        const tiers = await engine.getTiers(currency);
        
        return NextResponse.json({
          success: true,
          data: tiers,
        });
      }
      
      case 'usage': {
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return NextResponse.json(
            { success: false, error: 'userId parameter required' },
            { status: 400 }
          );
        }
        
        const usage = await engine.getUserUsage(userId);
        
        return NextResponse.json({
          success: true,
          data: usage,
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Pricing API error:', error);
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    if (action === 'discounts') {
      const body = await request.json();
      const params = discountSchema.parse(body);
      
      // Apply discount to subscription
      const { data: discount, error: discountError } = await supabase
        .from('discounts')
        .select('*')
        .eq('code', params.discountCode)
        .eq('is_active', true)
        .gte('valid_until', new Date().toISOString())
        .single();

      if (discountError || !discount) {
        return NextResponse.json(
          { success: false, error: 'Invalid discount code' },
          { status: 400 }
        );
      }

      // Update subscription with discount
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ 
          discount_code: params.discountCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.subscriptionId)
        .eq('user_id', params.userId);

      if (updateError) {
        throw new Error('Failed to apply discount');
      }

      // Update discount usage count
      await supabase
        .from('discounts')
        .update({ current_uses: discount.current_uses + 1 })
        .eq('id', discount.id);

      return NextResponse.json({
        success: true,
        message: 'Discount applied successfully',
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Pricing API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
```