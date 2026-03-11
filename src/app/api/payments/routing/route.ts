import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Redis } from 'ioredis';

// Types
interface PaymentProcessor {
  id: string;
  name: string;
  type: 'stripe' | 'paypal' | 'square' | 'adyen';
  supported_methods: string[];
  supported_countries: string[];
  base_fee_percentage: number;
  fixed_fee_cents: number;
  currency_support: string[];
  is_active: boolean;
  health_score: number;
  avg_success_rate: number;
  avg_processing_time_ms: number;
}

interface GeographicRule {
  processor_id: string;
  country_code: string;
  priority_boost: number;
  is_preferred: boolean;
}

interface ProcessorHealth {
  processor_id: string;
  is_healthy: boolean;
  last_check: string;
  error_rate: number;
  response_time_ms: number;
}

interface RoutingWeights {
  success_rate: number;
  fees: number;
  geography: number;
  method_support: number;
}

// Validation schemas
const routingRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  payment_method: z.string(),
  customer_country: z.string().length(2).optional(),
  customer_ip: z.string().optional(),
  merchant_id: z.string().uuid(),
  priority: z.enum(['cost', 'speed', 'reliability']).default('reliability'),
  excluded_processors: z.array(z.string()).optional().default([]),
});

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

class PaymentRoutingEngine {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly WEIGHTS: Record<string, RoutingWeights> = {
    cost: { success_rate: 0.2, fees: 0.5, geography: 0.2, method_support: 0.1 },
    speed: { success_rate: 0.3, fees: 0.2, geography: 0.3, method_support: 0.2 },
    reliability: { success_rate: 0.4, fees: 0.3, geography: 0.2, method_support: 0.1 },
  };

  static async getOptimalProcessor(
    amount: number,
    currency: string,
    paymentMethod: string,
    customerCountry: string,
    merchantId: string,
    priority: string,
    excludedProcessors: string[]
  ) {
    // Get available processors
    const processors = await this.getActiveProcessors(merchantId);
    
    // Filter by support criteria
    const supportedProcessors = processors.filter(p => 
      !excludedProcessors.includes(p.id) &&
      p.supported_methods.includes(paymentMethod) &&
      p.currency_support.includes(currency) &&
      (p.supported_countries.length === 0 || p.supported_countries.includes(customerCountry))
    );

    if (supportedProcessors.length === 0) {
      throw new Error('No processors support the requested payment configuration');
    }

    // Get processor health status
    const healthStatuses = await this.getProcessorHealthStatuses(
      supportedProcessors.map(p => p.id)
    );

    // Filter out unhealthy processors
    const healthyProcessors = supportedProcessors.filter(p => {
      const health = healthStatuses.find(h => h.processor_id === p.id);
      return health?.is_healthy !== false;
    });

    if (healthyProcessors.length === 0) {
      throw new Error('No healthy processors available');
    }

    // Get geographic rules
    const geoRules = await this.getGeographicRules(customerCountry);

    // Calculate scores for each processor
    const scores = await Promise.all(
      healthyProcessors.map(processor => 
        this.calculateProcessorScore(
          processor,
          amount,
          currency,
          customerCountry,
          geoRules,
          this.WEIGHTS[priority] || this.WEIGHTS.reliability
        )
      )
    );

    // Sort by score (highest first)
    const rankedProcessors = healthyProcessors
      .map((processor, index) => ({
        processor,
        score: scores[index],
        health: healthStatuses.find(h => h.processor_id === processor.id)
      }))
      .sort((a, b) => b.score - a.score);

    return {
      primary: rankedProcessors[0],
      fallbacks: rankedProcessors.slice(1, 3),
      decision_factors: {
        total_candidates: processors.length,
        supported_candidates: supportedProcessors.length,
        healthy_candidates: healthyProcessors.length,
        routing_priority: priority,
        weights_used: this.WEIGHTS[priority] || this.WEIGHTS.reliability
      }
    };
  }

  private static async getActiveProcessors(merchantId: string): Promise<PaymentProcessor[]> {
    const cacheKey = `processors:${merchantId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for processors:', error);
    }

    const { data: processors, error } = await supabase
      .from('payment_processors')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    if (error) throw error;

    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(processors));
    } catch (error) {
      console.warn('Failed to cache processors:', error);
    }

    return processors || [];
  }

  private static async getProcessorHealthStatuses(processorIds: string[]): Promise<ProcessorHealth[]> {
    const healthStatuses: ProcessorHealth[] = [];

    for (const processorId of processorIds) {
      const cacheKey = `health:${processorId}`;
      
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          healthStatuses.push(JSON.parse(cached));
          continue;
        }
      } catch (error) {
        console.warn('Redis cache miss for health:', error);
      }

      // Fallback to database
      const { data: health } = await supabase
        .from('processor_health')
        .select('*')
        .eq('processor_id', processorId)
        .single();

      if (health) {
        healthStatuses.push(health);
        try {
          await redis.setex(cacheKey, 60, JSON.stringify(health)); // 1 minute TTL for health
        } catch (error) {
          console.warn('Failed to cache health status:', error);
        }
      }
    }

    return healthStatuses;
  }

  private static async getGeographicRules(countryCode: string): Promise<GeographicRule[]> {
    const cacheKey = `geo_rules:${countryCode}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for geo rules:', error);
    }

