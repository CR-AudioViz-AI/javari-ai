```typescript
/**
 * Multi-Region Capacity Orchestration Service
 * 
 * Orchestrates capacity allocation across multiple geographic regions with
 * ML-driven demand forecasting, cost optimization, and disaster recovery capabilities.
 * 
 * @module MultiRegionOrchestrator
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';

/**
 * Geographic region configuration
 */
export interface RegionConfig {
  /** Region identifier (e.g., 'us-east-1', 'eu-west-1') */
  regionId: string;
  /** Human-readable region name */
  name: string;
  /** Cloud provider (aws, gcp, azure) */
  provider: 'aws' | 'gcp' | 'azure';
  /** Region priority for traffic routing (1-10, higher = more preferred) */
  priority: number;
  /** Maximum capacity allowed in this region */
  maxCapacity: number;
  /** Minimum capacity to maintain in this region */
  minCapacity: number;
  /** Cost per compute unit in USD */
  costPerUnit: number;
  /** Network latency to primary region in ms */
  latencyMs: number;
  /** Whether this region is enabled for disaster recovery */
  isDRCapable: boolean;
  /** Resource tags for cloud provider resources */
  tags: Record<string, string>;
}

/**
 * Current capacity metrics for a region
 */
export interface RegionMetrics {
  /** Region identifier */
  regionId: string;
  /** Current allocated capacity units */
  currentCapacity: number;
  /** Current utilization percentage (0-100) */
  utilizationPercent: number;
  /** Number of active instances/nodes */
  activeInstances: number;
  /** Average CPU usage across instances */
  avgCpuUsage: number;
  /** Average memory usage across instances */
  avgMemoryUsage: number;
  /** Network traffic in/out in MB/s */
  networkTraffic: { inMbps: number; outMbps: number };
  /** Health status of the region */
  healthStatus: 'healthy' | 'degraded' | 'critical' | 'offline';
  /** Last metrics update timestamp */
  lastUpdated: Date;
  /** Cost metrics in USD */
  costMetrics: {
    hourlyRate: number;
    dailySpend: number;
    monthlyProjection: number;
  };
}

/**
 * Demand forecast data structure
 */
export interface DemandForecast {
  /** Region identifier */
  regionId: string;
  /** Forecast timestamp */
  timestamp: Date;
  /** Predicted capacity needed */
  predictedCapacity: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Forecast horizon in hours */
  horizonHours: number;
  /** Seasonal patterns detected */
  seasonalFactors: {
    hourOfDay: number;
    dayOfWeek: number;
    monthOfYear: number;
  };
  /** Trend direction */
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Capacity allocation decision
 */
export interface AllocationDecision {
  /** Region identifier */
  regionId: string;
  /** Target capacity to allocate */
  targetCapacity: number;
  /** Current capacity */
  currentCapacity: number;
  /** Scaling action required */
  action: 'scale_up' | 'scale_down' | 'maintain' | 'emergency_scale';
  /** Priority of this decision (1-10, higher = more urgent) */
  priority: number;
  /** Cost impact in USD per hour */
  costImpact: number;
  /** Estimated completion time in minutes */
  estimatedCompletionTime: number;
  /** Reasoning for the decision */
  reasoning: string;
}

/**
 * Disaster recovery event
 */
export interface DisasterRecoveryEvent {
  /** Event identifier */
  eventId: string;
  /** Type of disaster */
  type: 'region_failure' | 'provider_outage' | 'network_partition' | 'capacity_exhaustion';
  /** Affected region */
  affectedRegion: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Event timestamp */
  timestamp: Date;
  /** Failover target regions */
  failoverRegions: string[];
  /** Estimated impact duration in minutes */
  estimatedDuration: number;
  /** Recovery actions taken */
  recoveryActions: string[];
  /** Current status */
  status: 'detected' | 'responding' | 'recovering' | 'resolved';
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Redis cluster configuration for state sync */
  redis: {
    hosts: string[];
    password?: string;
    keyPrefix: string;
  };
  /** Metrics collection interval in seconds */
  metricsInterval: number;
  /** Forecasting update interval in minutes */
  forecastInterval: number;
  /** Health check interval in seconds */
  healthCheckInterval: number;
  /** Cost optimization frequency in minutes */
  costOptimizationInterval: number;
  /** DR detection sensitivity (0-1, higher = more sensitive) */
  drSensitivity: number;
  /** Maximum concurrent scaling operations */
  maxConcurrentScaling: number;
  /** Enable ML-based demand forecasting */
  enableMLForecasting: boolean;
  /** Enable automated disaster recovery */
  enableAutomatedDR: boolean;
}

/**
 * Regional capacity manager interface
 */
export interface IRegionCapacityManager {
  /** Get current capacity metrics for a region */
  getCapacityMetrics(regionId: string): Promise<RegionMetrics>;
  /** Scale capacity in a region */
  scaleCapacity(regionId: string, targetCapacity: number): Promise<void>;
  /** Get available instance types and their costs */
  getAvailableInstanceTypes(regionId: string): Promise<Array<{ type: string; costPerHour: number; capacity: number }>>;
  /** Check if region can handle additional capacity */
  canScale(regionId: string, additionalCapacity: number): Promise<boolean>;
}

/**
 * Demand forecasting engine interface
 */
export interface IDemandForecastEngine {
  /** Generate demand forecast for a region */
  generateForecast(regionId: string, historicalData: RegionMetrics[]): Promise<DemandForecast>;
  /** Update ML models with new data */
  updateModels(trainingData: Array<{ metrics: RegionMetrics; actualDemand: number }>): Promise<void>;
  /** Get forecast accuracy metrics */
  getForecastAccuracy(): Promise<{ mape: number; rmse: number; accuracy: number }>;
}

/**
 * Cost optimization engine interface
 */
export interface ICostOptimizationEngine {
  /** Optimize allocation across regions for minimum cost */
  optimizeAllocation(
    currentMetrics: RegionMetrics[],
    forecasts: DemandForecast[],
    constraints: { maxLatency: number; minReliability: number }
  ): Promise<AllocationDecision[]>;
  /** Calculate cost savings from optimization */
  calculateSavings(currentAllocation: RegionMetrics[], optimizedAllocation: AllocationDecision[]): Promise<number>;
}

/**
 * Disaster recovery orchestrator interface
 */
export interface IDisasterRecoveryOrchestrator {
  /** Detect potential disaster scenarios */
  detectDisaster(metrics: RegionMetrics[]): Promise<DisasterRecoveryEvent | null>;
  /** Execute disaster recovery plan */
  executeRecovery(event: DisasterRecoveryEvent): Promise<void>;
  /** Get recovery status */
  getRecoveryStatus(eventId: string): Promise<DisasterRecoveryEvent>;
  /** Test disaster recovery capabilities */
  testRecoveryPlan(regionId: string): Promise<{ success: boolean; issues: string[] }>;
}

/**
 * Health monitor interface
 */
export interface IHealthMonitor {
  /** Check health of all regions */
  checkRegionHealth(): Promise<RegionMetrics[]>;
  /** Get health trends over time */
  getHealthTrends(regionId: string, hours: number): Promise<Array<{ timestamp: Date; healthScore: number }>>;
  /** Set up health alerts */
  configureAlerts(regionId: string, thresholds: { cpu: number; memory: number; latency: number }): Promise<void>;
}

/**
 * Multi-Region Capacity Orchestrator Service
 */
export class MultiRegionOrchestrator extends EventEmitter {
  private readonly regions: Map<string, RegionConfig> = new Map();
  private readonly regionMetrics: Map<string, RegionMetrics> = new Map();
  private readonly redis: Redis.Cluster;
  private readonly config: OrchestratorConfig;
  
  private metricsInterval?: NodeJS.Timeout;
  private forecastInterval?: NodeJS.Timeout;
  private healthInterval?: NodeJS.Timeout;
  private costOptimizationInterval?: NodeJS.Timeout;
  
  private isRunning = false;
  private scalingOperations = new Set<string>();

  constructor(
    private readonly regionCapacityManager: IRegionCapacityManager,
    private readonly demandForecastEngine: IDemandForecastEngine,
    private readonly costOptimizationEngine: ICostOptimizationEngine,
    private readonly drOrchestrator: IDisasterRecoveryOrchestrator,
    private readonly healthMonitor: IHealthMonitor,
    config: OrchestratorConfig
  ) {
    super();
    this.config = config;
    
    // Initialize Redis cluster for cross-region state synchronization
    this.redis = new Redis.Cluster(
      config.redis.hosts.map(host => ({ host: host.split(':')[0], port: parseInt(host.split(':')[1]) || 6379 })),
      {
        redisOptions: {
          password: config.redis.password,
          keyPrefix: config.redis.keyPrefix,
          retryDelayOnFailover: 1000,
          maxRetriesPerRequest: 3,
        },
        enableOfflineQueue: false,
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Initialize the orchestrator with region configurations
   */
  public async initialize(regions: RegionConfig[]): Promise<void> {
    try {
      // Validate region configurations
      for (const region of regions) {
        this.validateRegionConfig(region);
        this.regions.set(region.regionId, region);
      }

      // Initialize Redis state
      await this.initializeRedisState();

      // Load initial metrics
      await this.collectInitialMetrics();

      // Start monitoring intervals
      this.startMonitoring();

      this.isRunning = true;
      this.emit('orchestrator:initialized', { regions: regions.length });
    } catch (error) {
      throw new Error(`Failed to initialize orchestrator: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start the orchestration process
   */
  public async start(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Orchestrator must be initialized before starting');
    }

    // Perform initial capacity optimization
    await this.optimizeCapacityAllocation();

    this.emit('orchestrator:started');
  }

  /**
   * Stop the orchestrator and cleanup resources
   */
  public async stop(): Promise<void> {
    this.isRunning = false;

    // Clear intervals
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.forecastInterval) clearInterval(this.forecastInterval);
    if (this.healthInterval) clearInterval(this.healthInterval);
    if (this.costOptimizationInterval) clearInterval(this.costOptimizationInterval);

    // Wait for ongoing scaling operations to complete
    await this.waitForScalingCompletion();

    // Close Redis connection
    await this.redis.disconnect();

    this.emit('orchestrator:stopped');
  }

  /**
   * Add a new region to the orchestrator
   */
  public async addRegion(region: RegionConfig): Promise<void> {
    this.validateRegionConfig(region);
    
    this.regions.set(region.regionId, region);
    
    // Update Redis state
    await this.redis.hset('regions', region.regionId, JSON.stringify(region));
    
    // Collect initial metrics for new region
    const metrics = await this.regionCapacityManager.getCapacityMetrics(region.regionId);
    this.regionMetrics.set(region.regionId, metrics);
    
    this.emit('region:added', { regionId: region.regionId });
  }

  /**
   * Remove a region from orchestration
   */
  public async removeRegion(regionId: string): Promise<void> {
    if (!this.regions.has(regionId)) {
      throw new Error(`Region ${regionId} not found`);
    }

    // Scale down region to minimum capacity before removal
    const region = this.regions.get(regionId)!;
    await this.regionCapacityManager.scaleCapacity(regionId, region.minCapacity);

    // Remove from state
    this.regions.delete(regionId);
    this.regionMetrics.delete(regionId);
    
    // Update Redis state
    await this.redis.hdel('regions', regionId);
    
    this.emit('region:removed', { regionId });
  }

  /**
   * Get current status of all regions
   */
  public getRegionStatus(): Array<RegionMetrics & { config: RegionConfig }> {
    const status: Array<RegionMetrics & { config: RegionConfig }> = [];
    
    for (const [regionId, config] of this.regions) {
      const metrics = this.regionMetrics.get(regionId);
      if (metrics) {
        status.push({ ...metrics, config });
      }
    }
    
    return status;
  }

  /**
   * Get demand forecast for a specific region
   */
  public async getDemandForecast(regionId: string, horizonHours = 24): Promise<DemandForecast> {
    if (!this.regions.has(regionId)) {
      throw new Error(`Region ${regionId} not found`);
    }

    const historicalMetrics = await this.getHistoricalMetrics(regionId, horizonHours * 2);
    return this.demandForecastEngine.generateForecast(regionId, historicalMetrics);
  }

  /**
   * Manually trigger capacity optimization
   */
  public async optimizeCapacityAllocation(): Promise<AllocationDecision[]> {
    try {
      // Collect current metrics
      const currentMetrics = Array.from(this.regionMetrics.values());
      
      // Generate forecasts for all regions
      const forecasts: DemandForecast[] = [];
      for (const regionId of this.regions.keys()) {
        if (this.config.enableMLForecasting) {
          const historicalMetrics = await this.getHistoricalMetrics(regionId, 168); // 1 week
          const forecast = await this.demandForecastEngine.generateForecast(regionId, historicalMetrics);
          forecasts.push(forecast);
        }
      }

      // Optimize allocation
      const decisions = await this.costOptimizationEngine.optimizeAllocation(
        currentMetrics,
        forecasts,
        { maxLatency: 100, minReliability: 0.99 }
      );

      // Execute scaling decisions
      await this.executeScalingDecisions(decisions);

      this.emit('capacity:optimized', { decisions: decisions.length });
      return decisions;
    } catch (error) {
      this.emit('capacity:optimization_failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Force failover to disaster recovery regions
   */
  public async executeDisasterRecovery(affectedRegion: string): Promise<DisasterRecoveryEvent> {
    if (!this.regions.has(affectedRegion)) {
      throw new Error(`Region ${affectedRegion} not found`);
    }

    const event: DisasterRecoveryEvent = {
      eventId: `dr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'region_failure',
      affectedRegion,
      severity: 'critical',
      timestamp: new Date(),
      failoverRegions: this.getDRRegions(affectedRegion),
      estimatedDuration: 15,
      recoveryActions: [],
      status: 'detected'
    };

    await this.drOrchestrator.executeRecovery(event);
    
    this.emit('disaster_recovery:initiated', { eventId: event.eventId, affectedRegion });
    return event;
  }

  /**
   * Get cost analysis across all regions
   */
  public async getCostAnalysis(): Promise<{
    totalHourlyCost: number;
    totalDailyCost: number;
    totalMonthlyCost: number;
    regionBreakdown: Array<{
      regionId: string;
      hourlyCost: number;
      utilizationEfficiency: number;
      costPerUnit: number;
    }>;
    optimizationOpportunities: Array<{
      type: 'underutilized' | 'overprovisioned' | 'expensive_region';
      regionId: string;
      potentialSavings: number;
      recommendation: string;
    }>;
  }> {
    const regionBreakdown = [];
    let totalHourlyCost = 0;

    const optimizationOpportunities = [];

    for (const [regionId, metrics] of this.regionMetrics) {
      const hourlyCost = metrics.costMetrics.hourlyRate;
      const utilizationEfficiency = metrics.utilizationPercent / 100;
      const costPerUnit = metrics.costMetrics.hourlyRate / metrics.currentCapacity;

      regionBreakdown.push({
        regionId,
        hourlyCost,
        utilizationEfficiency,
        costPerUnit
      });

      totalHourlyCost += hourlyCost;

      // Identify optimization opportunities
      if (utilizationEfficiency < 0.3) {
        optimizationOpportunities.push({
          type: 'underutilized',
          regionId,
          potentialSavings: hourlyCost * 0.7 * 24 * 30,
          recommendation: 'Consider scaling down capacity or consolidating workloads'
        });
      }

      if (utilizationEfficiency > 0.9) {
        optimizationOpportunities.push({
          type: 'overprovisioned',
          regionId,
          potentialSavings: 0,
          recommendation: 'Consider scaling up capacity to avoid performance issues'
        });
      }

      // Compare with other regions for cost efficiency
      const avgCostPerUnit = Array.from(this.regionMetrics.values())
        .reduce((sum, m) => sum + (m.costMetrics.hourlyRate / m.currentCapacity), 0) / this.regionMetrics.size;

      if (costPerUnit > avgCostPerUnit * 1.2) {
        optimizationOpportunities.push({
          type: 'expensive_region',
          regionId,
          potentialSavings: (costPerUnit - avgCostPerUnit) * metrics.currentCapacity * 24 * 30,
          recommendation: 'Consider migrating workloads to more cost-effective regions'
        });
      }
    }

    return {
      totalHourlyCost,
      totalDailyCost: totalHourlyCost * 24,
      totalMonthlyCost: totalHourlyCost * 24 * 30,
      regionBreakdown,
      optimizationOpportunities
    };
  }

  /**
   * Test disaster recovery capabilities
   */
  public async testDisasterRecovery(regionId?: string): Promise<{
    success: boolean;
    results: Array<{
      regionId: string;
      testResults: { success: boolean; issues: string[] };
    }>;
  }> {
    const results = [];
    let overallSuccess = true;

    const regionsToTest = regionId ? [regionId] : Array.from(this.regions.keys()).filter(id => 
      this.regions.get(id)?.isDRCapable
    );

    for (const testRegionId of regionsToTest) {
      try {
        const testResults = await this.drOrchestrator.testRecoveryPlan(testRegionId);
        results.push({
          regionId: testRegionId,
          testResults
        });

        if (!testResults.success) {
          overallSuccess = false;
        }
      } catch (error) {
        results.push({
          regionId: testRegionId,
          testResults: {
            success: false,
            issues: [error instanceof Error ? error.message : 'Unknown error']
          }
        });
        overallSuccess = false;
      }
    }

    this.emit('disaster_recovery:test_completed', { success: overallSuccess, regionsTestcd: results.length });
    return { success: overallSuccess, results };
  }

  /**
   * Private helper methods
   */

  private validateRegionConfig(region: RegionConfig): void {
    if (!region.regionId || !region.name || !region.provider) {
      throw new Error('Region must have regionId, name, and provider');
    }

    if (region.maxCapacity <= 0 || region.minCapacity < 0) {
      throw new Error('Invalid capacity configuration');
    }

    if (region.minCapacity >= region.maxCapacity) {
      throw new Error('minCapacity must be less than maxCapacity');
    }

    if (!['aws', 'gcp', 'azure'].includes(region.provider)) {
      throw new Error('Provider must be aws, gcp, or azure');
    }
  }

  private setupEventHandlers(): void {
    this.redis.on('error', (error) => {
      this.emit('error', { source: 'redis', error });
    });

    this.on('region:health_degraded', async (data: { regionId: string; metrics: RegionMetrics }) => {
      if (this.config.enableAutomatedDR) {
        const disaster = await this.drOrchestrator.detectDisaster([data.metrics]);
        if (disaster) {
          await this.drOrchestrator.executeRecovery(disaster);
        }
      }
    });
  }

  private async initializeRedisState(): Promise<void> {
    // Store region configurations
    const regionsData: Record<string, string> = {};
    for (const [regionId, config] of this.regions) {
      regionsData[regionId] = JSON.stringify(config);
    }
    
    if (Object.keys(regionsData).length > 0) {
      await this.redis.hset('regions', regionsData);
    }

    // Initialize state tracking
    await this.redis.set('orchestrator:state', JSON.stringify({
      startTime: new Date().toISOString(),
      version: '1.0.0',
      activeRegions: Array.from(this.regions.keys())
    }));
  }

  private async collectInitialMetrics(): Promise<void> {
    for (const regionId of this.regions.keys()) {
      try {
        const metrics = await this.regionCapacityManager.getCapacityMetrics(regionId);
        this.regionMetrics.set(regionId,