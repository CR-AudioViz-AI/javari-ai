```typescript
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import Docker from 'dockerode';
import { KubeConfig, AppsV1Api, CoreV1Api } from '@kubernetes/client-node';
import { promisify } from 'util';

/**
 * Agent Instant Deployment Service
 * Handles containerized deployment, scaling, and monitoring of purchased AI agents
 */

// Types and Interfaces
export interface AgentDefinition {
  id: string;
  name: string;
  version: string;
  image: string;
  dependencies: Dependency[];
  environment: EnvironmentConfig;
  resources: ResourceRequirements;
  healthCheck: HealthCheckConfig;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'npm' | 'pip' | 'docker' | 'system';
  required: boolean;
}

export interface EnvironmentConfig {
  variables: Record<string, string>;
  secrets: string[];
  volumes: VolumeMount[];
  ports: PortMapping[];
}

export interface ResourceRequirements {
  cpu: string;
  memory: string;
  storage: string;
  gpu?: string;
}

export interface HealthCheckConfig {
  path: string;
  port: number;
  interval: number;
  timeout: number;
  retries: number;
}

export interface DeploymentRequest {
  id: string;
  userId: string;
  agentId: string;
  replicas: number;
  priority: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
}

export interface DeploymentStatus {
  id: string;
  status: 'queued' | 'provisioning' | 'running' | 'scaling' | 'failed' | 'terminated';
  progress: number;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContainerInstance {
  id: string;
  deploymentId: string;
  containerId: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  metrics: ContainerMetrics;
}

export interface ContainerMetrics {
  cpu: number;
  memory: number;
  network: NetworkMetrics;
  disk: DiskMetrics;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface DiskMetrics {
  read: number;
  write: number;
  usage: number;
}

export interface VolumeMount {
  source: string;
  target: string;
  readOnly: boolean;
}

export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  protocol: 'tcp' | 'udp';
}

export interface ScalingRule {
  metric: string;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  cooldown: number;
}

// Error Classes
export class DeploymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public deploymentId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'DeploymentError';
  }
}

export class ContainerError extends Error {
  constructor(
    message: string,
    public containerId: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ContainerError';
  }
}

export class ResourceError extends Error {
  constructor(
    message: string,
    public resourceType: string,
    public requested: string,
    public available: string
  ) {
    super(message);
    this.name = 'ResourceError';
  }
}

/**
 * Deployment Queue Manager
 * Handles prioritized deployment queue with Redis backing
 */
class DeploymentQueue extends EventEmitter {
  private redis: Redis;
  private processing = false;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
  }

  /**
   * Add deployment request to queue
   */
  async enqueue(request: DeploymentRequest): Promise<void> {
    try {
      const priority = this.getPriorityScore(request.priority);
      await this.redis.zadd(
        'deployment_queue',
        priority,
        JSON.stringify(request)
      );

      this.emit('queued', request);
    } catch (error) {
      throw new DeploymentError(
        'Failed to enqueue deployment request',
        'QUEUE_ERROR',
        request.id,
        error as Error
      );
    }
  }

  /**
   * Process next deployment from queue
   */
  async dequeue(): Promise<DeploymentRequest | null> {
    try {
      const result = await this.redis.zpopmax('deployment_queue');
      if (!result.length) return null;

      const request = JSON.parse(result[0]) as DeploymentRequest;
      this.emit('dequeued', request);
      return request;
    } catch (error) {
      throw new DeploymentError(
        'Failed to dequeue deployment request',
        'QUEUE_ERROR',
        undefined,
        error as Error
      );
    }
  }

  /**
   * Get queue length
   */
  async getQueueLength(): Promise<number> {
    return await this.redis.zcard('deployment_queue');
  }

  private getPriorityScore(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }
}

/**
 * Container Manager
 * Manages Docker containers and Kubernetes pods
 */
class ContainerManager extends EventEmitter {
  private docker: Docker;
  private k8sApps?: AppsV1Api;
  private k8sCore?: CoreV1Api;

  constructor(dockerOptions?: any, kubeConfig?: KubeConfig) {
    super();
    this.docker = new Docker(dockerOptions);
    
    if (kubeConfig) {
      this.k8sApps = kubeConfig.makeApiClient(AppsV1Api);
      this.k8sCore = kubeConfig.makeApiClient(CoreV1Api);
    }
  }

  /**
   * Create and start container
   */
  async createContainer(
    agentDef: AgentDefinition,
    deploymentId: string,
    environment: Record<string, string>
  ): Promise<ContainerInstance> {
    try {
      // Pull image if needed
      await this.pullImage(agentDef.image);

      // Create container
      const container = await this.docker.createContainer({
        Image: agentDef.image,
        name: `agent-${deploymentId}-${Date.now()}`,
        Env: Object.entries(environment).map(([k, v]) => `${k}=${v}`),
        HostConfig: {
          Memory: this.parseMemory(agentDef.resources.memory),
          CpuShares: this.parseCpu(agentDef.resources.cpu),
          PortBindings: this.buildPortBindings(agentDef.environment.ports),
          Binds: this.buildVolumeMounts(agentDef.environment.volumes),
          RestartPolicy: { Name: 'unless-stopped' }
        },
        Healthcheck: {
          Test: [`CMD-SHELL`, `curl -f http://localhost:${agentDef.healthCheck.port}${agentDef.healthCheck.path} || exit 1`],
          Interval: agentDef.healthCheck.interval * 1000000000,
          Timeout: agentDef.healthCheck.timeout * 1000000000,
          Retries: agentDef.healthCheck.retries
        }
      });

      // Start container
      await container.start();

      const instance: ContainerInstance = {
        id: `${deploymentId}-${container.id}`,
        deploymentId,
        containerId: container.id,
        status: 'running',
        health: 'unknown',
        metrics: {
          cpu: 0,
          memory: 0,
          network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 },
          disk: { read: 0, write: 0, usage: 0 }
        }
      };

      this.emit('container_created', instance);
      return instance;
    } catch (error) {
      throw new ContainerError(
        'Failed to create container',
        deploymentId,
        error as Error
      );
    }
  }

  /**
   * Stop and remove container
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      await container.remove();
      
      this.emit('container_removed', containerId);
    } catch (error) {
      throw new ContainerError(
        'Failed to remove container',
        containerId,
        error as Error
      );
    }
  }

  /**
   * Get container metrics
   */
  async getContainerMetrics(containerId: string): Promise<ContainerMetrics> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      return {
        cpu: this.calculateCpuPercent(stats),
        memory: this.calculateMemoryUsage(stats),
        network: this.extractNetworkMetrics(stats),
        disk: this.extractDiskMetrics(stats)
      };
    } catch (error) {
      throw new ContainerError(
        'Failed to get container metrics',
        containerId,
        error as Error
      );
    }
  }

  private async pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        
        this.docker.modem.followProgress(stream, (err: Error | null) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  }

  private parseMemory(memory: string): number {
    const match = memory.match(/^(\d+)([KMGT]i?)B?$/i);
    if (!match) return 512 * 1024 * 1024; // Default 512MB
    
    const value = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: Record<string, number> = {
      'K': 1024,
      'KI': 1024,
      'M': 1024 * 1024,
      'MI': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'GI': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024,
      'TI': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);
  }

  private parseCpu(cpu: string): number {
    const match = cpu.match(/^(\d+)m?$/);
    if (!match) return 1024; // Default 1 CPU
    
    const value = parseInt(match[1]);
    return cpu.endsWith('m') ? value : value * 1000;
  }

  private buildPortBindings(ports: PortMapping[]): Record<string, any> {
    const bindings: Record<string, any> = {};
    
    for (const port of ports) {
      const key = `${port.containerPort}/${port.protocol}`;
      bindings[key] = port.hostPort ? [{ HostPort: port.hostPort.toString() }] : [{}];
    }
    
    return bindings;
  }

  private buildVolumeMounts(volumes: VolumeMount[]): string[] {
    return volumes.map(vol => 
      vol.readOnly ? `${vol.source}:${vol.target}:ro` : `${vol.source}:${vol.target}`
    );
  }

  private calculateCpuPercent(stats: any): number {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
    
    return (cpuDelta / systemDelta) * cpuCount * 100;
  }

  private calculateMemoryUsage(stats: any): number {
    const usage = stats.memory_stats.usage;
    const cache = stats.memory_stats.stats?.cache || 0;
    return ((usage - cache) / stats.memory_stats.limit) * 100;
  }

  private extractNetworkMetrics(stats: any): NetworkMetrics {
    const networks = stats.networks || {};
    let totalRx = 0, totalTx = 0, totalRxPackets = 0, totalTxPackets = 0;
    
    for (const network of Object.values(networks) as any[]) {
      totalRx += network.rx_bytes || 0;
      totalTx += network.tx_bytes || 0;
      totalRxPackets += network.rx_packets || 0;
      totalTxPackets += network.tx_packets || 0;
    }
    
    return {
      bytesIn: totalRx,
      bytesOut: totalTx,
      packetsIn: totalRxPackets,
      packetsOut: totalTxPackets
    };
  }

  private extractDiskMetrics(stats: any): DiskMetrics {
    const blkioStats = stats.blkio_stats || {};
    let totalRead = 0, totalWrite = 0;
    
    if (blkioStats.io_service_bytes_recursive) {
      for (const entry of blkioStats.io_service_bytes_recursive) {
        if (entry.op === 'Read') totalRead += entry.value;
        if (entry.op === 'Write') totalWrite += entry.value;
      }
    }
    
    return {
      read: totalRead,
      write: totalWrite,
      usage: 0 // Would need filesystem stats for usage
    };
  }
}