    const { data: rules, error } = await supabase
      .from('geographic_rules')
      .select('*')
      .eq('country_code', countryCode);

    if (error) throw error;

    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(rules || []));
    } catch (error) {
      console.warn('Failed to cache geo rules:', error);
    }

    return rules || [];
  }

  private static async calculateProcessorScore(
    processor: PaymentProcessor,
    amount: number,
    currency: string,
    customerCountry: string,
    geoRules: GeographicRule[],
    weights: RoutingWeights
  ): Promise<number> {
    // Success rate score (0-100)
    const successScore = processor.avg_success_rate;

    // Fee score (inverted - lower fees = higher score)
    const totalFee = (amount * processor.base_fee_percentage / 100) + processor.fixed_fee_cents;
    const feeScore = Math.max(0, 100 - (totalFee / amount) * 1000); // Normalize fee impact

    // Geographic score
    const geoRule = geoRules.find(r => r.processor_id === processor.id);
    let geoScore = 50; // Default neutral score
    if (geoRule) {
      geoScore = geoRule.is_preferred ? 90 : 70;
      geoScore += geoRule.priority_boost;
    }
    geoScore = Math.min(100, Math.max(0, geoScore));

    // Method support score (binary - either supports or doesn't)
    const methodScore = 100; // Already filtered for support

    // Calculate weighted score
    const totalScore = 
      (successScore * weights.success_rate) +
      (feeScore * weights.fees) +
      (geoScore * weights.geography) +
      (methodScore * weights.method_support);

    // Apply health penalty
    const healthPenalty = processor.health_score < 80 ? (80 - processor.health_score) : 0;
    
    return Math.max(0, totalScore - healthPenalty);
  }

  static async logRoutingDecision(
    merchantId: string,
    selectedProcessor: string,
    amount: number,
    currency: string,
    paymentMethod: string,
    customerCountry: string,
    decisionFactors: any
  ) {
    try {
      await supabase.from('routing_decisions').insert({
        merchant_id: merchantId,
        selected_processor: selectedProcessor,
        amount,
        currency,
        payment_method: paymentMethod,
        customer_country: customerCountry,
        decision_factors: decisionFactors,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log routing decision:', error);
    }
  }
}

class GeoIPService {
  static async getCountryFromIP(ip: string): Promise<string> {
    try {
      // Use a GeoIP service or database lookup
      const response = await fetch(`http://ip-api.com/json/${ip}`);
      const data = await response.json();
      return data.countryCode || 'US'; // Default to US
    } catch (error) {
      console.warn('GeoIP lookup failed:', error);
      return 'US';
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = routingRequestSchema.parse(body);
    
    const {
      amount,
      currency,
      payment_method: paymentMethod,
      customer_country: providedCountry,
      customer_ip: customerIP,
      merchant_id: merchantId,
      priority,
      excluded_processors: excludedProcessors
    } = validatedData;

    // Determine customer country
    let customerCountry = providedCountry;
    if (!customerCountry && customerIP) {
      customerCountry = await GeoIPService.getCountryFromIP(customerIP);
    }
    if (!customerCountry) {
      customerCountry = 'US'; // Default fallback
    }

    // Get optimal processor routing
    const routing = await PaymentRoutingEngine.getOptimalProcessor(
      amount,
      currency,
      paymentMethod,
      customerCountry,
      merchantId,
      priority,
      excludedProcessors
    );

    // Log the routing decision
    await PaymentRoutingEngine.logRoutingDecision(
      merchantId,
      routing.primary.processor.id,
      amount,
      currency,
      paymentMethod,
      customerCountry,
      routing.decision_factors
    );

    return NextResponse.json({
      success: true,
      data: {
        primary_processor: {
          id: routing.primary.processor.id,
          name: routing.primary.processor.name,
          type: routing.primary.processor.type,
          score: routing.primary.score,
          estimated_fee: {
            percentage: routing.primary.processor.base_fee_percentage,
            fixed_cents: routing.primary.processor.fixed_fee_cents,
            total_cents: Math.round(
              (amount * routing.primary.processor.base_fee_percentage / 100) + 
              routing.primary.processor.fixed_fee_cents
            )
          },
          health_status: routing.primary.health
        },
        fallback_processors: routing.fallbacks.map(fallback => ({
          id: fallback.processor.id,
          name: fallback.processor.name,
          type: fallback.processor.type,
          score: fallback.score
        })),
        routing_metadata: {
          customer_country: customerCountry,
          decision_factors: routing.decision_factors,
          routing_timestamp: new Date().toISOString()
        }
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Payment routing error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }

    if (error instanceof Error && error.message.includes('No processors')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 422 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchant_id');

    if (!merchantId) {
      return NextResponse.json({
        success: false,
        error: 'merchant_id parameter required'
      }, { status: 400 });
    }

    // Get processor health overview
    const { data: processors } = await supabase
      .from('payment_processors')
      .select('id, name, type, is_active, health_score, avg_success_rate')
      .eq('merchant_id', merchantId);

    const healthStatuses = processors ? await PaymentRoutingEngine['getProcessorHealthStatuses'](
      processors.map(p => p.id)
    ) : [];

    return NextResponse.json({
      success: true,
      data: {
        processors: processors?.map(processor => ({
          ...processor,
          health_status: healthStatuses.find(h => h.processor_id === processor.id)
        })) || [],
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get routing status error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}