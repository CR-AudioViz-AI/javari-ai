```typescript
/**
 * Adaptive Load Balancing Service
 * 
 * Intelligent load balancer that dynamically routes requests based on:
 * - Real-time performance metrics
 * - Geographic proximity
 * - Service health status
 * - Automatic failover capabilities
 * 
 * @module AdaptiveLoadBalancer
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

/**
 * Geographic coordinates interface
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  region: string;
  country: string;
}

/**
 * Service endpoint definition
 */
export interface ServiceEndpoint {
  id: string;
  url: string;
  region: string;
  location: GeoLocation;
  capacity: number;
  currentLoad: number;
  healthStatus: HealthStatus;
  responseTime: number;
  lastHealthCheck: Date;
  metadata: Record<string, unknown>;
}

/**
 * Health status enumeration
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  timestamp: Date;
}

/**
 * Routing strategy types
 */
export enum RoutingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_RESPONSE_TIME = 'weighted_response_time',
  GEOGRAPHIC_PROXIMITY = 'geographic_proximity',
  LEAST_CONNECTIONS = 'least_connections',
  ADAPTIVE_HYBRID = 'adaptive_hybrid'
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
  monitoringPeriod: number;
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  healthCheckInterval: number;
  metricsCollectionInterval: number;
  adaptiveWeightUpdateInterval: number;
  circuitBreaker: CircuitBreakerConfig;
  routingStrategy: RoutingStrategy;
  sessionAffinity: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Routing decision interface
 */
export interface RoutingDecision {
  endpoint: ServiceEndpoint;
  weight: number;
  reason: string;
  confidence: number;
  fallbackEndpoints: ServiceEndpoint[];
}

/**
 * Request context for routing decisions
 */
export interface RequestContext {
  id: string;
  userLocation?: GeoLocation;
  sessionId?: string;
  requestType: string;
  priority: number;
  headers: Record<string, string>;
  metadata: Record<string, unknown>;
}

/**
 * Service registry for managing endpoints
 */
class ServiceRegistry {
  private endpoints: Map<string, ServiceEndpoint> = new Map();
  private endpointsByRegion: Map<string, ServiceEndpoint[]> = new Map();

  /**
   * Register a new service endpoint
   */
  registerEndpoint(endpoint: ServiceEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
    
    const regionEndpoints = this.endpointsByRegion.get(endpoint.region) || [];
    regionEndpoints.push(endpoint);
    this.endpointsByRegion.set(endpoint.region, regionEndpoints);
  }

  /**
   * Deregister a service endpoint
   */
  deregisterEndpoint(endpointId: string): void {
    const endpoint = this.endpoints.get(endpointId);
    if (endpoint) {
      this.endpoints.delete(endpointId);
      
      const regionEndpoints = this.endpointsByRegion.get(endpoint.region) || [];
      const filteredEndpoints = regionEndpoints.filter(e => e.id !== endpointId);
      this.endpointsByRegion.set(endpoint.region, filteredEndpoints);
    }
  }

  /**
   * Get all healthy endpoints
   */
  getHealthyEndpoints(): ServiceEndpoint[] {
    return Array.from(this.endpoints.values()).filter(
      endpoint => endpoint.healthStatus === HealthStatus.HEALTHY
    );
  }

  /**
   * Get endpoints by region
   */
  getEndpointsByRegion(region: string): ServiceEndpoint[] {
    return this.endpointsByRegion.get(region) || [];
  }

  /**
   * Get all endpoints
   */
  getAllEndpoints(): ServiceEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Update endpoint metrics
   */
  updateEndpoint(endpointId: string, updates: Partial<ServiceEndpoint>): void {
    const endpoint = this.endpoints.get(endpointId);
    if (endpoint) {
      Object.assign(endpoint, updates);
    }
  }
}

/**
 * Health monitor for service endpoints
 */
class HealthMonitor extends EventEmitter {
  private registry: ServiceRegistry;
  private monitoringInterval: number;
  private intervalId?: NodeJS.Timeout;

  constructor(registry: ServiceRegistry, interval: number) {
    super();
    this.registry = registry;
    this.monitoringInterval = interval;
  }

  /**
   * Start health monitoring
   */
  start(): void {
    this.intervalId = setInterval(() => {
      this.performHealthChecks();
    }, this.monitoringInterval);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    const endpoints = this.registry.getAllEndpoints();
    
    await Promise.allSettled(
      endpoints.map(endpoint => this.checkEndpointHealth(endpoint))
    );
  }

  /**
   * Check health of a specific endpoint
   */
  private async checkEndpointHealth(endpoint: ServiceEndpoint): Promise<void> {
    try {
      const startTime = Date.now();
      const response = await fetch(`${endpoint.url}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      const responseTime = Date.now() - startTime;
      
      const healthStatus = response.ok ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
      
      this.registry.updateEndpoint(endpoint.id, {
        healthStatus,
        responseTime,
        lastHealthCheck: new Date()
      });

      this.emit('healthCheck', {
        endpointId: endpoint.id,
        status: healthStatus,
        responseTime
      });

    } catch (error) {
      this.registry.updateEndpoint(endpoint.id, {
        healthStatus: HealthStatus.UNHEALTHY,
        lastHealthCheck: new Date()
      });

      this.emit('healthCheckError', {
        endpointId: endpoint.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Performance metrics collector
 */
class MetricsCollector extends EventEmitter {
  private registry: ServiceRegistry;
  private metricsHistory: Map<string, PerformanceMetrics[]> = new Map();
  private collectionInterval: number;
  private intervalId?: NodeJS.Timeout;

  constructor(registry: ServiceRegistry, interval: number) {
    super();
    this.registry = registry;
    this.collectionInterval = interval;
  }

  /**
   * Start metrics collection
   */
  start(): void {
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, this.collectionInterval);
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Collect metrics from all endpoints
   */
  private async collectMetrics(): Promise<void> {
    const endpoints = this.registry.getHealthyEndpoints();
    
    await Promise.allSettled(
      endpoints.map(endpoint => this.collectEndpointMetrics(endpoint))
    );
  }

  /**
   * Collect metrics from a specific endpoint
   */
  private async collectEndpointMetrics(endpoint: ServiceEndpoint): Promise<void> {
    try {
      const response = await fetch(`${endpoint.url}/metrics`, {
        method: 'GET',
        timeout: 3000
      });

      if (response.ok) {
        const metrics: PerformanceMetrics = await response.json();
        metrics.timestamp = new Date();
        
        this.storeMetrics(endpoint.id, metrics);
        this.emit('metricsCollected', { endpointId: endpoint.id, metrics });
      }
    } catch (error) {
      this.emit('metricsCollectionError', {
        endpointId: endpoint.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Store metrics with history management
   */
  private storeMetrics(endpointId: string, metrics: PerformanceMetrics): void {
    const history = this.metricsHistory.get(endpointId) || [];
    history.push(metrics);
    
    // Keep only last 100 metrics entries
    if (history.length > 100) {
      history.shift();
    }
    
    this.metricsHistory.set(endpointId, history);
  }

  /**
   * Get recent metrics for an endpoint
   */
  getRecentMetrics(endpointId: string, count: number = 10): PerformanceMetrics[] {
    const history = this.metricsHistory.get(endpointId) || [];
    return history.slice(-count);
  }

  /**
   * Get average metrics for an endpoint
   */
  getAverageMetrics(endpointId: string, windowSize: number = 10): Partial<PerformanceMetrics> | null {
    const recent = this.getRecentMetrics(endpointId, windowSize);
    
    if (recent.length === 0) return null;

    return {
      responseTime: recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length,
      throughput: recent.reduce((sum, m) => sum + m.throughput, 0) / recent.length,
      errorRate: recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length,
      cpuUsage: recent.reduce((sum, m) => sum + m.cpuUsage, 0) / recent.length,
      memoryUsage: recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length,
      activeConnections: recent.reduce((sum, m) => sum + m.activeConnections, 0) / recent.length
    };
  }
}

/**
 * Geographic router for location-based routing
 */
class GeographicRouter {
  private registry: ServiceRegistry;

  constructor(registry: ServiceRegistry) {
    this.registry = registry;
  }

  /**
   * Calculate distance between two geographic points (Haversine formula)
   */
  private calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find nearest endpoints to a user location
   */
  findNearestEndpoints(userLocation: GeoLocation, maxResults: number = 5): ServiceEndpoint[] {
    const healthyEndpoints = this.registry.getHealthyEndpoints();
    
    const endpointsWithDistance = healthyEndpoints.map(endpoint => ({
      endpoint,
      distance: this.calculateDistance(userLocation, endpoint.location)
    }));

    endpointsWithDistance.sort((a, b) => a.distance - b.distance);
    
    return endpointsWithDistance
      .slice(0, maxResults)
      .map(item => item.endpoint);
  }

  /**
   * Get endpoints in the same region as user
   */
  getRegionalEndpoints(userLocation: GeoLocation): ServiceEndpoint[] {
    const healthyEndpoints = this.registry.getHealthyEndpoints();
    
    return healthyEndpoints.filter(endpoint => 
      endpoint.location.region === userLocation.region ||
      endpoint.location.country === userLocation.country
    );
  }
}

/**
 * Adaptive weight calculator for routing decisions
 */
class AdaptiveWeightCalculator {
  private metricsCollector: MetricsCollector;
  private geographicRouter: GeographicRouter;

  constructor(metricsCollector: MetricsCollector, geographicRouter: GeographicRouter) {
    this.metricsCollector = metricsCollector;
    this.geographicRouter = geographicRouter;
  }

  /**
   * Calculate adaptive weights for endpoints based on multiple factors
   */
  calculateWeights(
    endpoints: ServiceEndpoint[],
    context: RequestContext,
    strategy: RoutingStrategy
  ): Map<string, number> {
    const weights = new Map<string, number>();

    switch (strategy) {
      case RoutingStrategy.ROUND_ROBIN:
        return this.calculateRoundRobinWeights(endpoints);
      
      case RoutingStrategy.WEIGHTED_RESPONSE_TIME:
        return this.calculateResponseTimeWeights(endpoints);
      
      case RoutingStrategy.GEOGRAPHIC_PROXIMITY:
        return this.calculateGeographicWeights(endpoints, context);
      
      case RoutingStrategy.LEAST_CONNECTIONS:
        return this.calculateConnectionWeights(endpoints);
      
      case RoutingStrategy.ADAPTIVE_HYBRID:
        return this.calculateHybridWeights(endpoints, context);
      
      default:
        return this.calculateRoundRobinWeights(endpoints);
    }
  }

  /**
   * Calculate round-robin weights (equal weights)
   */
  private calculateRoundRobinWeights(endpoints: ServiceEndpoint[]): Map<string, number> {
    const weights = new Map<string, number>();
    const equalWeight = 1 / endpoints.length;
    
    endpoints.forEach(endpoint => {
      weights.set(endpoint.id, equalWeight);
    });
    
    return weights;
  }

  /**
   * Calculate weights based on response time
   */
  private calculateResponseTimeWeights(endpoints: ServiceEndpoint[]): Map<string, number> {
    const weights = new Map<string, number>();
    
    // Calculate inverse response time weights
    const inverseResponseTimes = endpoints.map(endpoint => {
      const avgMetrics = this.metricsCollector.getAverageMetrics(endpoint.id);
      const responseTime = avgMetrics?.responseTime || endpoint.responseTime || 1000;
      return { endpointId: endpoint.id, inverseTime: 1 / responseTime };
    });

    const totalInverseTime = inverseResponseTimes.reduce((sum, item) => sum + item.inverseTime, 0);

    inverseResponseTimes.forEach(item => {
      weights.set(item.endpointId, item.inverseTime / totalInverseTime);
    });

    return weights;
  }

  /**
   * Calculate weights based on geographic proximity
   */
  private calculateGeographicWeights(
    endpoints: ServiceEndpoint[],
    context: RequestContext
  ): Map<string, number> {
    const weights = new Map<string, number>();
    
    if (!context.userLocation) {
      return this.calculateRoundRobinWeights(endpoints);
    }

    const endpointsWithDistance = endpoints.map(endpoint => ({
      endpointId: endpoint.id,
      distance: this.calculateDistance(context.userLocation!, endpoint.location)
    }));

    // Calculate inverse distance weights
    const inverseDistances = endpointsWithDistance.map(item => ({
      endpointId: item.endpointId,
      inverseDistance: 1 / (item.distance + 1) // +1 to avoid division by zero
    }));

    const totalInverseDistance = inverseDistances.reduce((sum, item) => sum + item.inverseDistance, 0);

    inverseDistances.forEach(item => {
      weights.set(item.endpointId, item.inverseDistance / totalInverseDistance);
    });

    return weights;
  }

  /**
   * Calculate distance between two geographic points
   */
  private calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(loc2.latitude - loc1.latitude);
    const dLon = this.toRadians(loc2.longitude - loc1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate weights based on active connections
   */
  private calculateConnectionWeights(endpoints: ServiceEndpoint[]): Map<string, number> {
    const weights = new Map<string, number>();
    
    const connectionsData = endpoints.map(endpoint => {
      const avgMetrics = this.metricsCollector.getAverageMetrics(endpoint.id);
      const connections = avgMetrics?.activeConnections || endpoint.currentLoad || 0;
      return { endpointId: endpoint.id, connections };
    });

    // Calculate inverse connection weights
    const inverseConnections = connectionsData.map(item => ({
      endpointId: item.endpointId,
      inverseConnections: 1 / (item.connections + 1) // +1 to avoid division by zero
    }));

    const totalInverse = inverseConnections.reduce((sum, item) => sum + item.inverseConnections, 0);

    inverseConnections.forEach(item => {
      weights.set(item.endpointId, item.inverseConnections / totalInverse);
    });

    return weights;
  }

  /**
   * Calculate hybrid weights combining multiple factors
   */
  private calculateHybridWeights(
    endpoints: ServiceEndpoint[],
    context: RequestContext
  ): Map<string, number> {
    const responseTimeWeights = this.calculateResponseTimeWeights(endpoints);
    const geographicWeights = this.calculateGeographicWeights(endpoints, context);
    const connectionWeights = this.calculateConnectionWeights(endpoints);

    const hybridWeights = new Map<string, number>();

    endpoints.forEach(endpoint => {
      const responseWeight = responseTimeWeights.get(endpoint.id) || 0;
      const geoWeight = geographicWeights.get(endpoint.id) || 0;
      const connWeight = connectionWeights.get(endpoint.id) || 0;

      // Weighted combination: 40% response time, 35% geography, 25% connections
      const combinedWeight = (responseWeight * 0.4) + (geoWeight * 0.35) + (connWeight * 0.25);
      hybridWeights.set(endpoint.id, combinedWeight);
    });

    return hybridWeights;
  }
}

/**
 * Circuit breaker for fault tolerance
 */
class CircuitBreaker extends EventEmitter {
  private endpointStates: Map<string, CircuitBreakerState> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private lastFailureTime: Map<string, Date> = new Map();
  private halfOpenCalls: Map<string, number> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    super();
    this.config = config;
  }

  /**
   * Check if endpoint is available for routing
   */
  isEndpointAvailable(endpointId: string): boolean {
    const state = this.endpointStates.get(endpointId) || CircuitBreakerState.CLOSED;
    
    switch (state) {
      case CircuitBreakerState.CLOSED:
        return true;
      
      case CircuitBreakerState.OPEN:
        return this.shouldAttemptRecovery(endpointId);
      
      case CircuitBreakerState.HALF_OPEN:
        const calls = this.halfOpenCalls.get(endpointId) || 0;
        return calls < this.config.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  /**
   * Record a successful call
   */
  recordSuccess(endpointId: string): void {
    const state = this.endpointStates.get(endpointId);
    
    if (state === CircuitBreakerState.HALF_OPEN) {
      this.endpointStates.set(endpointId, CircuitBreakerState.CLOSED);
      this.failureCounts.delete(endpointId);
      this.halfOpenCalls.delete(endpointId);
      this.emit('circuitClosed', { endpointId });
    } else if (state === CircuitBreakerState.CLOSED) {
      this.failureCounts.set(endpointId, 0);
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(endpointId: string): void {
    const currentFailures = this.failureCounts.get(endpointId) || 0;
    const newFailures = currentFailures + 1;