```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import Redis from 'ioredis';

// Types and Schemas
const HealthCheckSchema = z.object({
  service_id: z.string().uuid(),
  service_name: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']),
  region: z.string().min(1),
});

const ScalingRequestSchema = z.object({
  resource_id: z.string().uuid(),
  resource_type: z.enum(['kubernetes', 'ec2', 'lambda', 'database']),
  scaling_action: z.enum(['scale_up', 'scale_down', 'auto_scale']),
  target_capacity: z.number().positive().optional(),
  environment: z.string().min(1),
});

const HealingActionSchema = z.object({
  incident_id: z.string().uuid(),
  action_type: z.enum(['restart', 'redeploy', 'scale', 'failover', 'rollback']),
  target_resources: z.array(z.string().uuid()),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  auto_approve: z.boolean().default(false),
});

interface HealthMetric {
  id: string;
  service_name: string;
  metric_type: string;
  value: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  timestamp: Date;
  environment: string;
  region: string;
}

interface ScalingDecision {
  resource_id: string;
  current_capacity: number;
  target_capacity: number;
  scaling_reason: string;
  confidence_score: number;
  estimated_cost_impact: number;
}

interface HealingAction {
  id: string;
  incident_id: string;
  action_type: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  target_resources: string[];
  execution_log: string[];
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
}

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

class InfrastructureHealthMonitor {
  private redis: Redis;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
  }

  async collectHealthMetrics(serviceId: string): Promise<HealthMetric[]> {
    return this.circuitBreaker.execute(async () => {
      const cacheKey = `health_metrics:${serviceId}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      // Simulate health metric collection from various sources
      const metrics: HealthMetric[] = [
        {
          id: crypto.randomUUID(),
          service_name: `service-${serviceId}`,
          metric_type: 'cpu_utilization',
          value: Math.random() * 100,
          threshold: 80,
          status: 'healthy',
          timestamp: new Date(),
          environment: 'production',
          region: 'us-west-2'
        },
        {
          id: crypto.randomUUID(),
          service_name: `service-${serviceId}`,
          metric_type: 'memory_utilization',
          value: Math.random() * 100,
          threshold: 85,
          status: 'warning',
          timestamp: new Date(),
          environment: 'production',
          region: 'us-west-2'
        }
      ];

      // Determine status based on thresholds
      metrics.forEach(metric => {
        if (metric.value > metric.threshold * 0.9) {
          metric.status = 'critical';
        } else if (metric.value > metric.threshold * 0.7) {
          metric.status = 'warning';
        } else {
          metric.status = 'healthy';
        }
      });

      await this.redis.setex(cacheKey, 30, JSON.stringify(metrics));
      return metrics;
    });
  }

  async detectAnomalies(metrics: HealthMetric[]): Promise<string[]> {
    const anomalies: string[] = [];
    
    for (const metric of metrics) {
      if (metric.status === 'critical') {
        anomalies.push(`${metric.service_name}: ${metric.metric_type} at ${metric.value}% (threshold: ${metric.threshold}%)`);
      }
    }

    return anomalies;
  }
}

class AutoScalingEngine {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  async analyzeScalingNeeds(resourceId: string, metrics: HealthMetric[]): Promise<ScalingDecision | null> {
    const cpuMetric = metrics.find(m => m.metric_type === 'cpu_utilization');
    const memoryMetric = metrics.find(m => m.metric_type === 'memory_utilization');
    
    if (!cpuMetric || !memoryMetric) return null;

    const avgUtilization = (cpuMetric.value + memoryMetric.value) / 2;
    let scalingDecision: ScalingDecision | null = null;

    if (avgUtilization > 80) {
      scalingDecision = {
        resource_id: resourceId,
        current_capacity: 3, // Simulated current capacity
        target_capacity: 5,
        scaling_reason: 'High resource utilization detected',
        confidence_score: 0.85,
        estimated_cost_impact: 200
      };
    } else if (avgUtilization < 30) {
      scalingDecision = {
        resource_id: resourceId,
        current_capacity: 5,
        target_capacity: 2,
        scaling_reason: 'Low resource utilization, cost optimization opportunity',
        confidence_score: 0.75,
        estimated_cost_impact: -150
      };
    }

    if (scalingDecision) {
      await this.redis.setex(
        `scaling_decision:${resourceId}`,
        300,
        JSON.stringify(scalingDecision)
      );
    }

