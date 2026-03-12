```typescript
import { createClient } from '@supabase/supabase-js';
import Docker from 'dockerode';
import { k8s } from '@kubernetes/client-node';
import AWS from 'aws-sdk';
import { GoogleAuth } from 'google-auth-library';
import { ContainerInstanceManagementClient } from '@azure/arm-containerinstance';
import { DefaultAzureCredential } from '@azure/identity';
import Redis from 'ioredis';
import WebSocket from 'ws';
import { EventEmitter } from 'events';

/**
 * Deployment configuration interface
 */
interface DeploymentConfig {
  agentId: string;
  version: string;
  replicas: number;
  resources: ResourceRequirements;
  environment: Record<string, string>;
  healthCheck: HealthCheckConfig;
  scaling: AutoScalingConfig;
  rollback: RollbackConfig;
  provider: CloudProvider;
}

/**
 * Resource requirements interface
 */
interface ResourceRequirements {
  cpu: string;
  memory: string;
  storage?: string;
  gpu?: boolean;
}

/**
 * Health check configuration
 */
interface HealthCheckConfig {
  path: string;
  port: number;
  interval: number;
  timeout: number;
  retries: number;
  initialDelay: number;
}

/**
 * Auto-scaling configuration
 */
interface AutoScalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPU: number;
  targetMemory: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

/**
 * Rollback configuration
 */
interface RollbackConfig {
  enabled: boolean;
  healthCheckFailureThreshold: number;
  rollbackTimeout: number;
  preserveLogs: boolean;
}

/**
 * Cloud provider types
 */
type CloudProvider = 'aws' | 'gcp' | 'azure' | 'kubernetes';

/**
 * Deployment status enumeration
 */
enum DeploymentStatus {
  QUEUED = 'queued',
  BUILDING = 'building',
  PUSHING = 'pushing',
  DEPLOYING = 'deploying',
  RUNNING = 'running',
  SCALING = 'scaling',
  UNHEALTHY = 'unhealthy',
  ROLLING_BACK = 'rolling_back',
  FAILED = 'failed',
  TERMINATED = 'terminated'
}

/**
 * Deployment instance interface
 */
interface DeploymentInstance {
  id: string;
  agentId: string;
  version: string;
  status: DeploymentStatus;
  provider: CloudProvider;
  region: string;
  endpoint?: string;
  replicas: number;
  healthScore: number;
  metrics: DeploymentMetrics;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Deployment metrics interface
 */
interface DeploymentMetrics {
  cpuUsage: number;
  memoryUsage: number;
  requestCount: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
}

/**
 * Health check result interface
 */
interface HealthCheckResult {
  deploymentId: string;
  healthy: boolean;
  score: number;
  checks: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    latency?: number;
  }>;
  timestamp: Date;
}

/**
 * Circuit breaker state
 */
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker interface
 */
interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime: Date;
  timeout: number;
  threshold: number;
}

/**
 * Container builder class for creating deployment images
 */
class ContainerBuilder {
  private docker: Docker;
  private registry: string;

  constructor(registryUrl: string) {
    this.docker = new Docker();
    this.registry = registryUrl;
  }

  /**
   * Build container image for agent
   */
  async buildImage(agentId: string, version: string, sourceCode: string): Promise<string> {
    const imageName = `${this.registry}/agents/${agentId}:${version}`;
    
    const dockerfile = this.generateDockerfile(sourceCode);
    const buildContext = await this.createBuildContext(dockerfile, sourceCode);

    const stream = await this.docker.buildImage(buildContext, {
      t: imageName,
      platform: 'linux/amd64,linux/arm64'
    });

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err, res) => {
        if (err) reject(err);
        else resolve(imageName);
      });
    });
  }

  /**
   * Push image to registry
   */
  async pushImage(imageName: string): Promise<void> {
    const image = this.docker.getImage(imageName);
    const stream = await image.push();

    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private generateDockerfile(sourceCode: string): string {
    return `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1
