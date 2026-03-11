```typescript
import { EventEmitter } from 'events';
import { 
  ScalingEngine,
  ScalingConfiguration,
  ScalingMetrics,
  ScalingDecision,
  ScalingAction
} from './core/ScalingEngine';
import { 
  MetricsCollector,
  MetricDefinition,
  MetricValue,
  CollectorConfiguration
} from './core/MetricsCollector';
import {
  CostOptimizer,
  CostConfiguration,
  CostAnalysis,
  CostOptimizationRecommendation
} from './core/CostOptimizer';
import {
  AvailabilityManager,
  AvailabilityConfiguration,
  AvailabilityZone,
  FailoverPolicy
} from './core/AvailabilityManager';
import {
  CloudProviderAdapter,
  CloudProvider,
  ProviderCapabilities,
  ResourceConfiguration,
  ScalingOperationResult
} from './providers/CloudProviderAdapter';
import { AWSAdapter } from './providers/aws/AWSAdapter';
import { AzureAdapter } from './providers/azure/AzureAdapter';
import { GCPAdapter } from './providers/gcp/GCPAdapter';
import { DOAdapter } from './providers/digital-ocean/DOAdapter';
import { ScalingAPI } from './api/ScalingAPI';
import { 
  ScalingPolicyEngine,
  ScalingPolicy,
  PolicyEvaluationResult,
  PolicyCondition
} from './policies/ScalingPolicyEngine';
import { PolicyValidator } from './policies/PolicyValidator';
import { HealthChecker, HealthStatus } from './monitoring/HealthChecker';
import { AlertManager, Alert, AlertSeverity } from './monitoring/AlertManager';
import { ConfigStore } from './storage/ConfigStore';
import { MetricsStore } from './storage/MetricsStore';

/**
 * Configuration for the multi-cloud scaling framework
 */
export interface MultiCloudScalingConfig {
  /** Global scaling configuration */
  scaling: ScalingConfiguration;
  /** Metrics collection configuration */
  metrics: CollectorConfiguration;
  /** Cost optimization configuration */
  cost: CostConfiguration;
  /** Availability management configuration */
  availability: AvailabilityConfiguration;
  /** Cloud provider configurations */
  providers: Record<CloudProvider, any>;
  /** Storage configuration */
  storage: {
    configStore: string;
    metricsStore: string;
  };
  /** API configuration */
  api: {
    port: number;
    enableAuth: boolean;
    corsOrigins: string[];
  };
  /** Monitoring configuration */
  monitoring: {
    healthCheckInterval: number;
    alertThresholds: Record<string, number>;
  };
}

/**
 * Application configuration for scaling
 */
export interface ApplicationConfig {
  /** Application identifier */
  id: string;
  /** Application name */
  name: string;
  /** Scaling policies */
  policies: ScalingPolicy[];
  /** Resource requirements */
  resources: ResourceConfiguration;
  /** Availability requirements */
  availability: {
    minZones: number;
    maxDowntime: number;
    primaryProvider: CloudProvider;
    backupProviders: CloudProvider[];
  };
  /** Cost constraints */
  cost: {
    maxHourlyCost: number;
    preferredProviders: CloudProvider[];
    spotInstancesAllowed: boolean;
  };
}

/**
 * Scaling operation status
 */
export interface ScalingStatus {
  /** Operation ID */
  operationId: string;
  /** Application ID */
  applicationId: string;
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  /** Progress percentage */
  progress: number;
  /** Status message */
  message: string;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Associated scaling actions */
  actions: ScalingAction[];
  /** Error details if failed */
  error?: string;
}

/**
 * Multi-cloud scaling framework events
 */
export interface MultiCloudScalingEvents {
  'scaling-decision': (decision: ScalingDecision) => void;
  'scaling-started': (status: ScalingStatus) => void;
  'scaling-completed': (status: ScalingStatus) => void;
  'scaling-failed': (status: ScalingStatus, error: Error) => void;
  'cost-threshold-exceeded': (analysis: CostAnalysis) => void;
  'availability-degraded': (zones: AvailabilityZone[]) => void;
  'provider-error': (provider: CloudProvider, error: Error) => void;
  'health-check-failed': (applicationId: string, status: HealthStatus) => void;
  'alert-triggered': (alert: Alert) => void;
}

/**
 * Main multi-cloud auto-scaling framework class
 * Orchestrates scaling operations across multiple cloud providers
 */
export class MultiCloudAutoScaler extends EventEmitter {
  private readonly config: MultiCloudScalingConfig;
  private readonly scalingEngine: ScalingEngine;
  private readonly metricsCollector: MetricsCollector;
  private readonly costOptimizer: CostOptimizer;
  private readonly availabilityManager: AvailabilityManager;
  private readonly providers: Map<CloudProvider, CloudProviderAdapter>;
  private readonly policyEngine: ScalingPolicyEngine;
  private readonly policyValidator: PolicyValidator;
  private readonly healthChecker: HealthChecker;
  private readonly alertManager: AlertManager;
  private readonly configStore: ConfigStore;
  private readonly metricsStore: MetricsStore;
  private readonly api: ScalingAPI;
  private readonly applications: Map<string, ApplicationConfig>;
  private readonly scalingOperations: Map<string, ScalingStatus>;
  private isRunning: boolean;
  private scalingInterval?: NodeJS.Timeout;

  /**
   * Create a new multi-cloud auto-scaler instance
   * @param config - Framework configuration
   */
  constructor(config: MultiCloudScalingConfig) {
    super();
    
    this.config = config;
    this.applications = new Map();
    this.scalingOperations = new Map();
    this.isRunning = false;

    // Initialize storage
    this.configStore = new ConfigStore(config.storage.configStore);
    this.metricsStore = new MetricsStore(config.storage.metricsStore);

    // Initialize core components
    this.scalingEngine = new ScalingEngine(config.scaling, this.metricsStore);
    this.metricsCollector = new MetricsCollector(config.metrics, this.metricsStore);
    this.costOptimizer = new CostOptimizer(config.cost);
    this.availabilityManager = new AvailabilityManager(config.availability);

    // Initialize cloud providers
    this.providers = new Map();
    this.initializeProviders();

    // Initialize policy components
    this.policyEngine = new ScalingPolicyEngine();
    this.policyValidator = new PolicyValidator();

    // Initialize monitoring components
    this.healthChecker = new HealthChecker(config.monitoring.healthCheckInterval);
    this.alertManager = new AlertManager(config.monitoring.alertThresholds);

    // Initialize API
    this.api = new ScalingAPI(config.api, this);

    this.setupEventHandlers();
  }

  /**
   * Initialize cloud provider adapters
   */
  private initializeProviders(): void {
    try {
      if (this.config.providers.aws) {
        this.providers.set(CloudProvider.AWS, new AWSAdapter(this.config.providers.aws));
      }

      if (this.config.providers.azure) {
        this.providers.set(CloudProvider.AZURE, new AzureAdapter(this.config.providers.azure));
      }

      if (this.config.providers.gcp) {
        this.providers.set(CloudProvider.GCP, new GCPAdapter(this.config.providers.gcp));
      }

      if (this.config.providers.digitalocean) {
        this.providers.set(CloudProvider.DIGITAL_OCEAN, new DOAdapter(this.config.providers.digitalocean));
      }

      // Validate at least one provider is configured
      if (this.providers.size === 0) {
        throw new Error('No cloud providers configured');
      }

    } catch (error) {
      throw new Error(`Failed to initialize cloud providers: ${error}`);
    }
  }

  /**
   * Setup event handlers for internal components
   */
  private setupEventHandlers(): void {
    // Scaling engine events
    this.scalingEngine.on('decision', (decision: ScalingDecision) => {
      this.emit('scaling-decision', decision);
    });

    // Metrics collector events
    this.metricsCollector.on('metric-collected', (metric: MetricValue) => {
      this.handleMetricCollected(metric);
    });

    // Cost optimizer events
    this.costOptimizer.on('cost-threshold-exceeded', (analysis: CostAnalysis) => {
      this.emit('cost-threshold-exceeded', analysis);
    });

    // Availability manager events
    this.availabilityManager.on('availability-degraded', (zones: AvailabilityZone[]) => {
      this.emit('availability-degraded', zones);
    });

    // Health checker events
    this.healthChecker.on('health-check-failed', (appId: string, status: HealthStatus) => {
      this.emit('health-check-failed', appId, status);
    });

    // Alert manager events
    this.alertManager.on('alert', (alert: Alert) => {
      this.emit('alert-triggered', alert);
    });

    // Provider events
    this.providers.forEach((provider, providerType) => {
      provider.on('error', (error: Error) => {
        this.emit('provider-error', providerType, error);
      });
    });
  }

  /**
   * Start the auto-scaling framework
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Multi-cloud auto-scaler is already running');
    }

    try {
      // Initialize storage
      await this.configStore.initialize();
      await this.metricsStore.initialize();

      // Load existing applications
      await this.loadApplications();

      // Start core components
      await this.metricsCollector.start();
      await this.healthChecker.start();
      await this.alertManager.start();

      // Start API server
      await this.api.start();

      // Start scaling loop
      this.startScalingLoop();

      this.isRunning = true;

    } catch (error) {
      throw new Error(`Failed to start multi-cloud auto-scaler: ${error}`);
    }
  }

  /**
   * Stop the auto-scaling framework
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop scaling loop
      if (this.scalingInterval) {
        clearInterval(this.scalingInterval);
        this.scalingInterval = undefined;
      }

      // Stop API server
      await this.api.stop();

      // Stop monitoring components
      await this.alertManager.stop();
      await this.healthChecker.stop();

      // Stop metrics collection
      await this.metricsCollector.stop();

      // Close storage connections
      await this.metricsStore.close();
      await this.configStore.close();

      this.isRunning = false;

    } catch (error) {
      throw new Error(`Failed to stop multi-cloud auto-scaler: ${error}`);
    }
  }

  /**
   * Register an application for auto-scaling
   * @param appConfig - Application configuration
   */
  async registerApplication(appConfig: ApplicationConfig): Promise<void> {
    try {
      // Validate application configuration
      this.validateApplicationConfig(appConfig);

      // Validate scaling policies
      for (const policy of appConfig.policies) {
        await this.policyValidator.validate(policy);
      }

      // Store application configuration
      await this.configStore.saveApplication(appConfig);
      this.applications.set(appConfig.id, appConfig);

      // Register with health checker
      await this.healthChecker.registerApplication(appConfig.id, appConfig.resources);

    } catch (error) {
      throw new Error(`Failed to register application ${appConfig.id}: ${error}`);
    }
  }

  /**
   * Unregister an application
   * @param applicationId - Application ID
   */
  async unregisterApplication(applicationId: string): Promise<void> {
    try {
      const appConfig = this.applications.get(applicationId);
      if (!appConfig) {
        throw new Error(`Application ${applicationId} not found`);
      }

      // Cancel any ongoing scaling operations
      const ongoingOperations = Array.from(this.scalingOperations.values())
        .filter(op => op.applicationId === applicationId && 
                     ['pending', 'in_progress'].includes(op.status));

      for (const operation of ongoingOperations) {
        await this.cancelScalingOperation(operation.operationId);
      }

      // Unregister from health checker
      await this.healthChecker.unregisterApplication(applicationId);

      // Remove from storage
      await this.configStore.removeApplication(applicationId);
      this.applications.delete(applicationId);

    } catch (error) {
      throw new Error(`Failed to unregister application ${applicationId}: ${error}`);
    }
  }

  /**
   * Get scaling status for an application
   * @param applicationId - Application ID
   */
  getApplicationStatus(applicationId: string): ScalingStatus[] {
    return Array.from(this.scalingOperations.values())
      .filter(op => op.applicationId === applicationId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Trigger manual scaling for an application
   * @param applicationId - Application ID
   * @param targetInstances - Target instance count per provider
   */
  async triggerScaling(
    applicationId: string,
    targetInstances: Record<CloudProvider, number>
  ): Promise<string> {
    try {
      const appConfig = this.applications.get(applicationId);
      if (!appConfig) {
        throw new Error(`Application ${applicationId} not found`);
      }

      const operationId = this.generateOperationId();
      
      const scalingStatus: ScalingStatus = {
        operationId,
        applicationId,
        status: 'pending',
        progress: 0,
        message: 'Manual scaling operation initiated',
        startTime: new Date(),
        actions: []
      };

      this.scalingOperations.set(operationId, scalingStatus);

      // Execute scaling asynchronously
      this.executeScalingOperation(operationId, appConfig, targetInstances)
        .catch(error => {
          this.handleScalingError(operationId, error);
        });

      return operationId;

    } catch (error) {
      throw new Error(`Failed to trigger scaling for ${applicationId}: ${error}`);
    }
  }

  /**
   * Cancel a scaling operation
   * @param operationId - Operation ID
   */
  async cancelScalingOperation(operationId: string): Promise<void> {
    const operation = this.scalingOperations.get(operationId);
    if (!operation) {
      throw new Error(`Scaling operation ${operationId} not found`);
    }

    if (!['pending', 'in_progress'].includes(operation.status)) {
      throw new Error(`Cannot cancel scaling operation ${operationId} with status ${operation.status}`);
    }

    try {
      // Cancel ongoing provider operations
      for (const action of operation.actions) {
        if (action.status === 'in_progress') {
          const provider = this.providers.get(action.provider);
          if (provider) {
            await provider.cancelOperation(action.operationId);
          }
        }
      }

      operation.status = 'cancelled';
      operation.endTime = new Date();
      operation.message = 'Operation cancelled by user';

    } catch (error) {
      throw new Error(`Failed to cancel scaling operation ${operationId}: ${error}`);
    }
  }

  /**
   * Get current metrics for an application
   * @param applicationId - Application ID
   * @param timeRange - Time range in minutes
   */
  async getApplicationMetrics(
    applicationId: string,
    timeRange: number = 60
  ): Promise<Record<string, MetricValue[]>> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeRange * 60 * 1000);

      return await this.metricsStore.getMetrics(applicationId, startTime, endTime);

    } catch (error) {
      throw new Error(`Failed to get metrics for ${applicationId}: ${error}`);
    }
  }

  /**
   * Get cost analysis for an application
   * @param applicationId - Application ID
   * @param timeRange - Time range in hours
   */
  async getCostAnalysis(
    applicationId: string,
    timeRange: number = 24
  ): Promise<CostAnalysis> {
    try {
      const appConfig = this.applications.get(applicationId);
      if (!appConfig) {
        throw new Error(`Application ${applicationId} not found`);
      }

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeRange * 60 * 60 * 1000);

      return await this.costOptimizer.analyzeApplicationCosts(
        applicationId,
        startTime,
        endTime,
        this.providers
      );

    } catch (error) {
      throw new Error(`Failed to get cost analysis for ${applicationId}: ${error}`);
    }
  }

  /**
   * Start the main scaling loop
   */
  private startScalingLoop(): void {
    const intervalMs = this.config.scaling.evaluationIntervalMs || 60000;
    
    this.scalingInterval = setInterval(async () => {
      try {
        await this.evaluateScaling();
      } catch (error) {
        this.alertManager.createAlert({
          severity: AlertSeverity.ERROR,
          message: `Scaling evaluation error: ${error}`,
          source: 'MultiCloudAutoScaler',
          timestamp: new Date()
        });
      }
    }, intervalMs);
  }

  /**
   * Evaluate scaling decisions for all applications
   */
  private async evaluateScaling(): Promise<void> {
    for (const [applicationId, appConfig] of this.applications) {
      try {
        // Skip if there's an ongoing scaling operation
        const hasOngoingOperation = Array.from(this.scalingOperations.values())
          .some(op => op.applicationId === applicationId && 
                     ['pending', 'in_progress'].includes(op.status));

        if (hasOngoingOperation) {
          continue;
        }

        // Get current metrics
        const metrics = await this.getRecentMetrics(applicationId);
        
        // Evaluate scaling policies
        const policyResults = await Promise.all(
          appConfig.policies.map(policy => 
            this.policyEngine.evaluate(policy, metrics, appConfig)
          )
        );

        // Check if scaling is needed
        const scalingNeeded = policyResults.some(result => result.actionRequired);
        if (!scalingNeeded) {
          continue;
        }

        // Generate scaling decision
        const decision = await this.scalingEngine.makeDecision(
          applicationId,
          metrics,
          policyResults,
          appConfig
        );

        if (decision.actions.length > 0) {
          // Optimize decision with cost considerations
          const optimizedDecision = await this.costOptimizer.optimizeDecision(
            decision,
            appConfig.cost,
            this.providers
          );

          // Validate availability requirements
          await this.availabilityManager.validateDecision(
            optimizedDecision,
            appConfig.availability
          );

          // Execute scaling decision
          const operationId = this.generateOperationId();
          await this.executeScalingDecision(operationId, optimizedDecision, appConfig);
        }

      } catch (error) {
        this.alertManager.createAlert({
          severity: AlertSeverity.ERROR,
          message: `Failed to evaluate scaling for ${applicationId}: ${error}`,
          source: 'MultiCloudAutoScaler',
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Execute a scaling decision
   */
  private async executeScalingDecision(
    operationId: string,
    decision: ScalingDecision,
    appConfig: ApplicationConfig
  ): Promise<void> {
    const scalingStatus: ScalingStatus = {
      operationId,
      applicationId: appConfig.id,
      status: 'pending',
      progress: 0,
      message: 'Automated scaling operation initiated',
      startTime: new Date(),
      actions: decision.actions
    };

    this.scalingOperations.set(operationId, scalingStatus);
    this.emit('scaling-started', scalingStatus);

    try {
      scalingStatus.status = 'in_progress';
      scalingStatus.message = 'Executing scaling actions';

      const results = await Promise.allSettled(
        decision.actions.map(action => this.executeScalingAction(action))
      );

      // Check results
      const failures = results.filter(result => result.status === 'rejected');
      
      if (failures.length > 0) {
        throw new Error(`${failures.length} scaling actions failed`);
      }

      scalingStatus.status = 'completed';
      scalingStatus.progress = 100;
      scalingStatus.message = 'Scaling operation completed successfully';
      scalingStatus.endTime = new Date();

      this.emit('scaling-completed', scalingStatus);

    } catch (error) {
      this.handleScalingError(operationId, error);
    }
  }

  /**
   * Execute a single scaling action
   */
  private async executeScalingAction(action: ScalingAction): Promise<ScalingOperationResult> {
    const provider = this.providers.get(action.provider);
    if (!provider) {
      throw new Error(`Provider ${action.provider} not available`);
    }

    action.status = 'in_progress';
    action.startTime = new Date();

    try {
      const result = await provider.scaleApplication(
        action.applicationId,
        action.targetInstances,
        action.configuration
      );

      action.status = result.success ? 'completed' : 'failed';
      action.endTime = new Date();
      action.result = result;

      return result;

    } catch (error) {
      action.status = 'failed';
      action.endTime = new Date();
      action.error = error.message;
      throw error;
    }
  }

  /**
   * Execute scaling operation with specific target instances
   */
  private async executeScalingOperation(
    operationId: string,
    appConfig: ApplicationConfig,
    targetInstances: Record<CloudProvider, number>
  ): Promise<void> {
    const operation = this.scalingOperations.get(operationId)!;
    
    try {
      operation.status = 'in_progress';
      operation.message = 'Executing manual scaling operation';

      // Create scaling actions
      const actions: ScalingAction[] = [];