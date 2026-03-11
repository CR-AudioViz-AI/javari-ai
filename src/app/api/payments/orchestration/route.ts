import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import { headers } from 'next/headers';

// Types
interface PaymentMethod {
  id: string;
  provider: string;
  type: 'card' | 'wallet' | 'bank_transfer' | 'crypto';
  supported_countries: string[];
  fees: {
    fixed: number;
    percentage: number;
    currency: string;
  };
  processing_time: number;
  enabled: boolean;
}

interface PaymentAttempt {
  id: string;
  method_id: string;
  amount: number;
  currency: string;
  country: string;
  status: 'success' | 'failed' | 'pending';
  failure_reason?: string;
  created_at: string;
}

interface UserPreference {
  user_id: string;
  preferred_methods: string[];
  blocked_methods: string[];
  max_fees_percentage: number;
}

interface SuccessRate {
  method_id: string;
  country: string;
  success_rate: number;
  sample_size: number;
  last_updated: string;
}

interface RoutingDecision {
  primary_method: PaymentMethod;
  fallback_methods: PaymentMethod[];
  reasoning: {
    geography_score: number;
    cost_score: number;
    success_rate_score: number;
    user_preference_score: number;
    final_score: number;
  };
}

// Validation schemas
const orchestrationRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  country: z.string().length(2),
  user_id: z.string().optional(),
  payment_context: z.object({
    type: z.enum(['subscription', 'one_time', 'refund']),
    urgency: z.enum(['low', 'medium', 'high']),
    risk_level: z.enum(['low', 'medium', 'high'])
  }),
  preferences: z.object({
    exclude_methods: z.array(z.string()).optional(),
    max_processing_time: z.number().optional(),
    max_fees_percentage: z.number().optional()
  }).optional()
});

const retryRequestSchema = z.object({
  original_attempt_id: z.string(),
  failure_reason: z.string(),
  retry_count: z.number().min(0).max(3)
});

// Payment Orchestrator Classes
class PaymentMethodSelector {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  async getAvailableMethods(country: string): Promise<PaymentMethod[]> {
    const { data, error } = await this.supabase
      .from('payment_methods')
      .select('*')
      .contains('supported_countries', [country])
      .eq('enabled', true);

    if (error) throw new Error(`Failed to fetch payment methods: ${error.message}`);
    return data || [];
  }

  async calculateMethodScore(
    method: PaymentMethod,
    context: any
  ): Promise<{ method: PaymentMethod; score: number; breakdown: any }> {
    const geographyScore = await this.getGeographyScore(method, context.country);
    const costScore = await this.getCostScore(method, context.amount, context.currency);
    const successRateScore = await this.getSuccessRateScore(method, context.country);
    const userPreferenceScore = await this.getUserPreferenceScore(method, context.user_id);

    const finalScore = (
      geographyScore * 0.25 +
      costScore * 0.30 +
      successRateScore * 0.35 +
      userPreferenceScore * 0.10
    );

    return {
      method,
      score: finalScore,
      breakdown: {
        geography_score: geographyScore,
        cost_score: costScore,
        success_rate_score: successRateScore,
        user_preference_score: userPreferenceScore,
        final_score: finalScore
      }
    };
  }

  private async getGeographyScore(method: PaymentMethod, country: string): Promise<number> {
    const { data } = await this.supabase
      .from('geographic_routing_rules')
      .select('preference_score')
      .eq('method_id', method.id)
      .eq('country', country)
      .single();

    return data?.preference_score || 0.5;
  }

  private async getCostScore(method: PaymentMethod, amount: number, currency: string): Promise<number> {
    const totalFees = method.fees.fixed + (amount * method.fees.percentage / 100);
    const feePercentage = (totalFees / amount) * 100;
    
    // Lower fees = higher score (inverted scale)
    return Math.max(0, 1 - (feePercentage / 5)); // Normalize to 0-1 scale
  }

  private async getSuccessRateScore(method: PaymentMethod, country: string): Promise<number> {
    const { data } = await this.supabase
      .from('payment_success_rates')
      .select('success_rate, sample_size')
      .eq('method_id', method.id)
      .eq('country', country)
      .gte('sample_size', 100) // Minimum sample size for reliability
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();

    return data?.success_rate || 0.5;
  }

  private async getUserPreferenceScore(method: PaymentMethod, userId?: string): Promise<number> {
    if (!userId) return 0.5;

    const { data } = await this.supabase
      .from('user_payment_preferences')
      .select('preferred_methods, blocked_methods')
      .eq('user_id', userId)
      .single();

    if (!data) return 0.5;

    if (data.blocked_methods?.includes(method.id)) return 0;
    if (data.preferred_methods?.includes(method.id)) return 1;
    
    return 0.5;
  }
}

class FallbackManager {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  async selectFallbackMethods(
    failedMethod: PaymentMethod,
    availableMethods: PaymentMethod[],
    context: any
  ): Promise<PaymentMethod[]> {
    // Exclude the failed method and similar problematic methods
    const eligibleMethods = availableMethods.filter(method => 
      method.id !== failedMethod.id &&
      !await this.hasRecentFailures(method, context.country)
    );

    // Sort by reliability and user preference
    const selector = new PaymentMethodSelector();
    const scoredMethods = await Promise.all(
      eligibleMethods.map(method => selector.calculateMethodScore(method, context))
    );

    return scoredMethods
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(item => item.method);
  }

  private async hasRecentFailures(method: PaymentMethod, country: string): Promise<boolean> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data } = await this.supabase
      .from('payment_attempts')
      .select('id')
      .eq('method_id', method.id)
      .eq('country', country)
      .eq('status', 'failed')
      .gte('created_at', twentyFourHoursAgo);

    return (data?.length || 0) > 5; // More than 5 failures in 24h
  }
}

