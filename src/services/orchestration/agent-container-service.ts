```typescript
import { KubeConfig, AppsV1Api, CoreV1Api, AutoscalingV1Api, CustomObjectsApi } from '@kubernetes/client-node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

/**
 * Agent deployment configuration
 */
export interface AgentDeploymentConfig {
  agentId: string;
  userId: string;
  agentName: string;
  agentVersion: string;
  imageRegistry: string;
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
  limits: {
    maxCpu: string;
    maxMemory: string;
    maxReplicas: number;
  };
  environment: Record<string, string>;
  healthCheck: {
    path: string;
    port: number;
    initialDelaySeconds: number;
    periodSeconds: number;
  };
}

/**
 * Container deployment status
 */
export interface ContainerDeploymentStatus {
  deploymentId: string;
  agentId: string;
  status: 'pending' | 'running' | 'failed' | 'scaling' | 'terminated';
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    networkIO: number;
  };
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastUpdated: Date;
}

/**
 * Auto-scaling configuration
 */
export interface AutoScalingConfig {
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpPolicy: {
    stabilizationWindowSeconds: number;
    selectPolicy: 'Max' | 'Min' | 'Disabled';
  };
  scaleDownPolicy: {
    stabilizationWindowSeconds: number;
    selectPolicy: 'Max' | 'Min' | 'Disabled';
  };
}

/**
 * Usage pattern analysis result
 */
export interface UsagePattern {
  agentId: string;
  timeWindow: string;
  averageLoad: number;
  peakLoad: number;
  requestCount: number;
  responseTime: number;
  errorRate: number;
  recommendedReplicas: number;
  costOptimization: {
    currentCost: number;
    optimizedCost: number;
    savings: number;
  };
}

/**
 * Deployment configuration generator for Kubernetes manifests
 */
export class DeploymentConfigGenerator {
  /**
   * Generate Kubernetes deployment manifest
   */
  generateDeploymentManifest(config: AgentDeploymentConfig): any {
    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `agent-${config.agentId}`,
        namespace: 'agents',
        labels: {
          app: `agent-${config.agentId}`,
          'agent.craviz.ai/id': config.agentId,
          'agent.craviz.ai/user': config.userId,
          'agent.craviz.ai/version': config.agentVersion,
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: `agent-${config.agentId}`,
          },
        },
        template: {
          metadata: {
            labels: {
              app: `agent-${config.agentId}`,
              'agent.craviz.ai/id': config.agentId,
            },
          },
          spec: {
            containers: [
              {
                name: 'agent',
                image: `${config.imageRegistry}/${config.agentName}:${config.agentVersion}`,
                ports: [
                  {
                    containerPort: config.healthCheck.port,
                    protocol: 'TCP',
                  },
                ],
                env: Object.entries(config.environment).map(([key, value]) => ({
                  name: key,
                  value: value,
                })),
                resources: {
                  requests: {
                    cpu: config.resources.cpu,
                    memory: config.resources.memory,
                  },
                  limits: {
                    cpu: config.limits.maxCpu,
                    memory: config.limits.maxMemory,
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: config.healthCheck.path,
                    port: config.healthCheck.port,
                  },
                  initialDelaySeconds: config.healthCheck.initialDelaySeconds,
                  periodSeconds: config.healthCheck.periodSeconds,
                },
                readinessProbe: {
                  httpGet: {
                    path: config.healthCheck.path,
                    port: config.healthCheck.port,
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 5,
                },
                securityContext: {
                  runAsNonRoot: true,
                  runAsUser: 1000,
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                },
              },
            ],
            securityContext: {
              fsGroup: 1000,
            },
          },
        },
      },
    };
  }

  /**
   * Generate service manifest
   */
  generateServiceManifest(config: AgentDeploymentConfig): any {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `agent-${config.agentId}-service`,
        namespace: 'agents',
        labels: {
          app: `agent-${config.agentId}`,
        },
      },
      spec: {
        selector: {
          app: `agent-${config.agentId}`,
        },
        ports: [
          {
            port: 80,
            targetPort: config.healthCheck.port,
            protocol: 'TCP',
          },
        ],
        type: 'ClusterIP',
      },
    };
  }

  /**
   * Generate HPA manifest
   */
  generateHPAManifest(config: AgentDeploymentConfig, scalingConfig: AutoScalingConfig): any {
    return {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: `agent-${config.agentId}-hpa`,
        namespace: 'agents',
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: `agent-${config.agentId}`,
        },
        minReplicas: scalingConfig.minReplicas,
        maxReplicas: scalingConfig.maxReplicas,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: scalingConfig.targetCPUUtilization,
              },
            },
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: scalingConfig.targetMemoryUtilization,
              },
            },
          },
        ],
        behavior: {
          scaleUp: scalingConfig.scaleUpPolicy,
          scaleDown: scalingConfig.scaleDownPolicy,
        },
      },
    };
  }
}

/**
 * Kubernetes deployment manager for agent containers
 */
export class KubernetesDeploymentManager {
  private appsV1: AppsV1Api;
  private coreV1: CoreV1Api;
  private autoscalingV1: AutoscalingV1Api;
  private customObjects: CustomObjectsApi;
  private configGenerator: DeploymentConfigGenerator;

  constructor(kubeConfig: KubeConfig) {
    this.appsV1 = kubeConfig.makeApiClient(AppsV1Api);
    this.coreV1 = kubeConfig.makeApiClient(CoreV1Api);
    this.autoscalingV1 = kubeConfig.makeApiClient(AutoscalingV1Api);
    this.customObjects = kubeConfig.makeApiClient(CustomObjectsApi);
    this.configGenerator = new DeploymentConfigGenerator();
  }

  /**
   * Deploy agent container
   */
  async deployAgent(config: AgentDeploymentConfig, scalingConfig: AutoScalingConfig): Promise<string> {
    try {
      const namespace = 'agents';
      
      // Ensure namespace exists
      await this.ensureNamespace(namespace);

      // Create deployment
      const deploymentManifest = this.configGenerator.generateDeploymentManifest(config);
      await this.appsV1.createNamespacedDeployment(namespace, deploymentManifest);

      // Create service
      const serviceManifest = this.configGenerator.generateServiceManifest(config);
      await this.coreV1.createNamespacedService(namespace, serviceManifest);

      // Create HPA
      const hpaManifest = this.configGenerator.generateHPAManifest(config, scalingConfig);
      await this.customObjects.createNamespacedCustomObject(
        'autoscaling',
        'v2',
        namespace,
        'horizontalpodautoscalers',
        hpaManifest
      );

      return `agent-${config.agentId}`;
    } catch (error) {
      throw new Error(`Failed to deploy agent container: ${error}`);
    }
  }

  /**
   * Update agent deployment
   */
  async updateAgent(config: AgentDeploymentConfig): Promise<void> {
    try {
      const namespace = 'agents';
      const deploymentName = `agent-${config.agentId}`;
      
      const deploymentManifest = this.configGenerator.generateDeploymentManifest(config);
      await this.appsV1.patchNamespacedDeployment(
        deploymentName,
        namespace,
        deploymentManifest,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );
    } catch (error) {
      throw new Error(`Failed to update agent deployment: ${error}`);
    }
  }

  /**
   * Scale agent deployment
   */
  async scaleAgent(agentId: string, replicas: number): Promise<void> {
    try {
      const namespace = 'agents';
      const deploymentName = `agent-${agentId}`;
      
      await this.appsV1.patchNamespacedDeploymentScale(
        deploymentName,
        namespace,
        { spec: { replicas } },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );
    } catch (error) {
      throw new Error(`Failed to scale agent deployment: ${error}`);
    }
  }

  /**
   * Terminate agent deployment
   */
  async terminateAgent(agentId: string): Promise<void> {
    try {
      const namespace = 'agents';
      const deploymentName = `agent-${agentId}`;
      const serviceName = `agent-${agentId}-service`;
      const hpaName = `agent-${agentId}-hpa`;

      // Delete HPA
      await this.customObjects.deleteNamespacedCustomObject(
        'autoscaling',
        'v2',
        namespace,
        'horizontalpodautoscalers',
        hpaName
      );

      // Delete service
      await this.coreV1.deleteNamespacedService(serviceName, namespace);

      // Delete deployment
      await this.appsV1.deleteNamespacedDeployment(deploymentName, namespace);
    } catch (error) {
      throw new Error(`Failed to terminate agent deployment: ${error}`);
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(agentId: string): Promise<ContainerDeploymentStatus | null> {
    try {
      const namespace = 'agents';
      const deploymentName = `agent-${agentId}`;
      
      const response = await this.appsV1.readNamespacedDeployment(deploymentName, namespace);
      const deployment = response.body;

      if (!deployment.status) {
        return null;
      }

      const status: ContainerDeploymentStatus = {
        deploymentId: deploymentName,
        agentId,
        status: this.determineDeploymentStatus(deployment.status),
        replicas: {
          desired: deployment.status.replicas || 0,
          ready: deployment.status.readyReplicas || 0,
          available: deployment.status.availableReplicas || 0,
        },
        resources: await this.getResourceUsage(agentId),
        healthStatus: this.determineHealthStatus(deployment.status),
        lastUpdated: new Date(),
      };

      return status;
    } catch (error) {
      console.error(`Failed to get deployment status: ${error}`);
      return null;
    }
  }

  /**
   * Ensure namespace exists
   */
  private async ensureNamespace(namespace: string): Promise<void> {
    try {
      await this.coreV1.readNamespace(namespace);
    } catch (error) {
      // Namespace doesn't exist, create it
      await this.coreV1.createNamespace({
        metadata: {
          name: namespace,
          labels: {
            'craviz.ai/managed': 'true',
          },
        },
      });
    }
  }

  /**
   * Determine deployment status from Kubernetes status
   */
  private determineDeploymentStatus(status: any): ContainerDeploymentStatus['status'] {
    if (status.conditions) {
      const progressingCondition = status.conditions.find((c: any) => c.type === 'Progressing');
      const availableCondition = status.conditions.find((c: any) => c.type === 'Available');

      if (progressingCondition?.status === 'False' && progressingCondition?.reason === 'ProgressDeadlineExceeded') {
        return 'failed';
      }

      if (availableCondition?.status === 'True') {
        return 'running';
      }

      if (progressingCondition?.status === 'True') {
        return 'scaling';
      }
    }

    return 'pending';
  }

  /**
   * Determine health status from deployment conditions
   */
  private determineHealthStatus(status: any): ContainerDeploymentStatus['healthStatus'] {
    if (status.readyReplicas && status.replicas && status.readyReplicas === status.replicas) {
      return 'healthy';
    }
    if (status.readyReplicas === 0) {
      return 'unhealthy';
    }
    return 'unknown';
  }

  /**
   * Get resource usage for agent
   */
  private async getResourceUsage(agentId: string): Promise<ContainerDeploymentStatus['resources']> {
    // This would typically integrate with Prometheus or Kubernetes metrics API
    // For now, return placeholder values
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      networkIO: 0,
    };
  }
}

/**
 * Usage pattern analyzer for auto-scaling decisions
 */
export class UsagePatternAnalyzer {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Analyze usage patterns for an agent
   */
  async analyzeUsagePattern(agentId: string, timeWindow: string = '1h'): Promise<UsagePattern> {
    try {
      const { data: metrics, error } = await this.supabase
        .from('usage_metrics')
        .select('*')
        .eq('agent_id', agentId)
        .gte('created_at', this.getTimeWindowStart(timeWindow))
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch usage metrics: ${error.message}`);
      }

      if (!metrics || metrics.length === 0) {
        return this.getDefaultUsagePattern(agentId, timeWindow);
      }

      const analysis = this.calculateUsageMetrics(metrics);
      const recommendation = this.calculateScalingRecommendation(analysis);

      return {
        agentId,
        timeWindow,
        averageLoad: analysis.averageLoad,
        peakLoad: analysis.peakLoad,
        requestCount: analysis.requestCount,
        responseTime: analysis.responseTime,
        errorRate: analysis.errorRate,
        recommendedReplicas: recommendation.replicas,
        costOptimization: recommendation.costOptimization,
      };
    } catch (error) {
      throw new Error(`Failed to analyze usage pattern: ${error}`);
    }
  }

  /**
   * Get time window start date
   */
  private getTimeWindowStart(timeWindow: string): string {
    const now = new Date();
    const duration = parseInt(timeWindow.slice(0, -1));
    const unit = timeWindow.slice(-1);

    switch (unit) {
      case 'h':
        now.setHours(now.getHours() - duration);
        break;
      case 'd':
        now.setDate(now.getDate() - duration);
        break;
      case 'm':
        now.setMinutes(now.getMinutes() - duration);
        break;
      default:
        now.setHours(now.getHours() - 1);
    }

    return now.toISOString();
  }

  /**
   * Calculate usage metrics from raw data
   */
  private calculateUsageMetrics(metrics: any[]): any {
    const loads = metrics.map(m => m.cpu_usage || 0);
    const requests = metrics.reduce((sum, m) => sum + (m.request_count || 0), 0);
    const responseTimes = metrics.map(m => m.response_time || 0);
    const errors = metrics.reduce((sum, m) => sum + (m.error_count || 0), 0);

    return {
      averageLoad: loads.reduce((sum, load) => sum + load, 0) / loads.length,
      peakLoad: Math.max(...loads),
      requestCount: requests,
      responseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      errorRate: requests > 0 ? errors / requests : 0,
    };
  }

  /**
   * Calculate scaling recommendation
   */
  private calculateScalingRecommendation(analysis: any): any {
    let recommendedReplicas = 1;

    // Scale up if average load is high
    if (analysis.averageLoad > 0.7) {
      recommendedReplicas = Math.ceil(analysis.averageLoad / 0.5);
    }

    // Scale up if peak load is very high
    if (analysis.peakLoad > 0.9) {
      recommendedReplicas = Math.max(recommendedReplicas, 3);
    }

    // Scale down if load is consistently low
    if (analysis.averageLoad < 0.2 && analysis.peakLoad < 0.5) {
      recommendedReplicas = 1;
    }

    return {
      replicas: Math.min(recommendedReplicas, 10), // Cap at 10 replicas
      costOptimization: {
        currentCost: 0, // Would be calculated based on current resources
        optimizedCost: 0, // Would be calculated based on recommendation
        savings: 0,
      },
    };
  }

  /**
   * Get default usage pattern for agents with no metrics
   */
  private getDefaultUsagePattern(agentId: string, timeWindow: string): UsagePattern {
    return {
      agentId,
      timeWindow,
      averageLoad: 0.1,
      peakLoad: 0.2,
      requestCount: 0,
      responseTime: 0,
      errorRate: 0,
      recommendedReplicas: 1,
      costOptimization: {
        currentCost: 0,
        optimizedCost: 0,
        savings: 0,
      },
    };
  }
}

