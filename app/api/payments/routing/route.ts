```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

interface PaymentRequest {
  amount: number;
  currency: string;
  region: string;
  country: string;
  paymentMethod: string;
  merchantId: string;
  customerTier?: string;
  priority?: 'cost' | 'speed' | 'reliability';
}

interface ProcessorMetrics {
  processorId: string;
  name: string;
  successRate: number;
  averageProcessingTime: number;
  baseFee: number;
  percentageFee: number;
  availability: number;
  supportedRegions: string[];
  supportedMethods: string[];
  complianceScore: number;
  lastUpdated: string;
}

interface RoutingResult {
  primaryProcessor: ProcessorRecommendation;
  fallbackProcessors: ProcessorRecommendation[];
  routingReason: string;
  estimatedCost: number;
  estimatedTime: number;
  successProbability: number;
  complianceStatus: 'compliant' | 'restricted' | 'blocked';
  routeId: string;
}

interface ProcessorRecommendation {
  processorId: string;
  name: string;
  score: number;
  cost: number;
  estimatedTime: number;
  successRate: number;
  fees: {
    fixed: number;
    percentage: number;
    total: number;
  };
}

class PaymentRoutingEngine {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly ML_ENDPOINT = process.env.ML_PIPELINE_URL;

  static async routePayment(request: PaymentRequest): Promise<RoutingResult> {
    const routeId = this.generateRouteId();
    
    try {
      // 1. Validate compliance
      const complianceResult = await this.validateCompliance(request);
      if (complianceResult.status === 'blocked') {
        throw new Error(`Transaction blocked: ${complianceResult.reason}`);
      }

      // 2. Get available processors
      const availableProcessors = await this.getAvailableProcessors(request);
      
      if (availableProcessors.length === 0) {
        throw new Error('No available processors for this transaction');
      }

      // 3. Get real-time metrics
      const processorsWithMetrics = await this.enrichWithMetrics(availableProcessors, request);

      // 4. Predict success rates using ML
      const processorsWithPredictions = await this.predictSuccessRates(processorsWithMetrics, request);

      // 5. Calculate optimization scores
      const rankedProcessors = await this.calculateOptimizationScores(processorsWithPredictions, request);

      // 6. Apply business rules
      const finalRanking = await this.applyBusinessRules(rankedProcessors, request);

      // 7. Build routing result
      const result = this.buildRoutingResult(finalRanking, complianceResult, routeId, request);

      // 8. Cache and log
      await this.cacheRoute(routeId, result);
      await this.logRouting(request, result);

      return result;

    } catch (error) {
      await this.logError(routeId, request, error as Error);
      throw error;
    }
  }

  private static async validateCompliance(request: PaymentRequest) {
    const cacheKey = `compliance:${request.country}:${request.paymentMethod}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    const { data: rules } = await supabase
      .from('compliance_rules')
      .select('*')
      .or(`country.eq.${request.country},country.eq.global`)
      .eq('active', true);

    let status = 'compliant';
    let reason = '';

    for (const rule of rules || []) {
      if (rule.rule_type === 'amount_limit' && request.amount > rule.max_amount) {
        status = 'restricted';
        reason = `Amount exceeds limit for ${request.country}`;
      }
      
      if (rule.rule_type === 'method_restriction' && 
          rule.restricted_methods?.includes(request.paymentMethod)) {
        status = 'blocked';
        reason = `Payment method not allowed in ${request.country}`;
        break;
      }
    }

    const result = { status, reason, complianceScore: status === 'compliant' ? 100 : 0 };
    await redis.setex(cacheKey, 3600, JSON.stringify(result));
    
    return result;
  }

  private static async getAvailableProcessors(request: PaymentRequest): Promise<ProcessorMetrics[]> {
    const { data: processors } = await supabase
      .from('payment_processors')
      .select('*')
      .eq('active', true)
      .contains('supported_regions', [request.region])
      .contains('supported_methods', [request.paymentMethod]);

    return processors || [];
  }

  private static async enrichWithMetrics(processors: ProcessorMetrics[], request: PaymentRequest): Promise<ProcessorMetrics[]> {
    const enrichedProcessors = await Promise.all(
      processors.map(async (processor) => {
        const metricsKey = `metrics:${processor.processorId}:${request.region}`;
        const cachedMetrics = await redis.get(metricsKey);
        
        if (cachedMetrics) {
          const metrics = JSON.parse(cachedMetrics);
          return { ...processor, ...metrics };
        }

        // Fetch real-time metrics
        const { data: realtimeMetrics } = await supabase
          .from('routing_metrics')
          .select('*')
          .eq('processor_id', processor.processorId)
          .eq('region', request.region)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(100);

        if (realtimeMetrics && realtimeMetrics.length > 0) {
          const avgSuccessRate = realtimeMetrics.reduce((sum, m) => sum + m.success_rate, 0) / realtimeMetrics.length;
          const avgProcessingTime = realtimeMetrics.reduce((sum, m) => sum + m.processing_time, 0) / realtimeMetrics.length;
          
          processor.successRate = avgSuccessRate;
          processor.averageProcessingTime = avgProcessingTime;
          
          await redis.setex(metricsKey, this.CACHE_TTL, JSON.stringify({
            successRate: avgSuccessRate,
            averageProcessingTime: avgProcessingTime
          }));
        }

        return processor;
      })
    );

    return enrichedProcessors;
  }

  private static async predictSuccessRates(processors: ProcessorMetrics[], request: PaymentRequest): Promise<ProcessorMetrics[]> {
    if (!this.ML_ENDPOINT) {
      return processors;
    }

    try {
      const predictions = await Promise.all(
        processors.map(async (processor) => {
          const response = await fetch(`${this.ML_ENDPOINT}/predict-success`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              processor: processor.processorId,
              amount: request.amount,
              currency: request.currency,
              region: request.region,
              paymentMethod: request.paymentMethod,
              historicalSuccessRate: processor.successRate,
              processingTime: processor.averageProcessingTime
            })
          });

          if (response.ok) {
            const prediction = await response.json();
            processor.successRate = Math.max(processor.successRate * 0.3 + prediction.predictedSuccessRate * 0.7, 0);
          }

          return processor;
        })
      );

      return predictions;
    } catch (error) {
      console.error('ML prediction failed:', error);
      return processors;
    }
  }

  private static async calculateOptimizationScores(processors: ProcessorMetrics[], request: PaymentRequest): Promise<ProcessorRecommendation[]> {
    const priority = request.priority || 'reliability';
    
    return processors.map(processor => {
      const fixedFee = processor.baseFee;
      const percentageFee = request.amount * (processor.percentageFee / 100);
      const totalCost = fixedFee + percentageFee;

      // Normalize scores (0-100)
      const costScore = Math.max(0, 100 - (totalCost / request.amount * 100));
      const speedScore = Math.max(0, 100 - (processor.averageProcessingTime / 10));
      const reliabilityScore = processor.successRate;
      const availabilityScore = processor.availability;

      let finalScore = 0;
      switch (priority) {
        case 'cost':
          finalScore = costScore * 0.5 + reliabilityScore * 0.3 + speedScore * 0.2;
          break;
        case 'speed':
          finalScore = speedScore * 0.5 + reliabilityScore * 0.3 + costScore * 0.2;
          break;
        case 'reliability':
        default:
          finalScore = reliabilityScore * 0.5 + availabilityScore * 0.3 + costScore * 0.2;
          break;
      }

      return {
        processorId: processor.processorId,
        name: processor.name,
        score: finalScore * (processor.complianceScore / 100),
        cost: totalCost,
        estimatedTime: processor.averageProcessingTime,
        successRate: processor.successRate,
        fees: {
          fixed: fixedFee,
          percentage: percentageFee,
          total: totalCost
        }
      };
    });
  }

  private static async applyBusinessRules(processors: ProcessorRecommendation[], request: PaymentRequest): Promise<ProcessorRecommendation[]> {
    let filtered = processors.slice();

    // Rule 1: Customer tier preferences
    if (request.customerTier === 'premium') {
      filtered = filtered.filter(p => p.successRate >= 95);
    }

    // Rule 2: High-value transaction routing
    if (request.amount > 10000) {
      filtered = filtered.filter(p => p.name.includes('Enterprise') || p.successRate >= 98);
    }

    // Rule 3: Geographic preferences
    const { data: geoRules } = await supabase
      .from('geographic_routing_rules')
      .select('*')
      .eq('region', request.region)
      .eq('active', true);

    if (geoRules && geoRules.length > 0) {
      const preferredProcessors = geoRules[0].preferred_processors || [];
      if (preferredProcessors.length > 0) {
        filtered.forEach(processor => {
          if (preferredProcessors.includes(processor.processorId)) {
            processor.score *= 1.1; // 10% boost
          }
        });
      }
    }

    return filtered.sort((a, b) => b.score - a.score);
  }

  private static buildRoutingResult(
    rankedProcessors: ProcessorRecommendation[],
    complianceResult: any,
    routeId: string,
    request: PaymentRequest
  ): RoutingResult {
    const primary = rankedProcessors[0];
    const fallbacks = rankedProcessors.slice(1, 4); // Top 3 fallbacks

    let routingReason = '';
    switch (request.priority) {
      case 'cost':
        routingReason = 'Optimized for lowest transaction cost';
        break;
      case 'speed':
        routingReason = 'Optimized for fastest processing time';
        break;
      default:
        routingReason = 'Optimized for highest success rate and reliability';
    }

    return {
      primaryProcessor: primary,
      fallbackProcessors: fallbacks,
      routingReason,
      estimatedCost: primary.cost,
      estimatedTime: primary.estimatedTime,
      successProbability: primary.successRate,
      complianceStatus: complianceResult.status,
      routeId
    };
  }

  private static async cacheRoute(routeId: string, result: RoutingResult): Promise<void> {
    await redis.setex(`route:${routeId}`, 1800, JSON.stringify(result)); // 30 min cache
  }

  private static async logRouting(request: PaymentRequest, result: RoutingResult): Promise<void> {
    await supabase.from('routing_logs').insert({
      route_id: result.routeId,
      merchant_id: request.merchantId,
      amount: request.amount,
      currency: request.currency,
      region: request.region,
      primary_processor: result.primaryProcessor.processorId,
      estimated_cost: result.estimatedCost,
      success_probability: result.successProbability,
      routing_reason: result.routingReason,
      created_at: new Date().toISOString()
    });
  }

  private static async logError(routeId: string, request: PaymentRequest, error: Error): Promise<void> {
    await supabase.from('routing_errors').insert({
      route_id: routeId,
      merchant_id: request.merchantId,
      error_message: error.message,
      error_stack: error.stack,
      request_data: JSON.stringify(request),
      created_at: new Date().toISOString()
    });
  }

  private static generateRouteId(): string {
    return `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const { amount, currency, region, country, paymentMethod, merchantId } = body;
    
    if (!amount || !currency || !region || !country || !paymentMethod || !merchantId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, currency, region, country, paymentMethod, merchantId' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Create payment request
    const paymentRequest: PaymentRequest = {
      amount: Number(amount),
      currency: currency.toUpperCase(),
      region: region.toLowerCase(),
      country: country.toUpperCase(),
      paymentMethod: paymentMethod.toLowerCase(),
      merchantId,
      customerTier: body.customerTier?.toLowerCase(),
      priority: body.priority?.toLowerCase() || 'reliability'
    };

    // Route payment
    const routingResult = await PaymentRoutingEngine.routePayment(paymentRequest);

    return NextResponse.json({
      success: true,
      data: routingResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Payment routing error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');

    if (!routeId) {
      return NextResponse.json(
        { error: 'Route ID is required' },
        { status: 400 }
      );
    }

    // Get cached route
    const cachedRoute = await redis.get(`route:${routeId}`);
    if (cachedRoute) {
      return NextResponse.json({
        success: true,
        data: JSON.parse(cachedRoute),
        cached: true
      });
    }

    // Get from database
    const { data: routeLog } = await supabase
      .from('routing_logs')
      .select('*')
      .eq('route_id', routeId)
      .single();

    if (!routeLog) {
      return NextResponse.json(
        { error: 'Route not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: routeLog
    });

  } catch (error) {
    console.error('Route lookup error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```