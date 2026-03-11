```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import * as tf from '@tensorflow/tfjs';

// Types
interface PredictionRequest {
  timeHorizon: number; // days
  resourceTypes: ResourceType[];
  includeSeasonality: boolean;
  businessGrowthRate?: number;
  confidenceLevel?: number;
}

interface ResourceType {
  type: 'cpu' | 'memory' | 'storage' | 'network' | 'requests';
  unit: string;
  currentUtilization: number;
}

interface CapacityPrediction {
  resourceType: string;
  currentCapacity: number;
  predictedDemand: number[];
  recommendedCapacity: number[];
  confidence: number;
  seasonalFactors: SeasonalFactor[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  timeline: Date[];
}

interface SeasonalFactor {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  amplitude: number;
  phase: number;
  significance: number;
}

interface HistoricalMetric {
  timestamp: Date;
  resource_type: string;
  value: number;
  unit: string;
  metadata: Record<string, any>;
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

class PredictiveCapacityService {
  private mlModelManager: MLModelManager;
  private historicalDataAnalyzer: HistoricalDataAnalyzer;
  private seasonalityDetector: SeasonalityDetector;
  private growthProjectionEngine: GrowthProjectionEngine;
  private validationService: PredictionValidationService;

  constructor() {
    this.mlModelManager = new MLModelManager();
    this.historicalDataAnalyzer = new HistoricalDataAnalyzer();
    this.seasonalityDetector = new SeasonalityDetector();
    this.growthProjectionEngine = new GrowthProjectionEngine();
    this.validationService = new PredictionValidationService();
  }

  async generatePredictions(request: PredictionRequest): Promise<CapacityPrediction[]> {
    const predictions: CapacityPrediction[] = [];

    for (const resourceType of request.resourceTypes) {
      try {
        // Get historical data
        const historicalData = await this.historicalDataAnalyzer.getHistoricalData(
          resourceType.type,
          90 // 90 days of history
        );

        // Detect seasonality patterns
        const seasonalFactors = request.includeSeasonality 
          ? await this.seasonalityDetector.detectSeasonality(historicalData)
          : [];

        // Generate base prediction using ML model
        const basePrediction = await this.mlModelManager.predict(
          resourceType,
          historicalData,
          request.timeHorizon
        );

        // Apply growth projections
        const growthAdjustedPrediction = await this.growthProjectionEngine.applyGrowthProjection(
          basePrediction,
          request.businessGrowthRate || 0,
          request.timeHorizon
        );

        // Apply seasonal adjustments
        const seasonalAdjustedPrediction = this.applySeasonalAdjustments(
          growthAdjustedPrediction,
          seasonalFactors,
          request.timeHorizon
        );

        // Calculate confidence intervals
        const confidenceLevel = request.confidenceLevel || 0.95;
        const confidence = await this.calculateConfidence(
          resourceType,
          historicalData,
          seasonalAdjustedPrediction,
          confidenceLevel
        );

        // Generate recommendations
        const recommendedCapacity = this.calculateRecommendedCapacity(
          seasonalAdjustedPrediction,
          confidence,
          resourceType.currentUtilization
        );

        // Assess risk level
        const riskLevel = this.assessRiskLevel(
          recommendedCapacity,
          resourceType.currentUtilization,
          confidence
        );

        // Generate timeline
        const timeline = this.generateTimeline(request.timeHorizon);

        // Create recommendations
        const recommendations = this.generateRecommendations(
          resourceType,
          seasonalAdjustedPrediction,
          recommendedCapacity,
          riskLevel
        );

        predictions.push({
          resourceType: resourceType.type,
          currentCapacity: resourceType.currentUtilization,
          predictedDemand: seasonalAdjustedPrediction,
          recommendedCapacity,
          confidence,
          seasonalFactors,
          riskLevel,
          recommendations,
          timeline
        });

      } catch (error) {
        console.error(`Error predicting capacity for ${resourceType.type}:`, error);
        // Continue with other resource types
      }
    }

    return predictions;
  }

  private applySeasonalAdjustments(
    basePrediction: number[],
    seasonalFactors: SeasonalFactor[],
    timeHorizon: number
  ): number[] {
    const adjusted = [...basePrediction];
    const now = new Date();

    for (let i = 0; i < timeHorizon; i++) {
      const futureDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
      let seasonalMultiplier = 1;

      seasonalFactors.forEach(factor => {
        const seasonalValue = this.calculateSeasonalValue(futureDate, factor);
        seasonalMultiplier *= (1 + seasonalValue * factor.significance);
      });

      adjusted[i] *= seasonalMultiplier;
    }

    return adjusted;
  }

  private calculateSeasonalValue(date: Date, factor: SeasonalFactor): number {
    let period = 1;
    let position = 0;

    switch (factor.period) {
      case 'daily':
        period = 24;
        position = date.getHours();
        break;
      case 'weekly':
        period = 7;
        position = date.getDay();
        break;
      case 'monthly':
        period = 30;
        position = date.getDate();
        break;
      case 'yearly':
        period = 365;
        position = this.getDayOfYear(date);
        break;
    }

    return factor.amplitude * Math.sin(2 * Math.PI * position / period + factor.phase);
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private async calculateConfidence(
    resourceType: ResourceType,
    historicalData: number[],
    prediction: number[],
    confidenceLevel: number
  ): Promise<number> {
    // Calculate prediction accuracy based on historical validation
    const validationResults = await this.validationService.validatePredictionAccuracy(
      resourceType.type,
      historicalData
    );

    // Base confidence on model performance and data quality
    const baseConfidence = validationResults.accuracy;
    const dataQualityFactor = this.assessDataQuality(historicalData);
    const volatilityFactor = this.calculateVolatilityFactor(historicalData);

    return Math.min(baseConfidence * dataQualityFactor * volatilityFactor, confidenceLevel);
  }

  private assessDataQuality(data: number[]): number {
    if (data.length < 30) return 0.6; // Insufficient data
    
    const nullCount = data.filter(x => x === null || x === undefined).length;
    const nullRatio = nullCount / data.length;
    
    return Math.max(0.5, 1 - nullRatio * 2);
  }

  private calculateVolatilityFactor(data: number[]): number {
    if (data.length < 2) return 0.5;

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;

    // Lower volatility = higher confidence
    return Math.max(0.3, 1 - Math.min(coefficientOfVariation, 1));
  }

  private calculateRecommendedCapacity(
    prediction: number[],
    confidence: number,
    currentUtilization: number
  ): number[] {
    // Apply safety margin based on confidence level
    const safetyMargin = 1 + (1 - confidence) * 0.5; // Up to 50% safety margin for low confidence
    const bufferMargin = 1.2; // 20% operational buffer

    return prediction.map(value => 
      Math.max(currentUtilization, value * safetyMargin * bufferMargin)
    );
  }

  private assessRiskLevel(
    recommendedCapacity: number[],
    currentCapacity: number,
    confidence: number
  ): 'low' | 'medium' | 'high' {
    const maxRecommended = Math.max(...recommendedCapacity);
    const capacityRatio = maxRecommended / currentCapacity;
    
    if (confidence < 0.7 || capacityRatio > 2) return 'high';
    if (confidence < 0.8 || capacityRatio > 1.5) return 'medium';
    return 'low';
  }

  private generateTimeline(timeHorizon: number): Date[] {
    const timeline: Date[] = [];
    const now = new Date();
    
    for (let i = 0; i < timeHorizon; i++) {
      timeline.push(new Date(now.getTime() + (i * 24 * 60 * 60 * 1000)));
    }
    
    return timeline;
  }

  private generateRecommendations(
    resourceType: ResourceType,
    prediction: number[],
    recommendedCapacity: number[],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];
    const maxPredicted = Math.max(...prediction);
    const currentCapacity = resourceType.currentUtilization;
    
    if (maxPredicted > currentCapacity * 0.8) {
      recommendations.push(`Consider scaling ${resourceType.type} capacity within the next 7 days`);
    }
    
    if (riskLevel === 'high') {
      recommendations.push('High uncertainty detected - monitor closely and consider conservative scaling');
    }
    
    const growthRate = (maxPredicted - currentCapacity) / currentCapacity;
    if (growthRate > 0.5) {
      recommendations.push('Significant growth projected - plan for infrastructure expansion');
    }
    
    recommendations.push(`Optimal capacity target: ${Math.round(Math.max(...recommendedCapacity))} ${resourceType.unit}`);
    
    return recommendations;
  }
}

class MLModelManager {
  private models: Map<string, tf.LayersModel> = new Map();

  async predict(
    resourceType: ResourceType,
    historicalData: number[],
    timeHorizon: number
  ): Promise<number[]> {
    const cacheKey = `ml_prediction_${resourceType.type}_${timeHorizon}`;
    
    // Check cache first
    const cachedPrediction = await redis.get(cacheKey);
    if (cachedPrediction) {
      return JSON.parse(cachedPrediction as string);
    }

    // Load or create model
    let model = await this.getOrCreateModel(resourceType.type);
    
    // Prepare features
    const features = this.prepareFeatures(historicalData);
    
    // Make prediction
    const prediction = await model.predict(features) as tf.Tensor;
    const predictionArray = await prediction.data();
    
    // Extract the required number of future values
    const futurePredictions = Array.from(predictionArray).slice(0, timeHorizon);
    
    // Cache the result
    await redis.setex(cacheKey, 3600, JSON.stringify(futurePredictions)); // Cache for 1 hour
    
    // Clean up tensors
    prediction.dispose();
    features.dispose();
    
    return futurePredictions;
  }

  private async getOrCreateModel(resourceType: string): Promise<tf.LayersModel> {
    if (this.models.has(resourceType)) {
      return this.models.get(resourceType)!;
    }

    // Try to load pre-trained model
    try {
      const modelUrl = `${process.env.ML_MODELS_BASE_URL}/capacity_${resourceType}/model.json`;
      const model = await tf.loadLayersModel(modelUrl);
      this.models.set(resourceType, model);
      return model;
    } catch (error) {
      // Fallback to simple LSTM model
      const model = this.createLSTMModel();
      this.models.set(resourceType, model);
      return model;
    }
  }

  private createLSTMModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [30, 1] // 30 time steps, 1 feature
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 25 }),
        tf.layers.dense({ units: 1 })
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['meanAbsoluteError']
    });

    return model;
  }

  private prepareFeatures(historicalData: number[]): tf.Tensor {
    // Normalize data
    const min = Math.min(...historicalData);
    const max = Math.max(...historicalData);
    const normalized = historicalData.map(val => (val - min) / (max - min));
    
    // Create sequences for LSTM
    const sequenceLength = 30;
    const sequences: number[][] = [];
    
    for (let i = sequenceLength; i < normalized.length; i++) {
      sequences.push(normalized.slice(i - sequenceLength, i));
    }
    
    // Convert to tensor
    const tensorData = sequences.map(seq => seq.map(val => [val]));
    return tf.tensor3d(tensorData);
  }
}

class HistoricalDataAnalyzer {
  async getHistoricalData(resourceType: string, days: number): Promise<number[]> {
    const { data, error } = await supabase
      .from('capacity_metrics')
      .select('value, timestamp')
      .eq('resource_type', resourceType)
      .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch historical data: ${error.message}`);
    }

    return data?.map(row => row.value) || [];
  }
}