/**
 * Dependency Resolver
 * Resolves and installs agent dependencies
 */
class DependencyResolver {
  /**
   * Resolve all dependencies for an agent
   */
  async resolveDependencies(agentDef: AgentDefinition): Promise<string[]> {
    try {
      const installCommands: string[] = [];
      
      for (const dep of agentDef.dependencies) {
        const command = await this.buildInstallCommand(dep);
        if (command) installCommands.push(command);
      }
      
      return installCommands;
    } catch (error) {
      throw new DeploymentError(
        'Failed to resolve dependencies',
        'DEPENDENCY_ERROR',
        agentDef.id,
        error as Error
      );
    }
  }

  private async buildInstallCommand(dep: Dependency): Promise<string | null> {
    switch (dep.type) {
      case 'npm':
        return `npm install ${dep.name}@${dep.version}`;
      case 'pip':
        return `pip install ${dep.name}==${dep.version}`;
      case 'docker':
        return `docker pull ${dep.name}:${dep.version}`;
      case 'system':
        return `apt-get update && apt-get install -y ${dep.name}`;
      default:
        return null;
    }
  }
}

/**
 * Environment Provisioner
 * Sets up runtime environment for agents
 */
class EnvironmentProvisioner {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Provision environment for deployment
   */
  async provisionEnvironment(
    agentDef: AgentDefinition,
    deploymentId: string,
    userId: string
  ): Promise<Record<string, string>> {
    try {
      const environment: Record<string, string> = {
        ...agentDef.environment.variables,
        DEPLOYMENT_ID: deploymentId,
        USER_ID: userId,
        AGENT_ID: agentDef.id,
        AGENT_VERSION: agentDef.version
      };

      // Load secrets from database
      for (const secretName of agentDef.environment.secrets) {
        const secret = await this.getSecret(secretName, userId);
        if (secret) environment[secretName] = secret;
      }

      return environment;
    } catch (error) {
      throw new DeploymentError(
        'Failed to provision environment',
        'ENVIRONMENT_ERROR',
        deploymentId,
        error as Error
      );
    }
  }