CMD ["npm", "start"]
    `;
  }

  private async createBuildContext(dockerfile: string, sourceCode: string): Promise<Buffer> {
    // Create tar archive with dockerfile and source code
    const tar = require('tar-stream');
    const pack = tar.pack();
    
    pack.entry({ name: 'Dockerfile' }, dockerfile);
    pack.entry({ name: 'index.js' }, sourceCode);
    pack.finalize();

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      pack.on('data', (chunk: Buffer) => chunks.push(chunk));
      pack.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

/**
 * Cloud provider manager for multi-cloud deployments
 */
class CloudProviderManager {
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor() {
    this.circuitBreakers = new Map();
  }

  /**
   * Deploy to AWS ECS/EKS
   */
  async deployToAWS(config: DeploymentConfig, imageName: string): Promise<string> {
    return this.executeWithCircuitBreaker('aws', async () => {
      const ecs = new AWS.ECS();
      
      const taskDefinition = {
        family: `agent-${config.agentId}`,
        networkMode: 'awsvpc',
        requiresCompatibilities: ['FARGATE'],
        cpu: config.resources.cpu,
        memory: config.resources.memory,
        containerDefinitions: [{
          name: `agent-${config.agentId}`,
          image: imageName,
          portMappings: [{
            containerPort: 8080,
            protocol: 'tcp'
          }],
          environment: Object.entries(config.environment).map(([name, value]) => ({ name, value })),
          healthCheck: {
            command: [`CMD-SHELL`, `curl -f http://localhost:${config.healthCheck.port}${config.healthCheck.path} || exit 1`],
            interval: config.healthCheck.interval,
            timeout: config.healthCheck.timeout,
            retries: config.healthCheck.retries,
            startPeriod: config.healthCheck.initialDelay
          }
        }]
      };

      const taskDef = await ecs.registerTaskDefinition(taskDefinition).promise();
      
      const service = await ecs.createService({
        cluster: 'default',
        serviceName: `agent-${config.agentId}-${config.version}`,
        taskDefinition: taskDef.taskDefinition!.taskDefinitionArn!,
        desiredCount: config.replicas,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: process.env.AWS_SUBNET_IDS?.split(',') || [],
            securityGroups: process.env.AWS_SECURITY_GROUP_IDS?.split(',') || [],
            assignPublicIp: 'ENABLED'
          }
        }
      }).promise();

      return service.service!.serviceArn!;
    });
  }

  /**
   * Deploy to Google Cloud Run
   */
  async deployToGCP(config: DeploymentConfig, imageName: string): Promise<string> {
    return this.executeWithCircuitBreaker('gcp', async () => {
      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
      });
      
      const client = await auth.getClient();
      const projectId = await auth.getProjectId();
      
      const service = {
        apiVersion: 'serving.knative.dev/v1',
        kind: 'Service',
        metadata: {
          name: `agent-${config.agentId}-${config.version}`,
          namespace: projectId
        },
        spec: {
          template: {
            metadata: {
              annotations: {
                'autoscaling.knative.dev/minScale': config.scaling.minReplicas.toString(),
                'autoscaling.knative.dev/maxScale': config.scaling.maxReplicas.toString(),
                'run.googleapis.com/cpu-throttling': 'false'
              }
            },
            spec: {
              containers: [{
                image: imageName,
                ports: [{ containerPort: 8080 }],
                env: Object.entries(config.environment).map(([name, value]) => ({ name, value })),
                resources: {
                  limits: {
                    cpu: config.resources.cpu,
                    memory: config.resources.memory
                  }
                },
                livenessProbe: {
                  httpGet: {
                    path: config.healthCheck.path,
                    port: config.healthCheck.port
                  },
                  initialDelaySeconds: config.healthCheck.initialDelay,
                  periodSeconds: config.healthCheck.interval,
                  timeoutSeconds: config.healthCheck.timeout,
                  failureThreshold: config.healthCheck.retries
                }
              }]
            }
          }
        }
      };

      const url = `https://run.googleapis.com/v1/namespaces/${projectId}/services`;
      const response = await client.request({ url, method: 'POST', data: service });
      
      return response.data.metadata.name;
    });
  }

  /**
   * Deploy to Azure Container Instances
   */
  async deployToAzure(config: DeploymentConfig, imageName: string): Promise<string> {
    return this.executeWithCircuitBreaker('azure', async () => {
      const credential = new DefaultAzureCredential();
      const client = new ContainerInstanceManagementClient(credential, process.env.AZURE_SUBSCRIPTION_ID!);
      
      const containerGroup = {
        location: process.env.AZURE_REGION || 'eastus',
        containers: [{
          name: `agent-${config.agentId}`,
          image: imageName,
          resources: {
            requests: {
              cpu: parseFloat(config.resources.cpu),
              memoryInGB: parseFloat(config.resources.memory.replace('Gi', ''))
            }
          },
          ports: [{ port: 8080, protocol: 'TCP' }],
          environmentVariables: Object.entries(config.environment).map(([name, value]) => ({ name, value })),
          livenessProbe: {
            httpGet: {
              path: config.healthCheck.path,
              port: config.healthCheck.port
            },
            initialDelaySeconds: config.healthCheck.initialDelay,
            periodSeconds: config.healthCheck.interval,
            timeoutSeconds: config.healthCheck.timeout,
            failureThreshold: config.healthCheck.retries
          }
        }],
        osType: 'Linux',
        restartPolicy: 'Always',
        ipAddress: {
          type: 'Public',
          ports: [{ port: 8080, protocol: 'TCP' }]
        }
      };

      const result = await client.containerGroups.beginCreateOrUpdateAndWait(
        process.env.AZURE_RESOURCE_GROUP!,
        `agent-${config.agentId}-${config.version}`,
        containerGroup
      );

      return result.name!;
    });
  }

  /**
   * Deploy to Kubernetes cluster
   */
  async deployToKubernetes(config: DeploymentConfig, imageName: string): Promise<string> {
    return this.executeWithCircuitBreaker('kubernetes', async () => {
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();
      
      const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
      const k8sService = kc.makeApiClient(k8s.CoreV1Api);
      
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: `agent-${config.agentId}-${config.version}`,
          labels: { app: `agent-${config.agentId}` }
        },
        spec: {
          replicas: config.replicas,
          selector: { matchLabels: { app: `agent-${config.agentId}` } },
          template: {
            metadata: { labels: { app: `agent-${config.agentId}` } },
            spec: {
              containers: [{
                name: `agent-${config.agentId}`,
                image: imageName,
                ports: [{ containerPort: 8080 }],
                env: Object.entries(config.environment).map(([name, value]) => ({ name, value })),
                resources: {
                  requests: {
                    cpu: config.resources.cpu,
                    memory: config.resources.memory
                  },
                  limits: {
                    cpu: config.resources.cpu,
                    memory: config.resources.memory
                  }
                },
                livenessProbe: {
                  httpGet: {
                    path: config.healthCheck.path,
                    port: config.healthCheck.port
                  },
                  initialDelaySeconds: config.healthCheck.initialDelay,
                  periodSeconds: config.healthCheck.interval,
                  timeoutSeconds: config.healthCheck.timeout,
                  failureThreshold: config.healthCheck.retries
                }
              }]
            }
          }
        }
      };

      await k8sApi.createNamespacedDeployment('default', deployment);

      const service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: `agent-${config.agentId}-service` },
        spec: {
          selector: { app: `agent-${config.agentId}` },
          ports: [{ port: 80, targetPort: 8080 }],
          type: 'LoadBalancer'
        }
      };

      await k8sService.createNamespacedService('default', service);
      
      return `agent-${config.agentId}-${config.version}`;
    });
  }

  private async executeWithCircuitBreaker<T>(provider: string, operation: () => Promise<T>): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(provider);
    
    if (breaker.state === CircuitBreakerState.OPEN) {
      if (Date.now() - breaker.lastFailureTime.getTime() > breaker.timeout) {
        breaker.state = CircuitBreakerState.HALF_OPEN;
      } else {
        throw new Error(`Circuit breaker open for provider: ${provider}`);
      }
    }

    try {
      const result = await operation();
      
      if (breaker.state === CircuitBreakerState.HALF_OPEN) {
        breaker.state = CircuitBreakerState.CLOSED;
        breaker.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      breaker.failureCount++;
      breaker.lastFailureTime = new Date();
      
      if (breaker.failureCount >= breaker.threshold) {
        breaker.state = CircuitBreakerState.OPEN;
      }
      
      throw error;
    }
  }

  private getOrCreateCircuitBreaker(provider: string): CircuitBreaker {
    if (!this.circuitBreakers.has(provider)) {
      this.circuitBreakers.set(provider, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        lastFailureTime: new Date(),
        timeout: 60000, // 1 minute
        threshold: 5
      });
    }
    return this.circuitBreakers.get(provider)!;
  }
}

