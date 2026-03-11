import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ratelimit } from '@/lib/ratelimit';
import { validateApiKey } from '@/lib/auth';

// Validation schemas
const AllocationRequestSchema = z.object({
  workload_id: z.string().min(1),
  resource_type: z.enum(['cpu', 'memory', 'gpu', 'storage', 'network']),
  current_usage: z.object({
    cpu_percent: z.number().min(0).max(100),
    memory_percent: z.number().min(0).max(100),
    gpu_percent: z.number().min(0).max(100).optional(),
    storage_gb: z.number().min(0),
    network_mbps: z.number().min(0)
  }),
  target_sla: z.object({
    response_time_ms: z.number().min(0),
    availability_percent: z.number().min(0).max(100),
    throughput_rps: z.number().min(0)
  }),
  constraints: z.object({
    max_cost_per_hour: z.number().min(0),
    max_instances: z.number().min(1),
    preferred_regions: z.array(z.string()).optional()
  }).optional()
});

const MetricsUpdateSchema = z.object({
  workload_id: z.string().min(1),
  timestamp: z.string().datetime(),
  metrics: z.object({
    cpu_usage: z.number().min(0).max(100),
    memory_usage: z.number().min(0).max(100),
    gpu_usage: z.number().min(0).max(100).optional(),
    response_time: z.number().min(0),
    throughput: z.number().min(0),
    error_rate: z.number().min(0).max(100)
  })
});

const PolicyUpdateSchema = z.object({
  workload_id: z.string().min(1),
  policy: z.object({
    scale_up_threshold: z.number().min(0).max(100),
    scale_down_threshold: z.number().min(0).max(100),
    cooldown_period_seconds: z.number().min(30),
    min_instances: z.number().min(1),
    max_instances: z.number().min(1),
    cost_optimization_enabled: z.boolean()
  })
});

// Types
interface ResourceMetrics {
  workload_id: string;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  gpu_usage?: number;
  response_time: number;
  throughput: number;
  error_rate: number;
  cost_per_hour: number;
}

interface AllocationDecision {
  workload_id: string;
  action: 'scale_up' | 'scale_down' | 'maintain' | 'migrate';
  current_instances: number;
  target_instances: number;
  resource_changes: Record<string, any>;
  estimated_cost_impact: number;
  confidence_score: number;
  rationale: string;
}

interface DemandForecast {
  workload_id: string;
  forecast_horizon_hours: number;
  predicted_load: number[];
  confidence_interval: [number, number][];
  seasonality_factors: Record<string, number>;
}