/**
 * Auto-scaling engine for dynamic replica management
 */
export class AutoScalingEngine extends EventEmitter {
  private deploymentManager: KubernetesDeploymentManager;
  private usageAnalyzer: UsagePatternAnalyzer;
  private scalingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    deploymentManager: KubernetesDeploymentManager,
    usageAnalyzer: UsagePatternAnalyzer
  ) {
    super();
    this.deploymentManager = deploymentManager;
    this.usageAnalyzer = usageAnalyzer;
  }

  /**
   * Enable auto-scaling for an agent
   */
  enableAutoScaling(agentId: string, intervalSeconds: number = 60): void {
    if (this.scalingIntervals.has(agentId)) {
      this.disableAutoScaling(agentId);
    }

    const interval = setInterval(async () => {
      try {
        await this.performScalingCheck(agentId);
      } catch (error) {
        console.error(`Auto-scaling check failed for agent ${agentId}:`, error);
        this.emit('scaling-error', { agentId, error });
      }
    }, intervalSeconds * 1000);

    this.scalingIntervals.set(agentId, interval);
    this.emit('auto-scaling-enabled', { agentId });
  }

  /**
   * Disable auto-scaling for an agent
   */
  disableAutoScaling(agentId: string): void {
    const interval = this.scalingIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.scalingIntervals.delete(agentId);
      this.emit('auto-scaling-disabled', { agentId });
    }
  }

  /**
   * Perform scaling check for an agent
   */
  private async performScalingCheck(agentId: string): Promise<void> {
    const usagePattern = await this.usageAnalyzer.analyzeUsagePattern(agentId);
    const currentStatus = await this.deploymentManager.getDeploymentStatus(agentId);

    if (!currentStatus) {
      return;
    }

    const currentReplicas = currentStatus.replicas.desired;
    const recommendedReplicas = usagePattern.recommendedReplicas;

    if (currentReplicas !== recommendedReplicas) {
      await this.deploymentManager.scaleAgent(agentId, recommendedReplicas);
      
      this.emit('scaling-performed', {
        agentId,
        from: