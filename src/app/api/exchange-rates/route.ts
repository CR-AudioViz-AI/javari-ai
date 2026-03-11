```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

// Validation schemas
const exchangeRateQuerySchema = z.object({
  from: z.string().min(3).max(10).regex(/^[A-Z0-9]+$/),
  to: z.string().min(3).max(10).regex(/^[A-Z0-9]+$/),
  amount: z.coerce.number().positive().max(1000000).default(1),
  provider: z.enum(['auto', 'exchangerate-api', 'coingecko', 'fixer']).default('auto'),
  hedge: z.boolean().default(false)
});

const pairsQuerySchema = z.object({
  type: z.enum(['all', 'fiat', 'crypto']).default('all'),
  limit: z.coerce.number().min(1).max(100).default(50)
});

const updateRatesSchema = z.object({
  pairs: z.array(z.string()).optional(),
  force: z.boolean().default(false)
});

// Types
interface ExchangeRateProvider {
  name: string;
  fetchRate: (from: string, to: string) => Promise<number>;
  isHealthy: () => Promise<boolean>;
}

interface CachedRate {
  rate: number;
  provider: string;
  timestamp: Date;
  expires_at: Date;
}

interface HedgingStrategy {
  recommendedRate: number;
  confidence: number;
  volatility: number;
  recommendations: string[];
}

// Exchange Rate Providers
class ExchangeRateAPI implements ExchangeRateProvider {
  name = 'exchangerate-api';
  private apiKey = process.env.EXCHANGE_RATE_API_KEY!;
  private baseUrl = 'https://v6.exchangerate-api.com/v6';

  async fetchRate(from: string, to: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/${this.apiKey}/pair/${from}/${to}`,
      { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 } // 5 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`ExchangeRate-API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result !== 'success') {
      throw new Error(`ExchangeRate-API result: ${data['error-type']}`);
    }

    return data.conversion_rate;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${this.apiKey}/latest/USD`,
        { signal: AbortSignal.timeout(5000) }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

class CoinGecko implements ExchangeRateProvider {
  name = 'coingecko';
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private proApiKey = process.env.COINGECKO_PRO_API_KEY;

  async fetchRate(from: string, to: string): Promise<number> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.proApiKey) {
      headers['x-cg-pro-api-key'] = this.proApiKey;
    }

    const url = this.proApiKey 
      ? `https://pro-api.coingecko.com/api/v3/simple/price?ids=${from.toLowerCase()}&vs_currencies=${to.toLowerCase()}`
      : `${this.baseUrl}/simple/price?ids=${from.toLowerCase()}&vs_currencies=${to.toLowerCase()}`;

    const response = await fetch(url, {
      headers,
      next: { revalidate: 60 } // 1 minute for crypto
    });

    if (!response.ok) {
      throw new Error(`CoinGecko error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data[from.toLowerCase()]?.[to.toLowerCase()];
    
    if (!rate) {
      throw new Error(`CoinGecko: Rate not found for ${from}/${to}`);
    }

    return rate;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const url = this.proApiKey 
        ? 'https://pro-api.coingecko.com/api/v3/ping'
        : `${this.baseUrl}/ping`;
      
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(5000),
        headers: this.proApiKey ? { 'x-cg-pro-api-key': this.proApiKey } : {}
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

class Fixer implements ExchangeRateProvider {
  name = 'fixer';
  private apiKey = process.env.FIXER_API_KEY!;
  private baseUrl = 'https://api.fixer.io/v1';

  async fetchRate(from: string, to: string): Promise<number> {
    const response = await fetch(
      `${this.baseUrl}/convert?access_key=${this.apiKey}&from=${from}&to=${to}&amount=1`,
      { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 } // 5 minutes
      }
    );

    if (!response.ok) {
      throw new Error(`Fixer error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Fixer error: ${data.error?.info || 'Unknown error'}`);
    }

    return data.result;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/latest?access_key=${this.apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Rate Aggregator
class RateAggregator {
  private providers: ExchangeRateProvider[] = [];
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.providers = [
      new ExchangeRateAPI(),
      new CoinGecko(),
      new Fixer()
    ];
  }

  async getRate(from: string, to: string, preferredProvider?: string): Promise<{
    rate: number;
    provider: string;
    cached: boolean;
    timestamp: Date;
  }> {
    // Check cache first
    const cached = await this.getCachedRate(from, to);
    if (cached && !this.isExpired(cached)) {
      return {
        rate: cached.rate,
        provider: cached.provider,
        cached: true,
        timestamp: cached.timestamp
      };
    }

    // Determine providers to try
    let providersToTry = this.providers;
    if (preferredProvider && preferredProvider !== 'auto') {
      const preferred = this.providers.find(p => p.name === preferredProvider);
      if (preferred) {
        providersToTry = [preferred, ...this.providers.filter(p => p !== preferred)];
      }
    }

    // Try providers in order
    for (const provider of providersToTry) {
      try {
        const rate = await provider.fetchRate(from, to);
        
        // Cache the result
        await this.cacheRate(from, to, rate, provider.name);
        
        return {
          rate,
          provider: provider.name,
          cached: false,
          timestamp: new Date()
        };
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error);
        continue;
      }
    }

    // If all providers fail, return cached rate if available
    if (cached) {
      return {
        rate: cached.rate,
        provider: cached.provider,
        cached: true,
        timestamp: cached.timestamp
      };
    }

    throw new Error(`Unable to fetch rate for ${from}/${to} from any provider`);
  }

  private async getCachedRate(from: string, to: string): Promise<CachedRate | null> {
    try {
      const { data, error } = await this.supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', from)
        .eq('to_currency', to)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        rate: data.rate,
        provider: data.provider,
        timestamp: new Date(data.created_at),
        expires_at: new Date(data.expires_at)
      };
    } catch {
      return null;
    }
  }

  private async cacheRate(from: string, to: string, rate: number, provider: string): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 minute cache

      await this.supabase
        .from('exchange_rates')
        .upsert({
          from_currency: from,
          to_currency: to,
          rate,
          provider,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'from_currency,to_currency'
        });
    } catch (error) {
      console.warn('Failed to cache rate:', error);
    }
  }

  private isExpired(cached: CachedRate): boolean {
    return new Date() > cached.expires_at;
  }

  async getHealthyProviders(): Promise<string[]> {
    const healthChecks = await Promise.allSettled(
      this.providers.map(async provider => ({
        name: provider.name,
        healthy: await provider.isHealthy()
      }))
    );

    return healthChecks
      .filter((result): result is PromiseFulfilledResult<{ name: string; healthy: boolean }> => 
        result.status === 'fulfilled' && result.value.healthy)
      .map(result => result.value.name);
  }
}

// Hedging Strategy Calculator
class HedgingCalculator {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async calculateHedgingStrategy(from: string, to: string, amount: number): Promise<HedgingStrategy> {
    // Get historical rates for volatility analysis
    const historicalRates = await this.getHistoricalRates(from, to, 30); // 30 days
    
    if (historicalRates.length < 7) {
      return {
        recommendedRate: 0,
        confidence: 0,
        volatility: 0,
        recommendations: ['Insufficient historical data for hedging analysis']
      };
    }

    // Calculate volatility
    const rates = historicalRates.map(r => r.rate);
    const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / rates.length;
    const volatility = Math.sqrt(variance);

    // Calculate confidence based on data consistency
    const recentRates = rates.slice(-7); // Last 7 rates
    const recentAvg = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
    const confidence = Math.max(0, 1 - (volatility / avgRate));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (volatility / avgRate > 0.05) { // High volatility (>5%)
      recommendations.push('Consider splitting the transaction across multiple time periods');
      recommendations.push('High volatility detected - consider using limit orders');
    }
    
    if (confidence < 0.7) {
      recommendations.push('Low confidence in rate prediction - consider smaller transaction amounts');
    }
    
    if (amount > 10000) {
      recommendations.push('Large amount detected - consider institutional hedging products');
    }

    return {
      recommendedRate: recentAvg,
      confidence,
      volatility,
      recommendations: recommendations.length > 0 ? recommendations : ['Current market conditions are stable']
    };
  }

  private async getHistoricalRates(from: string, to: string, days: number): Promise<{ rate: number; timestamp: Date }[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('exchange_rates')
        .select('rate, created_at')
        .eq('from_currency', from)
        .eq('to_currency', to)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        rate: row.rate,
        timestamp: new Date(row.created_at)
      }));
    } catch {
      return [];
    }
  }
}

// GET handler
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const rateLimitResult = await rateLimit(identifier, 100, 3600); // 100 requests per hour
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle /api/exchange-rates/pairs
    if (pathname.includes('/pairs')) {
      const validation = pairsQuerySchema.safeParse({
        type: url.searchParams.get('type'),
        limit: url.searchParams.get('limit')
      });

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid query parameters', details: validation.error.flatten() },
          { status: 400 }
        );
      }

      const { type, limit } = validation.data;

      // Get available currency pairs from cache
      let query = supabase
        .from('exchange_rates')
        .select('from_currency, to_currency, rate, provider, created_at')
        .order('created_at', { ascending: false });

      if (type === 'fiat') {
        query = query.in('from_currency', ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY']);
      } else if (type === 'crypto') {
        query = query.in('from_currency', ['BTC', 'ETH', 'ADA', 'DOT', 'SOL', 'MATIC', 'AVAX']);
      }

      const { data: pairs, error } = await query.limit(limit);

      if (error) {
        console.error('Database error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch currency pairs' },
          { status: 500 }
        );
      }

      // Group by currency pair and get latest rates
      const pairMap = new Map();
      pairs?.forEach((pair: any) => {
        const key = `${pair.from_currency}/${pair.to_currency}`;
        if (!pairMap.has(key) || new Date(pair.created_at) > new Date(pairMap.get(key).created_at)) {
          pairMap.set(key, pair);
        }
      });

      const result = Array.from(pairMap.values()).map((pair: any) => ({
        pair: `${pair.from_currency}/${pair.to_currency}`,
        rate: pair.rate,
        provider: pair.provider,
        lastUpdated: pair.created_at
      }));

      return NextResponse.json({
        pairs: result,
        total: result.length,
        type
      });
    }

    // Handle main exchange rate query
    const validation = exchangeRateQuerySchema.safeParse({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      amount: url.searchParams.get('amount'),
      provider: url.searchParams.get('provider'),
      hedge: url.searchParams.get('hedge')
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { from, to, amount, provider, hedge } = validation.data;

    const aggregator = new RateAggregator(supabase);
    
    // Get exchange rate
    const rateResult = await aggregator.getRate(from, to, provider);
    const convertedAmount = rateResult.rate * amount;

    // Get hedging strategy if requested
    let hedgingStrategy: HedgingStrategy | undefined;
    if (hedge) {
      const hedgingCalculator = new HedgingCalculator(supabase);
      hedgingStrategy = await hedgingCalculator.calculateHedgingStrategy(from, to, amount);
    }

    // Get provider health status
    const healthyProviders = await aggregator.getHealthyProviders();

    const response = {
      from,
      to,
      rate: rateResult.rate,
      amount,
      convertedAmount,
      provider: rateResult.provider,
      cached: rateResult.cached,
      timestamp: rateResult.timestamp,
      healthyProviders,
      ...(hedgingStrategy && { hedging: hedgingStrategy })
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Exchange rate API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const isClientError = errorMessage.includes('not found') || errorMessage.includes('invalid');
    
    return NextResponse.json(
      { error: errorMessage },
      { status: isClientError ? 400 : 500 }
    );
  }
}

// POST handler for updating rates
export async function POST(request: NextRequest) {
  try {
    // Rate limiting for updates (more restrictive)
    const identifier = request.ip ?? 'anonymous';
    const rateLimitResult = await rateLimit(identifier, 10, 3600); // 10 requests per hour
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validation = updateRatesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { pairs, force } = validation.data;
    const supabase = createRouteHandlerClient({ cookies });
    const aggregator = new RateAggregator(supabase);

    // Default pairs to update if none specified
    const defaultPairs = [
      'USD/EUR', 'USD/GBP', 'USD/JPY', 'EUR/GBP',
      'BTC/USD', 'ETH/USD', 'ADA/USD', 'DOT/USD'
    ];

    const pairsToUpdate = pairs || defaultPairs;
    const updateResults = [];

    for (const pair of pairsToUpdate) {
      const [from, to] = pair.split('/');
      
      if (!from || !to) {
        updateResults.push({ pair, success: false, error: 'Invalid pair format' });
        continue;
      }

      try {
        const result = await aggregator.getRate(from, to);
        updateResults.push({ 
          pair, 
          success: true, 
          rate: result.rate,
          provider: result.provider,
          cached: result.cached
        });
      } catch (error) {
        updateResults.push({ 
          pair, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const successCount = updateResults.filter(r => r.success).length;
    const healthyProviders = await aggregator.getHealthyProviders();

    return NextResponse.json({
      message: `Updated ${successCount}/${pairsToUpdate.length} currency pairs`,
      results: updateResults,
      healthyProviders,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Exchange rate update error:', error);
    
    return NextResponse.json(
      { error: 'Failed to update exchange rates' },
      { status: 500 }
    );
  }
}
```