class SeasonalityDetector {
  async detectSeasonality(data: number[]): Promise<SeasonalFactor[]> {
    const factors: SeasonalFactor[] = [];
    
    // Detect daily seasonality
    const dailySeasonality = this.detectPeriodicity(data, 24);
    if (dailySeasonality.significance > 0.1) {
      factors.push({
        period: 'daily',
        amplitude: dailySeasonality.amplitude,
        phase: dailySeasonality.phase,
        significance: dailySeasonality.significance
      });
    }
    
    // Detect weekly seasonality
    const weeklySeasonality = this.detectPeriodicity(data, 168); // 24 * 7
    if (weeklySeasonality.significance > 0.1) {
      factors.push({
        period: 'weekly',
        amplitude: weeklySeasonality.amplitude,
        phase: weeklySeasonality.phase,
        significance: weeklySeasonality.significance
      });
    }

    return factors;
  }

  private detectPeriodicity(data: number[], period: number): {
    amplitude: number;
    phase: number;
    significance: number;
  } {
    if (data.length < period * 2) {
      return { amplitude: 0, phase: 0, significance: 0 };
    }

    // Simple FFT-based periodicity detection
    const cycles = Math.floor(data.length / period);
    let totalAmplitude = 0;
    let totalPhase = 0;

    for (let cycle = 0; cycle < cycles; cycle++) {
      const cycleData = data.slice(cycle * period, (cycle + 1) * period);
      const mean = cycleData.reduce((a, b) => a + b, 0) / cycleData.length;
      const amplitude = Math.max(...cycleData) - Math.min(...cycleData);
      
      totalAmplitude += amplitude / mean; // Normalized amplitude
    }

    const avgAmplitude = totalAmplitude / cycles;
    const significance = Math.min(avgAmplitude, 1); // Cap at 1

    return {
      amplitude: avgAmplitude,
      phase: 0, // Simplified - could implement proper phase detection
      significance
    };
  }
}

class GrowthProjectionEngine {
  async applyGrowthProjection(
    basePrediction: number[],
    growthRate: number,
    timeHorizon: number
  ): Promise<number[]> {
    const dailyGrowthRate = Math.pow(1 + growthRate, 1 / 365);
    
    return basePrediction.map((value, index) => {
      const growthFactor = Math.pow(dailyGrowthRate, index);
      return value * growthFactor;
    });
  }
}

class PredictionValidationService {
  async validatePredictionAccuracy(resourceType: string, historicalData: number[]): Promise<{
    accuracy: number;
    mape: number; // Mean Absolute Percentage Error
    rmse: number; // Root Mean Square Error
  }> {
    // Implement backtesting validation
    if (historicalData.length < 60) {
      return { accuracy: 0.7, mape: 0.15, rmse: 0.1 }; // Default values for insufficient data
    }

    // Split data for validation
    const trainSize = Math.floor(historicalData.length * 0.8);
    const trainData = historicalData.slice(0, trainSize);
    const testData = historicalData.slice(trainSize);

    // Simple trend-based prediction for validation
    const trend = this.calculateTrend(trainData);
    const predictions = testData.map((_, index) => {
      const lastValue = trainData[trainData.length - 1];
      return lastValue + (trend * (index + 1));
    });

    // Calculate metrics
    const mape = this.calculateMAPE(testData, predictions);
    const rmse = this.calculateRMSE(testData, predictions);
    const accuracy = Math.max(0, 1 - mape);

    return { accuracy, mape, rmse };
  }

