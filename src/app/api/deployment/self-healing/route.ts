import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import winston from 'winston';

// Types
interface DeploymentConfig {
  id: string;
  repository: string;
  branch: string;
  environment: 'staging' | 'production';
  buildCommand: string;
  healthCheckUrl?: string;
  rollbackOnFailure: boolean;
  maxRetries: number;
}

interface DeploymentStatus {
  id: string;
  status: 'queued' | 'building' | 'deploying' | 'success' | 'failed' | 'healing' | 'rolled_back';
  startTime: Date;
  endTime?: Date;
  buildTime?: number;
  healingActions: HealingAction[];
  metrics: DeploymentMetrics;
  logs: string[];
}

interface HealingAction {
  id: string;
  type: 'dependency_fix' | 'cache_clear' | 'memory_increase' | 'timeout_extend' | 'env_fix';
  description: string;
  applied: boolean;
  timestamp: Date;
  success: boolean;
}

interface DeploymentMetrics {
  buildTime: number;
  deployTime: number;
  successRate: number;
  failureCount: number;
  healingSuccessRate: number;
  averageBuildTime: number;
}

// Initialize services
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'deployment.log' })
  ]
});

class DeploymentPipelineManager {
  async startDeployment(config: DeploymentConfig): Promise<string> {
    const deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const deployment: DeploymentStatus = {
      id: deploymentId,
      status: 'queued',
      startTime: new Date(),
      healingActions: [],
      metrics: {
        buildTime: 0,
        deployTime: 0,
        successRate: 0,
        failureCount: 0,
        healingSuccessRate: 0,
        averageBuildTime: 0
      },
      logs: []
    };

    // Store in Redis for real-time status
    await redis.setex(`deployment:${deploymentId}`, 3600, JSON.stringify(deployment));
    
    // Store in Supabase for persistence
    await supabase.from('deployments').insert({
      id: deploymentId,
      config,
      status: deployment.status,
      start_time: deployment.startTime,
      metrics: deployment.metrics
    });

    // Queue deployment
    await redis.lpush('deployment:queue', deploymentId);
    
    logger.info('Deployment queued', { deploymentId, config });
    
    return deploymentId;
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    const cached = await redis.get(`deployment:${deploymentId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    const { data } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    return data ? this.mapDbToStatus(data) : null;
  }

  private mapDbToStatus(data: any): DeploymentStatus {
    return {
      id: data.id,
      status: data.status,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      buildTime: data.build_time,
      healingActions: data.healing_actions || [],
      metrics: data.metrics,
      logs: data.logs || []
    };
  }
}

class FailureDiagnostics {
  async diagnose(deploymentId: string): Promise<HealingAction[]> {
    const deployment = await new DeploymentPipelineManager().getStatus(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    const healingActions: HealingAction[] = [];
    const logs = deployment.logs.join('\n').toLowerCase();

    // Analyze common failure patterns
    if (logs.includes('npm err') || logs.includes('yarn error')) {
      healingActions.push({
        id: `heal_${Date.now()}_1`,
        type: 'dependency_fix',
        description: 'Clear npm/yarn cache and reinstall dependencies',
        applied: false,
        timestamp: new Date(),
        success: false
      });
    }

    if (logs.includes('enospc') || logs.includes('no space left')) {
      healingActions.push({
        id: `heal_${Date.now()}_2`,
        type: 'cache_clear',
        description: 'Clear build cache and temporary files',
        applied: false,
        timestamp: new Date(),
        success: false
      });
    }

    if (logs.includes('timeout') || logs.includes('killed')) {
      healingActions.push({
        id: `heal_${Date.now()}_3`,
        type: 'timeout_extend',
        description: 'Increase build timeout and memory limits',
        applied: false,
        timestamp: new Date(),
        success: false
      });
    }

    if (logs.includes('env') || logs.includes('environment')) {
      healingActions.push({
        id: `heal_${Date.now()}_4`,
        type: 'env_fix',
        description: 'Validate and fix environment variables',
        applied: false,
        timestamp: new Date(),
        success: false
      });
    }

    logger.info('Diagnostics completed', { deploymentId, actionsFound: healingActions.length });
    
    return healingActions;
  }
}

class AutoHealingEngine {
  async heal(deploymentId: string, actions: HealingAction[]): Promise<boolean> {
    let allSuccess = true;
    const healedActions: HealingAction[] = [];

    for (const action of actions) {
      try {
        const success = await this.applyHealingAction(deploymentId, action);
        const healedAction = { ...action, applied: true, success };
        healedActions.push(healedAction);
        
        if (!success) {
          allSuccess = false;
        }
        
        logger.info('Healing action applied', { 
          deploymentId, 
          actionType: action.type, 
          success 
        });
      } catch (error) {
        const failedAction = { ...action, applied: true, success: false };
        healedActions.push(failedAction);
        allSuccess = false;
        
        logger.error('Healing action failed', { 
          deploymentId, 
          actionType: action.type, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Update deployment with healing actions
    await this.updateDeploymentHealingActions(deploymentId, healedActions);
    
    return allSuccess;
  }

  private async applyHealingAction(deploymentId: string, action: HealingAction): Promise<boolean> {
    switch (action.type) {
      case 'dependency_fix':
        return await this.fixDependencies(deploymentId);
      case 'cache_clear':
        return await this.clearCache(deploymentId);
      case 'timeout_extend':
        return await this.extendTimeout(deploymentId);
      case 'env_fix':
        return await this.fixEnvironmentVariables(deploymentId);
      case 'memory_increase':
        return await this.increaseMemory(deploymentId);
      default:
        return false;
    }
  }

  private async fixDependencies(deploymentId: string): Promise<boolean> {
    // Simulate dependency fixing
    await new Promise(resolve => setTimeout(resolve, 2000));
    return Math.random() > 0.3; // 70% success rate
  }

  private async clearCache(deploymentId: string): Promise<boolean> {
    // Simulate cache clearing
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Math.random() > 0.1; // 90% success rate
  }

  private async extendTimeout(deploymentId: string): Promise<boolean> {
    // Simulate timeout extension
    await new Promise(resolve => setTimeout(resolve, 500));
    return Math.random() > 0.2; // 80% success rate
  }

  private async fixEnvironmentVariables(deploymentId: string): Promise<boolean> {
    // Simulate env var fixing
    await new Promise(resolve => setTimeout(resolve, 1500));
    return Math.random() > 0.25; // 75% success rate
  }

  private async increaseMemory(deploymentId: string): Promise<boolean> {
    // Simulate memory increase
    await new Promise(resolve => setTimeout(resolve, 1000));
    return Math.random() > 0.15; // 85% success rate
  }

  private async updateDeploymentHealingActions(deploymentId: string, actions: HealingAction[]): Promise<void> {
    await supabase
      .from('deployments')
      .update({ healing_actions: actions })
      .eq('id', deploymentId);

    const cached = await redis.get(`deployment:${deploymentId}`);
    if (cached) {
      const deployment = JSON.parse(cached);
      deployment.healingActions = actions;
      await redis.setex(`deployment:${deploymentId}`, 3600, JSON.stringify(deployment));
    }
  }
}

class BuildOptimizer {
  async optimizeBuild(deploymentId: string): Promise<DeploymentMetrics> {
    const deployment = await new DeploymentPipelineManager().getStatus(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    // Calculate optimization metrics
    const metrics: DeploymentMetrics = {
      buildTime: Math.max(deployment.buildTime || 0, 30), // Minimum 30s build time
      deployTime: 15, // Average deploy time
      successRate: await this.calculateSuccessRate(),
      failureCount: await this.getFailureCount(),
      healingSuccessRate: await this.getHealingSuccessRate(),
      averageBuildTime: await this.getAverageBuildTime()
    };

    return metrics;
  }

  private async calculateSuccessRate(): Promise<number> {
    const { data } = await supabase
      .from('deployments')
      .select('status')
      .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!data || data.length === 0) return 0;

    const successCount = data.filter(d => d.status === 'success').length;
    return (successCount / data.length) * 100;
  }

  private async getFailureCount(): Promise<number> {
    const { data } = await supabase
      .from('deployments')
      .select('id')
      .eq('status', 'failed')
      .gte('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return data?.length || 0;
  }

  private async getHealingSuccessRate(): Promise<number> {
    const { data } = await supabase
      .from('deployments')
      .select('healing_actions')
      .not('healing_actions', 'is', null)
      .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!data || data.length === 0) return 0;

    let totalActions = 0;
    let successfulActions = 0;

    data.forEach(deployment => {
      const actions = deployment.healing_actions as HealingAction[];
      if (actions) {
        totalActions += actions.length;
        successfulActions += actions.filter(a => a.success).length;
      }
    });

    return totalActions > 0 ? (successfulActions / totalActions) * 100 : 0;
  }

  private async getAverageBuildTime(): Promise<number> {
    const { data } = await supabase
      .from('deployments')
      .select('build_time')
      .not('build_time', 'is', null)
      .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!data || data.length === 0) return 0;

    const total = data.reduce((sum, d) => sum + (d.build_time || 0), 0);
    return total / data.length;
  }
}

class RollbackManager {
  async rollback(deploymentId: string): Promise<boolean> {
    try {
      // Update status to rolled_back
      await supabase
        .from('deployments')
        .update({ 
          status: 'rolled_back',
          end_time: new Date().toISOString()
        })
        .eq('id', deploymentId);

      // Update Redis cache
      const cached = await redis.get(`deployment:${deploymentId}`);
      if (cached) {
        const deployment = JSON.parse(cached);
        deployment.status = 'rolled_back';
        deployment.endTime = new Date();
        await redis.setex(`deployment:${deploymentId}`, 3600, JSON.stringify(deployment));
      }

      logger.info('Deployment rolled back successfully', { deploymentId });
      return true;
    } catch (error) {
      logger.error('Rollback failed', { 
        deploymentId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Route handlers
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const action = segments[segments.length - 1];

    const pipelineManager = new DeploymentPipelineManager();
    const diagnostics = new FailureDiagnostics();
    const healingEngine = new AutoHealingEngine();
    const buildOptimizer = new BuildOptimizer();
    const rollbackManager = new RollbackManager();

    switch (action) {
      case 'start': {
        const config = await request.json() as DeploymentConfig;
        
        // Validate config
        if (!config.repository || !config.branch || !config.buildCommand) {
          return NextResponse.json({ error: 'Missing required configuration' }, { status: 400 });
        }

        const deploymentId = await pipelineManager.startDeployment(config);
        
        return NextResponse.json({ 
          deploymentId,
          message: 'Deployment started successfully' 
        });
      }

      case 'diagnose': {
        const { deploymentId } = await request.json();
        
        if (!deploymentId) {
          return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
        }

        const healingActions = await diagnostics.diagnose(deploymentId);
        
        return NextResponse.json({ 
          deploymentId,
          healingActions,
          diagnosticsCompleted: true
        });
      }

      case 'heal': {
        const deploymentId = segments[segments.length - 2];
        const { actions } = await request.json();
        
        if (!deploymentId) {
          return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
        }

        if (!actions || !Array.isArray(actions)) {
          return NextResponse.json({ error: 'Healing actions are required' }, { status: 400 });
        }

        const success = await healingEngine.heal(deploymentId, actions);
        
        return NextResponse.json({ 
          deploymentId,
          healingSuccess: success,
          actionsApplied: actions.length
        });
      }

      case 'rollback': {
        const { deploymentId } = await request.json();
        
        if (!deploymentId) {
          return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
        }

        const success = await rollbackManager.rollback(deploymentId);
        
        return NextResponse.json({ 
          deploymentId,
          rollbackSuccess: success
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 404 });
    }
  } catch (error) {
    logger.error('API error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const action = segments[segments.length - 1];

    const pipelineManager = new DeploymentPipelineManager();
    const buildOptimizer = new BuildOptimizer();

    if (action === 'metrics') {
      // Get overall deployment metrics
      const metrics = await buildOptimizer.optimizeBuild('global');
      
      return NextResponse.json({ 
        metrics,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'status') {
      const deploymentId = segments[segments.length - 2];
      
      if (!deploymentId) {
        return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
      }

      const status = await pipelineManager.getStatus(deploymentId);
      
      if (!status) {
        return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
      }

      return NextResponse.json({ deployment: status });
    }

    // Handle deploymentId in URL path
    const deploymentId = segments[segments.length - 1];
    if (deploymentId.startsWith('deploy_')) {
      const status = await pipelineManager.getStatus(deploymentId);
      
      if (!status) {
        return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
      }

      return NextResponse.json({ deployment: status });
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (error) {
    logger.error('GET API error', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const deploymentId = segments[segments.length - 1];
    
    if (!deploymentId) {
      return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
    }

    const { status, metrics } = await request.json();
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (metrics) updateData.metrics = metrics;
    if (status === 'success' || status === 'failed') {
      updateData.end_time = new Date().toISOString();
    }

    await supabase
      .from('deployments')
      .update(updateData)
      .eq('id', deploymentId);

    // Update Redis cache
    const cached = await redis.get(`deployment:${deploymentId}`);
    if (cached) {
      const deployment = JSON.parse(cached);
      Object.assign(deployment, updateData);
      await redis.setex(`deployment:${deploymentId}`, 3600, JSON.stringify(deployment));
    }

    logger.info('Deployment updated', { deploymentId, updateData });

    return NextResponse.json({ 
      deploymentId,
      updated: true 
    });
  } catch (error) {
    logger.error('PUT API error', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const deploymentId = segments[segments.length - 1];
    
    if (!deploymentId) {
      return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
    }

    await supabase
      .from('deployments')
      .delete()
      .eq('id', deploymentId);

    await redis.del(`deployment:${deploymentId}`);

    logger.info('Deployment deleted', { deploymentId });

    return NextResponse.json({ 
      deploymentId,
      deleted: true 
    });
  } catch (error) {
    logger.error('DELETE API error', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}