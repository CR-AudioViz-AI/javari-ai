```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

/**
 * Canary deployment configuration
 */
export interface CanaryConfig {
  /** Deployment name identifier */
  name: string;
  /** Container image for canary version */
  image: string;
  /** Target namespace */
  namespace: string;
  /** Traffic split percentages for each phase */
  trafficSplitPhases: number[];
  /** Duration for each phase in minutes */
  phaseDurations: number[];
  /** Success rate threshold (0-1) */
  successRateThreshold: number;
  /** Latency threshold in milliseconds */
  latencyThreshold: number;
  /** Error rate threshold (0-1) */
  errorRateThreshold: number;
  /** Enable ML-based anomaly detection */
  enableAnomalyDetection: boolean;
  /** Notification channels */
  notificationChannels: NotificationChannel[];
}

/**
 * Deployment metrics snapshot
 */
export interface DeploymentMetrics {
  /** Timestamp of metrics collection */
  timestamp: Date;
  /** Request success rate (0-1) */
  successRate: number;
  /** Average response time in ms */
  avgLatency: number;
  /** P95 response time in ms */
  p95Latency: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Requests per second */
  requestsPerSecond: number;
  /** CPU utilization (0-1) */
  cpuUtilization: number;
  /** Memory utilization (0-1) */
  memoryUtilization: number;
  /** Custom metrics */
  customMetrics?: Record<string, number>;
}

/**
 * Deployment state information
 */
export interface DeploymentState {
  /** Deployment identifier */
  id: string;
  /** Current deployment phase */
  phase: DeploymentPhase;
  /** Current traffic split percentage */
  currentTrafficSplit: number;
  /** Deployment start time */
  startTime: Date;
  /** Phase start time */
  phaseStartTime: Date;
  /** Canary pod count */
  canaryPods: number;
  /** Production pod count */
  productionPods: number;
  /** Current metrics */
  currentMetrics?: DeploymentMetrics;
  /** Deployment status */
  status: DeploymentStatus;
  /** Status message */
  message: string;
}

/**
 * Deployment phases
 */
export enum DeploymentPhase {
  INITIALIZING = 'initializing',
  CANARY_10 = 'canary_10',
  CANARY_25 = 'canary_25',
  CANARY_50 = 'canary_50',
  CANARY_75 = 'canary_75',
  FULL_ROLLOUT = 'full_rollout',
  ROLLING_BACK = 'rolling_back',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Deployment status
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back'
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  /** Channel type */
  type: 'slack' | 'discord' | 'email' | 'webhook';
  /** Channel endpoint/webhook URL */
  endpoint: string;
  /** Channel-specific configuration */
  config?: Record<string, any>;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  /** Whether anomaly was detected */
  isAnomaly: boolean;
  /** Anomaly confidence score (0-1) */
  confidence: number;
  /** Detected anomaly type */
  anomalyType: string;
  /** Metrics that triggered anomaly */
  triggerMetrics: string[];
  /** Recommended action */
  recommendedAction: 'continue' | 'pause' | 'rollback';
}

/**
 * Traffic splitting strategy
 */
export interface TrafficSplitStrategy {
  /** Strategy type */
  type: 'weighted' | 'header-based' | 'geo-based';
  /** Strategy configuration */
  config: Record<string, any>;
}

/**
 * Rollback execution result
 */
export interface RollbackResult {
  /** Whether rollback was successful */
  success: boolean;
  /** Rollback duration in seconds */
  duration: number;
  /** Final traffic split after rollback */
  finalTrafficSplit: number;
  /** Error message if rollback failed */
  error?: string;
}

/**
 * Kubernetes pod management interface
 */
export interface KubernetesPodManager {
  createCanaryPods(namespace: string, image: string, replicas: number): Promise<string[]>;
  deleteCanaryPods(namespace: string, podIds: string[]): Promise<void>;
  scalePods(namespace: string, deployment: string, replicas: number): Promise<void>;
  getPodMetrics(namespace: string, podIds: string[]): Promise<DeploymentMetrics>;
}

/**
 * Traffic splitting interface
 */
export interface TrafficSplitter {
  updateTrafficSplit(namespace: string, deployment: string, percentage: number): Promise<void>;
  getTrafficSplit(namespace: string, deployment: string): Promise<number>;
  resetTrafficSplit(namespace: string, deployment: string): Promise<void>;
}

/**
 * Metrics collector interface
 */
export interface MetricsCollector {
  collectMetrics(namespace: string, deployment: string): Promise<DeploymentMetrics>;
  getHistoricalMetrics(namespace: string, deployment: string, duration: number): Promise<DeploymentMetrics[]>;
  subscribeToMetrics(namespace: string, deployment: string, callback: (metrics: DeploymentMetrics) => void): Promise<string>;
  unsubscribeFromMetrics(subscriptionId: string): Promise<void>;
}

/**
 * Anomaly detector interface
 */
export interface AnomalyDetector {
  detectAnomalies(currentMetrics: DeploymentMetrics, historicalMetrics: DeploymentMetrics[]): Promise<AnomalyResult>;
  trainModel(namespace: string, deployment: string): Promise<void>;
  updateThresholds(config: CanaryConfig): Promise<void>;
}

/**
 * Notification dispatcher interface
 */
export interface NotificationDispatcher {
  sendDeploymentStarted(config: CanaryConfig, state: DeploymentState): Promise<void>;
  sendPhaseChanged(config: CanaryConfig, state: DeploymentState, previousPhase: DeploymentPhase): Promise<void>;
  sendMetricsAlert(config: CanaryConfig, state: DeploymentState, metrics: DeploymentMetrics): Promise<void>;
  sendRollbackInitiated(config: CanaryConfig, state: DeploymentState, reason: string): Promise<void>;
  sendDeploymentCompleted(config: CanaryConfig, state: DeploymentState, success: boolean): Promise<void>;
}

/**
 * Intelligent Canary Deployment Service
 * 
 * Orchestrates gradual rollouts with automated monitoring and rollback capabilities.
 * Uses ML-driven anomaly detection and configurable success thresholds.
 * 
 * @example
 * ```typescript
 * const deploymentService = new CanaryDeploymentService(supabase, {
 *   podManager,
 *   trafficSplitter,
 *   metricsCollector,
 *   anomalyDetector,
 *   notificationDispatcher
 * });
 * 
 * const config: CanaryConfig = {
 *   name: 'audio-processor-v2',
 *   image: 'registry.io/audio-processor:v2.1.0',
 *   namespace: 'production',
 *   trafficSplitPhases: [10, 25, 50, 75, 100],
 *   phaseDurations: [5, 10, 15, 20, 30],
 *   successRateThreshold: 0.99,
 *   latencyThreshold: 500,
 *   errorRateThreshold: 0.01,
 *   enableAnomalyDetection: true,
 *   notificationChannels: [{ type: 'slack', endpoint: 'webhook-url' }]
 * };
 * 
 * const deploymentId = await deploymentService.startCanaryDeployment(config);
 * ```
 */
export class CanaryDeploymentService extends EventEmitter {
  private readonly supabase: SupabaseClient;
  private readonly podManager: KubernetesPodManager;
  private readonly trafficSplitter: TrafficSplitter;
  private readonly metricsCollector: MetricsCollector;
  private readonly anomalyDetector: AnomalyDetector;
  private readonly notificationDispatcher: NotificationDispatcher;
  
  private activeDeployments = new Map<string, {
    config: CanaryConfig;
    state: DeploymentState;
    phaseTimer?: NodeJS.Timeout;
    metricsSubscription?: string;
  }>();

  constructor(
    supabase: SupabaseClient,
    dependencies: {
      podManager: KubernetesPodManager;
      trafficSplitter: TrafficSplitter;
      metricsCollector: MetricsCollector;
      anomalyDetector: AnomalyDetector;
      notificationDispatcher: NotificationDispatcher;
    }
  ) {
    super();
    this.supabase = supabase;
    this.podManager = dependencies.podManager;
    this.trafficSplitter = dependencies.trafficSplitter;
    this.metricsCollector = dependencies.metricsCollector;
    this.anomalyDetector = dependencies.anomalyDetector;
    this.notificationDispatcher = dependencies.notificationDispatcher;

    this.setupRealtimeSubscriptions();
  }

  /**
   * Start a new canary deployment
   */
  public async startCanaryDeployment(config: CanaryConfig): Promise<string> {
    try {
      const deploymentId = this.generateDeploymentId(config.name);
      
      // Validate configuration
      this.validateConfig(config);
      
      // Initialize deployment state
      const state: DeploymentState = {
        id: deploymentId,
        phase: DeploymentPhase.INITIALIZING,
        currentTrafficSplit: 0,
        startTime: new Date(),
        phaseStartTime: new Date(),
        canaryPods: 0,
        productionPods: 0,
        status: DeploymentStatus.PENDING,
        message: 'Initializing canary deployment'
      };

      // Store deployment state
      await this.saveDeploymentState(state);
      
      // Cache active deployment
      this.activeDeployments.set(deploymentId, { config, state });

      // Start deployment process
      await this.initializeCanaryDeployment(deploymentId);
      
      // Send notification
      await this.notificationDispatcher.sendDeploymentStarted(config, state);

      this.emit('deploymentStarted', { deploymentId, config, state });
      
      return deploymentId;
    } catch (error) {
      const errorMessage = `Failed to start canary deployment: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(errorMessage);
    }
  }

  /**
   * Initialize canary deployment infrastructure
   */
  private async initializeCanaryDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

    const { config, state } = deployment;

    try {
      // Update anomaly detector thresholds
      if (config.enableAnomalyDetection) {
        await this.anomalyDetector.updateThresholds(config);
      }

      // Create initial canary pods (small percentage)
      const canaryReplicas = Math.max(1, Math.ceil(3 * config.trafficSplitPhases[0] / 100));
      const canaryPods = await this.podManager.createCanaryPods(
        config.namespace,
        config.image,
        canaryReplicas
      );

      // Update state
      state.canaryPods = canaryPods.length;
      state.phase = DeploymentPhase.CANARY_10;
      state.status = DeploymentStatus.RUNNING;
      state.message = `Created ${canaryPods.length} canary pods`;
      state.phaseStartTime = new Date();

      await this.saveDeploymentState(state);

      // Start metrics monitoring
      await this.startMetricsMonitoring(deploymentId);

      // Schedule first phase progression
      this.schedulePhaseProgression(deploymentId, 0);

    } catch (error) {
      state.status = DeploymentStatus.FAILED;
      state.message = `Initialization failed: ${error instanceof Error ? error.message : String(error)}`;
      await this.saveDeploymentState(state);
      throw error;
    }
  }

  /**
   * Progress to next deployment phase
   */
  private async progressToNextPhase(deploymentId: string, currentPhaseIndex: number): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    const { config, state } = deployment;
    const nextPhaseIndex = currentPhaseIndex + 1;

    try {
      // Check if we've completed all phases
      if (nextPhaseIndex >= config.trafficSplitPhases.length) {
        await this.completeDeployment(deploymentId);
        return;
      }

      // Collect current metrics for evaluation
      const currentMetrics = await this.metricsCollector.collectMetrics(
        config.namespace,
        config.name
      );

      // Evaluate metrics and anomalies
      const shouldContinue = await this.evaluateDeploymentHealth(
        deploymentId,
        currentMetrics
      );

      if (!shouldContinue) {
        await this.initiateRollback(deploymentId, 'Failed health evaluation');
        return;
      }

      // Update traffic split
      const newTrafficPercentage = config.trafficSplitPhases[nextPhaseIndex];
      await this.trafficSplitter.updateTrafficSplit(
        config.namespace,
        config.name,
        newTrafficPercentage
      );

      // Update state
      const previousPhase = state.phase;
      state.currentTrafficSplit = newTrafficPercentage;
      state.phase = this.getPhaseFromPercentage(newTrafficPercentage);
      state.phaseStartTime = new Date();
      state.message = `Progressed to ${newTrafficPercentage}% traffic split`;

      await this.saveDeploymentState(state);

      // Send notification
      await this.notificationDispatcher.sendPhaseChanged(config, state, previousPhase);

      // Schedule next phase
      if (nextPhaseIndex < config.trafficSplitPhases.length - 1) {
        this.schedulePhaseProgression(deploymentId, nextPhaseIndex);
      } else {
        // Final phase - complete deployment after duration
        this.scheduleDeploymentCompletion(deploymentId, nextPhaseIndex);
      }

      this.emit('phaseProgressed', { deploymentId, phase: state.phase, trafficSplit: newTrafficPercentage });

    } catch (error) {
      await this.initiateRollback(
        deploymentId,
        `Phase progression failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Evaluate deployment health metrics
   */
  private async evaluateDeploymentHealth(
    deploymentId: string,
    currentMetrics: DeploymentMetrics
  ): Promise<boolean> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return false;

    const { config } = deployment;

    // Basic threshold checks
    if (currentMetrics.successRate < config.successRateThreshold) {
      await this.notificationDispatcher.sendMetricsAlert(
        config,
        deployment.state,
        currentMetrics
      );
      return false;
    }

    if (currentMetrics.avgLatency > config.latencyThreshold) {
      await this.notificationDispatcher.sendMetricsAlert(
        config,
        deployment.state,
        currentMetrics
      );
      return false;
    }

    if (currentMetrics.errorRate > config.errorRateThreshold) {
      await this.notificationDispatcher.sendMetricsAlert(
        config,
        deployment.state,
        currentMetrics
      );
      return false;
    }

    // ML-based anomaly detection
    if (config.enableAnomalyDetection) {
      const historicalMetrics = await this.metricsCollector.getHistoricalMetrics(
        config.namespace,
        config.name,
        60 // Last 60 minutes
      );

      const anomalyResult = await this.anomalyDetector.detectAnomalies(
        currentMetrics,
        historicalMetrics
      );

      if (anomalyResult.isAnomaly && anomalyResult.recommendedAction === 'rollback') {
        await this.notificationDispatcher.sendMetricsAlert(
          config,
          deployment.state,
          currentMetrics
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Initiate deployment rollback
   */
  public async initiateRollback(deploymentId: string, reason: string): Promise<RollbackResult> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const { config, state } = deployment;
    const startTime = Date.now();

    try {
      // Update state
      state.status = DeploymentStatus.ROLLING_BACK;
      state.phase = DeploymentPhase.ROLLING_BACK;
      state.message = `Rolling back: ${reason}`;
      await this.saveDeploymentState(state);

      // Send rollback notification
      await this.notificationDispatcher.sendRollbackInitiated(config, state, reason);

      // Cancel phase timer
      if (deployment.phaseTimer) {
        clearTimeout(deployment.phaseTimer);
        deployment.phaseTimer = undefined;
      }

      // Restore traffic to production
      await this.trafficSplitter.resetTrafficSplit(config.namespace, config.name);

      // Remove canary pods
      const canaryPodIds = await this.getCanaryPodIds(config.namespace, config.name);
      if (canaryPodIds.length > 0) {
        await this.podManager.deleteCanaryPods(config.namespace, canaryPodIds);
      }

      // Update final state
      state.status = DeploymentStatus.ROLLED_BACK;
      state.phase = DeploymentPhase.FAILED;
      state.currentTrafficSplit = 0;
      state.canaryPods = 0;
      state.message = `Rollback completed: ${reason}`;
      await this.saveDeploymentState(state);

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Clean up
      await this.cleanupDeployment(deploymentId);

      const result: RollbackResult = {
        success: true,
        duration,
        finalTrafficSplit: 0
      };

      this.emit('deploymentRolledBack', { deploymentId, reason, result });

      return result;

    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      state.status = DeploymentStatus.FAILED;
      state.message = `Rollback failed: ${errorMessage}`;
      await this.saveDeploymentState(state);

      return {
        success: false,
        duration,
        finalTrafficSplit: state.currentTrafficSplit,
        error: errorMessage
      };
    }
  }

  /**
   * Complete successful deployment
   */
  private async completeDeployment(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    const { config, state } = deployment;

    try {
      // Update state
      state.status = DeploymentStatus.SUCCEEDED;
      state.phase = DeploymentPhase.COMPLETED;
      state.currentTrafficSplit = 100;
      state.message = 'Deployment completed successfully';
      await this.saveDeploymentState(state);

      // Send completion notification
      await this.notificationDispatcher.sendDeploymentCompleted(config, state, true);

      // Clean up
      await this.cleanupDeployment(deploymentId);

      this.emit('deploymentCompleted', { deploymentId, success: true });

    } catch (error) {
      state.status = DeploymentStatus.FAILED;
      state.message = `Completion failed: ${error instanceof Error ? error.message : String(error)}`;
      await this.saveDeploymentState(state);
      
      this.emit('deploymentCompleted', { deploymentId, success: false, error });
    }
  }

  /**
   * Start metrics monitoring for deployment
   */
  private async startMetricsMonitoring(deploymentId: string): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    const { config } = deployment;

    // Subscribe to real-time metrics
    const subscriptionId = await this.metricsCollector.subscribeToMetrics(
      config.namespace,
      config.name,
      (metrics: DeploymentMetrics) => {
        this.handleMetricsUpdate(deploymentId, metrics);
      }
    );

    deployment.metricsSubscription = subscriptionId;
  }

  /**
   * Handle real-time metrics update
   */
  private async handleMetricsUpdate(deploymentId: string, metrics: DeploymentMetrics): Promise<void> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) return;

    const { config, state } = deployment;

    // Update state with current metrics
    state.currentMetrics = metrics;
    await this.saveDeploymentState(state);

    // Check for immediate failures (circuit breaker pattern)
    const shouldStop = await this.checkCircuitBreaker(config, metrics);
    if (shouldStop) {
      await this.initiateRollback(deploymentId, 'Circuit breaker triggered');
      return;
    }

    this.emit('metricsUpdated', { deploymentId, metrics });
  }

  /**
   * Check circuit breaker conditions
   */
  private async checkCircuitBreaker(config: CanaryConfig, metrics: DeploymentMetrics): Promise<boolean> {
    // Immediate failure conditions
    if (metrics.errorRate > config.errorRateThreshold * 2) return true;
    if (metrics.successRate < config.successRateThreshold * 0