  private calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = data.length;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i];
      sumXY += i * data[i];
      sumXX += i * i;
    }

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateMAPE(actual: number[], predicted: number[]): number {
    let totalError = 0;
    let count = 0;

    for (let i = 0; i < actual.length && i < predicted.length; i++) {
      if (actual[i] !== 0) {
        totalError += Math.abs((actual[i] - predicted[i]) / actual[i]);
        count++;
      }
    }

    return count > 0 ? totalError / count : 1;
  }

  private calculateRMSE(actual: number[], predicted: number[]): number {
    let sumSquaredError = 0;
    const n = Math.min(actual.length, predicted.length);

    for (let i = 0; i < n; i++) {
      sumSquaredError += Math.pow(actual[i] - predicted[i], 2);
    }

    return Math.sqrt(sumSquaredError / n);
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    const body: PredictionRequest = await request.json();

    // Input validation
    if (!body.timeHorizon || body.timeHorizon < 1 || body.timeHorizon > 365) {
      return NextResponse.json(
        { error: 'Invalid time horizon. Must be between 1 and 365 days.' },
        { status: 400 }
      );
    }

    if (!body.resourceTypes || body.resourceTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one resource type must be specified.' },
        { status: 400 }
      );
    }

    // Validate resource types
    const validResourceTypes = ['cpu', 'memory', 'storage', 'network', 'requests'];
    for (const resourceType of body.resourceTypes) {
      if (!validResourceTypes.includes(resourceType.type)) {
        return NextResponse.json(
          { error: `Invalid resource type: ${resourceType.type}` },
          { status: 400 }
        );
      }
      if (typeof resourceType.currentUtilization !== 'number' || resourceType.currentUtilization < 0) {
        return NextResponse.json(
          { error: 'Current utilization must be a positive number.' },
          { status: 400 }
        );
      }
    }

    const service = new PredictiveCapacityService();
    const predictions = await service.generatePredictions(body);

    // Store predictions for future analysis
    await supabase.from('capacity_predictions').insert({
      request_params: body,
      predictions,
      created_at: new Date().toISOString()
    });