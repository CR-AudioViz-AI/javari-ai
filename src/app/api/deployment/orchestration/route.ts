```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { WebSocket } from 'ws';

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const githubToken = process.env.GITHUB_TOKEN!;
const kubernetesToken = process.env.KUBERNETES_TOKEN!;

// Validation schemas
const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(255),
  repository: z.string().url(),
  branch: z.string().min(1).max(100),
  environments: z.array(z.string()).min(1),
  stages: z.array(z.object({
    name: z.string().min(1).max(255),
    environment: z.string().min(1).max(100),
    dependencies: z.array(z.string()).optional(),
    config: z.record(z.any()).optional(),
    timeout: z.number().min(60).max(3600).optional(),
  })).min(1),
  autoRollback: z.boolean().optional(),
  notifications: z.object({
    webhook: z.string().url().optional(),
    email: z.array(z.string().email()).optional(),
  }).optional(),
});

const ExecutePipelineSchema = z.object({
  commitSha: z.string().min(40).max(40),
  triggeredBy: z.string().min(1).max(255),
  skipStages: z.array(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

const RollbackSchema = z.object({
  targetDeploymentId: z.string().uuid().optional(),
  reason: z.string().min(1).max(500),
  skipValidation: z.boolean().optional(),
});

// Types
interface DeploymentPipeline {
  id: string;
  name: string;
  repository: string;
  branch: string;
  environments: string[];
  stages: DeploymentStage[];
  status: 'draft' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  autoRollback: boolean;
  created_at: string;
  updated_at: string;
}

interface DeploymentStage {
  id: string;
  name: string;
  environment: string;
  dependencies: string[];
  config: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  timeout: number;
  started_at?: string;
  completed_at?: string;
  logs: string[];
}

interface DeploymentExecution {
  id: string;
  pipeline_id: string;
  commit_sha: string;
  triggered_by: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'rolled_back';
  current_stage?: string;
  started_at: string;
  completed_at?: string;
  rollback_eligible: boolean;
}

// Utility classes
class DeploymentOrchestrator {
  private supabase = createClient(supabaseUrl, supabaseServiceKey);
  private wsConnections = new Map<string, WebSocket>();

  async createPipeline(data: z.infer<typeof CreatePipelineSchema>): Promise<DeploymentPipeline> {
    // Validate dependencies
    await this.validateStageDependencies(data.stages);
    
    // Validate environments exist
    await this.validateEnvironments(data.environments);

    const { data: pipeline, error } = await this.supabase
      .from('deployment_pipelines')
      .insert([{
        name: data.name,
        repository: data.repository,
        branch: data.branch,
        environments: data.environments,
        auto_rollback: data.autoRollback || false,
        notifications: data.notifications || {},
        status: 'draft'
      }])
      .select()
      .single();

    if (error) throw new Error(`Pipeline creation failed: ${error.message}`);

    // Create stages
    const stageInserts = data.stages.map((stage, index) => ({
      pipeline_id: pipeline.id,
      name: stage.name,
      environment: stage.environment,
      dependencies: stage.dependencies || [],
      config: stage.config || {},
      order_index: index,
      timeout: stage.timeout || 1800,
      status: 'pending'
    }));

    const { error: stagesError } = await this.supabase
      .from('deployment_stages')
      .insert(stageInserts);

    if (stagesError) {
      await this.supabase.from('deployment_pipelines').delete().eq('id', pipeline.id);
      throw new Error(`Stage creation failed: ${stagesError.message}`);
    }

    return await this.getPipelineById(pipeline.id);
  }

  async getPipelineById(id: string): Promise<DeploymentPipeline> {
    const { data: pipeline, error } = await this.supabase
      .from('deployment_pipelines')
      .select(`
        *,
        deployment_stages (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw new Error(`Pipeline not found: ${error.message}`);

    return {
      ...pipeline,
      stages: pipeline.deployment_stages || []
    };
  }

  async executePipeline(
    pipelineId: string, 
    data: z.infer<typeof ExecutePipelineSchema>
  ): Promise<DeploymentExecution> {
    const pipeline = await this.getPipelineById(pipelineId);
    
    // Validate commit exists
    await this.validateCommit(pipeline.repository, data.commitSha);

    // Create execution record
    const { data: execution, error } = await this.supabase
      .from('deployment_executions')
      .insert([{
        pipeline_id: pipelineId,
        commit_sha: data.commitSha,
        triggered_by: data.triggeredBy,
        status: data.dryRun ? 'queued' : 'running',
        skip_stages: data.skipStages || [],
        dry_run: data.dryRun || false,
        started_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw new Error(`Execution creation failed: ${error.message}`);

    if (!data.dryRun) {
      // Start execution asynchronously
      this.executeStagesSequentially(execution.id, pipeline).catch(console.error);
    }

    return execution;
  }

  private async executeStagesSequentially(
    executionId: string, 
    pipeline: DeploymentPipeline
  ): Promise<void> {
    const dependencyGraph = this.buildDependencyGraph(pipeline.stages);
    const executionOrder = this.resolveDependencies(dependencyGraph);

    for (const stageName of executionOrder) {
      const stage = pipeline.stages.find(s => s.name === stageName)!;
      
      try {
        await this.executeStage(executionId, stage);
        this.broadcastStatus(executionId, { stage: stageName, status: 'completed' });
      } catch (error) {
        await this.handleStageFailure(executionId, stage, error as Error);
        break;
      }
    }
  }

  private async executeStage(executionId: string, stage: DeploymentStage): Promise<void> {
    // Update stage status
    await this.supabase
      .from('deployment_stages')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString() 
      })
      .eq('id', stage.id);

    // Execute based on environment type
    switch (stage.environment) {
      case 'kubernetes':
        await this.executeKubernetesDeployment(stage);
        break;
      case 'docker':
        await this.executeDockerDeployment(stage);
        break;
      case 'serverless':
        await this.executeServerlessDeployment(stage);
        break;
      default:
        await this.executeCustomDeployment(stage);
    }

    // Update completion status
    await this.supabase
      .from('deployment_stages')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', stage.id);
  }

  async rollbackDeployment(
    executionId: string, 
    data: z.infer<typeof RollbackSchema>
  ): Promise<void> {
    const { data: execution, error } = await this.supabase
      .from('deployment_executions')
      .select('*, deployment_pipelines(*)')
      .eq('id', executionId)
      .single();

    if (error) throw new Error(`Execution not found: ${error.message}`);

    if (!data.skipValidation && !execution.rollback_eligible) {
      throw new Error('Deployment is not eligible for rollback');
    }

    const targetDeployment = data.targetDeploymentId 
      ? await this.getExecutionById(data.targetDeploymentId)
      : await this.getPreviousSuccessfulDeployment(execution.pipeline_id);

    if (!targetDeployment) {
      throw new Error('No valid rollback target found');
    }

    // Create rollback execution
    const { data: rollbackExecution, error: rollbackError } = await this.supabase
      .from('deployment_executions')
      .insert([{
        pipeline_id: execution.pipeline_id,
        commit_sha: targetDeployment.commit_sha,
        triggered_by: `Rollback: ${data.reason}`,
        status: 'running',
        is_rollback: true,
        rollback_from: executionId,
        started_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (rollbackError) throw new Error(`Rollback creation failed: ${rollbackError.message}`);

    // Execute rollback
    const pipeline = await this.getPipelineById(execution.pipeline_id);
    await this.executeRollbackSequence(rollbackExecution.id, pipeline, targetDeployment);
  }

  private async validateStageDependencies(stages: any[]): Promise<void> {
    const stageNames = new Set(stages.map(s => s.name));
    
    for (const stage of stages) {
      if (stage.dependencies) {
        for (const dep of stage.dependencies) {
          if (!stageNames.has(dep)) {
            throw new Error(`Invalid dependency: ${dep} not found in stages`);
          }
        }
      }
    }

    // Check for circular dependencies
    const graph = this.buildDependencyGraph(stages);
    if (this.hasCircularDependencies(graph)) {
      throw new Error('Circular dependencies detected in stages');
    }
  }

  private async validateEnvironments(environments: string[]): Promise<void> {
    const { data, error } = await this.supabase
      .from('environment_configs')
      .select('name')
      .in('name', environments);

    if (error) throw new Error(`Environment validation failed: ${error.message}`);

    const validEnvironments = new Set(data.map(e => e.name));
    const invalidEnvironments = environments.filter(env => !validEnvironments.has(env));

    if (invalidEnvironments.length > 0) {
      throw new Error(`Invalid environments: ${invalidEnvironments.join(', ')}`);
    }
  }

  private async validateCommit(repository: string, commitSha: string): Promise<void> {
    const [owner, repo] = repository.replace('https://github.com/', '').split('/');
    
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Commit ${commitSha} not found in repository ${repository}`);
    }
  }

  private buildDependencyGraph(stages: any[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const stage of stages) {
      graph.set(stage.name, stage.dependencies || []);
    }
    
    return graph;
  }

  private resolveDependencies(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (node: string) => {
      if (visited.has(node)) return;
      
      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        visit(dep);
      }
      
      visited.add(node);
      result.push(node);
    };

    for (const node of graph.keys()) {
      visit(node);
    }

    return result;
  }

  private hasCircularDependencies(graph: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recursionStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recursionStack.add(node);

      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        if (hasCycle(dep)) return true;
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (hasCycle(node)) return true;
    }

    return false;
  }

  private async executeKubernetesDeployment(stage: DeploymentStage): Promise<void> {
    // Kubernetes deployment implementation
    const kubeConfig = stage.config.kubernetes || {};
    
    // Apply Kubernetes manifests
    const response = await fetch(`${process.env.KUBERNETES_API_URL}/api/v1/namespaces/${kubeConfig.namespace}/deployments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kubernetesToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(kubeConfig.manifest)
    });

    if (!response.ok) {
      throw new Error(`Kubernetes deployment failed: ${await response.text()}`);
    }
  }

  private async executeDockerDeployment(stage: DeploymentStage): Promise<void> {
    // Docker deployment implementation
    const dockerConfig = stage.config.docker || {};
    
    // Build and push Docker image
    const buildResponse = await fetch(`${process.env.DOCKER_REGISTRY_URL}/v2/${dockerConfig.image}/blobs/uploads/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DOCKER_REGISTRY_TOKEN}`
      }
    });

    if (!buildResponse.ok) {
      throw new Error(`Docker deployment failed: ${await buildResponse.text()}`);
    }
  }

  private async executeServerlessDeployment(stage: DeploymentStage): Promise<void> {
    // Serverless deployment implementation
    console.log(`Executing serverless deployment for stage: ${stage.name}`);
  }

  private async executeCustomDeployment(stage: DeploymentStage): Promise<void> {
    // Custom deployment implementation
    console.log(`Executing custom deployment for stage: ${stage.name}`);
  }

  private async handleStageFailure(
    executionId: string, 
    stage: DeploymentStage, 
    error: Error
  ): Promise<void> {
    // Update stage status
    await this.supabase
      .from('deployment_stages')
      .update({ 
        status: 'failed', 
        error_message: error.message,
        completed_at: new Date().toISOString() 
      })
      .eq('id', stage.id);

    // Update execution status
    await this.supabase
      .from('deployment_executions')
      .update({ 
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    this.broadcastStatus(executionId, { 
      stage: stage.name, 
      status: 'failed', 
      error: error.message 
    });
  }

  private async executeRollbackSequence(
    rollbackExecutionId: string,
    pipeline: DeploymentPipeline,
    targetDeployment: DeploymentExecution
  ): Promise<void> {
    // Implement rollback logic
    const reversedStages = [...pipeline.stages].reverse();
    
    for (const stage of reversedStages) {
      await this.rollbackStage(stage, targetDeployment);
    }

    await this.supabase
      .from('deployment_executions')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', rollbackExecutionId);
  }

  private async rollbackStage(
    stage: DeploymentStage, 
    targetDeployment: DeploymentExecution
  ): Promise<void> {
    // Stage-specific rollback logic
    console.log(`Rolling back stage: ${stage.name} to deployment: ${targetDeployment.id}`);
  }

  private async getExecutionById(id: string): Promise<DeploymentExecution> {
    const { data, error } = await this.supabase
      .from('deployment_executions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(`Execution not found: ${error.message}`);
    return data;
  }

  private async getPreviousSuccessfulDeployment(
    pipelineId: string
  ): Promise<DeploymentExecution | null> {
    const { data, error } = await this.supabase
      .from('deployment_executions')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  }

  private broadcastStatus(executionId: string, status: any): void {
    const ws = this.wsConnections.get(executionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'status_update',
        execution_id: executionId,
        timestamp: new Date().toISOString(),
        ...status
      }));
    }
  }

  async getEnvironments(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('environment_configs')
      .select('*')
      .order('name');

    if (error) throw new Error(`Failed to fetch environments: ${error.message}`);
    return data;
  }
}

