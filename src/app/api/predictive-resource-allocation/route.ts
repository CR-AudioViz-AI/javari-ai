```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import Redis from 'ioredis';
import AWS from 'aws-sdk';
import { WebSocketServer } from 'ws';

// Types
interface ResourceMetric {
  id: string;
  timestamp: Date;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io: number;
  request_count: number;
  response_time: number;
  service_name: string;
  instance_id: string;
}

interface PredictionResult {
  timestamp: Date;
  predicted_cpu: number;
  predicted_memory: number;
  predicted_load: number;
  confidence_score: number;
  scaling_recommendation: 'none' | 'scale_up' | 'scale_down';
  threshold_breach_probability: number;
}

interface ScalingEvent {
  id: string;
  timestamp: Date;
  service_name: string;
  action: string;
  current_instances: number;
  target_instances: number;
  trigger_reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface ScalingThresholds {
  cpu_threshold: number;
  memory_threshold: number;
  load_multiplier: number;
  prediction_window: number;
  min_confidence: number;
}

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

const autoScaling = new AWS.AutoScaling({
  region: process.env.AWS_REGION!,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
});

const ec2 = new AWS.EC2({
  region: process.env.AWS_REGION!,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
});

// Time Series Forecaster Class
class TimeSeriesForecaster {
  private model: tf.LayersModel | null = null;
  private windowSize = 96; // 24 hours with 15-min intervals
  private features = ['cpu_usage', 'memory_usage', 'request_count', 'response_time'];

  async loadModel(): Promise<void> {
    try {
      this.model = await tf.loadLayersModel('/models/lstm-forecaster/model.json');
    } catch (error) {
      console.error('Failed to load forecasting model:', error);
      await this.createNewModel();
    }
  }

  private async createNewModel(): Promise<void> {
    this.model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 50,
          returnSequences: true,
          inputShape: [this.windowSize, this.features.length]
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 25 }),
        tf.layers.dense({ units: this.features.length })
      ]
    });

    this.model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
  }

  async preprocessData(metrics: ResourceMetric[]): Promise<tf.Tensor3D> {
    const sequences = [];
    
    for (let i = this.windowSize; i < metrics.length; i++) {
      const sequence = metrics.slice(i - this.windowSize, i).map(metric => [
        metric.cpu_usage / 100,
        metric.memory_usage / 100,
        metric.request_count / 10000,
        metric.response_time / 1000
      ]);
      sequences.push(sequence);
    }

    return tf.tensor3d(sequences);
  }

  async predict(inputData: tf.Tensor3D, steps: number = 6): Promise<PredictionResult[]> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    const predictions: PredictionResult[] = [];
    let currentInput = inputData.slice([inputData.shape[0] - 1, 0, 0], [1, -1, -1]);

    for (let step = 0; step < steps; step++) {
      const prediction = this.model.predict(currentInput) as tf.Tensor2D;
      const predictionData = await prediction.data();

      const timestamp = new Date(Date.now() + (step + 1) * 15 * 60 * 1000);
      const confidence = this.calculateConfidence(predictionData);

      predictions.push({
        timestamp,
        predicted_cpu: predictionData[0] * 100,
        predicted_memory: predictionData[1] * 100,
        predicted_load: predictionData[2] * 10000,
        confidence_score: confidence,
        scaling_recommendation: this.getScalingRecommendation(predictionData, confidence),
        threshold_breach_probability: this.calculateThresholdBreachProbability(predictionData)
      });

      // Update input for next prediction
      const nextInput = tf.concat([
        currentInput.slice([0, 1, 0], [-1, -1, -1]),
        prediction.expandDims(1)
      ], 1);
      
      currentInput.dispose();
      prediction.dispose();
      currentInput = nextInput;
    }

    return predictions;
  }

  private calculateConfidence(predictionData: Float32Array): number {
    // Simple confidence calculation based on prediction stability
    const variance = predictionData.reduce((sum, val, idx) => {
      const mean = predictionData.reduce((a, b) => a + b) / predictionData.length;
      return sum + Math.pow(val - mean, 2);
    }, 0) / predictionData.length;
    
    return Math.max(0, Math.min(1, 1 - variance));
  }

  private getScalingRecommendation(
    predictionData: Float32Array, 
    confidence: number
  ): 'none' | 'scale_up' | 'scale_down' {
    if (confidence < 0.7) return 'none';

    const [cpu, memory, load] = predictionData;
    const cpuPercent = cpu * 100;
    const memoryPercent = memory * 100;
    const loadFactor = load / 10000;

    if (cpuPercent > 70 || memoryPercent > 80 || loadFactor > 1.5) {
      return 'scale_up';
    } else if (cpuPercent < 30 && memoryPercent < 40 && loadFactor < 0.5) {
      return 'scale_down';
    }

    return 'none';
  }

  private calculateThresholdBreachProbability(predictionData: Float32Array): number {
    const [cpu, memory] = predictionData;
    const cpuBreach = cpu > 0.8 ? 1 : Math.max(0, (cpu - 0.6) / 0.2);
    const memoryBreach = memory > 0.85 ? 1 : Math.max(0, (memory - 0.7) / 0.15);
    
    return Math.max(cpuBreach, memoryBreach);
  }
}

// Resource Usage Analyzer
class ResourceUsageAnalyzer {
  async collectMetrics(serviceName: string, timeWindow: number = 24): Promise<ResourceMetric[]> {
    const startTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('resource_metrics')
      .select('*')
      .eq('service_name', serviceName)
      .gte('timestamp', startTime.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(`Failed to collect metrics: ${error.message}`);
    }

    return data || [];
  }

  async analyzePatterns(metrics: ResourceMetric[]): Promise<{
    trends: any;
    seasonality: any;
    anomalies: any[];
  }> {
    // Calculate moving averages and detect patterns
    const trends = this.calculateTrends(metrics);
    const seasonality = this.detectSeasonality(metrics);
    const anomalies = this.detectAnomalies(metrics);

    return { trends, seasonality, anomalies };
  }

  private calculateTrends(metrics: ResourceMetric[]): any {
    const windowSize = 12; // 3-hour window
    const trends = {
      cpu: [],
      memory: [],
      load: []
    };

    for (let i = windowSize; i < metrics.length; i++) {
      const window = metrics.slice(i - windowSize, i);
      const avgCpu = window.reduce((sum, m) => sum + m.cpu_usage, 0) / window.length;
      const avgMemory = window.reduce((sum, m) => sum + m.memory_usage, 0) / window.length;
      const avgLoad = window.reduce((sum, m) => sum + m.request_count, 0) / window.length;

      trends.cpu.push({ timestamp: metrics[i].timestamp, value: avgCpu });
      trends.memory.push({ timestamp: metrics[i].timestamp, value: avgMemory });
      trends.load.push({ timestamp: metrics[i].timestamp, value: avgLoad });
    }

    return trends;
  }

  private detectSeasonality(metrics: ResourceMetric[]): any {
    // Simple hourly seasonality detection
    const hourlyPatterns = new Array(24).fill(0).map(() => ({ cpu: 0, memory: 0, count: 0 }));

    metrics.forEach(metric => {
      const hour = new Date(metric.timestamp).getHours();
      hourlyPatterns[hour].cpu += metric.cpu_usage;
      hourlyPatterns[hour].memory += metric.memory_usage;
      hourlyPatterns[hour].count += 1;
    });

    return hourlyPatterns.map((pattern, hour) => ({
      hour,
      avgCpu: pattern.count > 0 ? pattern.cpu / pattern.count : 0,
      avgMemory: pattern.count > 0 ? pattern.memory / pattern.count : 0
    }));
  }

  private detectAnomalies(metrics: ResourceMetric[]): any[] {
    const anomalies = [];
    const windowSize = 20;

    for (let i = windowSize; i < metrics.length; i++) {
      const window = metrics.slice(i - windowSize, i);
      const current = metrics[i];

      const avgCpu = window.reduce((sum, m) => sum + m.cpu_usage, 0) / window.length;
      const avgMemory = window.reduce((sum, m) => sum + m.memory_usage, 0) / window.length;
      
      const stdCpu = Math.sqrt(
        window.reduce((sum, m) => sum + Math.pow(m.cpu_usage - avgCpu, 2), 0) / window.length
      );
      const stdMemory = Math.sqrt(
        window.reduce((sum, m) => sum + Math.pow(m.memory_usage - avgMemory, 2), 0) / window.length
      );

      if (
        Math.abs(current.cpu_usage - avgCpu) > 2 * stdCpu ||
        Math.abs(current.memory_usage - avgMemory) > 2 * stdMemory
      ) {
        anomalies.push({
          timestamp: current.timestamp,
          type: 'resource_spike',
          severity: Math.max(
            Math.abs(current.cpu_usage - avgCpu) / stdCpu,
            Math.abs(current.memory_usage - avgMemory) / stdMemory
          )
        });
      }
    }

    return anomalies;
  }
}

// Auto Scaling Trigger
class AutoScalingTrigger {
  private thresholds: ScalingThresholds = {
    cpu_threshold: 70,
    memory_threshold: 80,
    load_multiplier: 1.5,
    prediction_window: 6,
    min_confidence: 0.7
  };

  async evaluateScalingDecision(
    predictions: PredictionResult[],
    currentMetrics: ResourceMetric,
    serviceName: string
  ): Promise<{
    shouldScale: boolean;
    action: 'scale_up' | 'scale_down' | 'none';
    reason: string;
    targetInstances: number;
  }> {
    // Check current resource usage
    const currentOverloaded = 
      currentMetrics.cpu_usage > this.thresholds.cpu_threshold ||
      currentMetrics.memory_usage > this.thresholds.memory_threshold;

    // Check predictions
    const criticalPredictions = predictions.filter(p => 
      p.confidence_score >= this.thresholds.min_confidence &&
      (p.predicted_cpu > this.thresholds.cpu_threshold ||
       p.predicted_memory > this.thresholds.memory_threshold ||
       p.threshold_breach_probability > 0.8)
    );

    const underutilizedPredictions = predictions.filter(p =>
      p.confidence_score >= this.thresholds.min_confidence &&
      p.predicted_cpu < 30 &&
      p.predicted_memory < 40
    );

    // Get current instance count
    const currentInstances = await this.getCurrentInstanceCount(serviceName);

    if (currentOverloaded || criticalPredictions.length >= 3) {
      return {
        shouldScale: true,
        action: 'scale_up',
        reason: currentOverloaded ? 'Current resource exhaustion' : 'Predicted resource exhaustion',
        targetInstances: Math.min(currentInstances + Math.ceil(currentInstances * 0.5), 20)
      };
    } else if (underutilizedPredictions.length >= 4 && currentInstances > 1) {
      return {
        shouldScale: true,
        action: 'scale_down',
        reason: 'Predicted resource underutilization',
        targetInstances: Math.max(Math.floor(currentInstances * 0.7), 1)
      };
    }

    return {
      shouldScale: false,
      action: 'none',
      reason: 'No scaling required',
      targetInstances: currentInstances
    };
  }

  private async getCurrentInstanceCount(serviceName: string): Promise<number> {
    try {
      const params = {
        AutoScalingGroupNames: [`${serviceName}-asg`]
      };

      const result = await autoScaling.describeAutoScalingGroups(params).promise();
      const group = result.AutoScalingGroups?.[0];
      
      return group?.Instances?.length || 1;
    } catch (error) {
      console.error('Error getting instance count:', error);
      return 1;
    }
  }
}

// Infrastructure Provisioner
class InfrastructureProvisioner {
  async executeScaling(
    serviceName: string,
    action: 'scale_up' | 'scale_down',
    targetInstances: number,
    reason: string
  ): Promise<ScalingEvent> {
    const scalingEvent: Partial<ScalingEvent> = {
      timestamp: new Date(),
      service_name: serviceName,
      action,
      target_instances: targetInstances,
      trigger_reason: reason,
      status: 'pending'
    };

    try {
      // Log scaling event
      const { data: eventData, error: eventError } = await supabase
        .from('scaling_events')
        .insert(scalingEvent)
        .select()
        .single();

      if (eventError) {
        throw new Error(`Failed to log scaling event: ${eventError.message}`);
      }

      // Update scaling event status
      await supabase
        .from('scaling_events')
        .update({ status: 'in_progress' })
        .eq('id', eventData.id);

      // Execute AWS Auto Scaling
      const asgName = `${serviceName}-asg`;
      
      const updateParams = {
        AutoScalingGroupName: asgName,
        DesiredCapacity: targetInstances,
        MinSize: 1,
        MaxSize: 20
      };

      await autoScaling.updateAutoScalingGroup(updateParams).promise();

      // Wait for scaling to complete (simplified)
      await this.waitForScalingCompletion(asgName, targetInstances);

      // Update event as completed
      await supabase
        .from('scaling_events')
        .update({ 
          status: 'completed',
          current_instances: targetInstances
        })
        .eq('id', eventData.id);

      return { ...eventData, status: 'completed', current_instances: targetInstances };

    } catch (error) {
      console.error('Scaling execution failed:', error);
      
      if (scalingEvent.id) {
        await supabase
          .from('scaling_events')
          .update({ status: 'failed' })
          .eq('id', scalingEvent.id);
      }

      throw error;
    }
  }

  private async waitForScalingCompletion(asgName: string, targetInstances: number): Promise<void> {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await autoScaling.describeAutoScalingGroups({
        AutoScalingGroupNames: [asgName]
      }).promise();

      const group = result.AutoScalingGroups?.[0];
      if (group && group.Instances?.length === targetInstances) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;
    }

    throw new Error('Scaling operation timed out');
  }
}

// Metrics Collector
class MetricsCollector {
  async storeMetrics(metrics: ResourceMetric[]): Promise<void> {
    const { error } = await supabase
      .from('resource_metrics')
      .insert(metrics);

    if (error) {
      throw new Error(`Failed to store metrics: ${error.message}`);
    }
  }

  async storePredictions(serviceName: string, predictions: PredictionResult[]): Promise<void> {
    const predictionRecords = predictions.map(p => ({
      service_name: serviceName,
      ...p
    }));

    const { error } = await supabase
      .from('prediction_results')
      .insert(predictionRecords);

    if (error) {
      throw new Error(`Failed to store predictions: ${error.message}`);
    }
  }
}

// Initialize components
const forecaster = new TimeSeriesForecaster();
const analyzer = new ResourceUsageAnalyzer();
const scalingTrigger = new AutoScalingTrigger();
const provisioner = new InfrastructureProvisioner();
const metricsCollector = new MetricsCollector();

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceName = searchParams.get('service');
    const action = searchParams.get('action') || 'predict';

    if (!serviceName) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400 }
      );
    }

    // Validate service name
    if (!/^[a-zA-Z0-9-_]+$/.test(serviceName)) {
      return NextResponse.json(
        { error: 'Invalid service name format' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'predict': {
        // Load forecasting model
        await forecaster.loadModel();

        // Collect historical metrics
        const metrics = await analyzer.collectMetrics(serviceName, 48);
        
        if (metrics.length < 96) {
          return NextResponse.json(
            { error: 'Insufficient historical data for prediction' },
            { status: 400 }
          );
        }

        // Preprocess data and generate predictions
        const inputData = await forecaster.preprocessData(metrics);
        const predictions = await forecaster.predict(inputData);

        // Cache predictions
        await redis.setex(
          `predictions:${serviceName}`,
          900, // 15 minutes
          JSON.stringify(predictions)
        );

        // Store predictions in database
        await metricsCollector.storePredictions(serviceName, predictions);

        return NextResponse.json({
          service: serviceName,
          predictions,
          generated_at: new Date().toISOString(),
          cache_ttl: 900
        });
      }

      case 'analyze': {
        const metrics = await analyzer.collectMetrics(serviceName, 24);
        const analysis = await analyzer.analyzePatterns(metrics);

        return NextResponse.json({
          service: serviceName,
          analysis,
          metrics_count: metrics.length,
          analyzed_at: new Date().toISOString()
        });
      }

      case 'status': {
        // Get recent scaling events
        const { data: events } = await supabase
          .from('scaling_events')
          .select('*')
          .eq('service_name', serviceName)
          .order('timestamp', { ascending: false })
          .limit(10);

        // Get cached predictions
        const cachedPredictions = await redis.get(`predictions:${serviceName}`);
        const predictions = cachedPredictions ? JSON.parse(cachedPredictions) : null;

        return NextResponse.json({
          service: serviceName,
          recent_events: events || [],
          cached_predictions: predictions,
          status: 'active'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Predictive resource allocation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service_name, action, metrics, force_scaling } = body;

    // Validate required fields
    if (!service_name || !action) {
      return NextResponse.json(
        { error: 'Service name and action are required' },
        { status: 400 }
      );
    }

    // Validate service name
    if (!/^[a-zA-Z0-9-_]+$/.test(service_name)) {
      return NextResponse.json(
        { error: 'Invalid service name format' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'evaluate_scaling': {
        // Load forecasting model