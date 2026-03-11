```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';
import Stripe from 'stripe';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { validateAuth } from '@/lib/auth';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Validation schemas
const calculatePriceSchema = z.object({
  serviceId: z.string().uuid(),
  creatorId: z.string().uuid(),
  basePrice: z.number().positive(),
  forceRecalculation: z.boolean().optional()
});

const abTestSchema = z.object({
  serviceId: z.string().uuid(),
  creatorId: z.string().uuid(),
  priceVariants: z.array(z.number().positive()).min(2).max(5),
  testName: z.string().min(1).max(100),
  duration: z.number().min(1).max(30),
  trafficSplit: z.array(z.number().min(0).max(100))
});

const updateTestSchema = z.object({
  testId: z.string().uuid(),
  conversionData: z.object({
    variant: z.number().int().min(0),
    conversions: z.number().int().min(0),
    impressions: z.number().int().min(0),
    revenue: z.number().min(0)
  })
});

// Pricing Engine Classes
class PricingEngine {
  private static readonly DEMAND_WEIGHT = 0.4;
  private static readonly COMPETITION_WEIGHT = 0.3;
  private static readonly PERFORMANCE_WEIGHT = 0.3;
  private static readonly MAX_PRICE_CHANGE = 0.2; // 20% max change

  static async calculateOptimalPrice(
    serviceId: string,
    creatorId: string,
    basePrice: number
  ): Promise<{
    suggestedPrice: number;
    confidence: number;
    factors: Record<string, number>;
  }> {
    const [demandScore, competitionScore, performanceScore] = await Promise.all([
      DemandForecaster.calculateDemandScore(serviceId),
      CompetitorAnalyzer.getCompetitionScore(serviceId),
      PerformanceMetricsCalculator.getPerformanceScore(creatorId)
    ]);

    const adjustmentFactor = 
      (demandScore * this.DEMAND_WEIGHT) +
      (competitionScore * this.COMPETITION_WEIGHT) +
      (performanceScore * this.PERFORMANCE_WEIGHT);

    const maxAdjustment = basePrice * this.MAX_PRICE_CHANGE;
    const priceAdjustment = Math.max(
      -maxAdjustment,
      Math.min(maxAdjustment, (adjustmentFactor - 1) * basePrice)
    );

    const suggestedPrice = Math.round((basePrice + priceAdjustment) * 100) / 100;
    
    const confidence = Math.min(
      0.95,
      0.6 + (Math.abs(adjustmentFactor - 1) * 0.35)
    );

    return {
      suggestedPrice,
      confidence,
      factors: {
        demand: demandScore,
        competition: competitionScore,
        performance: performanceScore,
        adjustment: adjustmentFactor
      }
    };
  }
}

class DemandForecaster {
  static async calculateDemandScore(serviceId: string): Promise<number> {
    const cacheKey = `demand:${serviceId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return parseFloat(cached);
    }

    const { data: metrics } = await supabase
      .from('demand_metrics')
      .select('*')
      .eq('service_id', serviceId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (!metrics || metrics.length === 0) {
      return 1.0; // Neutral demand
    }

    const recentViews = metrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const recentInquiries = metrics.reduce((sum, m) => sum + (m.inquiries || 0), 0);
    const recentConversions = metrics.reduce((sum, m) => sum + (m.conversions || 0), 0);

    const conversionRate = recentInquiries > 0 ? recentConversions / recentInquiries : 0;
    const inquiryRate = recentViews > 0 ? recentInquiries / recentViews : 0;

    // Calculate demand score (0.5 to 1.5 range)
    const viewTrend = this.calculateTrend(metrics.map(m => m.views || 0));
    const demandScore = Math.max(
      0.5,
      Math.min(1.5, 
        0.8 + 
        (conversionRate * 0.3) + 
        (inquiryRate * 0.2) + 
        (viewTrend * 0.2)
      )
    );

    await redis.setex(cacheKey, 300, demandScore.toString()); // Cache for 5 minutes
    return demandScore;
  }

  private static calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const recent = values.slice(0, Math.ceil(values.length / 2));
    const older = values.slice(Math.ceil(values.length / 2));
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    return olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
  }
}

