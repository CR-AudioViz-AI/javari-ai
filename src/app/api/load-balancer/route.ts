import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Types
interface ServiceNode {
  id: string;
  url: string;
  region: string;
  weight: number;
  maxConnections: number;
  currentConnections: number;
  responseTime: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: Date;
}

interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'geographic';
  healthCheckInterval: number;
  maxRetries: number;
  timeoutMs: number;
  circuitBreakerThreshold: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: Date;
  successCount: number;
}

interface HealthCheckResult {
  serviceId: string;
  healthy: boolean;
  responseTime: number;
  timestamp: Date;
  error?: string;
}

interface GeoLocation {
  country: string;
  region: string;
  latitude: number;
  longitude: number;
}

// Services
class LoadBalancerService {
  private services: Map<string, ServiceNode> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private roundRobinIndex = 0;
  private redis: Redis;
  private supabase: any;
  private config: LoadBalancerConfig;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.config = {
      algorithm: 'weighted',
      healthCheckInterval: 30000,
      maxRetries: 3,
      timeoutMs: 5000,
      circuitBreakerThreshold: 5
    };
  }

  async initializeServices(): Promise<void> {
    try {
      const { data: services, error } = await this.supabase
        .from('service_nodes')
        .select('*')
        .eq('active', true);

      if (error) throw error;

      for (const service of services) {
        const node: ServiceNode = {
          id: service.id,
          url: service.url,
          region: service.region,
          weight: service.weight || 1,
          maxConnections: service.max_connections || 100,
          currentConnections: 0,
          responseTime: service.avg_response_time || 0,
          healthStatus: 'healthy',
          lastHealthCheck: new Date()
        };

        this.services.set(service.id, node);
        this.circuitBreakers.set(service.id, {
          state: 'closed',
          failureCount: 0,
          lastFailureTime: new Date(),
          successCount: 0
        });
      }

      // Subscribe to real-time updates
      this.supabase
        .channel('service_health')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'service_nodes'
        }, (payload: any) => {
          this.handleServiceUpdate(payload);
        })
        .subscribe();

    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  async selectService(clientLocation?: GeoLocation): Promise<ServiceNode | null> {
    const healthyServices = Array.from(this.services.values())
      .filter(service => this.isServiceAvailable(service.id));

    if (healthyServices.length === 0) {
      return null;
    }

    let selectedService: ServiceNode;

    switch (this.config.algorithm) {
      case 'round-robin':
        selectedService = this.roundRobinSelection(healthyServices);
        break;
      case 'least-connections':
        selectedService = this.leastConnectionsSelection(healthyServices);
        break;
      case 'weighted':
        selectedService = this.weightedSelection(healthyServices);
        break;
      case 'geographic':
        selectedService = this.geographicSelection(healthyServices, clientLocation);
        break;
      default:
        selectedService = this.weightedSelection(healthyServices);
    }

    // Update connection count
    selectedService.currentConnections++;
    await this.updateServiceMetrics(selectedService.id, {
      currentConnections: selectedService.currentConnections
    });

    return selectedService;
  }

  private roundRobinSelection(services: ServiceNode[]): ServiceNode {
    const service = services[this.roundRobinIndex % services.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % services.length;
    return service;
  }

  private leastConnectionsSelection(services: ServiceNode[]): ServiceNode {
    return services.reduce((prev, current) =>
      current.currentConnections < prev.currentConnections ? current : prev
    );
  }

  private weightedSelection(services: ServiceNode[]): ServiceNode {
    const totalWeight = services.reduce((sum, service) => sum + service.weight, 0);
    const random = Math.random() * totalWeight;
    let weightSum = 0;

    for (const service of services) {
      weightSum += service.weight;
      if (random <= weightSum) {
        return service;
      }
    }

    return services[0];
  }

  private geographicSelection(services: ServiceNode[], clientLocation?: GeoLocation): ServiceNode {
    if (!clientLocation) {
      return this.weightedSelection(services);
    }

    const servicesWithDistance = services.map(service => {
      // Simple distance calculation (in practice, use proper geo library)
      const distance = Math.sqrt(
        Math.pow(clientLocation.latitude - this.getServiceLatitude(service.region), 2) +
        Math.pow(clientLocation.longitude - this.getServiceLongitude(service.region), 2)
      );

      return { service, distance };
    });

    servicesWithDistance.sort((a, b) => a.distance - b.distance);
    return servicesWithDistance[0].service;
  }

  private getServiceLatitude(region: string): number {
    const regionCoords: Record<string, [number, number]> = {
      'us-east-1': [39.0458, -76.6413],
      'us-west-2': [45.5152, -122.6784],
      'eu-west-1': [53.3498, -6.2603],
      'ap-southeast-1': [1.3521, 103.8198]
    };
    return regionCoords[region]?.[0] || 0;
  }

  private getServiceLongitude(region: string): number {
    const regionCoords: Record<string, [number, number]> = {
      'us-east-1': [39.0458, -76.6413],
      'us-west-2': [45.5152, -122.6784],
      'eu-west-1': [53.3498, -6.2603],
      'ap-southeast-1': [1.3521, 103.8198]
    };
    return regionCoords[region]?.[1] || 0;
  }

  private isServiceAvailable(serviceId: string): boolean {
    const service = this.services.get(serviceId);
    const circuitBreaker = this.circuitBreakers.get(serviceId);

    if (!service || !circuitBreaker) return false;

    return service.healthStatus !== 'unhealthy' && 
           circuitBreaker.state !== 'open' &&
           service.currentConnections < service.maxConnections;
  }

  async recordResponse(serviceId: string, success: boolean, responseTime: number): Promise<void> {
    const service = this.services.get(serviceId);
    const circuitBreaker = this.circuitBreakers.get(serviceId);

    if (!service || !circuitBreaker) return;

    // Update service connection count
    service.currentConnections = Math.max(0, service.currentConnections - 1);

    // Update circuit breaker state
    if (success) {
      circuitBreaker.successCount++;
      circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
      
      if (circuitBreaker.state === 'half-open' && circuitBreaker.successCount >= 3) {
        circuitBreaker.state = 'closed';
        circuitBreaker.failureCount = 0;
      }

      // Update response time using exponential moving average
      service.responseTime = service.responseTime * 0.8 + responseTime * 0.2;

    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date();

      if (circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
        circuitBreaker.state = 'open';
        await this.notifyServiceFailure(serviceId);
      }
    }

    // Update metrics in Redis
    await this.updateServiceMetrics(serviceId, {
      currentConnections: service.currentConnections,
      responseTime: service.responseTime,
      circuitBreakerState: circuitBreaker.state
    });
  }

  private async updateServiceMetrics(serviceId: string, metrics: any): Promise<void> {
    try {
      const key = `service:${serviceId}:metrics`;
      await this.redis.hset(key, metrics);
      await this.redis.expire(key, 300); // 5 minutes TTL
    } catch (error) {
      console.error('Failed to update service metrics:', error);
    }
  }

  private async notifyServiceFailure(serviceId: string): Promise<void> {
    try {
      await this.supabase.from('service_alerts').insert({
        service_id: serviceId,
        alert_type: 'circuit_breaker_open',
        message: `Circuit breaker opened for service ${serviceId}`,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to create service alert:', error);
    }
  }

  private handleServiceUpdate(payload: any): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const service: ServiceNode = {
        id: newRecord.id,
        url: newRecord.url,
        region: newRecord.region,
        weight: newRecord.weight || 1,
        maxConnections: newRecord.max_connections || 100,
        currentConnections: 0,
        responseTime: newRecord.avg_response_time || 0,
        healthStatus: newRecord.health_status || 'healthy',
        lastHealthCheck: new Date(newRecord.last_health_check)
      };

      this.services.set(newRecord.id, service);
    } else if (eventType === 'DELETE') {
      this.services.delete(oldRecord.id);
      this.circuitBreakers.delete(oldRecord.id);
    }
  }
}

