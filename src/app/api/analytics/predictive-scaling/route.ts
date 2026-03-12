```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import Redis from 'ioredis';
import { z } from 'zod';

// Types and interfaces
interface MetricPoint {
  timestamp: number;
  cpu_usage: number;
  memory_usage: number;
  request_count: number;
  response_time: number;
  active_connections: number;
}

interface SeasonalPattern {
  hourly: number[];
  daily: number[];
  weekly: number[];
}

interface ExternalFactor {
  weather_temp: number;
  weather_condition: string;
  event_impact_score: number;
  market_volatility: number;
}

interface PredictionResult {
  timestamp: number;
  predicted_cpu: number;
  predicted_memory: number;
  predicted_requests: number;
  scaling_recommendation: 'scale_up' | 'scale_down' | 'maintain';
  confidence_score: number;
  factors: string[];
  alert_level: 'low' | 'medium' | 'high' | 'critical';
}

// Validation schemas
const predictionRequestSchema = z.object({
  service_id: z.string().uuid(),
  prediction_horizon: z.number().min(15).max(30).default(20),
  include_external_factors: z.boolean().default(true),
  alert_threshold: z.number().min(0).max(1).default(0.7),
});

const metricsSchema = z.object({
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
});

class TimeSeriesAnalyzer {
  private windowSize: number = 144; // 12 hours of 5-minute intervals

  async analyzePattern(data: MetricPoint[]): Promise<SeasonalPattern> {
    if (data.length < this.windowSize) {
      throw new Error('Insufficient data for pattern analysis');
    }

    const hourlyPattern = this.extractHourlyPattern(data);
    const dailyPattern = this.extractDailyPattern(data);
    const weeklyPattern = this.extractWeeklyPattern(data);

    return {
      hourly: hourlyPattern,
      daily: dailyPattern,
      weekly: weeklyPattern,
    };
  }

  private extractHourlyPattern(data: MetricPoint[]): number[] {
    const hourlyBuckets = Array(24).fill(0).map(() => [] as number[]);
    
    data.forEach(point => {
      const hour = new Date(point.timestamp).getHours();
      hourlyBuckets[hour].push(point.cpu_usage);
    });

    return hourlyBuckets.map(bucket => 
      bucket.length > 0 ? bucket.reduce((a, b) => a + b) / bucket.length : 0
    );
  }

  private extractDailyPattern(data: MetricPoint[]): number[] {
    const dailyBuckets = Array(7).fill(0).map(() => [] as number[]);
    
    data.forEach(point => {
      const day = new Date(point.timestamp).getDay();
      dailyBuckets[day].push(point.cpu_usage);
    });

    return dailyBuckets.map(bucket => 
      bucket.length > 0 ? bucket.reduce((a, b) => a + b) / bucket.length : 0
    );
  }

  private extractWeeklyPattern(data: MetricPoint[]): number[] {
    const weeklyBuckets = Array(4).fill(0).map(() => [] as number[]);
    
    data.forEach(point => {
      const week = Math.floor(new Date(point.timestamp).getDate() / 7);
      weeklyBuckets[Math.min(week, 3)].push(point.cpu_usage);
    });

    return weeklyBuckets.map(bucket => 
      bucket.length > 0 ? bucket.reduce((a, b) => a + b) / bucket.length : 0
    );
  }

  async detectAnomalies(data: MetricPoint[]): Promise<number[]> {
    const values = data.map(d => d.cpu_usage);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
    
    return data
      .map((point, index) => Math.abs(point.cpu_usage - mean) > 2 * std ? index : -1)
      .filter(index => index !== -1);
  }
}

class MLScalingPredictor {
  private model: tf.LayersModel | null = null;
  private scaler: { mean: number; std: number } | null = null;

  async loadModel(serviceId: string): Promise<void> {
    try {
      // Try to load from cache first
      const cachedModel = await this.loadFromCache(serviceId);
      if (cachedModel) {
        this.model = cachedModel.model;
        this.scaler = cachedModel.scaler;
        return;
      }

      // Load or create new model
      this.model = await this.createLSTMModel();
      this.scaler = { mean: 0, std: 1 };
    } catch (error) {
      console.error('Model loading failed:', error);
      throw new Error('Failed to initialize ML model');
    }
  }

  private async createLSTMModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [20, 5], // 20 time steps, 5 features
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false,
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 25,
          activation: 'relu',
        }),
        tf.layers.dense({
          units: 3, // cpu, memory, requests
          activation: 'linear',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });

    return model;
  }

  async predict(data: MetricPoint[], horizon: number): Promise<PredictionResult[]> {
    if (!this.model || !this.scaler) {
      throw new Error('Model not initialized');
    }

    const processedData = this.preprocessData(data);
    const inputTensor = tf.tensor3d([processedData]);
    
    const predictions = this.model.predict(inputTensor) as tf.Tensor;
    const predictionData = await predictions.data();
    
    inputTensor.dispose();
    predictions.dispose();

    return this.formatPredictions(predictionData, horizon);
  }

  private preprocessData(data: MetricPoint[]): number[][] {
    const features = data.slice(-20).map(point => [
      (point.cpu_usage - (this.scaler?.mean || 0)) / (this.scaler?.std || 1),
      (point.memory_usage - (this.scaler?.mean || 0)) / (this.scaler?.std || 1),
      (point.request_count - (this.scaler?.mean || 0)) / (this.scaler?.std || 1),
      (point.response_time - (this.scaler?.mean || 0)) / (this.scaler?.std || 1),
      (point.active_connections - (this.scaler?.mean || 0)) / (this.scaler?.std || 1),
    ]);

    // Pad if necessary
    while (features.length < 20) {
      features.unshift([0, 0, 0, 0, 0]);
    }

    return features;
  }

  private formatPredictions(predictionData: Float32Array, horizon: number): PredictionResult[] {
    const baseTime = Date.now();
    const results: PredictionResult[] = [];

    for (let i = 0; i < horizon; i += 5) {
      const timestamp = baseTime + (i * 60 * 1000);
      const cpu = predictionData[0] * (this.scaler?.std || 1) + (this.scaler?.mean || 0);
      const memory = predictionData[1] * (this.scaler?.std || 1) + (this.scaler?.mean || 0);
      const requests = predictionData[2] * (this.scaler?.std || 1) + (this.scaler?.mean || 0);

      const recommendation = this.getScalingRecommendation(cpu, memory, requests);
      const confidence = this.calculateConfidence(cpu, memory, requests);
      
      results.push({
        timestamp,
        predicted_cpu: Math.max(0, Math.min(100, cpu)),
        predicted_memory: Math.max(0, Math.min(100, memory)),
        predicted_requests: Math.max(0, requests),
        scaling_recommendation: recommendation,
        confidence_score: confidence,
        factors: this.getInfluencingFactors(cpu, memory, requests),
        alert_level: this.getAlertLevel(cpu, memory, confidence),
      });
    }

    return results;
  }

  private getScalingRecommendation(cpu: number, memory: number, requests: number): 'scale_up' | 'scale_down' | 'maintain' {
    if (cpu > 80 || memory > 85) return 'scale_up';
    if (cpu < 20 && memory < 25 && requests < 10) return 'scale_down';
    return 'maintain';
  }

  private calculateConfidence(cpu: number, memory: number, requests: number): number {
    // Simple confidence calculation based on prediction stability
    const variance = Math.abs(cpu - 50) + Math.abs(memory - 50) + Math.abs(requests - 100);
    return Math.max(0.1, Math.min(1.0, 1 - (variance / 300)));
  }

  private getInfluencingFactors(cpu: number, memory: number, requests: number): string[] {
    const factors: string[] = [];
    
    if (cpu > 70) factors.push('high_cpu_load');
    if (memory > 75) factors.push('memory_pressure');
    if (requests > 200) factors.push('traffic_spike');
    
    return factors;
  }

  private getAlertLevel(cpu: number, memory: number, confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (cpu > 90 || memory > 95) return 'critical';
    if (cpu > 80 || memory > 85) return 'high';
    if (cpu > 60 || memory > 65) return 'medium';
    return 'low';
  }

  private async loadFromCache(serviceId: string): Promise<{ model: tf.LayersModel; scaler: any } | null> {
    // Implementation would load from Redis/Supabase cache
    return null;
  }
}

class ExternalFactorIntegrator {
  private weatherApiKey: string;
  private calendarApiKey: string;

  constructor() {
    this.weatherApiKey = process.env.OPENWEATHER_API_KEY || '';
    this.calendarApiKey = process.env.GOOGLE_CALENDAR_API_KEY || '';
  }

  async getExternalFactors(lat: number = 40.7128, lng: number = -74.0060): Promise<ExternalFactor> {
    const [weather, events, market] = await Promise.all([
      this.getWeatherData(lat, lng),
      this.getEventData(),
      this.getMarketData(),
    ]);

    return {
      weather_temp: weather.temp,
      weather_condition: weather.condition,
      event_impact_score: events.impact,
      market_volatility: market.volatility,
    };
  }

  private async getWeatherData(lat: number, lng: number): Promise<{ temp: number; condition: string }> {
    if (!this.weatherApiKey) {
      return { temp: 20, condition: 'clear' };
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${this.weatherApiKey}&units=metric`
      );
      
      if (!response.ok) {
        throw new Error('Weather API error');
      }

      const data = await response.json();
      return {
        temp: data.main.temp,
        condition: data.weather[0].main.toLowerCase(),
      };
    } catch (error) {
      console.warn('Weather data unavailable:', error);
      return { temp: 20, condition: 'clear' };
    }
  }

  private async getEventData(): Promise<{ impact: number }> {
    // Simplified implementation - would integrate with Google Calendar API
    const currentHour = new Date().getHours();
    const isBusinessHour = currentHour >= 9 && currentHour <= 17;
    return { impact: isBusinessHour ? 0.8 : 0.2 };
  }

  private async getMarketData(): Promise<{ volatility: number }> {
    // Simplified implementation - would integrate with financial APIs
    return { volatility: Math.random() * 0.5 };
  }
}

