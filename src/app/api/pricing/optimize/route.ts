```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { encrypt } from '@/lib/encryption';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Request validation schema
const optimizePricingSchema = z.object({
  creatorId: z.string().uuid(),
  productType: z.enum(['track', 'album', 'merchandise', 'subscription', 'live_show']),
  currentPrice: z.number().positive(),
  targetMetric: z.enum(['revenue', 'conversion', 'market_share']),
  testDuration: z.number().min(7).max(90).default(30),
  confidenceLevel: z.number().min(0.8).max(0.99).default(0.95),
  constraints: z.object({
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
    allowedVariation: z.number().min(0.05).max(0.5).default(0.2),
  }).optional(),
});

interface PricingAnalysis {
  marketPosition: 'budget' | 'mid-tier' | 'premium' | 'luxury';
  competitorAverage: number;
  demandElasticity: number;
  seasonalityFactor: number;
  engagementScore: number;
}

interface ABTestVariant {
  variantId: string;
  price: number;
  trafficAllocation: number;
  expectedConversion: number;
}

interface OptimizationResult {
  recommendedPrice: number;
  confidence: number;
  expectedLift: number;
  abTestVariants: ABTestVariant[];
  reasoning: string;
  implementationPlan: string[];
}

class PricingOptimizationEngine {
  private async getMarketAnalysis(creatorId: string, productType: string): Promise<PricingAnalysis> {
    const cacheKey = `market_analysis:${creatorId}:${productType}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return cached as PricingAnalysis;
    }

    // Fetch competitor data
    const { data: competitorData, error: competitorError } = await supabase
      .from('competitor_data')
      .select('price, product_type, market_position, last_updated')
      .eq('product_type', productType)
      .gte('last_updated', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (competitorError) {
      throw new Error(`Failed to fetch competitor data: ${competitorError.message}`);
    }

    // Get engagement metrics
    const { data: engagementData, error: engagementError } = await supabase
      .from('engagement_metrics')
      .select('conversion_rate, bounce_rate, time_on_page, social_shares')
      .eq('creator_id', creatorId)
      .order('recorded_at', { ascending: false })
      .limit(30);

    if (engagementError) {
      throw new Error(`Failed to fetch engagement data: ${engagementError.message}`);
    }

    // Calculate market position and metrics
    const prices = competitorData?.map(d => d.price) || [];
    const competitorAverage = prices.reduce((a, b) => a + b, 0) / prices.length || 0;
    
    const avgConversion = engagementData?.reduce((sum, item) => sum + (item.conversion_rate || 0), 0) / (engagementData?.length || 1) || 0;
    const avgEngagement = engagementData?.reduce((sum, item) => sum + ((item.time_on_page || 0) + (item.social_shares || 0)), 0) / (engagementData?.length || 1) || 0;

    const analysis: PricingAnalysis = {
      marketPosition: this.determineMarketPosition(competitorAverage, prices),
      competitorAverage,
      demandElasticity: this.calculateDemandElasticity(engagementData || []),
      seasonalityFactor: this.calculateSeasonalityFactor(productType),
      engagementScore: Math.min(100, Math.max(0, avgEngagement * 10)),
    };

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(analysis));
    
    return analysis;
  }

  private determineMarketPosition(competitorAverage: number, prices: number[]): PricingAnalysis['marketPosition'] {
    if (!prices.length) return 'mid-tier';
    
    const sorted = prices.sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    
    if (competitorAverage <= q1) return 'budget';
    if (competitorAverage <= competitorAverage) return 'mid-tier';
    if (competitorAverage <= q3) return 'premium';
    return 'luxury';
  }

  private calculateDemandElasticity(engagementData: any[]): number {
    if (!engagementData.length) return -1.5; // Default elasticity
    
    // Simplified elasticity calculation based on conversion trends
    const conversionTrend = this.calculateTrend(engagementData.map(d => d.conversion_rate || 0));
    return Math.max(-3, Math.min(-0.5, conversionTrend * -2));
  }

  private calculateSeasonalityFactor(productType: string): number {
    const month = new Date().getMonth();
    const seasonalityMap: Record<string, number[]> = {
      track: [0.8, 0.8, 0.9, 1.0, 1.1, 1.1, 1.0, 0.9, 1.0, 1.1, 1.2, 1.3],
      album: [0.7, 0.8, 0.9, 1.0, 1.0, 1.1, 0.9, 0.8, 0.9, 1.1, 1.3, 1.4],
      merchandise: [0.9, 0.9, 1.0, 1.0, 1.1, 1.0, 0.8, 0.8, 1.0, 1.1, 1.3, 1.5],
      subscription: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      live_show: [0.7, 0.8, 1.0, 1.2, 1.3, 1.4, 1.2, 1.0, 1.1, 1.2, 1.1, 0.9],
    };
    
    return seasonalityMap[productType]?.[month] || 1.0;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * values[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private async generateAIRecommendation(
    analysis: PricingAnalysis,
    currentPrice: number,
    targetMetric: string,
    constraints?: any
  ): Promise<{ recommendation: number; reasoning: string; implementationPlan: string[] }> {
    const prompt = `As a pricing optimization AI, analyze the following data and provide a price recommendation:

Current Price: $${currentPrice}
Market Position: ${analysis.marketPosition}
Competitor Average: $${analysis.competitorAverage}
Demand Elasticity: ${analysis.demandElasticity}
Seasonality Factor: ${analysis.seasonalityFactor}
Engagement Score: ${analysis.engagementScore}/100
Target Metric: ${targetMetric}
Constraints: ${JSON.stringify(constraints || {})}

Provide a JSON response with:
1. recommendedPrice (number)
2. reasoning (string explaining the logic)
3. implementationPlan (array of actionable steps)

Consider psychological pricing, market positioning, and revenue optimization.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0]?.message?.content || '{}');
    
    // Validate and constrain the recommendation
    let recommendedPrice = response.recommendedPrice || currentPrice;
    
    if (constraints) {
      if (constraints.minPrice) recommendedPrice = Math.max(recommendedPrice, constraints.minPrice);
      if (constraints.maxPrice) recommendedPrice = Math.min(recommendedPrice, constraints.maxPrice);
      
      const maxVariation = currentPrice * (constraints.allowedVariation || 0.2);
      recommendedPrice = Math.max(currentPrice - maxVariation, Math.min(currentPrice + maxVariation, recommendedPrice));
    }

    return {
      recommendation: Math.round(recommendedPrice * 100) / 100,
      reasoning: response.reasoning || 'AI-optimized pricing based on market analysis',
      implementationPlan: response.implementationPlan || ['Update pricing gradually', 'Monitor conversion rates', 'Adjust based on performance'],
    };
  }

  private generateABTestVariants(
    basePrice: number,
    recommendedPrice: number,
    constraints?: any
  ): ABTestVariant[] {
    const variants: ABTestVariant[] = [];
    
    // Control variant (current price)
    variants.push({
      variantId: 'control',
      price: basePrice,
      trafficAllocation: 0.4,
      expectedConversion: 1.0, // baseline
    });

    // Recommended price variant
    variants.push({
      variantId: 'recommended',
      price: recommendedPrice,
      trafficAllocation: 0.4,
      expectedConversion: this.estimateConversionLift(basePrice, recommendedPrice),
    });

    // Conservative variant (smaller change)
    const conservativePrice = basePrice + (recommendedPrice - basePrice) * 0.5;
    variants.push({
      variantId: 'conservative',
      price: Math.round(conservativePrice * 100) / 100,
      trafficAllocation: 0.2,
      expectedConversion: this.estimateConversionLift(basePrice, conservativePrice),
    });

    return variants;
  }

  private estimateConversionLift(currentPrice: number, newPrice: number): number {
    const priceChange = (newPrice - currentPrice) / currentPrice;
    const elasticity = -1.5; // Default price elasticity
    const conversionChange = elasticity * priceChange;
    return Math.max(0.1, 1 + conversionChange);
  }

  async optimize(request: z.infer<typeof optimizePricingSchema>): Promise<OptimizationResult> {
    const {
      creatorId,
      productType,
      currentPrice,
      targetMetric,
      testDuration,
      confidenceLevel,
      constraints,
    } = request;

    // Get market analysis
    const analysis = await this.getMarketAnalysis(creatorId, productType);

    // Generate AI recommendation
    const aiResult = await this.generateAIRecommendation(
      analysis,
      currentPrice,
      targetMetric,
      constraints
    );

    // Create A/B test variants
    const abTestVariants = this.generateABTestVariants(
      currentPrice,
      aiResult.recommendation,
      constraints
    );

    // Calculate expected lift
    const expectedLift = ((aiResult.recommendation - currentPrice) / currentPrice) * 100;

    // Store optimization in database
    const { data: optimizationRecord, error: dbError } = await supabase
      .from('pricing_strategies')
      .insert({
        creator_id: creatorId,
        product_type: productType,
        current_price: currentPrice,
        recommended_price: aiResult.recommendation,
        market_analysis: analysis,
        confidence_level: confidenceLevel,
        expected_lift: expectedLift,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      throw new Error(`Failed to store optimization: ${dbError.message}`);
    }

    // Create A/B test record
    const { error: abTestError } = await supabase
      .from('ab_tests')
      .insert({
        pricing_strategy_id: optimizationRecord.id,
        variants: abTestVariants,
        duration_days: testDuration,
        confidence_level: confidenceLevel,
        status: 'ready',
        created_at: new Date().toISOString(),
      });

    if (abTestError) {
      throw new Error(`Failed to create A/B test: ${abTestError.message}`);
    }

    return {
      recommendedPrice: aiResult.recommendation,
      confidence: confidenceLevel,
      expectedLift,
      abTestVariants,
      reasoning: aiResult.reasoning,
      implementationPlan: aiResult.implementationPlan,
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = optimizePricingSchema.parse(body);

    // Verify creator access
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Verify creator ownership
    const { data: creatorData, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', validatedData.creatorId)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creatorData) {
      return NextResponse.json(
        { error: 'Creator not found or access denied' },
        { status: 403 }
      );
    }

    // Initialize and run optimization
    const optimizer = new PricingOptimizationEngine();
    const result = await optimizer.optimize(validatedData);

    // Log optimization event
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'pricing_optimization_requested',
      resource_type: 'pricing_strategy',
      resource_id: validatedData.creatorId,
      details: {
        product_type: validatedData.productType,
        current_price: validatedData.currentPrice,
        recommended_price: result.recommendedPrice,
        expected_lift: result.expectedLift,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Pricing optimization error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      return NextResponse.json(
        {
          error: isDevelopment ? error.message : 'Internal server error',
          ...(isDevelopment && { stack: error.stack }),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get('creatorId');
    const status = searchParams.get('status') || 'active';

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    // Verify authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      );
    }

    // Get pricing strategies
    const { data: strategies, error } = await supabase
      .from('pricing_strategies')
      .select(`
        *,
        ab_tests (
          id,
          variants,
          status,
          results,
          created_at,
          updated_at
        )
      `)
      .eq('creator_id', creatorId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to fetch pricing strategies: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: strategies || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching pricing strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing strategies' },
      { status: 500 }
    );
  }
}
```