class RetryEngine {
  private redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });

  async scheduleRetry(
    attemptId: string,
    retryCount: number,
    fallbackMethods: PaymentMethod[]
  ): Promise<void> {
    const backoffMs = Math.pow(2, retryCount) * 1000; // Exponential backoff
    const retryAt = Date.now() + backoffMs;

    const retryJob = {
      attempt_id: attemptId,
      retry_count: retryCount,
      fallback_methods: fallbackMethods,
      scheduled_for: retryAt
    };

    await this.redis.zadd('payment_retry_queue', retryAt, JSON.stringify(retryJob));
  }

  async getRetryJob(attemptId: string): Promise<any | null> {
    const jobs = await this.redis.zrange('payment_retry_queue', 0, -1);
    
    for (const jobStr of jobs) {
      const job = JSON.parse(jobStr as string);
      if (job.attempt_id === attemptId) {
        return job;
      }
    }
    
    return null;
  }
}

class PaymentOrchestrator {
  private selector = new PaymentMethodSelector();
  private fallbackManager = new FallbackManager();
  private retryEngine = new RetryEngine();
  private redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });

  async orchestratePayment(request: any): Promise<RoutingDecision> {
    const { amount, currency, country, user_id, payment_context, preferences } = request;

    // Get available payment methods for the country
    const availableMethods = await this.selector.getAvailableMethods(country);
    
    if (availableMethods.length === 0) {
      throw new Error('No payment methods available for this country');
    }

    // Filter methods based on preferences
    const filteredMethods = this.filterMethodsByPreferences(availableMethods, preferences);

    // Score and rank methods
    const scoredMethods = await Promise.all(
      filteredMethods.map(method => 
        this.selector.calculateMethodScore(method, { 
          amount, 
          currency, 
          country, 
          user_id, 
          payment_context 
        })
      )
    );

    // Sort by score (highest first)
    scoredMethods.sort((a, b) => b.score - a.score);

    if (scoredMethods.length === 0) {
      throw new Error('No suitable payment methods found after filtering');
    }

    const primaryMethod = scoredMethods[0];
    const fallbackMethods = await this.fallbackManager.selectFallbackMethods(
      primaryMethod.method,
      availableMethods,
      { country, user_id, payment_context }
    );

    return {
      primary_method: primaryMethod.method,
      fallback_methods: fallbackMethods,
      reasoning: primaryMethod.breakdown
    };
  }

  async handleRetry(retryRequest: any): Promise<RoutingDecision> {
    const { original_attempt_id, failure_reason, retry_count } = retryRequest;

    // Get the retry job details
    const retryJob = await this.retryEngine.getRetryJob(original_attempt_id);
    
    if (!retryJob) {
      throw new Error('Retry job not found');
    }

    if (retry_count >= 3) {
      throw new Error('Maximum retry attempts reached');
    }

    // Select next fallback method
    const fallbackMethods = retryJob.fallback_methods;
    const nextMethod = fallbackMethods[retry_count] || fallbackMethods[fallbackMethods.length - 1];

    if (!nextMethod) {
      throw new Error('No more fallback methods available');
    }

    return {
      primary_method: nextMethod,
      fallback_methods: fallbackMethods.slice(retry_count + 1),
      reasoning: {
        geography_score: 0.5,
        cost_score: 0.5,
        success_rate_score: 0.5,
        user_preference_score: 0.5,
        final_score: 0.5
      }
    };
  }

  private filterMethodsByPreferences(
    methods: PaymentMethod[],
    preferences?: any
  ): PaymentMethod[] {
    if (!preferences) return methods;

    return methods.filter(method => {
      // Exclude blocked methods
      if (preferences.exclude_methods?.includes(method.id)) {
        return false;
      }

      // Check processing time limit
      if (preferences.max_processing_time && method.processing_time > preferences.max_processing_time) {
        return false;
      }

      // Check fees limit
      if (preferences.max_fees_percentage && method.fees.percentage > preferences.max_fees_percentage) {
        return false;
      }

      return true;
    });
  }
}

// Rate limiting
async function checkRateLimit(identifier: string): Promise<boolean> {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });

  const key = `orchestration_rate_limit:${identifier}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  return current <= 100; // 100 requests per minute
}

// Main API handlers
export async function POST(request: NextRequest) {
  try {
    const headersList = headers();
    const clientIp = headersList.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting
    if (!(await checkRateLimit(clientIp))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedRequest = orchestrationRequestSchema.parse(body);

    const orchestrator = new PaymentOrchestrator();
    const decision = await orchestrator.orchestratePayment(validatedRequest);

    return NextResponse.json({
      success: true,
      data: decision,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Payment orchestration error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const headersList = headers();
    const clientIp = headersList.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting
    if (!(await checkRateLimit(clientIp))) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedRequest = retryRequestSchema.parse(body);

    const orchestrator = new PaymentOrchestrator();
    const decision = await orchestrator.handleRetry(validatedRequest);

    return NextResponse.json({
      success: true,
      data: decision,
      retry_attempt: validatedRequest.retry_count + 1,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Payment retry error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid retry request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const userId = searchParams.get('user_id');

    if (!country) {
      return NextResponse.json(
        { error: 'Country parameter is required' },
        { status: 400 }
      );
    }

    const selector = new PaymentMethodSelector();
    const availableMethods = await selector.getAvailableMethods(country);

    return NextResponse.json({
      success: true,
      data: {
        country,
        available_methods: availableMethods.length,
        methods: availableMethods
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Payment methods lookup error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}