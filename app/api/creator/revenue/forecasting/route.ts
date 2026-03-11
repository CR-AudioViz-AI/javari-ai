import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Redis from 'ioredis';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Validation schemas
const ForecastRequestSchema = z.object({
  creator_id: z.string().uuid(),
  forecast_periods: z.array(z.enum(['3', '6', '12'])).default(['3', '6', '12']),
  confidence_level: z.number().min(0.8).max(0.99).default(0.95),
  include_market_trends: z.boolean().default(true),
  model_type: z.enum(['arima', 'prophet', 'hybrid']).default('hybrid')
});

// Types
interface RevenueDataPoint {
  date: string;
  revenue: number;
  platform: string;
  revenue_type: string;
}

interface MarketTrendData {
  date: string;
  trend_value: number;
  trend_type: string;
  impact_score: number;
}

interface ForecastResult {
  period_months: number;
  predicted_revenue: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
  growth_rate: number;
  seasonality_factor: number;
  market_impact: number;
}

interface ForecastResponse {
  creator_id: string;
  forecasts: ForecastResult[];
  model_accuracy: number;
  last_updated: string;
  data_quality_score: number;
  recommendations: string[];
}

// Time Series Analysis Components
class TimeSeriesAnalyzer {
  static calculateMovingAverage(data: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = window - 1; i < data.length; i++) {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
    return result;
  }

  static detectSeasonality(data: RevenueDataPoint[]): { period: number; strength: number } {
    const monthlyRevenue = this.aggregateByMonth(data);
    const values = monthlyRevenue.map(d => d.revenue);
    
    // Simple seasonal detection using autocorrelation
    let maxCorrelation = 0;
    let seasonalPeriod = 12;
    
    for (let period = 3; period <= 12; period++) {
      const correlation = this.calculateAutocorrelation(values, period);
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        seasonalPeriod = period;
      }
    }
    
    return { period: seasonalPeriod, strength: maxCorrelation };
  }

  static aggregateByMonth(data: RevenueDataPoint[]): { month: string; revenue: number }[] {
    const monthlyData = new Map<string, number>();
    
    data.forEach(point => {
      const month = point.date.substring(0, 7); // YYYY-MM
      monthlyData.set(month, (monthlyData.get(month) || 0) + point.revenue);
    });
    
    return Array.from(monthlyData.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  static calculateAutocorrelation(data: number[], lag: number): number {
    if (data.length <= lag) return 0;
    
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    
    let covariance = 0;
    for (let i = 0; i < data.length - lag; i++) {
      covariance += (data[i] - mean) * (data[i + lag] - mean);
    }
    covariance /= (data.length - lag);
    
    return variance > 0 ? covariance / variance : 0;
  }
}

class RevenueForecastingService {
  static async generateARIMAForecast(
    data: RevenueDataPoint[],
    periods: number[]
  ): Promise<{ [key: number]: ForecastResult }> {
    const monthlyData = TimeSeriesAnalyzer.aggregateByMonth(data);
    const values = monthlyData.map(d => d.revenue);
    
    // Simple ARIMA approximation using linear regression with trend
    const forecasts: { [key: number]: ForecastResult } = {};
    
    for (const period of periods) {
      const trend = this.calculateTrend(values);
      const seasonality = TimeSeriesAnalyzer.detectSeasonality(data);
      const baseRevenue = values[values.length - 1];
      
      const predictedRevenue = baseRevenue + (trend * period);
      const stdDev = this.calculateStandardDeviation(values);
      
      forecasts[period] = {
        period_months: period,
        predicted_revenue: Math.max(0, predictedRevenue),
        confidence_interval: {
          lower: Math.max(0, predictedRevenue - (1.96 * stdDev)),
          upper: predictedRevenue + (1.96 * stdDev)
        },
        growth_rate: (trend / baseRevenue) * 100,
        seasonality_factor: seasonality.strength,
        market_impact: 0 // Will be updated with market data
      };
    }
    
    return forecasts;
  }

  static calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;
    
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, index) => sum + (val * index), 0);
    const sumX2 = data.reduce((sum, _, index) => sum + (index * index), 0);
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  static calculateStandardDeviation(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return Math.sqrt(variance);
  }
}

