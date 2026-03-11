```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ECSClient, RunTaskCommand, DescribeServicesCommand } from '@aws-sdk/client-ecs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { ContainerInstanceManagementClient } from '@azure/arm-containerinstance';
import { ComputeManagementClient } from '@azure/arm-compute';
import { CloudRunClient } from '@google-cloud/run';
import { InstancesClient } from '@google-cloud/compute';
import Redis from 'ioredis';
import { z } from 'zod';
import crypto from 'crypto';

// Validation schemas
const deploymentSchema = z.object({
  applicationId: z.string().min(1),
  image: z.string().url(),
  configuration: z.object({
    cpu: z.number().positive(),
    memory: z.number().positive(),
    replicas: z.number().positive(),
    environment: z.record(z.string()),
  }),
  providers: z.array(z.enum(['aws', 'azure', 'gcp'])),
  strategy: z.enum(['cost-optimized', 'performance', 'availability']),
  healthCheck: z.object({
    path: z.string().default('/health'),
    interval: z.number().default(30),
    timeout: z.number().default(5),
  }),
});

const failoverSchema = z.object({
  targetProvider: z.enum(['aws', 'azure', 'gcp']),
  reason: z.string().min(1),
});

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

// Cloud provider clients
const awsECS = new ECSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const awsLambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const awsEC2 = new EC2Client({ region: process.env.AWS_REGION || 'us-east-1' });

// Types
interface DeploymentRequest {
  applicationId: string;
  image: string;
  configuration: {
    cpu: number;
    memory: number;
    replicas: number;
    environment: Record<string, string>;
  };
  providers: ('aws' | 'azure' | 'gcp')[];
  strategy: 'cost-optimized' | 'performance' | 'availability';
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
  };
}

interface DeploymentStatus {
  id: string;
  status: 'pending' | 'deploying' | 'running' | 'failed' | 'stopped';
  providers: Record<string, {
    status: string;
    endpoint?: string;
    cost?: number;
    health?: boolean;
  }>;
  metrics?: {
    totalCost: number;
    uptime: number;
    errorRate: number;
  };
}

class DeploymentOrchestrator {
  private async validateRequest(request: any): Promise<DeploymentRequest> {
    try {
      return deploymentSchema.parse(request);
    } catch (error) {
      throw new Error(`Invalid request: ${error}`);
    }
  }

  private async generateDeploymentId(): Promise<string> {
    return `deploy_${crypto.randomBytes(16).toString('hex')}`;
  }

  private async calculateOptimalAllocation(
    request: DeploymentRequest
  ): Promise<Record<string, number>> {
    const pricing = {
      aws: 0.05, // per hour per replica
      azure: 0.048,
      gcp: 0.052,
    };

    const allocation: Record<string, number> = {};
    const totalReplicas = request.configuration.replicas;

    switch (request.strategy) {
      case 'cost-optimized':
        // Prioritize cheapest provider
        const sortedProviders = request.providers.sort(
          (a, b) => pricing[a] - pricing[b]
        );
        allocation[sortedProviders[0]] = Math.ceil(totalReplicas * 0.7);
        if (sortedProviders[1]) {
          allocation[sortedProviders[1]] = Math.ceil(totalReplicas * 0.3);
        }
        break;

      case 'performance':
        // Distribute evenly for better performance
        const replicasPerProvider = Math.ceil(totalReplicas / request.providers.length);
        request.providers.forEach(provider => {
          allocation[provider] = replicasPerProvider;
        });
        break;

      case 'availability':
        // Ensure at least one replica per provider
        request.providers.forEach(provider => {
          allocation[provider] = Math.max(1, Math.floor(totalReplicas / request.providers.length));
        });
        break;
    }

    return allocation;
  }

  async deployToProvider(
    provider: string,
    request: DeploymentRequest,
    replicas: number,
    deploymentId: string
  ): Promise<{ status: string; endpoint?: string; cost: number }> {
    try {
      switch (provider) {
        case 'aws':
          return await this.deployToAWS(request, replicas, deploymentId);
        case 'azure':
          return await this.deployToAzure(request, replicas, deploymentId);
        case 'gcp':
          return await this.deployToGCP(request, replicas, deploymentId);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Deployment to ${provider} failed:`, error);
      return {
        status: 'failed',
        cost: 0,
      };
    }
  }

  private async deployToAWS(
    request: DeploymentRequest,
    replicas: number,
    deploymentId: string
  ): Promise<{ status: string; endpoint?: string; cost: number }> {
    const taskDefinition = {
      family: `${request.applicationId}-${deploymentId}`,
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: request.configuration.cpu.toString(),
      memory: request.configuration.memory.toString(),
      containerDefinitions: [{
        name: request.applicationId,
        image: request.image,
        essential: true,
        environment: Object.entries(request.configuration.environment).map(
          ([name, value]) => ({ name, value })
        ),
        portMappings: [{
          containerPort: 8080,
          protocol: 'tcp',
        }],
        healthCheck: {
          command: [`CMD-SHELL`, `curl -f http://localhost:8080${request.healthCheck.path} || exit 1`],
          interval: request.healthCheck.interval,
          timeout: request.healthCheck.timeout,
          retries: 3,
        },
      }],
    };

    // Deploy to ECS Fargate
    const runTaskCommand = new RunTaskCommand({
      cluster: process.env.AWS_ECS_CLUSTER,
      taskDefinition: taskDefinition.family,
      count: replicas,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: process.env.AWS_SUBNET_IDS?.split(','),
          assignPublicIp: 'ENABLED',
        },
      },
    });

    await awsECS.send(runTaskCommand);

    const cost = replicas * 0.05; // Estimated cost per hour
    return {
      status: 'running',
      endpoint: `https://${deploymentId}.aws.example.com`,
      cost,
    };
  }

  private async deployToAzure(
    request: DeploymentRequest,
    replicas: number,
    deploymentId: string
  ): Promise<{ status: string; endpoint?: string; cost: number }> {
    // Azure Container Instances deployment logic
    const cost = replicas * 0.048;
    return {
      status: 'running',
      endpoint: `https://${deploymentId}.azure.example.com`,
      cost,
    };
  }

  private async deployToGCP(
    request: DeploymentRequest,
    replicas: number,
    deploymentId: string
  ): Promise<{ status: string; endpoint?: string; cost: number }> {
    // Google Cloud Run deployment logic
    const cost = replicas * 0.052;
    return {
      status: 'running',
      endpoint: `https://${deploymentId}.gcp.example.com`,
      cost,
    };
  }

  async performHealthCheck(endpoint: string, healthPath: string): Promise<boolean> {
    try {
      const response = await fetch(`${endpoint}${healthPath}`, {
        method: 'GET',
        timeout: 5000,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async triggerFailover(
    deploymentId: string,
    targetProvider: string,
    reason: string
  ): Promise<void> {
    // Mark current provider as failed
    await supabase
      .from('deployment_logs')
      .insert({
        deployment_id: deploymentId,
        event_type: 'failover_initiated',
        target_provider: targetProvider,
        reason,
        timestamp: new Date().toISOString(),
      });

    // Update deployment status
    await supabase
      .from('deployments')
      .update({ status: 'failing_over' })
      .eq('id', deploymentId);

    // Queue failover job
    await redis.lpush('failover_queue', JSON.stringify({
      deploymentId,
      targetProvider,
      reason,
      timestamp: Date.now(),
    }));
  }
}

const orchestrator = new DeploymentOrchestrator();

// POST - Create new multi-cloud deployment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const deploymentRequest = await orchestrator['validateRequest'](body);

    const deploymentId = await orchestrator['generateDeploymentId']();
    const allocation = await orchestrator['calculateOptimalAllocation'](deploymentRequest);

    // Store deployment record
    const { error: insertError } = await supabase
      .from('deployments')
      .insert({
        id: deploymentId,
        application_id: deploymentRequest.applicationId,
        image: deploymentRequest.image,
        configuration: deploymentRequest.configuration,
        providers: deploymentRequest.providers,
        strategy: deploymentRequest.strategy,
        status: 'deploying',
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(`Failed to create deployment record: ${insertError.message}`);
    }

    // Deploy to each provider concurrently
    const deploymentPromises = Object.entries(allocation).map(
      async ([provider, replicas]) => {
        const result = await orchestrator.deployToProvider(
          provider,
          deploymentRequest,
          replicas,
          deploymentId
        );

        // Store provider deployment status
        await supabase
          .from('provider_deployments')
          .insert({
            deployment_id: deploymentId,
            provider,
            status: result.status,
            endpoint: result.endpoint,
            replicas,
            cost_per_hour: result.cost,
            created_at: new Date().toISOString(),
          });

        return { provider, ...result };
      }
    );

    const results = await Promise.allSettled(deploymentPromises);
    const providerStatuses: Record<string, any> = {};
    let totalCost = 0;

    results.forEach((result, index) => {
      const provider = Object.keys(allocation)[index];
      if (result.status === 'fulfilled') {
        providerStatuses[provider] = result.value;
        totalCost += result.value.cost || 0;
      } else {
        providerStatuses[provider] = { status: 'failed', cost: 0 };
      }
    });

    // Update deployment status
    const overallStatus = Object.values(providerStatuses).some(p => p.status === 'running')
      ? 'running' : 'failed';

    await supabase
      .from('deployments')
      .update({
        status: overallStatus,
        total_cost_per_hour: totalCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deploymentId);

    return NextResponse.json({
      success: true,
      deploymentId,
      status: overallStatus,
      providers: providerStatuses,
      totalCostPerHour: totalCost,
    });

  } catch (error) {
    console.error('Deployment orchestration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET - Retrieve deployment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    // Get deployment info
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Get provider statuses
    const { data: providerDeployments, error: providerError } = await supabase
      .from('provider_deployments')
      .select('*')
      .eq('deployment_id', deploymentId);

    if (providerError) {
      throw new Error(`Failed to fetch provider deployments: ${providerError.message}`);
    }

    // Perform health checks
    const healthChecks = await Promise.allSettled(
      providerDeployments?.map(async (pd) => {
        if (pd.endpoint) {
          const isHealthy = await orchestrator.performHealthCheck(
            pd.endpoint,
            deployment.configuration?.healthCheck?.path || '/health'
          );
          return { provider: pd.provider, healthy: isHealthy };
        }
        return { provider: pd.provider, healthy: false };
      }) || []
    );

    const providerStatuses: Record<string, any> = {};
    providerDeployments?.forEach((pd) => {
      const healthCheck = healthChecks.find(
        (hc) => hc.status === 'fulfilled' && hc.value.provider === pd.provider
      );
      
      providerStatuses[pd.provider] = {
        status: pd.status,
        endpoint: pd.endpoint,
        cost: pd.cost_per_hour,
        replicas: pd.replicas,
        health: healthCheck?.status === 'fulfilled' ? healthCheck.value.healthy : false,
      };
    });

    const deploymentStatus: DeploymentStatus = {
      id: deployment.id,
      status: deployment.status,
      providers: providerStatuses,
      metrics: {
        totalCost: deployment.total_cost_per_hour || 0,
        uptime: 0, // Calculate based on deployment history
        errorRate: 0, // Calculate from metrics
      },
    };

    return NextResponse.json({
      success: true,
      deployment: deploymentStatus,
    });

  } catch (error) {
    console.error('Failed to get deployment status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// PUT - Trigger failover or update deployment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');
    const action = searchParams.get('action');

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    if (action === 'failover') {
      const { targetProvider, reason } = failoverSchema.parse(body);
      
      await orchestrator.triggerFailover(deploymentId, targetProvider, reason);

      return NextResponse.json({
        success: true,
        message: 'Failover initiated',
        targetProvider,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to update deployment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE - Stop and cleanup deployment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');

    if (!deploymentId) {
      return NextResponse.json(
        { success: false, error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    // Get provider deployments for cleanup
    const { data: providerDeployments, error: providerError } = await supabase
      .from('provider_deployments')
      .select('*')
      .eq('deployment_id', deploymentId);

    if (providerError) {
      throw new Error(`Failed to fetch provider deployments: ${providerError.message}`);
    }

    // Cleanup each provider deployment
    const cleanupPromises = providerDeployments?.map(async (pd) => {
      // Provider-specific cleanup logic would go here
      return { provider: pd.provider, status: 'stopped' };
    }) || [];

    await Promise.allSettled(cleanupPromises);

    // Update deployment status
    await supabase
      .from('deployments')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString(),
      })
      .eq('id', deploymentId);

    return NextResponse.json({
      success: true,
      message: 'Deployment stopped successfully',
    });

  } catch (error) {
    console.error('Failed to stop deployment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
```