    return scalingDecision;
  }

  async executeScaling(decision: ScalingDecision): Promise<boolean> {
    try {
      // Simulate scaling operation
      console.log(`Scaling resource ${decision.resource_id} from ${decision.current_capacity} to ${decision.target_capacity}`);
      
      // In a real implementation, this would interface with cloud provider APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('Scaling operation failed:', error);
      return false;
    }
  }
}

class HealingOrchestrator {
  private supabase;
  private redis: Redis;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  async createHealingAction(
    incidentId: string,
    actionType: string,
    targetResources: string[]
  ): Promise<HealingAction> {
    const action: HealingAction = {
      id: crypto.randomUUID(),
      incident_id: incidentId,
      action_type: actionType,
      status: 'pending',
      target_resources: targetResources,
      execution_log: [],
      started_at: new Date()
    };

    const { error } = await this.supabase
      .from('healing_actions')
      .insert([action]);

    if (error) {
      throw new Error(`Failed to create healing action: ${error.message}`);
    }

    await this.redis.setex(
      `healing_action:${action.id}`,
      3600,
      JSON.stringify(action)
    );

    return action;
  }

  async executeHealingAction(actionId: string): Promise<void> {
    const actionData = await this.redis.get(`healing_action:${actionId}`);
    if (!actionData) {
      throw new Error('Healing action not found');
    }

    const action: HealingAction = JSON.parse(actionData);
    action.status = 'executing';
    action.execution_log.push(`Started execution at ${new Date().toISOString()}`);

    try {
      // Simulate healing action execution
      switch (action.action_type) {
        case 'restart':
          action.execution_log.push('Initiating service restart...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          action.execution_log.push('Service restarted successfully');
          break;
        
        case 'scale':
          action.execution_log.push('Initiating auto-scaling...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          action.execution_log.push('Auto-scaling completed');
          break;
        
        case 'failover':
          action.execution_log.push('Initiating failover to backup region...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          action.execution_log.push('Failover completed successfully');
          break;
        
        default:
          throw new Error(`Unknown action type: ${action.action_type}`);
      }

      action.status = 'completed';
      action.completed_at = new Date();
      action.execution_log.push(`Completed at ${action.completed_at.toISOString()}`);

    } catch (error) {
      action.status = 'failed';
      action.error_message = error instanceof Error ? error.message : 'Unknown error';
      action.execution_log.push(`Failed: ${action.error_message}`);
    }

    await this.redis.setex(
      `healing_action:${actionId}`,
      3600,
      JSON.stringify(action)
    );

    await this.supabase
      .from('healing_actions')
      .update({
        status: action.status,
        execution_log: action.execution_log,
        completed_at: action.completed_at,
        error_message: action.error_message
      })
      .eq('id', actionId);
  }

  async getHealingStatus(actionId: string): Promise<HealingAction | null> {
    const actionData = await this.redis.get(`healing_action:${actionId}`);
    if (actionData) {
      return JSON.parse(actionData);
    }

    const { data, error } = await this.supabase
      .from('healing_actions')
      .select('*')
      .eq('id', actionId)
      .single();

    if (error || !data) return null;
    return data;
  }
}

// Initialize services
const healthMonitor = new InfrastructureHealthMonitor();
const scalingEngine = new AutoScalingEngine();
const healingOrchestrator = new HealingOrchestrator();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const serviceId = searchParams.get('service_id');
    const actionId = searchParams.get('action_id');

    switch (action) {
      case 'health_check':
        if (!serviceId) {
          return NextResponse.json(
            { error: 'service_id is required for health check' },
            { status: 400 }
          );
        }

        const metrics = await healthMonitor.collectHealthMetrics(serviceId);
        const anomalies = await healthMonitor.detectAnomalies(metrics);
        
        return NextResponse.json({
          service_id: serviceId,
          metrics,
          anomalies,
          overall_health: anomalies.length === 0 ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString()
        });

      case 'scaling_analysis':
        if (!serviceId) {
          return NextResponse.json(
            { error: 'service_id is required for scaling analysis' },
            { status: 400 }
          );
        }

        const serviceMetrics = await healthMonitor.collectHealthMetrics(serviceId);
        const scalingDecision = await scalingEngine.analyzeScalingNeeds(serviceId, serviceMetrics);
        
        return NextResponse.json({
          service_id: serviceId,
          scaling_needed: scalingDecision !== null,
          decision: scalingDecision,
          timestamp: new Date().toISOString()
        });

      case 'healing_status':
        if (!actionId) {
          return NextResponse.json(
            { error: 'action_id is required for healing status' },
            { status: 400 }
          );
        }

        const healingStatus = await healingOrchestrator.getHealingStatus(actionId);
        if (!healingStatus) {
          return NextResponse.json(
            { error: 'Healing action not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          action: healingStatus,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Self-healing infrastructure API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'trigger_health_check':
        const healthData = HealthCheckSchema.parse(body);
        const metrics = await healthMonitor.collectHealthMetrics(healthData.service_id);
        const anomalies = await healthMonitor.detectAnomalies(metrics);

        if (anomalies.length > 0) {
          // Trigger automatic healing if critical issues detected
          const incidentId = crypto.randomUUID();
          const healingAction = await healingOrchestrator.createHealingAction(
            incidentId,
            'restart',
            [healthData.service_id]
          );

          // Execute healing action asynchronously
          healingOrchestrator.executeHealingAction(healingAction.id).catch(console.error);
        }

        return NextResponse.json({
          service_id: healthData.service_id,
          health_status: anomalies.length === 0 ? 'healthy' : 'unhealthy',
          anomalies,
          auto_healing_triggered: anomalies.length > 0,
          timestamp: new Date().toISOString()
        });

      case 'execute_scaling':
        const scalingData = ScalingRequestSchema.parse(body);
        
        // Get current metrics for scaling decision
        const currentMetrics = await healthMonitor.collectHealthMetrics(scalingData.resource_id);
        const decision = await scalingEngine.analyzeScalingNeeds(scalingData.resource_id, currentMetrics);
        
        if (!decision && scalingData.scaling_action === 'auto_scale') {
          return NextResponse.json({
            message: 'No scaling needed based on current metrics',
            scaling_executed: false,
            timestamp: new Date().toISOString()
          });
        }

        const scalingResult = decision 
          ? await scalingEngine.executeScaling(decision)
          : true; // Allow manual scaling requests

        return NextResponse.json({
          resource_id: scalingData.resource_id,
          scaling_action: scalingData.scaling_action,
          scaling_executed: scalingResult,
          decision,
          timestamp: new Date().toISOString()
        });

      case 'create_healing_action':
        const healingData = HealingActionSchema.parse(body);
        
        const action = await healingOrchestrator.createHealingAction(
          healingData.incident_id,
          healingData.action_type,
          healingData.target_resources
        );

        if (healingData.auto_approve) {
          // Execute immediately if auto-approved
          healingOrchestrator.executeHealingAction(action.id).catch(console.error);
        }

        return NextResponse.json({
          healing_action: action,
          auto_execution: healingData.auto_approve,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Self-healing infrastructure API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('action_id');

    if (!actionId) {
      return NextResponse.json(
        { error: 'action_id is required' },
        { status: 400 }
      );
    }

    const { status } = body;
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be approved, rejected, or cancelled' },
        { status: 400 }
      );
    }

    const healingAction = await healingOrchestrator.getHealingStatus(actionId);
    if (!healingAction) {
      return NextResponse.json(
        { error: 'Healing action not found' },
        { status: 404 }
      );
    }

    if (status === 'approved' && healingAction.status === 'pending') {
      // Execute the healing action
      healingOrchestrator.executeHealingAction(actionId).catch(console.error);
    }

    return NextResponse.json({
      action_id: actionId,
      previous_status: healingAction.status,
      new_status: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Self-healing infrastructure API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('action_id');

    if (!actionId) {
      return NextResponse.json(
        { error: 'action_id is required' },
        { status: 400 }
      );
    }

    const healingAction = await healingOrchestrator.getHealingStatus(actionId);
    if (!healingAction) {
      return NextResponse.json(
        { error: 'Healing action not found' },
        { status: 404 }
      );
    }

    if (['executing', 'completed'].includes(healingAction.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel healing action in current status' },
        { status: 400 }
      );
    }

    // Mark as cancelled in both Redis and database
    const redis = new Redis(process.env.REDIS_URL!);
    await redis.del(`healing_action:${actionId}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from('healing_actions')
      .update({ status: 'cancelled' })
      .eq('id', actionId);

    return NextResponse.json({
      action_id: actionId,
      status: 'cancelled',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Self-healing infrastructure API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```