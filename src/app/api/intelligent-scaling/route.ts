```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import { Redis } from 'ioredis';
import AWS from 'aws-sdk';

// Types
interface ScalingMetrics {
  cpu_usage: number;
  memory_usage: number;
  network_io: number;
  disk_io: number;
  request_count: number;
  response_time: number;
  error_rate: number;
  queue_length: number;
  active_connections: number;
  timestamp: number;
}

interface ScalingPrediction {
  predicted_cpu: number;
  predicted_memory: number;
  predicted_load: number;
  recommended_instances: number;
  confidence_score: number;
  cost_impact: number;
  scaling_action: 'scale_up' | 'scale_down' | 'maintain';
  reasoning: string[];
}

interface ScalingConfiguration {
  service_id: string;
  min_instances: number;
  max_instances: number;
  target_cpu: number;
  target_memory: number;
  scale_up_threshold: number;
  scale_down_threshold: number;
  cooldown_period: number;
  cost_budget: number;
  performance_priority: 'cost' | 'performance' | 'balanced';
}

// Validation schemas
const scalingRequestSchema = z.object({
  action: z.enum(['predict', 'scale', 'configure', 'status']),
  service_id: z.string().min(1),
  config: z.object({
    min_instances: z.number().min(1).optional(),
    max_instances: z.number().min(1).optional(),
    target_cpu: z.number().min(0).max(100).optional(),
    target_memory: z.number().min(0).max(100).optional(),
    scale_up_threshold: z.number().min(0).max(100).optional(),
    scale_down_threshold: z.number().min(0).max(100).optional(),
    cooldown_period: z.number().min(60).optional(),
    cost_budget: z.number().min(0).optional(),
    performance_priority: z.enum(['cost', 'performance', 'balanced']).optional()
  }).optional(),
  time_horizon: z.number().min(1).max(168).optional(), // 1 hour to 1 week
  include_cost_analysis: z.boolean().optional()
});

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const cloudWatch = new AWS.CloudWatch();
const autoScaling = new AWS.AutoScaling();
const costExplorer = new AWS.CostExplorer();

class IntelligentScalingEngine {
  private model: tf.LayersModel | null = null;

  async initializeModel(): Promise<void> {
    try {
      // Load pre-trained model or create new one
      try {
        this.model = await tf.loadLayersModel('/models/scaling-predictor/model.json');
      } catch {
        this.model = this.createModel();
        await this.trainModel();
      }
    } catch (error) {
      console.error('Model initialization failed:', error);
      this.model = this.createModel();
    }
  }

  private createModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [9], // 9 input features
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 4, // cpu, memory, load, instances
          activation: 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async trainModel(): Promise<void> {
    if (!this.model) return;

    // Get historical data for training
    const { data: historicalData } = await supabase
      .from('scaling_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10000);

    if (!historicalData?.length) return;

    // Prepare training data
    const features = historicalData.map(d => [
      d.cpu_usage,
      d.memory_usage,
      d.network_io,
      d.disk_io,
      d.request_count,
      d.response_time,
      d.error_rate,
      d.queue_length,
      d.active_connections
    ]);

    const labels = historicalData.map(d => [
      d.next_cpu_usage,
      d.next_memory_usage,
      d.next_load,
      d.next_instances
    ]);

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    await this.model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  async predictScaling(
    metrics: ScalingMetrics,
    config: ScalingConfiguration,
    timeHorizon: number = 1
  ): Promise<ScalingPrediction> {
    if (!this.model) {
      await this.initializeModel();
    }

    const features = tf.tensor2d([[
      metrics.cpu_usage,
      metrics.memory_usage,
      metrics.network_io,
      metrics.disk_io,
      metrics.request_count,
      metrics.response_time,
      metrics.error_rate,
      metrics.queue_length,
      metrics.active_connections
    ]]);

    const prediction = this.model!.predict(features) as tf.Tensor;
    const predictionData = await prediction.data();

    features.dispose();
    prediction.dispose();

    const [predictedCpu, predictedMemory, predictedLoad, predictedInstances] = predictionData;

    // Apply time horizon scaling
    const horizonMultiplier = Math.log(timeHorizon + 1);
    const adjustedCpu = predictedCpu * (1 + (horizonMultiplier * 0.1));
    const adjustedMemory = predictedMemory * (1 + (horizonMultiplier * 0.1));
    const adjustedLoad = predictedLoad * (1 + (horizonMultiplier * 0.15));

    // Determine scaling action
    let scalingAction: 'scale_up' | 'scale_down' | 'maintain' = 'maintain';
    const reasoning: string[] = [];

    if (adjustedCpu > config.scale_up_threshold || adjustedMemory > config.scale_up_threshold) {
      scalingAction = 'scale_up';
      reasoning.push(`Predicted resource usage exceeds thresholds (CPU: ${adjustedCpu.toFixed(1)}%, Memory: ${adjustedMemory.toFixed(1)}%)`);
    } else if (adjustedCpu < config.scale_down_threshold && adjustedMemory < config.scale_down_threshold) {
      scalingAction = 'scale_down';
      reasoning.push(`Predicted resource usage below thresholds (CPU: ${adjustedCpu.toFixed(1)}%, Memory: ${adjustedMemory.toFixed(1)}%)`);
    }

    // Calculate recommended instances
    const cpuBasedInstances = Math.ceil((adjustedCpu / 100) * Math.ceil(predictedInstances));
    const memoryBasedInstances = Math.ceil((adjustedMemory / 100) * Math.ceil(predictedInstances));
    let recommendedInstances = Math.max(cpuBasedInstances, memoryBasedInstances);
    
    recommendedInstances = Math.max(config.min_instances, Math.min(config.max_instances, recommendedInstances));

    // Calculate confidence score
    const confidence = Math.max(0, Math.min(1, 1 - (Math.abs(predictedCpu - metrics.cpu_usage) / 100)));

    // Estimate cost impact
    const costImpact = await this.calculateCostImpact(
      config.service_id,
      recommendedInstances,
      timeHorizon
    );

    return {
      predicted_cpu: adjustedCpu,
      predicted_memory: adjustedMemory,
      predicted_load: adjustedLoad,
      recommended_instances: recommendedInstances,
      confidence_score: confidence,
      cost_impact: costImpact,
      scaling_action: scalingAction,
      reasoning
    };
  }

  private async calculateCostImpact(
    serviceId: string,
    recommendedInstances: number,
    timeHorizon: number
  ): Promise<number> {
    try {
      // Get current instance count
      const currentInstances = await this.getCurrentInstanceCount(serviceId);
      const instanceDiff = recommendedInstances - currentInstances;
      
      // Estimate hourly cost per instance (simplified)
      const hourlyInstanceCost = 0.10; // $0.10 per hour per instance
      const totalCostImpact = instanceDiff * hourlyInstanceCost * timeHorizon;

      return totalCostImpact;
    } catch (error) {
      console.error('Cost calculation failed:', error);
      return 0;
    }
  }

  private async getCurrentInstanceCount(serviceId: string): Promise<number> {
    try {
      const params = {
        AutoScalingGroupNames: [serviceId]
      };

      const result = await autoScaling.describeAutoScalingGroups(params).promise();
      return result.AutoScalingGroups?.[0]?.DesiredCapacity || 1;
    } catch (error) {
      console.error('Failed to get current instance count:', error);
      return 1;
    }
  }

  async executeScaling(
    serviceId: string,
    targetInstances: number,
    config: ScalingConfiguration
  ): Promise<boolean> {
    try {
      // Check cooldown period
      const lastScalingTime = await redis.get(`scaling:${serviceId}:last`);
      if (lastScalingTime) {
        const timeSinceLastScaling = Date.now() - parseInt(lastScalingTime);
        if (timeSinceLastScaling < config.cooldown_period * 1000) {
          throw new Error('Still in cooldown period');
        }
      }

      // Execute scaling
      const params = {
        AutoScalingGroupName: serviceId,
        DesiredCapacity: targetInstances,
        HonorCooldown: true
      };

      await autoScaling.setDesiredCapacity(params).promise();

      // Update scaling timestamp
      await redis.set(`scaling:${serviceId}:last`, Date.now().toString());

      // Record scaling event
      await supabase.from('scaling_events').insert({
        service_id: serviceId,
        previous_instances: await this.getCurrentInstanceCount(serviceId),
        new_instances: targetInstances,
        trigger: 'intelligent_scaling',
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Scaling execution failed:', error);
      return false;
    }
  }

  async collectMetrics(serviceId: string): Promise<ScalingMetrics> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // 5 minutes ago

      const params = {
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'TargetResponseTime',
        Dimensions: [{
          Name: 'LoadBalancer',
          Value: serviceId
        }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Average']
      };

      const responseTimeData = await cloudWatch.getMetricStatistics(params).promise();
      const responseTime = responseTimeData.Datapoints?.[0]?.Average || 0;

      // Collect other metrics (simplified)
      return {
        cpu_usage: Math.random() * 100, // In real implementation, get from CloudWatch
        memory_usage: Math.random() * 100,
        network_io: Math.random() * 1000,
        disk_io: Math.random() * 500,
        request_count: Math.floor(Math.random() * 1000),
        response_time: responseTime,
        error_rate: Math.random() * 5,
        queue_length: Math.floor(Math.random() * 50),
        active_connections: Math.floor(Math.random() * 100),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Metrics collection failed:', error);
      throw error;
    }
  }
}

const scalingEngine = new IntelligentScalingEngine();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const validatedData = scalingRequestSchema.parse(body);

    const { action, service_id, config, time_horizon = 1, include_cost_analysis = false } = validatedData;

    // Rate limiting
    const clientId = request.headers.get('x-client-id') || 'anonymous';
    const rateLimitKey = `scaling_api:${clientId}`;
    const currentRequests = await redis.incr(rateLimitKey);
    
    if (currentRequests === 1) {
      await redis.expire(rateLimitKey, 60); // 1 minute window
    }
    
    if (currentRequests > 30) { // 30 requests per minute
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    switch (action) {
      case 'predict': {
        // Collect current metrics
        const metrics = await scalingEngine.collectMetrics(service_id);

        // Get or create scaling configuration
        const { data: configData } = await supabase
          .from('scaling_configurations')
          .select('*')
          .eq('service_id', service_id)
          .single();

        const scalingConfig: ScalingConfiguration = configData || {
          service_id,
          min_instances: 1,
          max_instances: 10,
          target_cpu: 70,
          target_memory: 80,
          scale_up_threshold: 80,
          scale_down_threshold: 30,
          cooldown_period: 300,
          cost_budget: 1000,
          performance_priority: 'balanced'
        };

        // Generate prediction
        const prediction = await scalingEngine.predictScaling(
          metrics,
          scalingConfig,
          time_horizon
        );

        // Store prediction
        await supabase.from('scaling_predictions').insert({
          service_id,
          metrics,
          prediction,
          time_horizon,
          created_at: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          prediction,
          current_metrics: metrics,
          configuration: scalingConfig
        });
      }

      case 'scale': {
        // Get current metrics and configuration
        const metrics = await scalingEngine.collectMetrics(service_id);
        const { data: configData } = await supabase
          .from('scaling_configurations')
          .select('*')
          .eq('service_id', service_id)
          .single();

        if (!configData) {
          return NextResponse.json(
            { error: 'Scaling configuration not found' },
            { status: 404 }
          );
        }

        // Generate prediction
        const prediction = await scalingEngine.predictScaling(
          metrics,
          configData,
          time_horizon
        );

        // Execute scaling if recommended
        let scalingExecuted = false;
        if (prediction.scaling_action !== 'maintain') {
          scalingExecuted = await scalingEngine.executeScaling(
            service_id,
            prediction.recommended_instances,
            configData
          );
        }

        return NextResponse.json({
          success: true,
          prediction,
          scaling_executed: scalingExecuted,
          current_metrics: metrics
        });
      }

      case 'configure': {
        if (!config) {
          return NextResponse.json(
            { error: 'Configuration data required' },
            { status: 400 }
          );
        }

        // Update or create configuration
        const { data, error } = await supabase
          .from('scaling_configurations')
          .upsert({
            service_id,
            ...config,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        return NextResponse.json({
          success: true,
          configuration: data
        });
      }

      case 'status': {
        // Get current status
        const metrics = await scalingEngine.collectMetrics(service_id);
        const currentInstances = await scalingEngine.getCurrentInstanceCount(service_id);

        // Get recent scaling events
        const { data: recentEvents } = await supabase
          .from('scaling_events')
          .select('*')
          .eq('service_id', service_id)
          .order('timestamp', { ascending: false })
          .limit(10);

        // Get configuration
        const { data: configData } = await supabase
          .from('scaling_configurations')
          .select('*')
          .eq('service_id', service_id)
          .single();

        return NextResponse.json({
          success: true,
          status: {
            service_id,
            current_instances: currentInstances,
            current_metrics: metrics,
            configuration: configData,
            recent_events: recentEvents || []
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Intelligent scaling API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    const action = searchParams.get('action') || 'status';

    if (!serviceId) {
      return NextResponse.json(
        { error: 'service_id parameter required' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientId = request.headers.get('x-client-id') || 'anonymous';
    const rateLimitKey = `scaling_api_get:${clientId}`;
    const currentRequests = await redis.incr(rateLimitKey);
    
    if (currentRequests === 1) {
      await redis.expire(rateLimitKey, 60);
    }
    
    if (currentRequests > 100) { // 100 GET requests per minute
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    switch (action) {
      case 'metrics': {
        const metrics = await scalingEngine.collectMetrics(serviceId);
        return NextResponse.json({
          success: true,
          service_id: serviceId,
          metrics,
          timestamp: new Date().toISOString()
        });
      }

      case 'history': {
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
        const { data: history } = await supabase
          .from('scaling_events')
          .select('*')
          .eq('service_id', serviceId)
          .order('timestamp', { ascending: false })
          .limit(limit);

        return NextResponse.json({
          success: true,
          service_id: serviceId,
          history: history || []
        });
      }

      case 'predictions': {
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
        const { data: predictions } = await supabase
          .from('scaling_predictions')
          .select('*')
          .eq('service_id', serviceId)
          .order('created_at', { ascending: false })
          .limit(limit);

        return NextResponse.json({
          success: true,
          service_id: serviceId,
          predictions: predictions || []
        });
      }

      default: {
        // Default to status
        const metrics = await scalingEngine.collectMetrics(serviceId);
        const currentInstances = await scalingEngine.getCurrentInstanceCount(serviceId);

        const { data: configData } = await supabase
          .from('scaling_configurations')
          .select('*')
          .eq('service_id', serviceId)
          .single();

        return NextResponse.json({
          success: true,
          status: {
            service_id: serviceId,
            current_instances: currentInstances,
            current_metrics: metrics,
            configuration: configData,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

  } catch (error) {
    console.error('Intelligent scaling GET API error:', error);

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```