class ResourceAllocationController {
  private supabase;
  private demandForecaster: DemandForecaster;
  private metricsCollector: PerformanceMetricsCollector;
  private policyEngine: AutoScalingPolicyEngine;
  private costOptimizer: CostOptimizer;
  private resourceManager: ResourceManager;
  private validator: AllocationValidator;
  private metricsAggregator: MetricsAggregator;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.demandForecaster = new DemandForecaster();
    this.metricsCollector = new PerformanceMetricsCollector();
    this.policyEngine = new AutoScalingPolicyEngine();
    this.costOptimizer = new CostOptimizer();
    this.resourceManager = new ResourceManager();
    this.validator = new AllocationValidator();
    this.metricsAggregator = new MetricsAggregator();
  }

  async getAllocationRecommendation(request: z.infer<typeof AllocationRequestSchema>) {
    try {
      // Collect current metrics
      const currentMetrics = await this.metricsCollector.getLatestMetrics(request.workload_id);
      
      // Generate demand forecast
      const forecast = await this.demandForecaster.generateForecast(
        request.workload_id,
        24 // 24-hour forecast
      );

      // Get scaling policy
      const policy = await this.policyEngine.getPolicy(request.workload_id);

      // Validate allocation constraints
      const validation = await this.validator.validateConstraints(request);
      if (!validation.isValid) {
        throw new Error(`Allocation constraints validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate allocation decision
      const decision = await this.generateAllocationDecision(
        request,
        currentMetrics,
        forecast,
        policy
      );

      // Optimize for cost
      const optimizedDecision = await this.costOptimizer.optimizeAllocation(decision);

      return optimizedDecision;
    } catch (error) {
      throw new Error(`Failed to generate allocation recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeAllocation(decision: AllocationDecision) {
    try {
      // Execute resource changes
      const result = await this.resourceManager.executeAllocation(decision);

      // Log allocation event
      await this.logAllocationEvent(decision, result);

      // Update metrics
      await this.metricsAggregator.recordAllocation(decision, result);

      return result;
    } catch (error) {
      throw new Error(`Failed to execute allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateAllocationDecision(
    request: z.infer<typeof AllocationRequestSchema>,
    metrics: ResourceMetrics,
    forecast: DemandForecast,
    policy: any
  ): Promise<AllocationDecision> {
    const currentUtilization = metrics.cpu_usage;
    const predictedPeakLoad = Math.max(...forecast.predicted_load);
    
    let action: AllocationDecision['action'] = 'maintain';
    let targetInstances = 1; // Default
    
    // Decision logic based on current usage and forecast
    if (currentUtilization > policy.scale_up_threshold || predictedPeakLoad > policy.scale_up_threshold) {
      action = 'scale_up';
      targetInstances = Math.min(
        Math.ceil(predictedPeakLoad / policy.scale_up_threshold),
        policy.max_instances
      );
    } else if (currentUtilization < policy.scale_down_threshold && predictedPeakLoad < policy.scale_down_threshold) {
      action = 'scale_down';
      targetInstances = Math.max(
        Math.ceil(predictedPeakLoad / policy.scale_up_threshold * 0.8),
        policy.min_instances
      );
    }

    // Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(forecast, metrics);

    return {
      workload_id: request.workload_id,
      action,
      current_instances: 1, // Would be fetched from resource manager
      target_instances: targetInstances,
      resource_changes: {
        cpu_cores: targetInstances * 2,
        memory_gb: targetInstances * 8,
        storage_gb: request.current_usage.storage_gb
      },
      estimated_cost_impact: this.estimateCostImpact(targetInstances),
      confidence_score: confidenceScore,
      rationale: this.generateRationale(action, currentUtilization, predictedPeakLoad, policy)
    };
  }

  private calculateConfidenceScore(forecast: DemandForecast, metrics: ResourceMetrics): number {
    // Simplified confidence calculation
    const forecastVariance = this.calculateVariance(forecast.predicted_load);
    const metricsStability = 100 - metrics.error_rate;
    return Math.min(100, (metricsStability * 0.6) + ((100 - forecastVariance) * 0.4));
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private estimateCostImpact(targetInstances: number): number {
    // Simplified cost calculation - would integrate with actual pricing APIs
    const costPerInstancePerHour = 0.50; // Example rate
    return targetInstances * costPerInstancePerHour;
  }

  private generateRationale(
    action: AllocationDecision['action'],
    currentUsage: number,
    predictedPeak: number,
    policy: any
  ): string {
    switch (action) {
      case 'scale_up':
        return `Scale up recommended due to current usage (${currentUsage}%) or predicted peak (${predictedPeak}%) exceeding threshold (${policy.scale_up_threshold}%)`;
      case 'scale_down':
        return `Scale down recommended as current usage (${currentUsage}%) and predicted peak (${predictedPeak}%) are below threshold (${policy.scale_down_threshold}%)`;
      default:
        return `Current allocation is optimal for predicted demand`;
    }
  }

  private async logAllocationEvent(decision: AllocationDecision, result: any) {
    await this.supabase
      .from('resource_allocation_events')
      .insert({
        workload_id: decision.workload_id,
        action: decision.action,
        decision_data: decision,
        execution_result: result,
        timestamp: new Date().toISOString()
      });
  }
}

// Supporting classes (simplified implementations)
class DemandForecaster {
  async generateForecast(workloadId: string, horizonHours: number): Promise<DemandForecast> {
    // Simplified forecasting logic
    const baseLoad = 50;
    const predicted_load = Array.from({ length: horizonHours }, (_, i) => 
      baseLoad + Math.sin(i * Math.PI / 12) * 20 + Math.random() * 10
    );
    
    return {
      workload_id: workloadId,
      forecast_horizon_hours: horizonHours,
      predicted_load,
      confidence_interval: predicted_load.map(load => [load * 0.9, load * 1.1] as [number, number]),
      seasonality_factors: { hourly: 0.2, daily: 0.5, weekly: 0.1 }
    };
  }
}

class PerformanceMetricsCollector {
  async getLatestMetrics(workloadId: string): Promise<ResourceMetrics> {
    // Would integrate with monitoring systems
    return {
      workload_id: workloadId,
      timestamp: new Date().toISOString(),
      cpu_usage: 65,
      memory_usage: 70,
      response_time: 150,
      throughput: 1000,
      error_rate: 1.5,
      cost_per_hour: 2.50
    };
  }
}

class AutoScalingPolicyEngine {
  async getPolicy(workloadId: string) {
    // Default policy
    return {
      scale_up_threshold: 80,
      scale_down_threshold: 30,
      cooldown_period_seconds: 300,
      min_instances: 1,
      max_instances: 10,
      cost_optimization_enabled: true
    };
  }
}

class CostOptimizer {
  async optimizeAllocation(decision: AllocationDecision): Promise<AllocationDecision> {
    // Cost optimization logic would go here
    return decision;
  }
}

class ResourceManager {
  async executeAllocation(decision: AllocationDecision) {
    // Would integrate with cloud provider APIs
    return {
      success: true,
      executedAt: new Date().toISOString(),
      resourcesAllocated: decision.resource_changes,
      actualCost: decision.estimated_cost_impact
    };
  }
}

class AllocationValidator {
  async validateConstraints(request: z.infer<typeof AllocationRequestSchema>) {
    // Validation logic
    return {
      isValid: true,
      errors: []
    };
  }
}

class MetricsAggregator {
  async recordAllocation(decision: AllocationDecision, result: any) {
    // Record metrics for analysis
  }
}

const controller = new ResourceAllocationController();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workloadId = searchParams.get('workload_id');

    if (!workloadId) {
      return NextResponse.json(
        { error: 'workload_id parameter is required' },
        { status: 400 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    const isValidKey = await validateApiKey(apiKey);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Get current allocation status
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: allocation, error } = await supabase
      .from('resource_allocations')
      .select('*')
      .eq('workload_id', workloadId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: allocation || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('GET /api/platform/resource-allocation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    const isValidKey = await validateApiKey(apiKey);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = AllocationRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validation.error.errors 
        },
        { status: 400 }
      );
    }

    // Generate allocation recommendation
    const recommendation = await controller.getAllocationRecommendation(validation.data);

    // Store recommendation
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: dbError } = await supabase
      .from('allocation_recommendations')
      .insert({
        workload_id: validation.data.workload_id,
        recommendation_data: recommendation,
        created_at: new Date().toISOString()
      });

    if (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: recommendation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('POST /api/platform/resource-allocation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    const isValidKey = await validateApiKey(apiKey);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    if (body.type === 'metrics') {
      const validation = MetricsUpdateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid metrics data', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Update metrics
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabase
        .from('resource_metrics')
        .insert({
          workload_id: validation.data.workload_id,
          metrics_data: validation.data.metrics,
          timestamp: validation.data.timestamp
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Metrics updated successfully',
        timestamp: new Date().toISOString()
      });

    } else if (body.type === 'policy') {
      const validation = PolicyUpdateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid policy data', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Update scaling policy
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error } = await supabase
        .from('scaling_policies')
        .upsert({
          workload_id: validation.data.workload_id,
          policy_data: validation.data.policy,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Scaling policy updated successfully',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { error: 'Invalid update type. Must be "metrics" or "policy"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('PUT /api/platform/resource-allocation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workloadId = searchParams.get('workload_id');

    if (!workloadId) {
      return NextResponse.json(
        { error: 'workload_id parameter is required' },
        { status: 400 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    const isValidKey = await validateApiKey(apiKey);
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Delete allocation configuration
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('resource_allocations')
      .delete()
      .eq('workload_id', workloadId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Resource allocation configuration deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('DELETE /api/platform/resource-allocation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}