class HealthMonitor {
  private loadBalancer: LoadBalancerService;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(loadBalancer: LoadBalancerService) {
    this.loadBalancer = loadBalancer;
  }

  startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      30000 // 30 seconds
    );
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async performHealthChecks(): Promise<void> {
    const services = Array.from(this.loadBalancer['services'].values());
    const healthCheckPromises = services.map(service => this.checkServiceHealth(service));
    
    await Promise.allSettled(healthCheckPromises);
  }

  private async checkServiceHealth(service: ServiceNode): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${service.url}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'LoadBalancer-HealthCheck/1.0'
        }
      });

      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;
      const healthy = response.ok;

      service.healthStatus = healthy ? 'healthy' : 'degraded';
      service.lastHealthCheck = new Date();

      await this.loadBalancer.recordResponse(service.id, healthy, responseTime);

      return {
        serviceId: service.id,
        healthy,
        responseTime,
        timestamp: new Date()
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      service.healthStatus = 'unhealthy';
      service.lastHealthCheck = new Date();

      await this.loadBalancer.recordResponse(service.id, false, responseTime);

      return {
        serviceId: service.id,
        healthy: false,
        responseTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

class GeoLocationResolver {
  async resolveLocation(ip: string): Promise<GeoLocation | null> {
    try {
      // In production, use a proper IP geolocation service
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,lat,lon`);
      const data = await response.json();

      if (data.status === 'success') {
        return {
          country: data.country,
          region: data.regionName,
          latitude: data.lat,
          longitude: data.lon
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to resolve geo location:', error);
      return null;
    }
  }

  getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return request.ip || '127.0.0.1';
  }
}

// Global instances
const loadBalancer = new LoadBalancerService();
const healthMonitor = new HealthMonitor(loadBalancer);
const geoResolver = new GeoLocationResolver();

// Initialize on first request
let initialized = false;

async function initialize(): Promise<void> {
  if (!initialized) {
    await loadBalancer.initializeServices();
    healthMonitor.startHealthChecks();
    initialized = true;
  }
}

// API Routes
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await initialize();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        const services = Array.from(loadBalancer['services'].values());
        const healthyCount = services.filter(s => s.healthStatus === 'healthy').length;
        
        return NextResponse.json({
          status: 'active',
          totalServices: services.length,
          healthyServices: healthyCount,
          algorithm: loadBalancer['config'].algorithm,
          services: services.map(s => ({
            id: s.id,
            region: s.region,
            healthStatus: s.healthStatus,
            currentConnections: s.currentConnections,
            responseTime: s.responseTime
          }))
        });

      case 'metrics':
        const redis = loadBalancer['redis'];
        const serviceIds = Array.from(loadBalancer['services'].keys());
        const metrics: Record<string, any> = {};

        for (const serviceId of serviceIds) {
          const serviceMetrics = await redis.hgetall(`service:${serviceId}:metrics`);
          metrics[serviceId] = serviceMetrics;
        }

        return NextResponse.json({ metrics });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Load balancer GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await initialize();

    const clientIP = geoResolver.getClientIP(request);
    const clientLocation = await geoResolver.resolveLocation(clientIP);

    // Select best service based on load balancing algorithm
    const selectedService = await loadBalancer.selectService(clientLocation);

    if (!selectedService) {
      return NextResponse.json(
        { error: 'No healthy services available' },
        { status: 503 }
      );
    }

    // Return selected service information
    return NextResponse.json({
      serviceId: selectedService.id,
      url: selectedService.url,
      region: selectedService.region,
      estimatedResponseTime: selectedService.responseTime,
      clientLocation: clientLocation ? {
        country: clientLocation.country,
        region: clientLocation.region
      } : null
    });

  } catch (error) {
    console.error('Load balancer POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    await initialize();

    const body = await request.json();
    const { serviceId, success, responseTime } = body;

    if (!serviceId || typeof success !== 'boolean' || typeof responseTime !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid parameters' },
        { status: 400 }
      );
    }

    await loadBalancer.recordResponse(serviceId, success, responseTime);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Load balancer PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    await initialize();

    const body = await request.json();
    const { algorithm, healthCheckInterval, maxRetries, timeoutMs } = body;

    // Update load balancer configuration
    if (algorithm && ['round-robin', 'least-connections', 'weighted', 'geographic'].includes(algorithm)) {
      loadBalancer['config'].algorithm = algorithm;
    }

    if (healthCheckInterval && typeof healthCheckInterval === 'number') {
      loadBalancer['config'].healthCheckInterval = healthCheckInterval;
    }

    if (maxRetries && typeof maxRetries === 'number') {
      loadBalancer['config'].maxRetries = maxRetries;
    }

    if (timeoutMs && typeof timeoutMs === 'number') {
      loadBalancer['config'].timeoutMs = timeoutMs;
    }

    return NextResponse.json({
      success: true,
      config: loadBalancer['config']
    });

  } catch (error) {
    console.error('Load balancer PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}