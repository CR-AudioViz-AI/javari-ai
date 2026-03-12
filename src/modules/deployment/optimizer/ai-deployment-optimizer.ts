```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';

// Types
interface DeploymentMetrics {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_io: number;
  network_io: number;
  active_users: number;
  error_rate: number;
  response_time: number;
}

interface DeploymentHistory {
  id: string;
  timestamp: string;
  environment: string;
  service: string;
  version: string;
  duration_minutes: number;
  success: boolean;
  rollback_required: boolean;
  resource_usage: Record<string, number>;
  pre_deployment_metrics: DeploymentMetrics;
  post_deployment_metrics: DeploymentMetrics;
}

interface OptimizationRecommendation {
  optimal_timing: string;
  resource_allocation: {
    cpu_limit: string;
    memory_limit: string;
    replica_count: number;
  };
  rollout_strategy: {
    type: 'blue-green' | 'canary' | 'rolling';
    stages: Array<{
      percentage: number;
      duration_minutes: number;
      success_criteria: Record<string, number>;
    }>;
  };
  risk_assessment: {
    overall_risk: 'low' | 'medium' | 'high';
    factors: Record<string, number>;
    mitigation_strategies: string[];
  };
  confidence_score: number;
}

interface PredictionFeatures {
  hour_of_day: number;
  day_of_week: number;
  current_load: number;
  recent_deployments: number;
  system_stability: number;
  resource_utilization: number;
  historical_success_rate: number;
}

class AIDeploymentOptimizer {
  private supabase: ReturnType<typeof createClient>;
  private timingModel: tf.LayersModel | null = null;
  private resourceModel: tf.LayersModel | null = null;
  private riskModel: tf.LayersModel | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    try {
      // Initialize timing optimization model
      this.timingModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [7], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 24, activation: 'softmax' }) // 24 hours
        ]
      });

      // Initialize resource prediction model
      this.resourceModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [7], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 3, activation: 'linear' }) // CPU, Memory, Replicas
        ]
      });

      // Initialize risk assessment model
      this.riskModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [7], units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Risk probability
        ]
      });

      await this.loadPreTrainedModels();
    } catch (error) {
      console.error('Model initialization failed:', error);
    }
  }

  private async loadPreTrainedModels(): Promise<void> {
    try {
      // Load models from storage if available
      const { data: modelFiles } = await this.supabase.storage
        .from('ml-models')
        .list('deployment-optimizer');

      if (modelFiles?.length) {
        // Load timing model
        const timingModelUrl = await this.supabase.storage
          .from('ml-models')
          .createSignedUrl('deployment-optimizer/timing-model.json', 3600);
        
        if (timingModelUrl.data?.signedUrl) {
          this.timingModel = await tf.loadLayersModel(timingModelUrl.data.signedUrl);
        }

        // Similar for other models...
      }
    } catch (error) {
      console.error('Failed to load pre-trained models:', error);
    }
  }

  private async collectHistoricalData(): Promise<DeploymentHistory[]> {
    const { data, error } = await this.supabase
      .from('deployments_history')
      .select(`
        *,
        pre_deployment_metrics (*),
        post_deployment_metrics (*)
      `)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(`Failed to fetch deployment history: ${error.message}`);
    }

    return data as DeploymentHistory[];
  }

  private async getCurrentMetrics(): Promise<DeploymentMetrics> {
    const { data, error } = await this.supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      throw new Error(`Failed to fetch current metrics: ${error.message}`);
    }

    return data as DeploymentMetrics;
  }

  private extractFeatures(
    currentMetrics: DeploymentMetrics,
    historicalData: DeploymentHistory[]
  ): PredictionFeatures {
    const now = new Date();
    const recentDeployments = historicalData.filter(
      d => new Date(d.timestamp) > new Date(now.getTime() - 24 * 60 * 60 * 1000)
    ).length;

    const successfulDeployments = historicalData.filter(d => d.success).length;
    const totalDeployments = historicalData.length;

    return {
      hour_of_day: now.getHours(),
      day_of_week: now.getDay(),
      current_load: (currentMetrics.cpu_usage + currentMetrics.memory_usage) / 2,
      recent_deployments: recentDeployments,
      system_stability: 1 - currentMetrics.error_rate,
      resource_utilization: Math.max(
        currentMetrics.cpu_usage,
        currentMetrics.memory_usage
      ),
      historical_success_rate: totalDeployments > 0 ? successfulDeployments / totalDeployments : 0.5
    };
  }

  private async predictOptimalTiming(features: PredictionFeatures): Promise<number> {
    if (!this.timingModel) {
      throw new Error('Timing model not initialized');
    }

    const input = tf.tensor2d([[
      features.hour_of_day / 24,
      features.day_of_week / 7,
      features.current_load,
      features.recent_deployments / 10,
      features.system_stability,
      features.resource_utilization,
      features.historical_success_rate
    ]]);

    const prediction = this.timingModel.predict(input) as tf.Tensor;
    const probabilities = await prediction.data();
    
    input.dispose();
    prediction.dispose();

    // Find hour with highest success probability
    return probabilities.indexOf(Math.max(...probabilities));
  }

  private async predictResourceRequirements(
    features: PredictionFeatures
  ): Promise<{ cpu: number; memory: number; replicas: number }> {
    if (!this.resourceModel) {
      throw new Error('Resource model not initialized');
    }

    const input = tf.tensor2d([[
      features.hour_of_day / 24,
      features.day_of_week / 7,
      features.current_load,
      features.recent_deployments / 10,
      features.system_stability,
      features.resource_utilization,
      features.historical_success_rate
    ]]);

    const prediction = this.resourceModel.predict(input) as tf.Tensor;
    const resources = await prediction.data();
    
    input.dispose();
    prediction.dispose();

    return {
      cpu: Math.max(0.1, resources[0]), // CPU cores
      memory: Math.max(128, resources[1]), // MB
      replicas: Math.max(1, Math.round(resources[2]))
    };
  }

  private async assessRisk(features: PredictionFeatures): Promise<number> {
    if (!this.riskModel) {
      throw new Error('Risk model not initialized');
    }

    const input = tf.tensor2d([[
      features.hour_of_day / 24,
      features.day_of_week / 7,
      features.current_load,
      features.recent_deployments / 10,
      features.system_stability,
      features.resource_utilization,
      features.historical_success_rate
    ]]);

    const prediction = this.riskModel.predict(input) as tf.Tensor;
    const riskScore = await prediction.data();
    
    input.dispose();
    prediction.dispose();

    return riskScore[0];
  }

  private generateRolloutStrategy(
    riskScore: number,
    resourceRequirements: { cpu: number; memory: number; replicas: number }
  ): OptimizationRecommendation['rollout_strategy'] {
    if (riskScore < 0.3) {
      return {
        type: 'rolling',
        stages: [
          { percentage: 25, duration_minutes: 5, success_criteria: { error_rate: 0.01, response_time: 500 } },
          { percentage: 50, duration_minutes: 10, success_criteria: { error_rate: 0.01, response_time: 500 } },
          { percentage: 100, duration_minutes: 15, success_criteria: { error_rate: 0.01, response_time: 500 } }
        ]
      };
    } else if (riskScore < 0.7) {
      return {
        type: 'canary',
        stages: [
          { percentage: 5, duration_minutes: 10, success_criteria: { error_rate: 0.005, response_time: 400 } },
          { percentage: 25, duration_minutes: 15, success_criteria: { error_rate: 0.01, response_time: 500 } },
          { percentage: 100, duration_minutes: 20, success_criteria: { error_rate: 0.01, response_time: 500 } }
        ]
      };
    } else {
      return {
        type: 'blue-green',
        stages: [
          { percentage: 100, duration_minutes: 30, success_criteria: { error_rate: 0.005, response_time: 300 } }
        ]
      };
    }
  }

  public async generateOptimizationRecommendation(
    service: string,
    environment: string
  ): Promise<OptimizationRecommendation> {
    try {
      const [historicalData, currentMetrics] = await Promise.all([
        this.collectHistoricalData(),
        this.getCurrentMetrics()
      ]);

      const features = this.extractFeatures(currentMetrics, historicalData);
      
      const [optimalHour, resourceRequirements, riskScore] = await Promise.all([
        this.predictOptimalTiming(features),
        this.predictResourceRequirements(features),
        this.assessRisk(features)
      ]);

      const optimalTiming = new Date();
      optimalTiming.setHours(optimalHour, 0, 0, 0);

      const rolloutStrategy = this.generateRolloutStrategy(riskScore, resourceRequirements);

      const riskLevel: 'low' | 'medium' | 'high' = 
        riskScore < 0.3 ? 'low' : riskScore < 0.7 ? 'medium' : 'high';

      return {
        optimal_timing: optimalTiming.toISOString(),
        resource_allocation: {
          cpu_limit: `${resourceRequirements.cpu}`,
          memory_limit: `${Math.round(resourceRequirements.memory)}Mi`,
          replica_count: resourceRequirements.replicas
        },
        rollout_strategy: rolloutStrategy,
        risk_assessment: {
          overall_risk: riskLevel,
          factors: {
            system_load: features.current_load,
            recent_activity: features.recent_deployments,
            stability: features.system_stability,
            historical_success: features.historical_success_rate
          },
          mitigation_strategies: this.generateMitigationStrategies(riskScore, features)
        },
        confidence_score: Math.min(0.95, features.historical_success_rate + (1 - riskScore) * 0.3)
      };
    } catch (error) {
      throw new Error(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateMitigationStrategies(riskScore: number, features: PredictionFeatures): string[] {
    const strategies: string[] = [];

    if (features.current_load > 0.8) {
      strategies.push('Consider scaling up resources before deployment');
    }

    if (features.recent_deployments > 3) {
      strategies.push('Delay deployment - too many recent deployments detected');
    }

    if (features.system_stability < 0.95) {
      strategies.push('Investigate and resolve system stability issues first');
    }

    if (riskScore > 0.7) {
      strategies.push('Use blue-green deployment for zero-downtime rollback capability');
      strategies.push('Implement comprehensive monitoring and alerting');
    }

    if (strategies.length === 0) {
      strategies.push('No specific mitigations required - system is stable');
    }

    return strategies;
  }

  public async trainModels(): Promise<void> {
    try {
      const historicalData = await this.collectHistoricalData();
      
      if (historicalData.length < 100) {
        throw new Error('Insufficient training data - need at least 100 deployment records');
      }

      const trainingData = historicalData.map(deployment => {
        const features = this.extractFeatures(
          deployment.pre_deployment_metrics,
          historicalData
        );
        
        return {
          features: Object.values(features),
          timing_label: new Date(deployment.timestamp).getHours(),
          resource_labels: [
            deployment.resource_usage.cpu || 1,
            deployment.resource_usage.memory || 512,
            deployment.resource_usage.replicas || 2
          ],
          success_label: deployment.success ? 0 : 1 // Risk score (0 = success, 1 = failure)
        };
      });

      // Train timing model
      if (this.timingModel) {
        const timingX = tf.tensor2d(trainingData.map(d => d.features));
        const timingY = tf.oneHot(trainingData.map(d => d.timing_label), 24);

        await this.timingModel.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'categoricalCrossentropy',
          metrics: ['accuracy']
        });

        await this.timingModel.fit(timingX, timingY, {
          epochs: 50,
          batchSize: 32,
          validationSplit: 0.2,
          verbose: 0
        });

        timingX.dispose();
        timingY.dispose();
      }

      // Train resource model
      if (this.resourceModel) {
        const resourceX = tf.tensor2d(trainingData.map(d => d.features));
        const resourceY = tf.tensor2d(trainingData.map(d => d.resource_labels));

        await this.resourceModel.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'meanSquaredError',
          metrics: ['mae']
        });

        await this.resourceModel.fit(resourceX, resourceY, {
          epochs: 100,
          batchSize: 32,
          validationSplit: 0.2,
          verbose: 0
        });

        resourceX.dispose();
        resourceY.dispose();
      }

      // Train risk model
      if (this.riskModel) {
        const riskX = tf.tensor2d(trainingData.map(d => d.features));
        const riskY = tf.tensor2d(trainingData.map(d => [d.success_label]));

        await this.riskModel.compile({
          optimizer: tf.train.adam(0.001),
          loss: 'binaryCrossentropy',
          metrics: ['accuracy']
        });

        await this.riskModel.fit(riskX, riskY, {
          epochs: 75,
          batchSize: 32,
          validationSplit: 0.2,
          verbose: 0
        });

        riskX.dispose();
        riskY.dispose();
      }

      await this.saveModels();
      console.log('Models trained successfully');
    } catch (error) {
      throw new Error(`Model training failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async saveModels(): Promise<void> {
    try {
      if (this.timingModel) {
        await this.timingModel.save('file:///tmp/timing-model');
        // Upload to Supabase storage
        // Implementation depends on your storage setup
      }
      
      if (this.resourceModel) {
        await this.resourceModel.save('file:///tmp/resource-model');
      }
      
      if (this.riskModel) {
        await this.riskModel.save('file:///tmp/risk-model');
      }
    } catch (error) {
      console.error('Failed to save models:', error);
    }
  }
}

// Initialize optimizer
const deploymentOptimizer = new AIDeploymentOptimizer();

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json({
      status: 'healthy',
      service: 'ai-deployment-optimizer',
      timestamp: new Date().toISOString(),
      models_loaded: {
        timing: !!deploymentOptimizer['timingModel'],
        resource: !!deploymentOptimizer['resourceModel'],
        risk: !!deploymentOptimizer['riskModel']
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, service, environment } = body;

    switch (action) {
      case 'optimize':
        if (!service || !environment) {
          return NextResponse.json(
            { error: 'Service and environment parameters required' },
            { status: 400 }
          );
        }

        const recommendation = await deploymentOptimizer.generateOptimizationRecommendation(
          service,
          environment
        );

        return NextResponse.json({
          success: true,
          recommendation,
          generated_at: new Date().toISOString()
        });

      case 'train':
        await deploymentOptimizer.trainModels();
        
        return NextResponse.json({
          success: true,
          message: 'Models trained successfully',
          trained_at: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "optimize" or "train"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI Deployment Optimizer error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
```