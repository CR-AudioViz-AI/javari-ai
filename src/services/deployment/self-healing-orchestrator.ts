```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node';
import { k8s } from '@kubernetes/client-node';
import { Docker } from 'dockerode';
import { Octokit } from '@octokit/rest';

// Types
interface DeploymentContext {
  id: string;
  environment: string;
  service: string;
  version: string;
  previousVersion?: string;
  config: Record<string, any>;
  timestamp: number;
}

interface HealthMetrics {
  cpu: number;
  memory: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
}

interface FailureSignature {
  type: string;
  severity: number;
  patterns: string[];
  confidence: number;
  rootCause: string;
  recommendedFix: string;
}

interface DeploymentState {
  status: 'pending' | 'deploying' | 'healthy' | 'degraded' | 'failed' | 'rolling_back' | 'recovered';
  metrics: HealthMetrics;
  failures: FailureSignature[];
  lastHealthCheck: number;
  rollbackAvailable: boolean;
}

class SelfHealingDeploymentOrchestrator {
  private supabase: any;
  private k8sClient: k8s.CoreV1Api;
  private docker: Docker;
  private github: Octokit;
  private mlModel: tf.LayersModel | null = null;
  private deploymentStates = new Map<string, DeploymentState>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sClient = kc.makeApiClient(k8s.CoreV1Api);
    
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
    });

    this.github = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    this.initializeMLModel();
    this.startHealthMonitoring();
  }

  private async initializeMLModel(): Promise<void> {
    try {
      // Load pre-trained anomaly detection model
      this.mlModel = await tf.loadLayersModel('file://models/deployment-failure-detector.json');
    } catch (error) {
      console.warn('ML model not available, using rule-based detection');
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  async deployService(context: DeploymentContext): Promise<{ success: boolean; deploymentId: string; message: string }> {
    try {
      // Initialize deployment state
      this.deploymentStates.set(context.id, {
        status: 'pending',
        metrics: this.getDefaultMetrics(),
        failures: [],
        lastHealthCheck: Date.now(),
        rollbackAvailable: !!context.previousVersion
      });

      // Log deployment start
      await this.supabase.from('deployment_logs').insert({
        deployment_id: context.id,
        event: 'deployment_started',
        context,
        timestamp: new Date().toISOString()
      });

      // Execute deployment
      await this.executeDeployment(context);

      // Wait for initial health check
      await this.waitForHealthyState(context.id);

      return {
        success: true,
        deploymentId: context.id,
        message: 'Deployment completed successfully'
      };

    } catch (error) {
      await this.handleDeploymentFailure(context.id, error as Error);
      return {
        success: false,
        deploymentId: context.id,
        message: `Deployment failed: ${(error as Error).message}`
      };
    }
  }

  private async executeDeployment(context: DeploymentContext): Promise<void> {
    const state = this.deploymentStates.get(context.id)!;
    state.status = 'deploying';

    // Update Kubernetes deployment
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: context.service,
        namespace: context.environment,
        labels: {
          'deployment-id': context.id,
          'cr-audioviz': 'true'
        }
      },
      spec: {
        replicas: context.config.replicas || 3,
        selector: {
          matchLabels: {
            app: context.service
          }
        },
        template: {
          metadata: {
            labels: {
              app: context.service,
              version: context.version
            }
          },
          spec: {
            containers: [{
              name: context.service,
              image: `${context.config.registry}/${context.service}:${context.version}`,
              ports: [{ containerPort: context.config.port || 3000 }],
              resources: context.config.resources || {
                limits: { cpu: '1000m', memory: '512Mi' },
                requests: { cpu: '500m', memory: '256Mi' }
              },
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: context.config.port || 3000
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: context.config.port || 3000
                },
                initialDelaySeconds: 60,
                periodSeconds: 30
              }
            }]
          }
        }
      }
    };

    // Apply deployment using kubectl-like API
    await this.k8sClient.createNamespacedDeployment(context.environment, deployment as any);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [deploymentId, state] of this.deploymentStates.entries()) {
      try {
        const metrics = await this.collectMetrics(deploymentId);
        state.metrics = metrics;
        state.lastHealthCheck = Date.now();

        // Analyze metrics for anomalies
        const failures = await this.detectFailures(deploymentId, metrics);
        
        if (failures.length > 0) {
          state.failures = failures;
          await this.handleDetectedFailures(deploymentId, failures);
        } else if (state.status === 'degraded') {
          state.status = 'healthy';
        }

        // Update Supabase with current state
        await this.supabase.from('deployment_states').upsert({
          deployment_id: deploymentId,
          status: state.status,
          metrics: state.metrics,
          failures: state.failures,
          updated_at: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Health check failed for ${deploymentId}:`, error);
        state.status = 'failed';
      }
    }
  }

  private async collectMetrics(deploymentId: string): Promise<HealthMetrics> {
    try {
      // Collect metrics from Kubernetes API
      const context = await this.getDeploymentContext(deploymentId);
      if (!context) throw new Error('Deployment context not found');

      const pods = await this.k8sClient.listNamespacedPod(
        context.environment,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=${context.service}`
      );

      let totalCpu = 0;
      let totalMemory = 0;
      let healthyPods = 0;

      for (const pod of pods.body.items) {
        if (pod.status?.phase === 'Running') {
          healthyPods++;
          // Simulate metrics collection (in real implementation, use metrics server)
          totalCpu += Math.random() * 50; // CPU percentage
          totalMemory += Math.random() * 80; // Memory percentage
        }
      }

      const availability = healthyPods / (context.config.replicas || 3);
      
      return {
        cpu: totalCpu / Math.max(healthyPods, 1),
        memory: totalMemory / Math.max(healthyPods, 1),
        responseTime: 50 + Math.random() * 200, // Simulated
        errorRate: Math.random() * 5, // Percentage
        throughput: 100 + Math.random() * 900, // Requests per minute
        availability: availability * 100
      };

    } catch (error) {
      throw new Error(`Failed to collect metrics: ${(error as Error).message}`);
    }
  }

  private async detectFailures(deploymentId: string, metrics: HealthMetrics): Promise<FailureSignature[]> {
    const failures: FailureSignature[] = [];

    // Rule-based detection
    if (metrics.availability < 80) {
      failures.push({
        type: 'availability_degradation',
        severity: metrics.availability < 50 ? 9 : 6,
        patterns: ['low_pod_count', 'startup_failures'],
        confidence: 0.9,
        rootCause: 'Pod startup failures or resource constraints',
        recommendedFix: 'scale_up_or_restart_pods'
      });
    }

    if (metrics.errorRate > 10) {
      failures.push({
        type: 'high_error_rate',
        severity: 8,
        patterns: ['application_errors', 'dependency_failures'],
        confidence: 0.85,
        rootCause: 'Application errors or downstream service failures',
        recommendedFix: 'check_application_logs_and_dependencies'
      });
    }

    if (metrics.responseTime > 1000) {
      failures.push({
        type: 'performance_degradation',
        severity: 5,
        patterns: ['slow_responses', 'resource_contention'],
        confidence: 0.7,
        rootCause: 'Performance bottleneck or resource contention',
        recommendedFix: 'optimize_resources_or_scale_up'
      });
    }

    // ML-based detection if model is available
    if (this.mlModel && failures.length === 0) {
      const mlFailures = await this.detectAnomaliesWithML(metrics);
      failures.push(...mlFailures);
    }

    return failures;
  }

  private async detectAnomaliesWithML(metrics: HealthMetrics): Promise<FailureSignature[]> {
    if (!this.mlModel) return [];

    try {
      const input = tf.tensor2d([[
        metrics.cpu / 100,
        metrics.memory / 100,
        metrics.responseTime / 2000,
        metrics.errorRate / 100,
        metrics.throughput / 1000,
        metrics.availability / 100
      ]]);

      const prediction = this.mlModel.predict(input) as tf.Tensor;
      const anomalyScore = await prediction.data();

      if (anomalyScore[0] > 0.7) {
        return [{
          type: 'anomaly_detected',
          severity: Math.floor(anomalyScore[0] * 10),
          patterns: ['ml_detected_anomaly'],
          confidence: anomalyScore[0],
          rootCause: 'ML model detected unusual behavior pattern',
          recommendedFix: 'investigate_recent_changes'
        }];
      }

      return [];
    } catch (error) {
      console.error('ML anomaly detection failed:', error);
      return [];
    }
  }

  private async handleDetectedFailures(deploymentId: string, failures: FailureSignature[]): Promise<void> {
    const state = this.deploymentStates.get(deploymentId)!;
    state.status = 'degraded';

    // Log failures
    await this.supabase.from('deployment_failures').insert({
      deployment_id: deploymentId,
      failures,
      detected_at: new Date().toISOString()
    });

    // Determine if automatic recovery should be attempted
    const criticalFailures = failures.filter(f => f.severity >= 8);
    
    if (criticalFailures.length > 0 && state.rollbackAvailable) {
      await this.initiateAutomaticRollback(deploymentId);
    } else {
      // Attempt self-healing fixes
      await this.applySelfHealingFixes(deploymentId, failures);
    }

    // Send alerts
    await this.sendAlerts(deploymentId, failures);
  }

  private async initiateAutomaticRollback(deploymentId: string): Promise<void> {
    try {
      const state = this.deploymentStates.get(deploymentId)!;
      state.status = 'rolling_back';

      const context = await this.getDeploymentContext(deploymentId);
      if (!context?.previousVersion) {
        throw new Error('No previous version available for rollback');
      }

      // Create rollback deployment context
      const rollbackContext: DeploymentContext = {
        ...context,
        id: `${deploymentId}-rollback`,
        version: context.previousVersion,
        previousVersion: context.version
      };

      // Execute rollback
      await this.executeDeployment(rollbackContext);

      state.status = 'recovered';

      await this.supabase.from('deployment_logs').insert({
        deployment_id: deploymentId,
        event: 'automatic_rollback_completed',
        context: rollbackContext,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Rollback failed for ${deploymentId}:`, error);
      const state = this.deploymentStates.get(deploymentId)!;
      state.status = 'failed';
    }
  }

  private async applySelfHealingFixes(deploymentId: string, failures: FailureSignature[]): Promise<void> {
    for (const failure of failures) {
      try {
        switch (failure.recommendedFix) {
          case 'scale_up_or_restart_pods':
            await this.scaleUpOrRestartPods(deploymentId);
            break;
          case 'optimize_resources_or_scale_up':
            await this.optimizeResources(deploymentId);
            break;
          case 'check_application_logs_and_dependencies':
            await this.checkApplicationHealth(deploymentId);
            break;
          default:
            console.log(`No automatic fix available for: ${failure.type}`);
        }

        await this.supabase.from('deployment_fixes').insert({
          deployment_id: deploymentId,
          failure_type: failure.type,
          fix_applied: failure.recommendedFix,
          applied_at: new Date().toISOString()
        });

      } catch (error) {
        console.error(`Failed to apply fix ${failure.recommendedFix}:`, error);
      }
    }
  }

  private async scaleUpOrRestartPods(deploymentId: string): Promise<void> {
    const context = await this.getDeploymentContext(deploymentId);
    if (!context) return;

    // Scale up deployment
    const deployment = await this.k8sClient.readNamespacedDeployment(
      context.service,
      context.environment
    );

    const currentReplicas = deployment.body.spec?.replicas || 1;
    const newReplicas = Math.min(currentReplicas + 1, 5); // Cap at 5 replicas

    await this.k8sClient.patchNamespacedDeployment(
      context.service,
      context.environment,
      {
        spec: { replicas: newReplicas }
      }
    );
  }

  private async optimizeResources(deploymentId: string): Promise<void> {
    const context = await this.getDeploymentContext(deploymentId);
    if (!context) return;

    // Update resource limits
    await this.k8sClient.patchNamespacedDeployment(
      context.service,
      context.environment,
      {
        spec: {
          template: {
            spec: {
              containers: [{
                name: context.service,
                resources: {
                  limits: { cpu: '1500m', memory: '768Mi' },
                  requests: { cpu: '750m', memory: '384Mi' }
                }
              }]
            }
          }
        }
      }
    );
  }

  private async checkApplicationHealth(deploymentId: string): Promise<void> {
    // This would typically involve checking logs, metrics, and dependencies
    // For now, we'll just restart unhealthy pods
    await this.scaleUpOrRestartPods(deploymentId);
  }

  private async sendAlerts(deploymentId: string, failures: FailureSignature[]): Promise<void> {
    const highSeverityFailures = failures.filter(f => f.severity >= 7);
    
    if (highSeverityFailures.length > 0) {
      await this.supabase.from('alerts').insert({
        deployment_id: deploymentId,
        severity: 'high',
        message: `Critical deployment issues detected: ${highSeverityFailures.map(f => f.type).join(', ')}`,
        failures: highSeverityFailures,
        created_at: new Date().toISOString()
      });
    }
  }

  private async getDeploymentContext(deploymentId: string): Promise<DeploymentContext | null> {
    const { data } = await this.supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();
    
    return data;
  }

  private async waitForHealthyState(deploymentId: string, timeout: number = 300000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const state = this.deploymentStates.get(deploymentId);
      
      if (state?.status === 'healthy' || state?.metrics.availability >= 90) {
        return;
      }
      
      if (state?.status === 'failed') {
        throw new Error('Deployment failed health checks');
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Deployment health check timeout');
  }

  private getDefaultMetrics(): HealthMetrics {
    return {
      cpu: 0,
      memory: 0,
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      availability: 0
    };
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentState | null> {
    return this.deploymentStates.get(deploymentId) || null;
  }

  async getHealthMetrics(): Promise<Record<string, any>> {
    const deployments = Array.from(this.deploymentStates.entries()).map(([id, state]) => ({
      deploymentId: id,
      status: state.status,
      metrics: state.metrics,
      failures: state.failures.length,
      lastCheck: new Date(state.lastHealthCheck).toISOString()
    }));

    return {
      totalDeployments: deployments.length,
      healthyDeployments: deployments.filter(d => d.status === 'healthy').length,
      failedDeployments: deployments.filter(d => d.status === 'failed').length,
      deployments
    };
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

// Global orchestrator instance
let orchestrator: SelfHealingDeploymentOrchestrator | null = null;

function getOrchestrator(): SelfHealingDeploymentOrchestrator {
  if (!orchestrator) {
    orchestrator = new SelfHealingDeploymentOrchestrator();
  }
  return orchestrator;
}

// API Route Handler
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { action, ...payload } = await req.json();
    const deployOrchestrator = getOrchestrator();

    switch (action) {
      case 'deploy':
        const result = await deployOrchestrator.deployService(payload as DeploymentContext);
        return NextResponse.json(result);

      case 'rollback':
        await deployOrchestrator.initiateAutomaticRollback(payload.deploymentId);
        return NextResponse.json({ success: true, message: 'Rollback initiated' });

      case 'get_status':
        const status = await deployOrchestrator.getDeploymentStatus(payload.deploymentId);
        return NextResponse.json({ status });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Self-healing orchestrator error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const deploymentId = searchParams.get('deploymentId');
    
    const deployOrchestrator = getOrchestrator();

    if (deploymentId) {
      const status = await deployOrchestrator.getDeploymentStatus(deploymentId);
      return NextResponse.json({ deployment: status });
    } else {
      const health = await deployOrchestrator.getHealthMetrics();
      return NextResponse.json(health);
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { 
    status: 200,
    headers: { 'Cache-Control': 'no-cache' }
  });
}
```