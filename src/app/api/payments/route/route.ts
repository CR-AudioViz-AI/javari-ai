```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

interface RoutePaymentRequest {
  amount: number;
  currency: string;
  country: string;
  paymentMethod: string;
  customerTier?: 'basic' | 'premium' | 'enterprise';
  merchantId?: string;
  transactionType?: 'purchase' | 'subscription' | 'refund';
}

interface ProcessorRecommendation {
  processorId: string;
  processorName: string;
  confidenceScore: number;
  estimatedSuccessRate: number;
  estimatedFees: number;
  processingTime: string;
  healthStatus: 'healthy' | 'degraded' | 'down';
  fallbackOrder: number;
}

interface ProcessorPerformanceMetrics {
  processorId: string;
  country: string;
  currency: string;
  amountRange: string;
  successRate: number;
  avgProcessingTime: number;
  lastUpdated: string;
}

interface RoutingRule {
  id: string;
  country?: string;
  currency?: string;
  amountMin?: number;
  amountMax?: number;
  paymentMethod?: string;
  customerTier?: string;
  preferredProcessors: string[];
  blockedProcessors: string[];
  priority: number;
}

class PaymentRoutingEngine {
  private static getAmountRange(amount: number): string {
    if (amount < 10) return '0-10';
    if (amount < 50) return '10-50';
    if (amount < 100) return '50-100';
    if (amount < 500) return '100-500';
    if (amount < 1000) return '500-1000';
    return '1000+';
  }

  private static calculateConfidenceScore(
    successRate: number,
    healthStatus: string,
    ruleMatch: boolean,
    historicalVolume: number
  ): number {
    let score = successRate * 0.4;
    
    // Health status weight
    const healthMultiplier = healthStatus === 'healthy' ? 1.0 : 
                           healthStatus === 'degraded' ? 0.7 : 0.1;
    score *= healthMultiplier;
    
    // Rule match bonus
    if (ruleMatch) score += 0.1;
    
    // Historical volume confidence
    const volumeConfidence = Math.min(historicalVolume / 1000, 1.0);
    score *= (0.7 + 0.3 * volumeConfidence);
    
    return Math.min(score, 1.0);
  }

  static async getOptimalRoute(request: RoutePaymentRequest): Promise<ProcessorRecommendation[]> {
    try {
      const amountRange = this.getAmountRange(request.amount);
      
      // Get performance metrics for this geography/amount
      const { data: performanceMetrics } = await supabase
        .from('processor_performance_metrics')
        .select('*')
        .eq('country', request.country)
        .eq('currency', request.currency)
        .eq('amount_range', amountRange)
        .gte('last_updated', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Get applicable routing rules
      const { data: routingRules } = await supabase
        .from('routing_rules')
        .select('*')
        .or(`country.is.null,country.eq.${request.country}`)
        .or(`currency.is.null,currency.eq.${request.currency}`)
        .or(`amount_min.is.null,amount_min.lte.${request.amount}`)
        .or(`amount_max.is.null,amount_max.gte.${request.amount}`)
        .or(`payment_method.is.null,payment_method.eq.${request.paymentMethod}`)
        .or(`customer_tier.is.null,customer_tier.eq.${request.customerTier || 'basic'}`)
        .order('priority', { ascending: false });

      // Get all active processors
      const { data: processors } = await supabase
        .from('payment_processors')
        .select('*')
        .eq('is_active', true)
        .contains('supported_countries', [request.country])
        .contains('supported_currencies', [request.currency]);

      if (!processors || processors.length === 0) {
        throw new Error('No processors available for this geography/currency');
      }

      // Get real-time health status from Redis
      const healthStatuses = await Promise.all(
        processors.map(async (processor) => {
          const health = await redis.get(`processor_health:${processor.id}`);
          return {
            processorId: processor.id,
            status: health || 'healthy'
          };
        })
      );

      // Build recommendations
      const recommendations: ProcessorRecommendation[] = [];
      
      for (const processor of processors) {
        const metrics = (performanceMetrics as ProcessorPerformanceMetrics[] || [])
          .find(m => m.processorId === processor.id);
        
        const healthStatus = healthStatuses
          .find(h => h.processorId === processor.id)?.status || 'healthy';
        
        const applicableRules = (routingRules as RoutingRule[] || [])
          .filter(rule => this.ruleApplies(rule, request));
        
        const isPreferred = applicableRules.some(rule => 
          rule.preferredProcessors.includes(processor.id));
        const isBlocked = applicableRules.some(rule => 
          rule.blockedProcessors.includes(processor.id));
        
        if (isBlocked) continue;
        
        const successRate = metrics?.successRate || processor.default_success_rate || 0.85;
        const processingTime = metrics?.avgProcessingTime || processor.avg_processing_time || 3;
        
        const confidenceScore = this.calculateConfidenceScore(
          successRate,
          healthStatus,
          isPreferred,
          processor.monthly_volume || 0
        );

        recommendations.push({
          processorId: processor.id,
          processorName: processor.name,
          confidenceScore,
          estimatedSuccessRate: successRate,
          estimatedFees: this.calculateFees(processor, request.amount),
          processingTime: `${processingTime}s`,
          healthStatus: healthStatus as 'healthy' | 'degraded' | 'down',
          fallbackOrder: 0
        });
      }

      // Sort by confidence score and assign fallback order
      recommendations.sort((a, b) => b.confidenceScore - a.confidenceScore);
      recommendations.forEach((rec, index) => {
        rec.fallbackOrder = index + 1;
      });

      return recommendations.slice(0, 5); // Return top 5 recommendations
      
    } catch (error) {
      console.error('Routing engine error:', error);
      throw error;
    }
  }

  private static ruleApplies(rule: RoutingRule, request: RoutePaymentRequest): boolean {
    if (rule.country && rule.country !== request.country) return false;
    if (rule.currency && rule.currency !== request.currency) return false;
    if (rule.amountMin && request.amount < rule.amountMin) return false;
    if (rule.amountMax && request.amount > rule.amountMax) return false;
    if (rule.paymentMethod && rule.paymentMethod !== request.paymentMethod) return false;
    if (rule.customerTier && rule.customerTier !== (request.customerTier || 'basic')) return false;
    
    return true;
  }

  private static calculateFees(processor: any, amount: number): number {
    const fixedFee = processor.fixed_fee || 0;
    const percentageFee = processor.percentage_fee || 0.029;
    return fixedFee + (amount * percentageFee);
  }
}

class RoutingDecisionLogger {
  static async logDecision(
    request: RoutePaymentRequest,
    recommendations: ProcessorRecommendation[],
    selectedProcessor?: string
  ): Promise<void> {
    try {
      await supabase.from('routing_decisions').insert({
        request_data: request,
        recommendations,
        selected_processor: selectedProcessor,
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID()
      });
    } catch (error) {
      console.error('Failed to log routing decision:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RoutePaymentRequest;

    // Input validation
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!body.currency || !/^[A-Z]{3}$/.test(body.currency)) {
      return NextResponse.json(
        { error: 'Invalid currency code' },
        { status: 400 }
      );
    }

    if (!body.country || !/^[A-Z]{2}$/.test(body.country)) {
      return NextResponse.json(
        { error: 'Invalid country code' },
        { status: 400 }
      );
    }

    if (!body.paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `rate_limit:routing:${clientIP}`;
    const currentCount = await redis.incr(rateLimitKey);
    
    if (currentCount === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }
    
    if (currentCount > 100) { // 100 requests per minute
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Get routing recommendations
    const recommendations = await PaymentRoutingEngine.getOptimalRoute(body);

    if (recommendations.length === 0) {
      return NextResponse.json(
        { error: 'No suitable processors found' },
        { status: 404 }
      );
    }

    // Log the routing decision
    await RoutingDecisionLogger.logDecision(body, recommendations);

    // Update processor selection stats in background
    const primaryProcessor = recommendations[0];
    redis.hincrby(
      `processor_stats:${primaryProcessor.processorId}`,
      'selections',
      1
    ).catch(err => console.error('Redis stats update failed:', err));

    return NextResponse.json({
      success: true,
      requestId: crypto.randomUUID(),
      recommendations,
      metadata: {
        evaluatedProcessors: recommendations.length,
        primaryProcessor: primaryProcessor.processorName,
        estimatedSuccessRate: primaryProcessor.estimatedSuccessRate,
        routingLatency: `${Date.now() - Date.now()}ms`
      }
    });

  } catch (error) {
    console.error('Payment routing error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const processorId = searchParams.get('processorId');

    if (processorId) {
      // Get specific processor health and performance
      const health = await redis.get(`processor_health:${processorId}`);
      const stats = await redis.hgetall(`processor_stats:${processorId}`);
      
      const { data: processor } = await supabase
        .from('payment_processors')
        .select('*')
        .eq('id', processorId)
        .single();

      if (!processor) {
        return NextResponse.json(
          { error: 'Processor not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        processor,
        healthStatus: health || 'healthy',
        stats: {
          selections: parseInt(stats.selections || '0'),
          successfulTransactions: parseInt(stats.successful || '0'),
          failedTransactions: parseInt(stats.failed || '0')
        }
      });
    }

    // Get all active processors with health status
    const { data: processors } = await supabase
      .from('payment_processors')
      .select('id, name, supported_countries, supported_currencies, is_active')
      .eq('is_active', true);

    const processorsWithHealth = await Promise.all(
      (processors || []).map(async (processor) => {
        const health = await redis.get(`processor_health:${processor.id}`);
        return {
          ...processor,
          healthStatus: health || 'healthy'
        };
      })
    );

    return NextResponse.json({
      processors: processorsWithHealth,
      total: processorsWithHealth.length
    });

  } catch (error) {
    console.error('GET payment routing error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```