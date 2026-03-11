```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/realtime-js';

/**
 * Performance metric data structure
 */
export interface PerformanceMetric {
  id: string;
  timestamp: number;
  type: MetricType;
  value: number;
  label: string;
  tags: Record<string, string>;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Core Web Vitals metrics
 */
export interface WebVitalMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'prerender';
}

/**
 * System health status
 */
export interface SystemHealth {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  id: string;
  metricType: MetricType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  threshold: number;
  actualValue: number;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  id: string;
  name: string;
  metricType: MetricType;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  recipients: string[];
  cooldown: number;
}

/**
 * Performance analytics configuration
 */
export interface PerformanceAnalyticsConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableWebVitals: boolean;
  enableResourceTiming: boolean;
  enableNavigationTiming: boolean;
  enableUserTiming: boolean;
  samplingRate: number;
  maxBufferSize: number;
  flushInterval: number;
  anomalyDetectionEnabled: boolean;
  alertingEnabled: boolean;
}

/**
 * Metric types enumeration
 */
export enum MetricType {
  WEB_VITAL = 'web_vital',
  NAVIGATION = 'navigation',
  RESOURCE = 'resource',
  USER_TIMING = 'user_timing',
  CUSTOM = 'custom',
  SYSTEM = 'system',
  ERROR = 'error',
  BUSINESS = 'business'
}

/**
 * Performance event handlers
 */
export interface PerformanceEventHandlers {
  onMetricCollected?: (metric: PerformanceMetric) => void;
  onAnomalyDetected?: (anomaly: AnomalyDetection) => void;
  onAlertTriggered?: (alert: AlertConfig, anomaly: AnomalyDetection) => void;
  onSystemHealthUpdate?: (health: SystemHealth) => void;
  onError?: (error: Error) => void;
}

/**
 * Metrics processor utility class
 */
class MetricsProcessor {
  private readonly config: PerformanceAnalyticsConfig;

  constructor(config: PerformanceAnalyticsConfig) {
    this.config = config;
  }

  /**
   * Process raw performance entries into structured metrics
   */
  processPerformanceEntries(entries: PerformanceEntry[]): PerformanceMetric[] {
    return entries.map(entry => this.processPerformanceEntry(entry));
  }

  /**
   * Process a single performance entry
   */
  private processPerformanceEntry(entry: PerformanceEntry): PerformanceMetric {
    const baseMetric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: this.getMetricType(entry),
      value: entry.duration || 0,
      label: entry.name,
      tags: {
        entryType: entry.entryType,
        initiatorType: (entry as any).initiatorType || 'unknown'
      },
      sessionId: this.getSessionId(),
      metadata: {
        startTime: entry.startTime,
        duration: entry.duration
      }
    };

    // Add type-specific processing
    if (entry.entryType === 'navigation') {
      return this.processNavigationEntry(entry as PerformanceNavigationTiming, baseMetric);
    }

    if (entry.entryType === 'resource') {
      return this.processResourceEntry(entry as PerformanceResourceTiming, baseMetric);
    }

    return baseMetric;
  }

  /**
   * Process navigation timing entry
   */
  private processNavigationEntry(
    entry: PerformanceNavigationTiming,
    baseMetric: PerformanceMetric
  ): PerformanceMetric {
    return {
      ...baseMetric,
      type: MetricType.NAVIGATION,
      tags: {
        ...baseMetric.tags,
        navigationType: entry.type.toString()
      },
      metadata: {
        ...baseMetric.metadata,
        domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
        loadEventEnd: entry.loadEventEnd,
        domInteractive: entry.domInteractive,
        domComplete: entry.domComplete
      }
    };
  }

  /**
   * Process resource timing entry
   */
  private processResourceEntry(
    entry: PerformanceResourceTiming,
    baseMetric: PerformanceMetric
  ): PerformanceMetric {
    return {
      ...baseMetric,
      type: MetricType.RESOURCE,
      tags: {
        ...baseMetric.tags,
        transferSize: entry.transferSize?.toString() || '0',
        encodedBodySize: entry.encodedBodySize?.toString() || '0'
      },
      metadata: {
        ...baseMetric.metadata,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize
      }
    };
  }

  /**
   * Get metric type from performance entry
   */
  private getMetricType(entry: PerformanceEntry): MetricType {
    switch (entry.entryType) {
      case 'navigation':
        return MetricType.NAVIGATION;
      case 'resource':
        return MetricType.RESOURCE;
      case 'measure':
      case 'mark':
        return MetricType.USER_TIMING;
      default:
        return MetricType.CUSTOM;
    }
  }

  /**
   * Generate unique ID for metrics
   */
  private generateId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('performance_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('performance_session_id', sessionId);
    }
    return sessionId;
  }
}

/**
 * Anomaly detection engine
 */
class AnomalyEngine {
  private readonly config: PerformanceAnalyticsConfig;
  private readonly historicalData: Map<string, number[]> = new Map();
  private readonly thresholds: Map<string, number> = new Map();

  constructor(config: PerformanceAnalyticsConfig) {
    this.config = config;
    this.initializeThresholds();
  }

  /**
   * Detect anomalies in performance metrics
   */
  detectAnomalies(metrics: PerformanceMetric[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];

    for (const metric of metrics) {
      const anomaly = this.detectMetricAnomaly(metric);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Detect anomaly for a single metric
   */
  private detectMetricAnomaly(metric: PerformanceMetric): AnomalyDetection | null {
    const key = `${metric.type}_${metric.label}`;
    const threshold = this.getThreshold(key, metric.type);
    
    // Update historical data
    this.updateHistoricalData(key, metric.value);

    // Statistical anomaly detection
    const isStatisticalAnomaly = this.detectStatisticalAnomaly(key, metric.value);
    const isThresholdAnomaly = this.detectThresholdAnomaly(metric.value, threshold);

    if (isStatisticalAnomaly || isThresholdAnomaly) {
      return {
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        metricType: metric.type,
        severity: this.calculateSeverity(metric.value, threshold),
        confidence: this.calculateConfidence(key, metric.value),
        description: this.generateAnomalyDescription(metric, threshold),
        threshold,
        actualValue: metric.value,
        detectedAt: Date.now(),
        resolved: false
      };
    }

    return null;
  }

  /**
   * Detect statistical anomalies using Z-score
   */
  private detectStatisticalAnomaly(key: string, value: number): boolean {
    const history = this.historicalData.get(key);
    if (!history || history.length < 10) return false;

    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return false;

    const zScore = Math.abs((value - mean) / stdDev);
    return zScore > 3; // 3-sigma rule
  }

  /**
   * Detect threshold-based anomalies
   */
  private detectThresholdAnomaly(value: number, threshold: number): boolean {
    return value > threshold;
  }

  /**
   * Calculate anomaly severity
   */
  private calculateSeverity(value: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = value / threshold;
    
    if (ratio < 1.2) return 'low';
    if (ratio < 1.5) return 'medium';
    if (ratio < 2.0) return 'high';
    return 'critical';
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(key: string, value: number): number {
    const history = this.historicalData.get(key);
    if (!history || history.length < 5) return 0.5;

    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0.5;

    const zScore = Math.abs((value - mean) / stdDev);
    return Math.min(zScore / 3, 1); // Normalize to 0-1
  }

  /**
   * Generate anomaly description
   */
  private generateAnomalyDescription(metric: PerformanceMetric, threshold: number): string {
    const percentage = ((metric.value - threshold) / threshold * 100).toFixed(1);
    return `${metric.label} exceeded threshold by ${percentage}% (${metric.value.toFixed(2)}ms vs ${threshold.toFixed(2)}ms)`;
  }

  /**
   * Update historical data for metric
   */
  private updateHistoricalData(key: string, value: number): void {
    let history = this.historicalData.get(key) || [];
    history.push(value);
    
    // Keep only last 100 values
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    this.historicalData.set(key, history);
  }

  /**
   * Get threshold for metric
   */
  private getThreshold(key: string, type: MetricType): number {
    const customThreshold = this.thresholds.get(key);
    if (customThreshold) return customThreshold;

    // Default thresholds by metric type
    switch (type) {
      case MetricType.WEB_VITAL:
        return 2500; // 2.5s for LCP
      case MetricType.NAVIGATION:
        return 3000; // 3s for navigation
      case MetricType.RESOURCE:
        return 1000; // 1s for resources
      default:
        return 5000; // 5s default
    }
  }

  /**
   * Initialize default thresholds
   */
  private initializeThresholds(): void {
    // Core Web Vitals thresholds
    this.thresholds.set('web_vital_LCP', 2500);
    this.thresholds.set('web_vital_FID', 100);
    this.thresholds.set('web_vital_CLS', 0.1);
    this.thresholds.set('web_vital_FCP', 1800);
    this.thresholds.set('web_vital_TTFB', 800);
    this.thresholds.set('web_vital_INP', 200);
  }
}

/**
 * Alerting service for performance anomalies
 */
class AlertingService {
  private readonly config: PerformanceAnalyticsConfig;
  private readonly alertConfigs: Map<string, AlertConfig> = new Map();
  private readonly cooldownTracker: Map<string, number> = new Map();

  constructor(config: PerformanceAnalyticsConfig) {
    this.config = config;
  }

  /**
   * Process anomalies and trigger alerts
   */
  processAnomalies(anomalies: AnomalyDetection[]): AlertConfig[] {
    const triggeredAlerts: AlertConfig[] = [];

    for (const anomaly of anomalies) {
      const alerts = this.findMatchingAlerts(anomaly);
      
      for (const alert of alerts) {
        if (this.shouldTriggerAlert(alert, anomaly)) {
          this.triggerAlert(alert, anomaly);
          triggeredAlerts.push(alert);
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * Add alert configuration
   */
  addAlert(alert: AlertConfig): void {
    this.alertConfigs.set(alert.id, alert);
  }

  /**
   * Remove alert configuration
   */
  removeAlert(alertId: string): void {
    this.alertConfigs.delete(alertId);
    this.cooldownTracker.delete(alertId);
  }

  /**
   * Find alerts matching the anomaly
   */
  private findMatchingAlerts(anomaly: AnomalyDetection): AlertConfig[] {
    const matchingAlerts: AlertConfig[] = [];

    for (const alert of this.alertConfigs.values()) {
      if (alert.enabled && alert.metricType === anomaly.metricType) {
        if (this.evaluateAlertCondition(alert, anomaly)) {
          matchingAlerts.push(alert);
        }
      }
    }

    return matchingAlerts;
  }

  /**
   * Evaluate if alert condition is met
   */
  private evaluateAlertCondition(alert: AlertConfig, anomaly: AnomalyDetection): boolean {
    const { operator, threshold } = alert;
    const { actualValue } = anomaly;

    switch (operator) {
      case 'gt':
        return actualValue > threshold;
      case 'lt':
        return actualValue < threshold;
      case 'gte':
        return actualValue >= threshold;
      case 'lte':
        return actualValue <= threshold;
      case 'eq':
        return Math.abs(actualValue - threshold) < 0.001;
      default:
        return false;
    }
  }

  /**
   * Check if alert should be triggered considering cooldown
   */
  private shouldTriggerAlert(alert: AlertConfig, anomaly: AnomalyDetection): boolean {
    const lastTriggered = this.cooldownTracker.get(alert.id);
    const now = Date.now();

    if (lastTriggered && (now - lastTriggered) < alert.cooldown) {
      return false;
    }

    return true;
  }

  /**
   * Trigger alert notification
   */
  private triggerAlert(alert: AlertConfig, anomaly: AnomalyDetection): void {
    this.cooldownTracker.set(alert.id, Date.now());

    // Here you would integrate with actual notification services
    // For now, we'll just log the alert
    console.warn(`Alert triggered: ${alert.name}`, {
      alert,
      anomaly,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Web Vitals collector
 */
class WebVitalsCollector {
  private readonly onMetric: (metric: WebVitalMetric) => void;

  constructor(onMetric: (metric: WebVitalMetric) => void) {
    this.onMetric = onMetric;
    this.initializeWebVitals();
  }

  /**
   * Initialize Web Vitals collection
   */
  private async initializeWebVitals(): Promise<void> {
    try {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

      getCLS(this.handleWebVital.bind(this));
      getFID(this.handleWebVital.bind(this));
      getFCP(this.handleWebVital.bind(this));
      getLCP(this.handleWebVital.bind(this));
      getTTFB(this.handleWebVital.bind(this));
    } catch (error) {
      console.warn('Web Vitals library not available:', error);
    }
  }

  /**
   * Handle Web Vital measurement
   */
  private handleWebVital(metric: any): void {
    const webVitalMetric: WebVitalMetric = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating || 'needs-improvement',
      delta: metric.delta || 0,
      id: metric.id,
      navigationType: metric.navigationType || 'navigate'
    };

    this.onMetric(webVitalMetric);
  }
}

/**
 * Main Performance Analytics class
 */
export class PerformanceAnalytics {
  private readonly config: PerformanceAnalyticsConfig;
  private readonly supabase: SupabaseClient;
  private readonly metricsProcessor: MetricsProcessor;
  private readonly anomalyEngine: AnomalyEngine;
  private readonly alertingService: AlertingService;
  private readonly webVitalsCollector: WebVitalsCollector;
  private readonly eventHandlers: PerformanceEventHandlers;
  
  private metricsBuffer: PerformanceMetric[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private performanceObserver: PerformanceObserver | null = null;

  constructor(
    config: PerformanceAnalyticsConfig,
    eventHandlers: PerformanceEventHandlers = {}
  ) {
    this.config = config;
    this.eventHandlers = eventHandlers;
    
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.metricsProcessor = new MetricsProcessor(config);
    this.anomalyEngine = new AnomalyEngine(config);
    this.alertingService = new AlertingService(config);
    
    this.webVitalsCollector = new WebVitalsCollector(this.handleWebVital.bind(this));
    
    this.initialize();
  }

  /**
   * Initialize performance analytics
   */
  private async initialize(): Promise<void> {
    try {
      await this.setupRealtimeConnection();
      this.setupPerformanceObserver();
      this.startMetricsCollection();
      this.startFlushTimer();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Setup Supabase realtime connection
   */
  private async setupRealtimeConnection(): Promise<void> {
    this.realtimeChannel = this.supabase.channel('performance-metrics');
    
    this.realtimeChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Connected to realtime performance channel');
      }
    });
  }

  /**
   * Setup Performance Observer
   */
  private setupPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('PerformanceObserver not supported');
      return;
    }

    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const metrics = this.metricsProcessor.processPerformanceEntries(entries);
      
      for (const metric of metrics) {
        this.collectMetric(metric);
      }
    });

    try {
      this.performanceObserver.observe({
        entryTypes: ['navigation', 'resource', 'measure', 'mark', 'paint']
      });
    } catch (error) {
      console.warn('Error setting up PerformanceObserver:', error);
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Collect initial navigation metrics
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const metrics = this.metricsProcessor.processPerformanceEntries(navigationEntries);
      metrics.forEach(metric => this.collectMetric(metric));
    }
  }

  /**
   * Start flush timer for buffered metrics
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  /**
   * Collect a performance metric
   */
  public collectMetric(metric: PerformanceMetric): void {
    try {
      // Apply sampling rate
      if (Math.random() > this.config.samplingRate) {
        return;