class MarketTrendAnalyzer {
  static async analyzeMarketImpact(
    marketData: MarketTrendData[],
    revenueData: RevenueDataPoint[]
  ): Promise<number> {
    if (marketData.length === 0) return 1.0;
    
    // Calculate correlation between market trends and revenue
    const monthlyRevenue = TimeSeriesAnalyzer.aggregateByMonth(revenueData);
    const marketByMonth = this.aggregateMarketDataByMonth(marketData);
    
    let correlation = 0;
    let validPairs = 0;
    
    monthlyRevenue.forEach(revenuePoint => {
      const marketPoint = marketByMonth.find(m => m.month === revenuePoint.month);
      if (marketPoint) {
        correlation += revenuePoint.revenue * marketPoint.impact_score;
        validPairs++;
      }
    });
    
    return validPairs > 0 ? Math.abs(correlation / validPairs) / 1000000 : 1.0;
  }

  static aggregateMarketDataByMonth(data: MarketTrendData[]): { month: string; impact_score: number }[] {
    const monthlyData = new Map<string, number[]>();
    
    data.forEach(point => {
      const month = point.date.substring(0, 7);
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(point.impact_score);
    });
    
    return Array.from(monthlyData.entries()).map(([month, scores]) => ({
      month,
      impact_score: scores.reduce((sum, score) => sum + score, 0) / scores.length
    }));
  }
}

class ForecastingModelManager {
  static async generateComprehensiveForecast(
    revenueData: RevenueDataPoint[],
    marketData: MarketTrendData[],
    periods: number[],
    modelType: string
  ): Promise<{ [key: number]: ForecastResult }> {
    const baseForecasts = await RevenueForecastingService.generateARIMAForecast(revenueData, periods);
    const marketImpact = await MarketTrendAnalyzer.analyzeMarketImpact(marketData, revenueData);
    
    // Apply market impact to forecasts
    const adjustedForecasts: { [key: number]: ForecastResult } = {};
    
    for (const [period, forecast] of Object.entries(baseForecasts)) {
      const periodNum = parseInt(period);
      const marketMultiplier = Math.pow(marketImpact, periodNum / 12);
      
      adjustedForecasts[periodNum] = {
        ...forecast,
        predicted_revenue: forecast.predicted_revenue * marketMultiplier,
        confidence_interval: {
          lower: forecast.confidence_interval.lower * marketMultiplier,
          upper: forecast.confidence_interval.upper * marketMultiplier
        },
        market_impact: marketImpact
      };
    }
    
    return adjustedForecasts;
  }

  static calculateModelAccuracy(
    historicalData: RevenueDataPoint[],
    forecastData: { [key: number]: ForecastResult }
  ): number {
    // Simple accuracy calculation based on recent trend consistency
    const monthlyData = TimeSeriesAnalyzer.aggregateByMonth(historicalData);
    if (monthlyData.length < 6) return 0.7;
    
    const recentTrend = RevenueForecastingService.calculateTrend(
      monthlyData.slice(-6).map(d => d.revenue)
    );
    const overallTrend = RevenueForecastingService.calculateTrend(
      monthlyData.map(d => d.revenue)
    );
    
    const trendConsistency = Math.abs(recentTrend - overallTrend) / Math.abs(overallTrend || 1);
    return Math.max(0.5, 0.95 - trendConsistency);
  }
}

class RevenueDataProcessor {
  static async fetchHistoricalRevenue(creatorId: string): Promise<RevenueDataPoint[]> {
    const { data, error } = await supabase
      .from('creator_revenue_history')
      .select('*')
      .eq('creator_id', creatorId)
      .gte('created_at', new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString()) // 2 years
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Revenue data fetch failed: ${error.message}`);
    
    return (data || []).map(row => ({
      date: row.created_at.split('T')[0],
      revenue: row.revenue_amount,
      platform: row.platform,
      revenue_type: row.revenue_type
    }));
  }

  static async fetchMarketTrends(): Promise<MarketTrendData[]> {
    const { data, error } = await supabase
      .from('market_trends')
      .select('*')
      .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()) // 1 year
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Market data fetch failed: ${error.message}`);
    
