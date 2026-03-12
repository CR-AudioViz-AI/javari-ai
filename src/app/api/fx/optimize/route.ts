```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RateLimiter } from 'limiter';

// Rate limiting
const rateLimiter = new RateLimiter({
  tokensPerInterval: 100,
  interval: 'minute',
  fireImmediately: true
});

// Validation schemas
const FXOptimizationSchema = z.object({
  currencyPair: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/, 'Invalid currency pair format'),
  amount: z.number().positive().max(100000000, 'Amount exceeds maximum limit'),
  maxSlippage: z.number().min(0).max(0.05, 'Max slippage must be between 0-5%'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  jurisdiction: z.string().min(2).max(3),
  hedgingPreference: z.enum(['NONE', 'PARTIAL', 'FULL']),
  clientId: z.string().uuid(),
  executionWindow: z.number().min(1).max(3600).optional()
});

// Types
interface LiquidityProvider {
  id: string;
  name: string;
  rate: number;
  spread: number;
  liquidity: number;
  latency: number;
  reliability: number;
}

interface RegulatoryRule {
  jurisdiction: string;
  maxAmount: number;
  requiredReporting: boolean;
  restrictedPairs: string[];
  complianceLevel: string;
}

interface OptimizationResult {
  optimalRoute: ExecutionRoute;
  estimatedCost: number;
  estimatedSlippage: number;
  riskScore: number;
  complianceStatus: string;
  hedgingStrategy: HedgingStrategy | null;
  executionInstructions: ExecutionInstruction[];
}

interface ExecutionRoute {
  providerId: string;
  allocation: number;
  expectedRate: number;
  estimatedLatency: number;
}

interface HedgingStrategy {
  type: string;
  instruments: string[];
  ratio: number;
  cost: number;
}

interface ExecutionInstruction {
  providerId: string;
  amount: number;
  rate: number;
  timestamp: number;
  complianceFlags: string[];
}

class FXOptimizationEngine {
  private supabase: ReturnType<typeof createClient>;
  
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async optimizeExecution(request: z.infer<typeof FXOptimizationSchema>): Promise<OptimizationResult> {
    try {
      // 1. Validate regulatory compliance
      const complianceResult = await this.validateCompliance(request);
      if (!complianceResult.isCompliant) {
        throw new Error(`Compliance violation: ${complianceResult.reason}`);
      }

      // 2. Aggregate liquidity from providers
      const liquidityProviders = await this.aggregateLiquidity(request.currencyPair, request.amount);
      
      // 3. Apply smart routing algorithm
      const optimalRoute = await this.calculateOptimalRoute(
        liquidityProviders,
        request.amount,
        request.urgency,
        request.maxSlippage
      );

      // 4. Assess risk and determine hedging
      const riskAssessment = await this.assessRisk(request, optimalRoute);
      const hedgingStrategy = await this.determineHedgingStrategy(
        request.hedgingPreference,
        riskAssessment
      );

      // 5. Generate execution instructions
      const executionInstructions = await this.generateExecutionInstructions(
        optimalRoute,
        request,
        complianceResult.metadata
      );

      // 6. Log optimization request
      await this.logOptimization(request, optimalRoute, riskAssessment);

      return {
        optimalRoute,
        estimatedCost: this.calculateTotalCost(optimalRoute, hedgingStrategy),
        estimatedSlippage: this.calculateExpectedSlippage(optimalRoute, request.amount),
        riskScore: riskAssessment.score,
        complianceStatus: complianceResult.status,
        hedgingStrategy,
        executionInstructions
      };

    } catch (error) {
      await this.logError(request, error as Error);
      throw error;
    }
  }

  private async validateCompliance(request: z.infer<typeof FXOptimizationSchema>) {
    const { data: rules } = await this.supabase
      .from('regulatory_rules')
      .select('*')
      .eq('jurisdiction', request.jurisdiction)
      .eq('active', true);

    if (!rules || rules.length === 0) {
      return {
        isCompliant: false,
        reason: 'No regulatory rules found for jurisdiction',
        status: 'BLOCKED'
      };
    }

    const rule = rules[0] as RegulatoryRule;
    
    // Check amount limits
    if (request.amount > rule.maxAmount) {
      return {
        isCompliant: false,
        reason: `Amount exceeds jurisdiction limit of ${rule.maxAmount}`,
        status: 'BLOCKED'
      };
    }

    // Check restricted pairs
    if (rule.restrictedPairs.includes(request.currencyPair)) {
      return {
        isCompliant: false,
        reason: `Currency pair ${request.currencyPair} is restricted`,
        status: 'BLOCKED'
      };
    }

    return {
      isCompliant: true,
      status: 'COMPLIANT',
      metadata: {
        reportingRequired: rule.requiredReporting,
        complianceLevel: rule.complianceLevel
      }
    };
  }

  private async aggregateLiquidity(currencyPair: string, amount: number): Promise<LiquidityProvider[]> {
    // Get real-time rates from Supabase
    const { data: rates } = await this.supabase
      .from('fx_rates')
      .select('*')
      .eq('currency_pair', currencyPair)
      .eq('active', true)
      .order('last_updated', { ascending: false });

    if (!rates || rates.length === 0) {
      throw new Error(`No liquidity available for ${currencyPair}`);
    }

    // Filter providers with sufficient liquidity
    return rates
      .filter((rate: any) => rate.available_liquidity >= amount)
      .map((rate: any) => ({
        id: rate.provider_id,
        name: rate.provider_name,
        rate: rate.bid_rate,
        spread: rate.ask_rate - rate.bid_rate,
        liquidity: rate.available_liquidity,
        latency: rate.avg_latency_ms,
        reliability: rate.reliability_score
      }));
  }

  private async calculateOptimalRoute(
    providers: LiquidityProvider[],
    amount: number,
    urgency: string,
    maxSlippage: number
  ): Promise<ExecutionRoute> {
    if (providers.length === 0) {
      throw new Error('No suitable liquidity providers available');
    }

    // Weight factors based on urgency
    const weights = {
      LOW: { cost: 0.6, speed: 0.2, reliability: 0.2 },
      MEDIUM: { cost: 0.4, speed: 0.4, reliability: 0.2 },
      HIGH: { cost: 0.2, speed: 0.6, reliability: 0.2 },
      URGENT: { cost: 0.1, speed: 0.7, reliability: 0.2 }
    }[urgency];

    // Score each provider
    const scoredProviders = providers.map(provider => {
      const costScore = 1 - (provider.spread / Math.max(...providers.map(p => p.spread)));
      const speedScore = 1 - (provider.latency / Math.max(...providers.map(p => p.latency)));
      const reliabilityScore = provider.reliability;
      
      const totalScore = 
        weights.cost * costScore +
        weights.speed * speedScore +
        weights.reliability * reliabilityScore;

      return { ...provider, score: totalScore };
    });

    // Select best provider
    const bestProvider = scoredProviders.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Validate slippage doesn't exceed maximum
    const estimatedSlippage = this.calculateExpectedSlippage({ 
      providerId: bestProvider.id,
      allocation: 1.0,
      expectedRate: bestProvider.rate,
      estimatedLatency: bestProvider.latency
    }, amount);

    if (estimatedSlippage > maxSlippage) {
      throw new Error(`Estimated slippage ${estimatedSlippage} exceeds maximum ${maxSlippage}`);
    }

    return {
      providerId: bestProvider.id,
      allocation: 1.0,
      expectedRate: bestProvider.rate,
      estimatedLatency: bestProvider.latency
    };
  }

  private async assessRisk(
    request: z.infer<typeof FXOptimizationSchema>,
    route: ExecutionRoute
  ) {
    // Get historical volatility
    const { data: volatility } = await this.supabase
      .from('fx_volatility')
      .select('volatility_30d')
      .eq('currency_pair', request.currencyPair)
      .single();

    const vol = volatility?.volatility_30d || 0.05;
    
    // Calculate risk factors
    const amountRisk = Math.min(request.amount / 10000000, 1); // Normalize to 0-1
    const volatilityRisk = Math.min(vol / 0.1, 1);
    const liquidityRisk = route.estimatedLatency > 1000 ? 0.8 : 0.2;
    
    const riskScore = (amountRisk * 0.4 + volatilityRisk * 0.4 + liquidityRisk * 0.2);

    return {
      score: riskScore,
      factors: {
        amount: amountRisk,
        volatility: volatilityRisk,
        liquidity: liquidityRisk
      }
    };
  }

  private async determineHedgingStrategy(
    preference: string,
    riskAssessment: any
  ): Promise<HedgingStrategy | null> {
    if (preference === 'NONE' || riskAssessment.score < 0.3) {
      return null;
    }

    const hedgingRatio = preference === 'FULL' ? 1.0 : 
                        preference === 'PARTIAL' ? 0.5 : 0;

    if (hedgingRatio === 0) return null;

    return {
      type: 'FX_FORWARD',
      instruments: ['FX_FORWARD_1M'],
      ratio: hedgingRatio,
      cost: 0.0005 * hedgingRatio // 0.05% cost for hedging
    };
  }

  private async generateExecutionInstructions(
    route: ExecutionRoute,
    request: z.infer<typeof FXOptimizationSchema>,
    complianceMetadata: any
  ): Promise<ExecutionInstruction[]> {
    const complianceFlags: string[] = [];
    
    if (complianceMetadata?.reportingRequired) {
      complianceFlags.push('REPORTING_REQUIRED');
    }
    
    if (request.amount > 1000000) {
      complianceFlags.push('LARGE_TRANSACTION');
    }

    return [{
      providerId: route.providerId,
      amount: request.amount,
      rate: route.expectedRate,
      timestamp: Date.now() + (request.executionWindow || 300) * 1000,
      complianceFlags
    }];
  }

  private calculateTotalCost(route: ExecutionRoute, hedging: HedgingStrategy | null): number {
    const executionCost = 0.0001; // 1 bps base cost
    const hedgingCost = hedging?.cost || 0;
    return executionCost + hedgingCost;
  }

  private calculateExpectedSlippage(route: ExecutionRoute, amount: number): number {
    // Simplified slippage model based on amount and latency
    const baseSlippage = 0.0001; // 1 bps base
    const amountMultiplier = Math.log(amount / 100000) / 10;
    const latencyMultiplier = route.estimatedLatency / 1000;
    return Math.max(baseSlippage * (1 + amountMultiplier + latencyMultiplier), 0);
  }

  private async logOptimization(
    request: z.infer<typeof FXOptimizationSchema>,
    route: ExecutionRoute,
    riskAssessment: any
  ) {
    await this.supabase
      .from('fx_optimization_log')
      .insert({
        client_id: request.clientId,
        currency_pair: request.currencyPair,
        amount: request.amount,
        provider_id: route.providerId,
        risk_score: riskAssessment.score,
        timestamp: new Date().toISOString()
      });
  }

  private async logError(request: z.infer<typeof FXOptimizationSchema>, error: Error) {
    await this.supabase
      .from('fx_optimization_errors')
      .insert({
        client_id: request.clientId,
        error_message: error.message,
        request_data: JSON.stringify(request),
        timestamp: new Date().toISOString()
      });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const remainingRequests = await rateLimiter.removeTokens(1);
    if (remainingRequests < 0) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      );
    }

    // Validate request body
    const body = await request.json().catch(() => ({}));
    const validatedRequest = FXOptimizationSchema.parse(body);

    // Initialize optimization engine
    const engine = new FXOptimizationEngine();
    
    // Perform optimization
    const result = await engine.optimizeExecution(validatedRequest);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
    });

  } catch (error) {
    console.error('FX Optimization error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle known business logic errors
      if (error.message.includes('Compliance violation')) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'COMPLIANCE_ERROR'
          },
          { status: 403 }
        );
      }

      if (error.message.includes('No liquidity')) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'INSUFFICIENT_LIQUIDITY'
          },
          { status: 422 }
        );
      }

      if (error.message.includes('slippage')) {
        return NextResponse.json(
          {
            error: error.message,
            code: 'EXCESSIVE_SLIPPAGE'
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId: crypto.randomUUID()
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    { status: 405 }
  );
}
```