/**
 * Health monitor for tracking deployment health
 */
class HealthMonitor extends EventEmitter {
  private checks: Map<string, HealthCheckResult> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start monitoring deployment health
   */
  async startMonitoring(deployment: DeploymentInstance, config: HealthCheckConfig): Promise<void> {
    const checkHealth = async () => {
      try {
        const result = await this.performHealthCheck(deployment, config);
        this.checks.set(deployment.id, result);
        
        if (!result.healthy) {
          this.emit('unhealthy', deployment.id, result);
        } else {
          this.emit('healthy', deployment.id, result);
        }
      } catch (error) {
        console.error(`Health check failed for deployment ${deployment.id}:`, error);
      }
    };

    // Perform initial check after delay
    setTimeout(checkHealth, config.initialDelay);
    
    // Set up recurring checks
    const interval = setInterval(checkHealth, config.interval);
    this.intervals.set(deployment.id, interval);
  }

  /**
   * Stop monitoring deployment
   */
  stopMonitoring(deploymentId: string): void {
    const interval = this.intervals.get(deploymentId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(deploymentId);
    }
    this.checks.delete(deploymentId);
  }

  /**
   * Get current health status
   */
  getHealthStatus(deploymentId: string): HealthCheckResult | null {
    return this.checks.get(deploymentId) || null;
  }