class PredictiveScalingAnalytics {
  private supabase;
  private redis;
  private timeSeriesAnalyzer: TimeSeriesAnalyzer;
  private mlPredictor: MLScalingPredictor;
  private externalFactors: ExternalFactorIntegrator;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    this.timeSeriesAnalyzer = new TimeSeriesAnalyzer();
    this.mlPredictor = new MLScalingPredictor();
    this.externalFactors = new ExternalFactorIntegrator();
  }

  async generatePredictions(
    serviceId: string,
    predictionHorizon: number,
    includeExternalFactors: boolean
  ): Promise<PredictionResult[]> {
    // Load historical data
    const historicalData = await this.getHistoricalMetrics(serviceId);
    
    // Load and initialize ML model
    await this.mlPredictor.loadModel(serviceId);
    
    // Analyze patterns
    const patterns = await this.timeSeriesAnalyzer.analyzePattern(historicalData);
    
    // Get external factors if requested
    let externalData: ExternalFactor | null = null;
    if (includeExternalFactors) {
      externalData = await this.externalFactors.getExternalFactors();
    }
    
    // Generate predictions
    const predictions = await this.mlPredictor.predict(historicalData, predictionHorizon);
    
    // Apply external factor adjustments
    if (externalData) {
      predictions.forEach(prediction => {
        this.adjustPredictionForExternalFactors(prediction, externalData!);
      });
    }
    
    // Cache predictions
    await this.cachePredictions(serviceId, predictions);
    
    // Check for alerts
    await this.checkAlertThresholds(serviceId, predictions);
    
    return predictions;
  }

  private async getHistoricalMetrics(serviceId: string): Promise<MetricPoint[]> {
    const cacheKey = `metrics:${serviceId}:${Date.now() - 86400000}`;
    
    // Try cache first
    const cachedData = await this.redis.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Fetch from Supabase
    const { data, error } = await this.supabase
      .from('service_metrics')
      .select('*')
      .eq('service_id', serviceId)
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch historical metrics: ${error.message}`);
    }

    const metrics = data?.map(row => ({
      timestamp: new Date(row.timestamp).getTime(),
      cpu_usage: row.cpu_usage,
      memory_usage: row.memory_usage,
      request_count: row.request_count,
      response_time: row.response_time,
      active_connections: row.active_connections,
    })) || [];

    // Cache for future use
    await this.redis.setex(cacheKey, 300, JSON.stringify(metrics));

    return metrics;
  }

  private adjustPredictionForExternalFactors(
    prediction: PredictionResult,
    factors: ExternalFactor
  ): void {
    // Weather impact
    if (factors.weather_condition === 'storm' || factors.weather_temp > 35 || factors.weather_temp < 0) {
      prediction.predicted_cpu *= 1.1;
      prediction.predicted_requests *= 1.15;
      prediction.factors.push('adverse_weather');
    }

    // Event impact
    if (factors.event_impact_score > 0.7) {
      prediction.predicted_cpu *= (1 + factors.event_impact_score * 0.2);
      prediction.predicted_requests *= (1 + factors.event_impact_score * 0.3);
      prediction.factors.push('high_event_impact');
    }

    // Market volatility
    if (factors.market_volatility > 0.3) {
      prediction.predicted_cpu *= 1.05;
      prediction.factors.push('market_volatility');
    }

    // Recalculate recommendation based on adjusted values
    prediction.scaling_recommendation = this.getUpdatedRecommendation(prediction);
  }

  private getUpdatedRecommendation(prediction: PredictionResult): 'scale_up' | 'scale_down' | 'maintain' {
    if (prediction.predicted_cpu > 80 || prediction.predicted_memory > 85) return 'scale_up';
    if (prediction.predicted_cpu < 20 && prediction.predicted_memory < 25) return 'scale_down';
    return 'maintain';
  }

  private async cachePredictions(serviceId: string, predictions: PredictionResult[]): Promise<void> {
    const cacheKey = `predictions:${serviceId}:${Date.now()}`;
    await this.redis.setex(cacheKey, 1800, JSON.stringify(predictions)); // 30 minutes TTL
  }

  private async checkAlertThresholds(serviceId: string, predictions: PredictionResult[]): Promise<void> {
    const criticalPredictions = predictions.filter(p => p.alert_level === 'critical');
    const highPredictions = predictions.filter(p => p.alert_level === 'high');

    if (criticalPredictions.length > 0) {
      await this.sendAlert(serviceId, 'critical', criticalPredictions[0]);
    } else if (highPredictions.length > 0) {
      await this.sendAlert(serviceId, 'high', highPredictions[0]);
    }
  }

  private async sendAlert(serviceId: string, level: string, prediction: PredictionResult): Promise<void> {
    // Store alert in database
    await this.supabase.from('scaling_alerts').insert({
      service_id: serviceId,
      alert_level: level,
      predicted_cpu: prediction.predicted_cpu,
      predicted_memory: prediction.predicted_memory,
      confidence_score: prediction.confidence_score,
      recommendation: prediction.scaling_recommendation,
      factors: prediction.factors,
      created_at: new Date().toISOString(),
    });

    // Add to notification queue
    await this.redis.lpush(
      'notification_queue',
      JSON.stringify({
        type: 'scaling_alert',
        service_id: serviceId,
        level,
        prediction,
        timestamp: Date.now(),
      })
    );
  }

  async getRealtimeMetrics(serviceId: string): Promise<MetricPoint[]> {
    const cacheKey = `realtime:${serviceId}`;
    const data = await this.redis.lrange(cacheKey, 0, 100);
    return data.map(item => JSON.parse(item));
  }

  async storeRealtimeMetric(serviceId: string, metric: MetricPoint): Promise<void> {
    const cacheKey = `realtime:${serviceId}`;
    await this.redis.lpush(cacheKey, JSON.stringify(metric));
    await this.redis.ltrim(cacheKey, 0, 1000); // Keep last 1000 points
    await this.redis.expire(cacheKey, 3600); // 1 hour expiry
  }
}

// Route handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validation = predictionRequestSchema.safeParse({
      service_id: searchParams.get('service_id'),
      prediction_horizon: parseInt(searchParams.get('prediction_horizon') || '20'),
      include_external_factors: searchParams.get('include_external_factors') === 'true',
      alert_threshold: parseFloat(searchParams.get('alert_threshold') || '0.7'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { service_id, prediction_horizon, include_external_factors } = validation.data;

    const analytics = new PredictiveScalingAnalytics();
    const predictions = await analytics.generatePredictions(
      service_id,
      prediction_horizon,
      include_external_factors
    );

    return NextResponse.json({
      success: true,
      data: {
        service_id,
        predictions,
        generated_at: new Date().toISOString(),
        horizon_minutes: prediction_horizon,
      },
    });

  } catch (error) {
    console.error('Predictive scaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Store real-time metric
    if (body.action === 'store_metric') {
      const validation = z.object({
        service_id: z.string().uuid(),
        metric: z.object({
          timestamp: z.number(),
          cpu_usage: z.number().min(0).max(100),
          memory_usage: z.number().min(0).max(100),
          request_count: