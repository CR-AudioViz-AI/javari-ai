```typescript
/**
 * Kubernetes Auto-Scaling Service
 * 
 * Provides intelligent auto-scaling for Kubernetes deployments based on custom metrics
 * including queue depth, response time, and business KPIs.
 * 
 * @fileoverview Complete service for managing Kubernetes auto-scaling operations
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import * as k8s from '@kubernetes/client-node';
import { PrometheusApi } from 'prom-client';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// ================================
// Types and Interfaces
// ================================

/**
 * Custom metrics for scaling decisions
 */
interface CustomMetric {
  name: string;
  value: number;
  timestamp: Date;
  source: 'queue' | 'response_time' | 'business_kpi' | 'system';
  labels: Record<string, string>;
  unit: string;
}

/**
 * Scaling decision configuration
 */
interface ScalingPolicy {
  id: string;
  deployment: string;
  namespace: string;
  minReplicas: number;
  maxReplicas: number;
  metrics: ScalingMetricConfig[];
  cooldownPeriod: number;
  scaleUpStabilization: number;
  scaleDownStabilization: number;
  enabled: boolean;
}

/**
 * Metric configuration for scaling
 */
interface ScalingMetricConfig {
  name: string;
  type: 'resource' | 'custom' | 'external';
  targetType: 'utilization' | 'averageValue' | 'value';
  targetValue: number;
  weight: number;
  query?: string;
}

/**
 * Scaling decision result
 */
interface ScalingDecision {
  deployment: string;
  namespace: string;
  currentReplicas: number;
  desiredReplicas: number;
  reason: string;
  metrics: CustomMetric[];
  timestamp: Date;
  confidence: number;
}

/**
 * Auto-scaling event
 */
interface ScalingEvent {
  id: string;
  type: 'scale_up' | 'scale_down' | 'no_change' | 'error';
  deployment: string;
  namespace: string;
  oldReplicas: number;
  newReplicas: number;
  reason: string;
  metrics: CustomMetric[];
  timestamp: Date;
  duration?: number;
}

/**
 * HPA configuration
 */
interface HPAConfig {
  name: string;
  namespace: string;
  targetRef: {
    apiVersion: string;
    kind: string;
    name: string;
  };
  minReplicas: number;
  maxReplicas: number;
  metrics: k8s.V2MetricSpec[];
  behavior?: k8s.V2HPAScalingRules;
}

/**
 * Service configuration
 */
interface KubernetesAutoScalingConfig {
  kubeconfig?: string;
  prometheusUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
  metricsCollectionInterval: number;
  scalingEvaluationInterval: number;
  customMetricsPort: number;
  alertWebhookUrl?: string;
  dashboardPort: number;
  enableRealTimeEvents: boolean;
  defaultCooldownPeriod: number;
  maxScalingVelocity: number;
}

/**
 * Deployment status
 */
interface DeploymentStatus {
  name: string;
  namespace: string;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  conditions: k8s.V1DeploymentCondition[];
  lastScalingEvent?: Date;
}

// ================================
// Core Service Implementation
// ================================

/**
 * Kubernetes Auto-Scaling Service
 * 
 * Provides intelligent auto-scaling capabilities for Kubernetes deployments
 * based on custom metrics and business requirements.
 */
export class KubernetesAutoScalingService extends EventEmitter {
  private readonly config: KubernetesAutoScalingConfig;
  private readonly kubeClient: k8s.KubernetesApi;
  private readonly appsV1Api: k8s.AppsV1Api;
  private readonly autoscalingV2Api: k8s.AutoscalingV2Api;
  private readonly prometheusApi: PrometheusApi;
  private readonly supabase: any;
  private readonly scalingPolicies: Map<string, ScalingPolicy> = new Map();
  private readonly activeHPAs: Map<string, HPAConfig> = new Map();
  private readonly deploymentStatuses: Map<string, DeploymentStatus> = new Map();
  private readonly metricsCache: Map<string, CustomMetric[]> = new Map();
  private readonly scalingHistory: Map<string, ScalingEvent[]> = new Map();
  
  private metricsCollectionTimer?: NodeJS.Timer;
  private scalingEvaluationTimer?: NodeJS.Timer;
  private wsServer?: WebSocket.Server;
  private isRunning = false;

  constructor(config: KubernetesAutoScalingConfig) {
    super();
    this.config = config;

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig();
    if (config.kubeconfig) {
      kc.loadFromFile(config.kubeconfig);
    } else {
      kc.loadFromDefault();
    }

    this.kubeClient = kc.makeApiClient(k8s.KubernetesApi);
    this.appsV1Api = kc.makeApiClient(k8s.AppsV1Api);
    this.autoscalingV2Api = kc.makeApiClient(k8s.AutoscalingV2Api);

    // Initialize Prometheus client
    this.prometheusApi = new PrometheusApi({
      endpoint: config.prometheusUrl,
    });

    // Initialize Supabase client
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);

    this.setupEventHandlers();
  }

  /**
   * Start the auto-scaling service
   */
  public async start(): Promise<void> {
    try {
      if (this.isRunning) {
        throw new Error('Service is already running');
      }

      console.log('Starting Kubernetes Auto-Scaling Service...');

      // Initialize database tables
      await this.initializeDatabase();

      // Load scaling policies
      await this.loadScalingPolicies();

      // Start metrics collection
      await this.startMetricsCollection();

      // Start scaling evaluation
      await this.startScalingEvaluation();

      // Start real-time events if enabled
      if (this.config.enableRealTimeEvents) {
        await this.startWebSocketServer();
      }

      // Perform initial deployment scan
      await this.scanDeployments();

      this.isRunning = true;
      this.emit('serviceStarted');

      console.log('Kubernetes Auto-Scaling Service started successfully');
    } catch (error) {
      console.error('Failed to start service:', error);
      throw error;
    }
  }

  /**
   * Stop the auto-scaling service
   */
  public async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        return;
      }

      console.log('Stopping Kubernetes Auto-Scaling Service...');

      // Stop timers
      if (this.metricsCollectionTimer) {
        clearInterval(this.metricsCollectionTimer);
      }

      if (this.scalingEvaluationTimer) {
        clearInterval(this.scalingEvaluationTimer);
      }

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      this.isRunning = false;
      this.emit('serviceStopped');

      console.log('Kubernetes Auto-Scaling Service stopped');
    } catch (error) {
      console.error('Error stopping service:', error);
      throw error;
    }
  }

  // ================================
  // Metrics Collection
  // ================================

  /**
   * Start metrics collection process
   */
  private async startMetricsCollection(): Promise<void> {
    await this.collectMetrics(); // Initial collection

    this.metricsCollectionTimer = setInterval(
      () => this.collectMetrics().catch(console.error),
      this.config.metricsCollectionInterval
    );
  }

  /**
   * Collect all metrics for scaling decisions
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: CustomMetric[] = [];

      // Collect queue depth metrics
      const queueMetrics = await this.collectQueueMetrics();
      metrics.push(...queueMetrics);

      // Collect response time metrics
      const responseTimeMetrics = await this.collectResponseTimeMetrics();
      metrics.push(...responseTimeMetrics);

      // Collect business KPI metrics
      const businessMetrics = await this.collectBusinessKPIs();
      metrics.push(...businessMetrics);

      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      metrics.push(...systemMetrics);

      // Update metrics cache
      const timestamp = new Date().toISOString();
      this.metricsCache.set(timestamp, metrics);

      // Clean old metrics (keep last 24 hours)
      await this.cleanOldMetrics();

      this.emit('metricsCollected', { metrics, timestamp });
    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.emit('metricsCollectionError', error);
    }
  }

  /**
   * Collect queue depth metrics from message brokers
   */
  private async collectQueueMetrics(): Promise<CustomMetric[]> {
    const metrics: CustomMetric[] = [];

    try {
      // Query Prometheus for queue depth metrics
      const query = 'sum by (queue, service) (rabbitmq_queue_messages + redis_list_length)';
      const result = await this.prometheusApi.query({ query });

      for (const series of result.data.result) {
        metrics.push({
          name: 'queue_depth',
          value: parseFloat(series.value[1]),
          timestamp: new Date(),
          source: 'queue',
          labels: series.metric,
          unit: 'messages'
        });
      }
    } catch (error) {
      console.error('Error collecting queue metrics:', error);
    }

    return metrics;
  }

  /**
   * Collect response time metrics from applications
   */
  private async collectResponseTimeMetrics(): Promise<CustomMetric[]> {
    const metrics: CustomMetric[] = [];

    try {
      // Query Prometheus for response time metrics
      const queries = [
        'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
        'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))',
        'rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])'
      ];

      for (const query of queries) {
        const result = await this.prometheusApi.query({ query });
        
        for (const series of result.data.result) {
          const metricName = query.includes('0.95') ? 'response_time_p95' :
                           query.includes('0.99') ? 'response_time_p99' : 'response_time_avg';
          
          metrics.push({
            name: metricName,
            value: parseFloat(series.value[1]) * 1000, // Convert to milliseconds
            timestamp: new Date(),
            source: 'response_time',
            labels: series.metric,
            unit: 'milliseconds'
          });
        }
      }
    } catch (error) {
      console.error('Error collecting response time metrics:', error);
    }

    return metrics;
  }

  /**
   * Collect business KPI metrics from database
   */
  private async collectBusinessKPIs(): Promise<CustomMetric[]> {
    const metrics: CustomMetric[] = [];

    try {
      // Query business KPIs from Supabase
      const { data: kpis, error } = await this.supabase
        .from('business_kpis')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (error) throw error;

      for (const kpi of kpis) {
        metrics.push({
          name: kpi.name,
          value: kpi.value,
          timestamp: new Date(kpi.timestamp),
          source: 'business_kpi',
          labels: kpi.labels || {},
          unit: kpi.unit || 'count'
        });
      }
    } catch (error) {
      console.error('Error collecting business KPIs:', error);
    }

    return metrics;
  }

  /**
   * Collect system metrics from Kubernetes and Prometheus
   */
  private async collectSystemMetrics(): Promise<CustomMetric[]> {
    const metrics: CustomMetric[] = [];

    try {
      // CPU and memory metrics
      const cpuQuery = 'sum by (pod, namespace) (rate(container_cpu_usage_seconds_total[5m]))';
      const memoryQuery = 'sum by (pod, namespace) (container_memory_working_set_bytes)';

      const [cpuResult, memoryResult] = await Promise.all([
        this.prometheusApi.query({ query: cpuQuery }),
        this.prometheusApi.query({ query: memoryQuery })
      ]);

      // Process CPU metrics
      for (const series of cpuResult.data.result) {
        metrics.push({
          name: 'cpu_usage',
          value: parseFloat(series.value[1]),
          timestamp: new Date(),
          source: 'system',
          labels: series.metric,
          unit: 'cores'
        });
      }

      // Process memory metrics
      for (const series of memoryResult.data.result) {
        metrics.push({
          name: 'memory_usage',
          value: parseFloat(series.value[1]) / (1024 * 1024 * 1024), // Convert to GB
          timestamp: new Date(),
          source: 'system',
          labels: series.metric,
          unit: 'GB'
        });
      }
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }

    return metrics;
  }

  // ================================
  // Scaling Decision Engine
  // ================================

  /**
   * Start scaling evaluation process
   */
  private async startScalingEvaluation(): Promise<void> {
    await this.evaluateScaling(); // Initial evaluation

    this.scalingEvaluationTimer = setInterval(
      () => this.evaluateScaling().catch(console.error),
      this.config.scalingEvaluationInterval
    );
  }

  /**
   * Evaluate scaling decisions for all managed deployments
   */
  private async evaluateScaling(): Promise<void> {
    try {
      const decisions: ScalingDecision[] = [];

      for (const [policyId, policy] of this.scalingPolicies) {
        if (!policy.enabled) continue;

        const decision = await this.evaluateDeploymentScaling(policy);
        if (decision) {
          decisions.push(decision);
        }
      }

      // Apply scaling decisions
      for (const decision of decisions) {
        await this.applyScalingDecision(decision);
      }

      this.emit('scalingEvaluated', { decisions, timestamp: new Date() });
    } catch (error) {
      console.error('Error evaluating scaling:', error);
      this.emit('scalingEvaluationError', error);
    }
  }

  /**
   * Evaluate scaling decision for a specific deployment
   */
  private async evaluateDeploymentScaling(policy: ScalingPolicy): Promise<ScalingDecision | null> {
    try {
      // Get current deployment status
      const deployment = await this.getDeploymentStatus(policy.deployment, policy.namespace);
      if (!deployment) return null;

      // Get relevant metrics
      const metrics = await this.getRelevantMetrics(policy);
      if (metrics.length === 0) return null;

      // Calculate scaling score
      const scalingScore = await this.calculateScalingScore(policy, metrics);
      
      // Determine desired replica count
      const desiredReplicas = await this.calculateDesiredReplicas(
        policy,
        deployment.replicas,
        scalingScore
      );

      // Check if scaling is needed
      if (desiredReplicas === deployment.replicas) {
        return null;
      }

      // Check cooldown period
      if (await this.isInCooldownPeriod(policy.deployment, policy.namespace)) {
        return null;
      }

      return {
        deployment: policy.deployment,
        namespace: policy.namespace,
        currentReplicas: deployment.replicas,
        desiredReplicas,
        reason: this.generateScalingReason(scalingScore, metrics),
        metrics,
        timestamp: new Date(),
        confidence: Math.min(Math.abs(scalingScore) / 100, 1.0)
      };
    } catch (error) {
      console.error(`Error evaluating scaling for ${policy.deployment}:`, error);
      return null;
    }
  }

  /**
   * Calculate scaling score based on metrics and policy
   */
  private async calculateScalingScore(
    policy: ScalingPolicy,
    metrics: CustomMetric[]
  ): Promise<number> {
    let totalScore = 0;
    let totalWeight = 0;

    for (const metricConfig of policy.metrics) {
      const relevantMetrics = metrics.filter(m => m.name === metricConfig.name);
      if (relevantMetrics.length === 0) continue;

      // Calculate average value for the metric
      const avgValue = relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length;
      
      // Calculate deviation from target
      let deviation = 0;
      switch (metricConfig.targetType) {
        case 'utilization':
          deviation = (avgValue / metricConfig.targetValue - 1) * 100;
          break;
        case 'averageValue':
        case 'value':
          deviation = (avgValue - metricConfig.targetValue) / metricConfig.targetValue * 100;
          break;
      }

      // Apply weight and accumulate
      totalScore += deviation * metricConfig.weight;
      totalWeight += metricConfig.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate desired replica count based on scaling score
   */
  private async calculateDesiredReplicas(
    policy: ScalingPolicy,
    currentReplicas: number,
    scalingScore: number
  ): Promise<number> {
    // Determine scaling direction and magnitude
    const scalingFactor = Math.abs(scalingScore) / 100;
    const scalingDirection = scalingScore > 0 ? 1 : -1;

    // Calculate replica change
    let replicaChange = Math.ceil(currentReplicas * scalingFactor * scalingDirection);
    
    // Apply maximum scaling velocity
    const maxChange = Math.ceil(currentReplicas * this.config.maxScalingVelocity);
    replicaChange = Math.max(-maxChange, Math.min(maxChange, replicaChange));

    // Calculate desired replicas
    let desiredReplicas = currentReplicas + replicaChange;

    // Apply min/max constraints
    desiredReplicas = Math.max(policy.minReplicas, Math.min(policy.maxReplicas, desiredReplicas));

    return desiredReplicas;
  }

  // ================================
  // Kubernetes Controller
  // ================================

  /**
   * Apply scaling decision to Kubernetes deployment
   */
  private async applyScalingDecision(decision: ScalingDecision): Promise<void> {
    try {
      const scalingEvent: ScalingEvent = {
        id: `scaling-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: decision.desiredReplicas > decision.currentReplicas ? 'scale_up' : 'scale_down',
        deployment: decision.deployment,
        namespace: decision.namespace,
        oldReplicas: decision.currentReplicas,
        newReplicas: decision.desiredReplicas,
        reason: decision.reason,
        metrics: decision.metrics,
        timestamp: new Date()
      };

      // Scale the deployment
      await this.scaleDeployment(
        decision.deployment,
        decision.namespace,
        decision.desiredReplicas
      );

      // Record scaling event
      await this.recordScalingEvent(scalingEvent);

      // Update HPA if exists
      await this.updateHPAIfExists(decision);

      // Send real-time update
      this.broadcastScalingEvent(scalingEvent);

      this.emit('scalingApplied', scalingEvent);
      
      console.log(
        `Scaled ${decision.deployment}/${decision.namespace} from ${decision.currentReplicas} to ${decision.desiredReplicas} replicas`
      );
    } catch (error) {
      const errorEvent: ScalingEvent = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'error',
        deployment: decision.deployment,
        namespace: decision.namespace,
        oldReplicas: decision.currentReplicas,
        newReplicas: decision.currentReplicas,
        reason: `Error: ${error.message}`,
        metrics: decision.metrics,
        timestamp: new Date()
      };

      await this.recordScalingEvent(errorEvent);
      this.emit('scalingError', { decision, error });
      
      console.error(`Failed to scale ${decision.deployment}:`, error);
    }
  }

  /**
   * Scale Kubernetes deployment
   */
  private async scaleDeployment(
    name: string,
    namespace: string,
    replicas: number
  ): Promise<void> {
    const patch = {
      spec: {
        replicas
      }
    };

    await this.appsV1Api.patchNamespacedDeploymentScale(
      name,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        headers: {
          'Content-Type': 'application/merge-patch+json'
        }
      }
    );
  }

  // ================================
  // HPA Management
  // ================================

  /**
   * Create or update HPA for deployment
   */
  public async createOrUpdateHPA(config: HPAConfig): Promise<void> {
    try {
      const hpaSpec: k8s.V2HorizontalPodAutoscaler = {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
          name: config.name,
          namespace: config.namespace
        },
        spec: {
          scaleTargetRef: config.targetRef,
          minReplicas: config.minRepl