const orchestrator = new DeploymentOrchestrator();

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 3) {
      // Create pipeline
      const body = await request.json();
      const validatedData = CreatePipelineSchema.parse(body);
      const pipeline = await orchestrator.createPipeline(validatedData);
      
      return NextResponse.json({ 
        success: true, 
        data: pipeline 
      }, { status: 201 });
      
    } else if (pathSegments.length === 5 && pathSegments[4] === 'execute') {
      // Execute pipeline
      const pipelineId = pathSegments[3];
      const body = await request.json();
      const validatedData = ExecutePipelineSchema.parse(body);
      const execution = await orchestrator.executePipeline(pipelineId, validatedData);
      
      return NextResponse.json({ 
        success: true, 
        data: execution 
      }, { status: 200 });
      
    } else if (pathSegments.length === 5 && pathSegments[4] === 'rollback') {
      // Rollback deployment
      const executionId = pathSegments[3];
      const body = await request.json();
      const validatedData = RollbackSchema.parse(body);
      await orchestrator.rollbackDeployment(executionId, validatedData);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Rollback initiated' 
      }, { status: 200 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid endpoint' 
    }, { status: 404 });
    
  } catch (error) {
    console.error('Deployment orchestration error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    if (pathSegments.length === 4 && pathSegments[3] === 'environments') {
      // Get environments
      const environments = await orchestrator.getEnvironments();
      return NextResponse.json({ 
        success: true, 
        data: environments 
      }, { status: 200 });
      
    } else if (pathSegments.length === 4) {
      // Get pipeline by ID
      const pipelineId = pathSegments[3];
      const pipeline = await orchestrator.getPipelineById(pipelineId);
      
      return NextResponse.json({ 
        success: true, 
        data: pipeline 
      }, { status: 200 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid endpoint' 
    }, { status: 404 });
    
  } catch (error) {
    console.error('Deployment orchestration error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    return NextResponse.json({ 
      success: false, 
      error: 'Method not implemented' 
    }, { status: 501 });
    
  } catch (error) {
    console.error('Deployment orchestration