class CompetitorAnalyzer {
  static async getCompetitionScore(serviceId: string): Promise<number> {
    const cacheKey = `competition:${serviceId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return parseFloat(cached);
    }

    const { data: service } = await supabase
      .from('creator_services')
      .select('category, subcategory, current_price')
      .eq('id', serviceId)
      .single();

    if (!service) return 1.0;

    const { data: competitors } = await supabase
      .from('competitor_data')
      .select('price, quality_score, updated_at')
      .eq('category', service.category)
      .eq('subcategory', service.subcategory)
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!competitors || competitors.length === 0) {
      return 1.0; // Neutral if no competitor data
    }

    const avgCompetitorPrice = competitors.reduce((sum, c) => sum + c.price, 0) / competitors.length;
    const currentPrice = service.current_price;

    // Score based on price positioning (0.7 to 1.3 range)
    let competitionScore = 1.0;
    if (currentPrice > avgCompetitorPrice * 1.1) {
      competitionScore = 0.7; // Priced too high
    } else if (currentPrice < avgCompetitorPrice * 0.9) {
      competitionScore = 1.3; // Opportunity to increase
    } else {
      competitionScore = 1.0; // Competitively priced
    }

    await redis.setex(cacheKey, 600, competitionScore.toString()); // Cache for 10 minutes
    return competitionScore;
  }
}

class PerformanceMetricsCalculator {
  static async getPerformanceScore(creatorId: string): Promise<number> {
    const cacheKey = `performance:${creatorId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return parseFloat(cached);
    }

    const { data: metrics } = await supabase
      .from('creator_performance')
      .select('*')
      .eq('creator_id', creatorId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (!metrics) return 1.0;

    const satisfactionScore = metrics.avg_rating / 5.0;
    const deliveryScore = metrics.on_time_delivery_rate;
    const retentionScore = metrics.client_retention_rate;
    const volumeScore = Math.min(1.0, metrics.completed_projects / 10);

    const performanceScore = Math.max(
      0.6,
      Math.min(1.4,
        0.7 + 
        (satisfactionScore * 0.25) + 
        (deliveryScore * 0.25) + 
        (retentionScore * 0.25) + 
        (volumeScore * 0.25)
      )
    );

    await redis.setex(cacheKey, 900, performanceScore.toString()); // Cache for 15 minutes
    return performanceScore;
  }
}

class ABTestManager {
  static async createTest(data: z.infer<typeof abTestSchema>): Promise<string> {
    const { data: test, error } = await supabase
      .from('ab_tests')
      .insert({
        service_id: data.serviceId,
        creator_id: data.creatorId,
        test_name: data.testName,
        price_variants: data.priceVariants,
        traffic_split: data.trafficSplit,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + data.duration * 24 * 60 * 60 * 1000).toISOString(),
        results: data.priceVariants.map(() => ({
          impressions: 0,
          conversions: 0,
          revenue: 0
        }))
      })
      .select('id')
      .single();

    if (error) throw error;
    return test.id;
  }

  static async updateTestResults(testId: string, conversionData: any): Promise<void> {
    const { data: test } = await supabase
      .from('ab_tests')
      .select('results')
      .eq('id', testId)
      .single();

    if (!test) throw new Error('Test not found');

    const results = [...test.results];
    const variant = conversionData.variant;
    
    if (results[variant]) {
      results[variant].impressions += conversionData.impressions;
      results[variant].conversions += conversionData.conversions;
      results[variant].revenue += conversionData.revenue;
    }

    await supabase
      .from('ab_tests')
      .update({ 
        results,
        updated_at: new Date().toISOString()
      })
      .eq('id', testId);
  }

  static async getActiveTest(serviceId: string): Promise<any | null> {
    const { data } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('service_id', serviceId)
      .eq('status', 'active')
      .single();

    return data;
  }
}

class PriceHistoryTracker {
  static async recordPriceChange(
    serviceId: string,
    oldPrice: number,
    newPrice: number,
    reason: string,
    confidence: number
  ): Promise<void> {
    await supabase
      .from('pricing_history')
      .insert({
        service_id: serviceId,
        old_price: oldPrice,
        new_price: newPrice,
        change_reason: reason,
        confidence_score: confidence,
        created_at: new Date().toISOString()
      });
  }
}

// Main API handlers
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(request, 'pricing-calculate', 10, 60);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.includes('/calculate')) {
      const body = await request.json();
      const validatedData = calculatePriceSchema.parse(body);

      // Check for active A/B test
      const activeTest = await ABTestManager.getActiveTest(validatedData.serviceId);
      if (activeTest && !validatedData.forceRecalculation) {
        const randomVariant = Math.floor(Math.random() * activeTest.price_variants.length);
        return NextResponse.json({
          price: activeTest.price_variants[randomVariant],
          isABTest: true,
          variant: randomVariant,
          testId: activeTest.id
        });
      }

      const result = await PricingEngine.calculateOptimalPrice(
        validatedData.serviceId,
        validatedData.creatorId,
        validatedData.basePrice
      );

      // Record price change if significant
      if (Math.abs(result.suggestedPrice - validatedData.basePrice) > 0.01) {
        await PriceHistoryTracker.recordPriceChange(
          validatedData.serviceId,
          validatedData.basePrice,
          result.suggestedPrice,
          'Dynamic pricing adjustment',
          result.confidence
        );
      }

      return NextResponse.json({
        suggestedPrice: result.suggestedPrice,
        confidence: result.confidence,
        factors: result.factors,
        recommendation: result.confidence > 0.8 ? 'apply' : 'review',
        isABTest: false
      });
    }

    if (pathname.includes('/ab-test') && request.method === 'POST') {
      const body = await request.json();
      const validatedData = abTestSchema.parse(body);

      const testId = await ABTestManager.createTest(validatedData);
      
      return NextResponse.json({
        testId,
        status: 'created',
        message: 'A/B test created successfully'
      });
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  } catch (error) {
    console.error('Pricing API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const serviceId = pathname.split('/').pop();

    if (pathname.includes('/history/') && serviceId) {
      const { data: history } = await supabase
        .from('pricing_history')
        .select('*')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(50);

      return NextResponse.json({ history: history || [] });
    }

    if (pathname.includes('/analytics/')) {
      const { data: analytics } = await supabase
        .from('pricing_analytics')
        .select('*')
        .eq('service_id', serviceId)
        .single();

      return NextResponse.json({ analytics });
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  } catch (error) {
    console.error('GET Pricing API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname.includes('/ab-test/')) {
      const body = await request.json();
      const validatedData = updateTestSchema.parse(body);

      await ABTestManager.updateTestResults(
        validatedData.testId,
        validatedData.conversionData
      );

      return NextResponse.json({
        success: true,
        message: 'A/B test results updated'
      });
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });

  } catch (error) {
    console.error('PUT Pricing API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
```