  private async performHealthCheck(deployment: DeploymentInstance, config: HealthCheckConfig): Promise<HealthCheckResult> {
    const checks = [];
    
    // HTTP health check
    try {
      const start = Date.now();
      const response = await fetch(`${deployment.endpoint}${config.path}`, {
        method: 'GET',
        timeout: config.timeout
      });
      const latency = Date.now() - start;
      
      checks.push({
        name: 'http',
        status: response.ok ? 'healthy' : 'unhealthy' as const,
        message: response.ok ? 'OK' : `HTTP ${response.status}`,
        latency
      });
    } catch (error) {
      checks.push({
        name: 'http',
        status: 'unhealthy' as const,
        message: (error as Error).message
      });
    }

    // Resource usage check
    const metrics = await this.getDeploymentMetrics(deployment.id);
    checks.push({
      name: 'cpu',
      status: metrics.cpuUsage < 90 ? 'healthy' : 'degraded' as const,
      message: `CPU: ${metrics.cpuUsage.toFixed(1)}%`
    });

    checks.push({
      name: 'memory',
      status: metrics.memoryUsage < 90 ? 'healthy' : 'degraded' as const,
      message: `Memory: ${metrics.memoryUsage.toFixed(1)}%`
    });

    const healthyChecks = checks.filter(c => c.status === 'healthy').length;
    const score = (healthyChecks / checks.length) * 100;

    return {
      deploymentId: deployment.id,
      healthy: score >= 70, // Consider healthy if 70% of checks pass
      score,
      checks,
      timestamp: new Date()
    };
  }

  private async getDeploymentMetrics(deploymentId: string): Promise<DeploymentMetrics> {
    // This would integrate with actual metrics collection system
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      requestCount: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 5,
      responseTime: Math.random() * 200,
      uptime: Math.random() * 100
    };
  }
}

/**
 * Auto-scaler for managing deployment replicas
 */
class AutoScaler extends EventEmitter {
  private scalingDecisions: Map<string, Date> = new Map();

  /**
   * Evaluate scaling for deployment
   */
  async evaluateScaling(deployment: DeploymentInstance, config: AutoScalingConfig, metrics: DeploymentMetrics): Promise<void> {
    if (!config.enabled) return;

    const lastScaling = this.scalingDecisions.get(deployment.id);
    const cooldownPeriod = this.getCooldownPeriod(deployment, config);
    
    if (lastScaling && Date.now() - lastScaling.getTime() < cooldownPeriod) {
      return; // Still in cooldown period
    }

    const targetReplicas = this.calculateTargetReplicas(deployment, config, metrics);
    
    if (targetReplicas !== deployment.replicas) {
      await this.scaleDeployment(deployment, targetReplicas);
      this.scalingDecisions.set(deployment.id, new Date());
      
      this.emit('scaled', {
        deploymentId: deployment.id,
        oldReplicas: deployment.replicas,
        newReplicas: targetReplicas,
        reason: this.getScalingReason(metrics, config)
      });
    }
  }

  private calculateTargetReplicas(deployment: DeploymentInstance, config: AutoScalingConfig, metrics: DeploymentMetrics): number {
    let targetReplicas = deployment.replicas;

    // CPU-based scaling
    if (metrics.cpuUsage > config.targetCPU) {
      targetReplicas = Math.ceil(deployment.replicas * (metrics.cpuUsage / config.targetCPU));
    } else if (metrics.cpuUsage