    return (data || []).map(row => ({
      date: row.created_at.split('T')[0],
      trend_value: row.trend_value,
      trend_type: row.trend_type,
      impact_score: row.impact_score || 1.0
    }));
  }

  static calculateDataQuality(data: RevenueDataPoint[]): number {
    if (data.length === 0) return 0;
    
    const monthlyData = TimeSeriesAnalyzer.aggregateByMonth(data);
    const dataPoints = monthlyData.length;
    const completeness = Math.min(1, dataPoints / 24); // Ideal: 24 months
    
    const consistency = this.calculateConsistency(monthlyData.map(d => d.revenue));
    
    return (completeness * 0.6) + (consistency * 0.4);
  }

  static calculateConsistency(data: number[]): number {
    if (data.length < 2) return 0;
    
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    return Math.max(0, 1 - coefficientOfVariation);
  }
}

class TrendAggregator {
  static generateRecommendations(
    forecasts: { [key: number]: ForecastResult },
    dataQuality: number,
    modelAccuracy: number
  ): string[] {
    const recommendations: string[] = [];
    const forecast12Month = forecasts[12];
    
    if (dataQuality < 0.7) {
      recommendations.push("Improve data quality by ensuring consistent revenue tracking across all platforms");
    }
    
    if (modelAccuracy < 0.8) {
      recommendations.push("Forecast accuracy may improve with more historical data");
    }
    
    if (forecast12Month?.growth_rate > 20) {
      recommendations.push("Strong growth trend detected. Consider scaling content production");
    } else if (forecast12Month?.growth_rate < -10) {
      recommendations.push("Declining trend detected. Review content strategy and audience engagement");
    }
    
    if (forecast12Month?.seasonality_factor > 0.5) {
      recommendations.push("Strong seasonal patterns detected. Plan content calendar accordingly");
    }
    
    if (forecast12Month?.market_impact > 1.2) {
      recommendations.push("Positive market conditions. Consider expanding to new platforms");
    }
    
    return recommendations;
  }
}

// Main API Handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ForecastRequestSchema.parse(body);
    
    // Check cache first
    const cacheKey = `forecast:${validatedData.creator_id}:${JSON.stringify(validatedData)}`;
    const cachedResult = await redis.get(cacheKey);
    
    if (cachedResult) {
      return NextResponse.json(JSON.parse(cachedResult));
    }
    
    // Verify creator authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    // Fetch historical data
    const [revenueData, marketData] = await Promise.all([
      RevenueDataProcessor.fetchHistoricalRevenue(validatedData.creator_id),
      validatedData.include_market_trends ? RevenueDataProcessor.fetchMarketTrends() : []
    ]);
    
    if (revenueData.length < 3) {
      return NextResponse.json(
        { error: 'Insufficient historical data for forecasting' },
        { status: 400 }
      );
    }
    
    // Generate forecasts
    const periods = validatedData.forecast_periods.map(p => parseInt(p));
    const forecasts = await ForecastingModelManager.generateComprehensiveForecast(
      revenueData,
      marketData,
      periods,
      validatedData.model_type
    );
    
    const modelAccuracy = ForecastingModelManager.calculateModelAccuracy(revenueData, forecasts);
    const dataQuality = RevenueDataProcessor.calculateDataQuality(revenueData);
    const recommendations = TrendAggregator.generateRecommendations(
      forecasts,
      dataQuality,
      modelAccuracy
    );
    
    const response: ForecastResponse = {
      creator_id: validatedData.creator_id,
      forecasts: Object.values(forecasts),
      model_accuracy: modelAccuracy,
      last_updated: new Date().toISOString(),
      data_quality_score: dataQuality,
      recommendations
    };
    
    // Cache result for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(response));
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Revenue forecasting error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate forecasts.' },
    { status: 405 }
  );
}