```typescript
import { EventEmitter } from 'events';
import { SystemMonitor } from './monitoring/system-monitor';
import { MetricsCollector } from './monitoring/metrics-collector';
import { MLDetector } from './anomaly/ml-detector';
import { AutoRemediation } from './remediation/auto-remediation';
import { MemoryCleanup } from './remediation/memory-cleanup';
import { DiskCleanup } from './remediation/disk-cleanup';
import { NetworkRecovery } from './remediation/network-recovery';
import { HealthChecker } from '../lib/infrastructure/health-checker';
import { MLModels } from '../lib/infrastructure/ml-models';
import { createClient } from '@supabase/supabase-js';
import {
  HealthMetrics,
  SystemHealth,
  HealthThresholds,
  HealthStatus
} from '../types/infrastructure/health-metrics';
import {
  AnomalyDetectionResult,
  AnomalyType,
  AnomalyConfig
} from '../types/infrastructure/anomaly-detection';
import {
  RemediationAction,
  RemediationResult,
  RemediationConfig
} from '../types/infrastructure/remediation-actions';

/**
 * Configuration for the self-healing infrastructure service
 */
interface SelfHealingConfig {
  /** Monitoring interval in milliseconds */
  monitoringInterval: number;
  /** Health thresholds for different metrics */
  thresholds: HealthThresholds;
  /** Anomaly detection configuration */
  anomalyConfig: AnomalyConfig;
  /** Remediation configuration */
  remediationConfig: RemediationConfig;
  /** Enable/disable automatic remediation */
  autoRemediationEnabled: boolean;
  /** Maximum remediation attempts per issue */
  maxRemediationAttempts: number;
  /** Cooldown period between remediation attempts (ms) */
  remediationCooldown: number;
}

/**
 * Health issue tracking
 */
interface HealthIssue {
  id: string;
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  description: string;
  metrics: HealthMetrics;
  remediationAttempts: number;
  lastRemediationAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Service events
 */
interface SelfHealingEvents {
  healthUpdate: (health: SystemHealth) => void;
  anomalyDetected: (issue: HealthIssue) => void;
  remediationStarted: (issue: HealthIssue, action: RemediationAction) => void;
  remediationCompleted: (issue: HealthIssue, result: RemediationResult) => void;
  issueResolved: (issue: HealthIssue) => void;
  criticalAlert: (issue: HealthIssue) => void;
}

/**
 * Self-Healing Infrastructure Service
 * 
 * Monitors system health, detects anomalies using ML, and automatically
 * remediates common infrastructure issues like memory leaks, disk space
 * problems, and network connectivity failures.
 */
export class SelfHealingService extends EventEmitter {
  private config: SelfHealingConfig;
  private systemMonitor: SystemMonitor;
  private metricsCollector: MetricsCollector;
  private mlDetector: MLDetector;
  private autoRemediation: AutoRemediation;
  private memoryCleanup: MemoryCleanup;
  private diskCleanup: DiskCleanup;
  private networkRecovery: NetworkRecovery;
  private healthChecker: HealthChecker;
  private mlModels: MLModels;
  private supabase: any;
  private monitoringTimer?: NodeJS.Timeout;
  private activeIssues: Map<string, HealthIssue> = new Map();
  private isRunning = false;
  private lastHealthCheck: Date = new Date();

  constructor(config: SelfHealingConfig, supabaseUrl?: string, supabaseKey?: string) {
    super();
    this.config = config;
    
    // Initialize monitoring components
    this.systemMonitor = new SystemMonitor();
    this.metricsCollector = new MetricsCollector();
    this.mlDetector = new MLDetector(config.anomalyConfig);
    
    // Initialize remediation components
    this.autoRemediation = new AutoRemediation(config.remediationConfig);
    this.memoryCleanup = new MemoryCleanup();
    this.diskCleanup = new DiskCleanup();
    this.networkRecovery = new NetworkRecovery();
    
    // Initialize utility components
    this.healthChecker = new HealthChecker(config.thresholds);
    this.mlModels = new MLModels();
    
    // Initialize Supabase if credentials provided
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    
    this.setupEventListeners();
  }

  /**
   * Start the self-healing service
   */
  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        throw new Error('Self-healing service is already running');
      }

      console.log('Starting self-healing infrastructure service...');
      
      // Initialize ML models
      await this.mlModels.initialize();
      
      // Start system monitoring
      await this.systemMonitor.start();
      
      // Setup monitoring interval
      this.monitoringTimer = setInterval(
        () => this.performHealthCheck(),
        this.config.monitoringInterval
      );
      
      this.isRunning = true;
      
      // Perform initial health check
      await this.performHealthCheck();
      
      console.log('Self-healing service started successfully');
    } catch (error) {
      console.error('Failed to start self-healing service:', error);
      throw error;
    }
  }

  /**
   * Stop the self-healing service
   */
  async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        return;
      }

      console.log('Stopping self-healing infrastructure service...');
      
      // Clear monitoring timer
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
        this.monitoringTimer = undefined;
      }
      
      // Stop system monitoring
      await this.systemMonitor.stop();
      
      this.isRunning = false;
      
      console.log('Self-healing service stopped successfully');
    } catch (error) {
      console.error('Error stopping self-healing service:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Collect current metrics
      const metrics = await this.metricsCollector.collectMetrics();
      
      // Assess system health
      const health = await this.healthChecker.assessHealth(metrics);
      
      // Detect anomalies using ML
      const anomalies = await this.mlDetector.detectAnomalies(metrics);
      
      // Update last check time
      this.lastHealthCheck = new Date();
      
      // Emit health update
      this.emit('healthUpdate', health);
      
      // Process any detected anomalies
      if (anomalies.length > 0) {
        await this.processAnomalies(anomalies, metrics);
      }
      
      // Check for resolved issues
      await this.checkResolvedIssues(health);
      
      // Store metrics if Supabase is available
      if (this.supabase) {
        await this.storeHealthMetrics(metrics, health);
      }
      
      const duration = Date.now() - startTime;
      console.log(`Health check completed in ${duration}ms`);
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Process detected anomalies
   */
  private async processAnomalies(
    anomalies: AnomalyDetectionResult[],
    metrics: HealthMetrics
  ): Promise<void> {
    for (const anomaly of anomalies) {
      const issueId = this.generateIssueId(anomaly);
      
      // Check if this is a new issue or existing one
      let issue = this.activeIssues.get(issueId);
      
      if (!issue) {
        // Create new issue
        issue = {
          id: issueId,
          type: anomaly.type,
          severity: this.determineSeverity(anomaly),
          detectedAt: new Date(),
          description: anomaly.description,
          metrics,
          remediationAttempts: 0,
          resolved: false
        };
        
        this.activeIssues.set(issueId, issue);
        this.emit('anomalyDetected', issue);
      }
      
      // Attempt remediation if enabled and within limits
      if (this.shouldAttemptRemediation(issue)) {
        await this.attemptRemediation(issue);
      }
    }
  }

  /**
   * Attempt automatic remediation for an issue
   */
  private async attemptRemediation(issue: HealthIssue): Promise<void> {
    try {
      // Check cooldown period
      if (issue.lastRemediationAt) {
        const timeSinceLastAttempt = Date.now() - issue.lastRemediationAt.getTime();
        if (timeSinceLastAttempt < this.config.remediationCooldown) {
          return;
        }
      }
      
      // Determine remediation action
      const action = await this.autoRemediation.determineAction(issue);
      
      issue.remediationAttempts++;
      issue.lastRemediationAt = new Date();
      
      this.emit('remediationStarted', issue, action);
      
      // Execute remediation based on issue type
      let result: RemediationResult;
      
      switch (issue.type) {
        case 'memory_leak':
        case 'high_memory_usage':
          result = await this.memoryCleanup.performCleanup(action);
          break;
          
        case 'disk_space_low':
        case 'disk_io_high':
          result = await this.diskCleanup.performCleanup(action);
          break;
          
        case 'network_connectivity':
        case 'network_latency_high':
          result = await this.networkRecovery.performRecovery(action);
          break;
          
        default:
          result = await this.autoRemediation.executeAction(action);
      }
      
      this.emit('remediationCompleted', issue, result);
      
      // Mark as resolved if successful
      if (result.success) {
        issue.resolved = true;
        issue.resolvedAt = new Date();
        this.emit('issueResolved', issue);
      }
      
    } catch (error) {
      console.error(`Remediation failed for issue ${issue.id}:`, error);
    }
  }

  /**
   * Check for resolved issues and clean up
   */
  private async checkResolvedIssues(health: SystemHealth): Promise<void> {
    for (const [issueId, issue] of this.activeIssues) {
      if (!issue.resolved) {
        // Check if issue is naturally resolved
        const isResolved = await this.isIssueResolved(issue, health);
        
        if (isResolved) {
          issue.resolved = true;
          issue.resolvedAt = new Date();
          this.emit('issueResolved', issue);
        }
      }
      
      // Remove old resolved issues (older than 1 hour)
      if (issue.resolved && issue.resolvedAt) {
        const hoursSinceResolved = (Date.now() - issue.resolvedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceResolved > 1) {
          this.activeIssues.delete(issueId);
        }
      }
    }
  }

  /**
   * Check if an issue is resolved based on current health
   */
  private async isIssueResolved(issue: HealthIssue, health: SystemHealth): Promise<boolean> {
    switch (issue.type) {
      case 'memory_leak':
      case 'high_memory_usage':
        return health.memory.status === HealthStatus.HEALTHY;
        
      case 'disk_space_low':
      case 'disk_io_high':
        return health.disk.status === HealthStatus.HEALTHY;
        
      case 'network_connectivity':
      case 'network_latency_high':
        return health.network.status === HealthStatus.HEALTHY;
        
      default:
        return false;
    }
  }

  /**
   * Store health metrics in Supabase
   */
  private async storeHealthMetrics(metrics: HealthMetrics, health: SystemHealth): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('health_metrics')
        .insert({
          timestamp: new Date().toISOString(),
          metrics,
          health,
          active_issues: Array.from(this.activeIssues.values())
        });
      
      if (error) {
        console.error('Failed to store health metrics:', error);
      }
    } catch (error) {
      console.error('Error storing health metrics:', error);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Handle critical alerts
    this.on('anomalyDetected', (issue: HealthIssue) => {
      if (issue.severity === 'critical') {
        this.emit('criticalAlert', issue);
      }
    });
    
    // Log important events
    this.on('anomalyDetected', (issue) => {
      console.warn(`Anomaly detected: ${issue.description} (${issue.severity})`);
    });
    
    this.on('issueResolved', (issue) => {
      console.log(`Issue resolved: ${issue.description}`);
    });
  }

  /**
   * Generate unique issue ID
   */
  private generateIssueId(anomaly: AnomalyDetectionResult): string {
    return `${anomaly.type}_${Date.now()}`;
  }

  /**
   * Determine issue severity based on anomaly
   */
  private determineSeverity(anomaly: AnomalyDetectionResult): HealthIssue['severity'] {
    if (anomaly.confidence > 0.9) return 'critical';
    if (anomaly.confidence > 0.7) return 'high';
    if (anomaly.confidence > 0.5) return 'medium';
    return 'low';
  }

  /**
   * Check if remediation should be attempted
   */
  private shouldAttemptRemediation(issue: HealthIssue): boolean {
    return (
      this.config.autoRemediationEnabled &&
      !issue.resolved &&
      issue.remediationAttempts < this.config.maxRemediationAttempts
    );
  }

  /**
   * Get current system health
   */
  async getCurrentHealth(): Promise<SystemHealth> {
    const metrics = await this.metricsCollector.collectMetrics();
    return await this.healthChecker.assessHealth(metrics);
  }

  /**
   * Get active issues
   */
  getActiveIssues(): HealthIssue[] {
    return Array.from(this.activeIssues.values()).filter(issue => !issue.resolved);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastHealthCheck: this.lastHealthCheck,
      activeIssueCount: this.getActiveIssues().length,
      totalIssuesTracked: this.activeIssues.size
    };
  }

  /**
   * Force a health check
   */
  async forceHealthCheck(): Promise<SystemHealth> {
    await this.performHealthCheck();
    return this.getCurrentHealth();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SelfHealingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    if (newConfig.thresholds) {
      this.healthChecker.updateThresholds(newConfig.thresholds);
    }
    
    if (newConfig.anomalyConfig) {
      this.mlDetector.updateConfig(newConfig.anomalyConfig);
    }
    
    if (newConfig.remediationConfig) {
      this.autoRemediation.updateConfig(newConfig.remediationConfig);
    }
  }
}

// Type augmentation for EventEmitter
declare interface SelfHealingService {
  on<K extends keyof SelfHealingEvents>(event: K, listener: SelfHealingEvents[K]): this;
  emit<K extends keyof SelfHealingEvents>(event: K, ...args: Parameters<SelfHealingEvents[K]>): boolean;
}

export default SelfHealingService;
```