  private async getSecret(name: string, userId: string): Promise<string | null> {
    try {
      const { data } = await this.supabase
        .from('user_secrets')
        .select('value')
        .eq('name', name)
        .eq('user_id', userId)
        .single();

      return data?.value || null;
    } catch {
      return null;
    }
  }
}

/**
 * Health Monitor
 * Monitors container health and performs recovery actions
 */
class HealthMonitor extends EventEmitter {
  private intervals = new Map<string, NodeJS.Timer>();
  private containerManager: ContainerManager;

  constructor(containerManager: ContainerManager) {
    super();
    this.containerManager = containerManager;
  }

  /**
   * Start monitoring container health
   */
  startMonitoring(instance: ContainerInstance, healthCheck: HealthCheckConfig): void {
    const interval = setInterval(async () => {
      try {
        const health = await this.checkContainerHealth(instance.containerId, healthCheck);
        instance.health = health;
        
        if (health === 'unhealthy') {
          this.emit('container_unhealthy', instance);
        }
        
        this.emit('health_check', { instance, health });
      } catch (error) {
        this.emit('health_check_error', { instance, error });
      }
    }, healthCheck.interval * 1000);

    this.intervals.set(instance.id, interval);
  }

  /**
   * Stop monitoring container
   */
  stopMonitoring(instanceId: string): void {
    const interval = this.intervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(instanceId);
    }
  }

  private async checkContainerHealth(
    containerId: string,
    healthCheck: HealthCheckConfig
  ): Promise<'healthy' | 'unhealthy' | 'unknown'> {
    try {
      const response = await fetch(`http://localhost:${healthCheck.port}${healthCheck.path}`, {
        timeout: healthCheck.timeout * 1000
      });
      
      return response.ok ? 'healthy' : 'unhealthy';
    } catch {
      return 'unhealthy';
    }
  }
}

/**
 * Scaling Controller
 * Handles automatic scaling based on metrics and rules
 */
class ScalingController extends EventEmitter {
  private containerManager: ContainerManager;
  private deployments = new Map<string, ContainerInstance[]>();

  constructor(containerManager: ContainerManager) {
    super();
    this.containerManager = containerManager;
  }

  /**
   * Add deployment for scaling management
   */
  addDeployment(deploymentId: string, instances: ContainerInstance[]): void {
    this.deployments.set(deploymentId, instances);
  }

  /**
   * Scale deployment based on rules
   */
  async scaleDeployment(
    deploymentId: string,
    targetReplicas: number,
    agentDef: AgentDefinition
  ): Promise<void> {
    try {
      const instances = this.deployments.get(deploymentId) || [];
      const currentReplicas = instances.length;

      if (targetReplicas > currentReplicas) {
        // Scale up
        await this.scaleUp(deploymentId, targetReplicas - currentReplicas, agentDef);
      } else if (targetReplicas < currentReplicas) {
        // Scale down
        await this.scaleDown(deploymentId, currentReplicas - targetReplicas);
      }

      this.emit('deployment_scaled', { deploymentId, targetReplicas });
    } catch (error) {
      throw new DeploymentError(
        'Failed to scale deployment',
        'SCALING_ERROR',
        deploymentId,
        error as Error
      );
    }
  }

  private async scaleUp(
    deploymentId: string,
    count: number,
    agentDef: AgentDefinition
  ): Promise<void> {
    const instances = this.deployments.get(deploymentId) || [];
    
    for (let i = 0; i < count; i++) {
      const instance = await this.containerManager.createContainer(
        agentDef,
        deploymentId,
        {}
      );
      instances.push(instance);
    }
    
    this.deployments.set(deploymentId, instances);
  }

  private async scaleDown(deploymentId: string, count: number): Promise<void> {
    const instances = this.deployments.get(deploymentId) || [];
    
    for (let i = 0; i < count && instances.length > 0; i++) {
      const instance = instances.pop()!;
      await this.containerManager.removeContainer(instance.containerId);
    }
    
    this.deployments.set(deploymentId, instances);
  }
}

/**
 * Resource Manager
 * Manages resource allocation and limits
 */
class ResourceManager {
  private totalResources: ResourceRequirements;
  private usedResources: ResourceRequirements;

  constructor(totalResources: ResourceRequirements) {
    this.totalResources = totalResources;
    this.usedResources = { cpu: '0', memory: '0', storage: '0' };
  }

  /**
   * Check if resources are available
   */
  canAllocate(required: ResourceRequirements): boolean {
    const availableCpu = this.parseResource(this.totalResources.cpu) - 
                        this.parseResource(this.usedResources.cpu);
    const availableMemory = this.parseResource(this.totalResources.memory) - 
                           this.parseResource(this.usedResources.memory);
    const availableStorage = this.parseResource(this.totalResources.storage) - 
                            this.parseResource(this.usedResources.storage);

    return (
      this.parseResource(required.cpu) <= availableCpu &&
      this.parse