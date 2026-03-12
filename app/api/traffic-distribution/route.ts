```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Reader } from 'maxmind';
import Redis from 'ioredis';

// Validation schemas
const trafficRouteRequestSchema = z.object({
  clientIp: z.string().optional(),
  userAgent: z.string().optional(),
  acceptLanguage: z.string().optional(),
  userId: z.string().optional(),
  serviceType: z.enum(['api', 'cdn', 'websocket', 'streaming']).default('api'),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  preferences: z.object({
    region: z.string().optional(),
    latencyThreshold: z.number().min(0).max(5000).optional(),
    preferredProviders: z.array(z.string()).optional(),
  }).optional(),
});

const trafficMetricsSchema = z.object({
  region: z.string(),
  serverId: z.string(),
  metrics: z.object({
    cpuUsage: z.number().min(0).max(100),
    memoryUsage: z.number().min(0).max(100),
    diskUsage: z.number().min(0).max(100),
    activeConnections: z.number().min(0),
    responseTime: z.number().min(0),
    errorRate: z.number().min(0).max(100),
  }),
});

// Types
interface ServerNode {
  id: string;
  region: string;
  provider: string;
  endpoint: string;
  capacity: number;
  currentLoad: number;
  healthScore: number;
  latency: number;
  lastHealthCheck: string;
  status: 'active' | 'degraded' | 'offline';
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface RoutingDecision {
  selectedServer: ServerNode;
  routingReason: string;
  alternativeServers: ServerNode[];
  estimatedLatency: number;
  loadBalancingWeight: number;
  cacheTtl: number;
}

interface GeographicLocation {
  country: string;
  region: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  timezone: string;
  isp: string;
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

class GeographicLocationDetector {
  private geoipReader: Reader<any> | null = null;

  constructor() {
    this.initializeGeoIP();
  }

  private async initializeGeoIP(): Promise<void> {
    try {
      // Initialize MaxMind GeoIP2 reader
      // Note: In production, load from file system
      this.geoipReader = await Reader.open('/path/to/GeoLite2-City.mmdb');
    } catch (error) {
      console.error('Failed to initialize GeoIP reader:', error);
    }
  }

  async detectLocation(ip: string): Promise<GeographicLocation | null> {
    try {
      if (!this.geoipReader) {
        // Fallback to IP-API service
        return await this.fallbackLocationDetection(ip);
      }

      const result = this.geoipReader.get(ip);
      if (!result) return null;

      return {
        country: result.country?.iso_code || 'US',
        region: result.subdivisions?.[0]?.iso_code || '',
        city: result.city?.names?.en || '',
        coordinates: {
          lat: result.location?.latitude || 0,
          lng: result.location?.longitude || 0,
        },
        timezone: result.location?.time_zone || 'UTC',
        isp: result.traits?.isp || 'unknown',
      };
    } catch (error) {
      console.error('GeoIP detection failed:', error);
      return await this.fallbackLocationDetection(ip);
    }
  }

  private async fallbackLocationDetection(ip: string): Promise<GeographicLocation | null> {
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon,timezone,isp`);
      const data = await response.json();
      
      if (data.status !== 'success') return null;

      return {
        country: data.country,
        region: data.regionName,
        city: data.city,
        coordinates: {
          lat: data.lat,
          lng: data.lon,
        },
        timezone: data.timezone,
        isp: data.isp,
      };
    } catch (error) {
      console.error('Fallback location detection failed:', error);
      return null;
    }
  }
}

class ServerLoadBalancer {
  private serverNodes: Map<string, ServerNode> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeServerNodes();
    this.startHealthChecks();
  }

  private async initializeServerNodes(): Promise<void> {
    try {
      const { data: servers, error } = await supabase
        .from('server_nodes')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      servers?.forEach(server => {
        this.serverNodes.set(server.id, server);
      });

      console.log(`Initialized ${this.serverNodes.size} server nodes`);
    } catch (error) {
      console.error('Failed to initialize server nodes:', error);
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = Array.from(this.serverNodes.values()).map(
      server => this.checkServerHealth(server)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  private async checkServerHealth(server: ServerNode): Promise<void> {
    try {
      const start = Date.now();
      const response = await fetch(`${server.endpoint}/health`, {
        method: 'GET',
        timeout: 5000,
      });

      const latency = Date.now() - start;
      const healthData = await response.json();

      const updatedServer: ServerNode = {
        ...server,
        currentLoad: healthData.load || 0,
        healthScore: this.calculateHealthScore(healthData),
        latency,
        lastHealthCheck: new Date().toISOString(),
        status: response.ok ? 'active' : 'degraded',
      };

      this.serverNodes.set(server.id, updatedServer);

      // Cache health data in Redis
      await redis.setex(
        `server:health:${server.id}`,
        60,
        JSON.stringify(updatedServer)
      );

      // Update database
      await supabase
        .from('server_nodes')
        .update({
          current_load: updatedServer.currentLoad,
          health_score: updatedServer.healthScore,
          latency: updatedServer.latency,
          last_health_check: updatedServer.lastHealthCheck,
          status: updatedServer.status,
        })
        .eq('id', server.id);

    } catch (error) {
      console.error(`Health check failed for server ${server.id}:`, error);
      
      const failedServer = {
        ...server,
        status: 'offline' as const,
        lastHealthCheck: new Date().toISOString(),
      };

      this.serverNodes.set(server.id, failedServer);
    }
  }

  private calculateHealthScore(healthData: any): number {
    const cpuScore = Math.max(0, 100 - (healthData.cpu || 0));
    const memoryScore = Math.max(0, 100 - (healthData.memory || 0));
    const diskScore = Math.max(0, 100 - (healthData.disk || 0));
    const errorScore = Math.max(0, 100 - (healthData.errorRate || 0));

    return Math.round((cpuScore + memoryScore + diskScore + errorScore) / 4);
  }

  getAvailableServers(region?: string): ServerNode[] {
    const servers = Array.from(this.serverNodes.values())
      .filter(server => server.status === 'active' || server.status === 'degraded');

    if (region) {
      return servers.filter(server => 
        server.region === region || 
        this.isNearbyRegion(server.region, region)
      );
    }

    return servers;
  }

  private isNearbyRegion(serverRegion: string, targetRegion: string): boolean {
    // Define region proximity mapping
    const regionGroups: Record<string, string[]> = {
      'us-east': ['us-east-1', 'us-east-2', 'ca-central-1'],
      'us-west': ['us-west-1', 'us-west-2'],
      'eu': ['eu-west-1', 'eu-west-2', 'eu-central-1'],
      'ap': ['ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'],
    };

    for (const [group, regions] of Object.entries(regionGroups)) {
      if (regions.includes(serverRegion) && regions.includes(targetRegion)) {
        return true;
      }
    }

    return false;
  }
}

class NetworkLatencyMeasurer {
  private latencyCache = new Map<string, { latency: number; timestamp: number }>();

  async measureLatency(clientLocation: GeographicLocation, servers: ServerNode[]): Promise<Map<string, number>> {
    const latencyMap = new Map<string, number>();
    
    for (const server of servers) {
      const cacheKey = `${clientLocation.country}-${server.id}`;
      const cached = this.latencyCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        latencyMap.set(server.id, cached.latency);
        continue;
      }

      try {
        const latency = await this.pingServer(server);
        const estimatedLatency = this.estimateLatency(clientLocation, server) + latency;
        
        latencyMap.set(server.id, estimatedLatency);
        this.latencyCache.set(cacheKey, { 
          latency: estimatedLatency, 
          timestamp: Date.now() 
        });
      } catch (error) {
        console.error(`Failed to measure latency for server ${server.id}:`, error);
        latencyMap.set(server.id, 9999); // High penalty for unreachable servers
      }
    }

    return latencyMap;
  }

  private async pingServer(server: ServerNode): Promise<number> {
    const start = Date.now();
    
    try {
      await fetch(`${server.endpoint}/ping`, {
        method: 'HEAD',
        timeout: 3000,
      });
      
      return Date.now() - start;
    } catch (error) {
      return 9999; // High latency penalty for failed pings
    }
  }

  private estimateLatency(clientLocation: GeographicLocation, server: ServerNode): number {
    // Calculate great circle distance
    const distance = this.calculateDistance(
      clientLocation.coordinates.lat,
      clientLocation.coordinates.lng,
      server.coordinates.lat,
      server.coordinates.lng
    );

    // Estimate latency based on distance (roughly 1ms per 100km)
    return Math.round(distance / 100);
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

class TrafficRoutingEngine {
  private locationDetector: GeographicLocationDetector;
  private loadBalancer: ServerLoadBalancer;
  private latencyMeasurer: NetworkLatencyMeasurer;

  constructor() {
    this.locationDetector = new GeographicLocationDetector();
    this.loadBalancer = new ServerLoadBalancer();
    this.latencyMeasurer = new NetworkLatencyMeasurer();
  }

  async routeTraffic(
    request: z.infer<typeof trafficRouteRequestSchema>,
    clientIp: string
  ): Promise<RoutingDecision> {
    try {
      // Detect client location
      const location = await this.locationDetector.detectLocation(clientIp);
      if (!location) {
        throw new Error('Unable to detect client location');
      }

      // Get available servers
      const availableServers = this.loadBalancer.getAvailableServers(
        request.preferences?.region
      );

      if (availableServers.length === 0) {
        throw new Error('No available servers found');
      }

      // Measure latencies
      const latencyMap = await this.latencyMeasurer.measureLatency(
        location,
        availableServers
      );

      // Apply routing algorithm
      const routingDecision = this.selectOptimalServer(
        availableServers,
        latencyMap,
        request,
        location
      );

      // Log routing decision
      await this.logRoutingDecision(routingDecision, request, location);

      return routingDecision;
    } catch (error) {
      console.error('Traffic routing failed:', error);
      throw new Error('Unable to route traffic');
    }
  }

  private selectOptimalServer(
    servers: ServerNode[],
    latencyMap: Map<string, number>,
    request: z.infer<typeof trafficRouteRequestSchema>,
    location: GeographicLocation
  ): RoutingDecision {
    // Calculate scores for each server
    const serverScores = servers.map(server => {
      const latency = latencyMap.get(server.id) || 9999;
      const load = server.currentLoad;
      const health = server.healthScore;
      
      // Weighted scoring algorithm
      const latencyScore = Math.max(0, 100 - (latency / 10));
      const loadScore = Math.max(0, 100 - load);
      const healthScore = health;
      
      // Priority-based weighting
      let weights = { latency: 0.4, load: 0.3, health: 0.3 };
      
      if (request.priority === 'critical') {
        weights = { latency: 0.6, load: 0.2, health: 0.2 };
      } else if (request.serviceType === 'streaming') {
        weights = { latency: 0.5, load: 0.3, health: 0.2 };
      }

      const totalScore = 
        latencyScore * weights.latency +
        loadScore * weights.load +
        healthScore * weights.health;

      return {
        server,
        score: totalScore,
        latency,
        load,
        health,
      };
    });

    // Sort by score (highest first)
    serverScores.sort((a, b) => b.score - a.score);

    const selectedServer = serverScores[0].server;
    const alternativeServers = serverScores.slice(1, 4).map(s => s.server);

    return {
      selectedServer,
      routingReason: this.generateRoutingReason(serverScores[0], request),
      alternativeServers,
      estimatedLatency: serverScores[0].latency,
      loadBalancingWeight: this.calculateLoadBalancingWeight(selectedServer),
      cacheTtl: this.calculateCacheTtl(request),
    };
  }

  private generateRoutingReason(
    selectedScore: any,
    request: z.infer<typeof trafficRouteRequestSchema>
  ): string {
    const reasons = [];
    
    if (selectedScore.latency < 100) {
      reasons.push('low latency');
    }
    
    if (selectedScore.load < 50) {
      reasons.push('low server load');
    }
    
    if (selectedScore.health > 80) {
      reasons.push('high health score');
    }

    if (request.priority === 'critical') {
      reasons.push('critical priority routing');
    }

    return reasons.join(', ') || 'optimal server selection';
  }

  private calculateLoadBalancingWeight(server: ServerNode): number {
    return Math.max(0, Math.round((100 - server.currentLoad) / 10));
  }

  private calculateCacheTtl(request: z.infer<typeof trafficRouteRequestSchema>): number {
    switch (request.serviceType) {
      case 'streaming':
        return 60; // 1 minute
      case 'websocket':
        return 300; // 5 minutes
      case 'cdn':
        return 900; // 15 minutes
      default:
        return 180; // 3 minutes
    }
  }

  private async logRoutingDecision(
    decision: RoutingDecision,
    request: z.infer<typeof trafficRouteRequestSchema>,
    location: GeographicLocation
  ): Promise<void> {
    try {
      await supabase.from('traffic_routing_logs').insert({
        user_id: request.userId,
        client_location: location,
        selected_server_id: decision.selectedServer.id,
        routing_reason: decision.routingReason,
        estimated_latency: decision.estimatedLatency,
        service_type: request.serviceType,
        priority: request.priority,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log routing decision:', error);
    }
  }
}

// Initialize routing engine
const routingEngine = new TrafficRoutingEngine();

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientIp = request.ip || 
                    request.headers.get('x-forwarded-for')?.split(',')[0] ||
                    request.headers.get('x-real-ip') ||
                    '127.0.0.1';

    const routeRequest = trafficRouteRequestSchema.parse({
      clientIp,
      userAgent: request.headers.get('user-agent'),
      acceptLanguage: request.headers.get('accept-language'),
      userId: searchParams.get('userId'),
      serviceType: searchParams.get('serviceType') || 'api',
      priority: searchParams.get('priority') || 'normal',
      preferences: {
        region: searchParams.get('region'),
        latencyThreshold: searchParams.get('latencyThreshold') 
          ? parseInt(searchParams.get('latencyThreshold')!) 
          : undefined,
        preferredProviders: searchParams.get('providers')?.split(',') || undefined,
      },
    });

    const routingDecision = await routingEngine.routeTraffic(routeRequest, clientIp);

    // Cache the routing decision
    const cacheKey = `routing:${clientIp}:${routeRequest.serviceType}`;
    await redis.setex(
      cacheKey,
      routingDecision.cacheTtl,
      JSON.stringify(routingDecision)
    );

    return NextResponse.json({
      success: true,
      data: {
        selectedServer: {
          id: routingDecision.selectedServer.id,
          endpoint: routingDecision.selectedServer.endpoint,
          region: routingDecision.selectedServer.region,
          provider: routingDecision.selectedServer.provider,
        },
        routing: {
          reason: routingDecision.routingReason,
          estimatedLatency: routingDecision.estimatedLatency,
          loadBalancingWeight: routingDecision.loadBalancingWeight,
        },
        alternatives: routingDecision.alternativeServers.map(server => ({
          id: server.id,
          endpoint: server.endpoint,
          region: server.region,
        })),
        cacheInfo: {
          ttl: routingDecision.cacheTtl,
          key: cacheKey,
        },
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Traffic distribution API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const metricsData = trafficMetricsSchema.parse(body);

    // Update server metrics in database
    await supabase
      .from('server_nodes')
      .update({
        current_load: (metricsData.metrics.cpuUsage + metricsData.metrics.memoryUsage) / 2,
        health_score: Math.round(
          (100 - metricsData.metrics.cpuUsage + 
           100 - metricsData.metrics.memoryUsage + 
           100 - metricsData.metrics.errorRate) / 3
        ),
        latency: metricsData.metrics.responseTime,
        last_health_check: new Date().toISOString(),
      })
      .eq('id', metricsData.serverId);

    // Store detailed metrics
    await supabase.from('server_metrics').insert({
      server_id: metricsData.serverId,
      region: metricsData.region,
      cpu_usage: metricsData.metrics.cpuUsage,
      memory_usage: metricsData.metrics.memoryUsage,
      disk_usage: metricsData.metrics.diskUsage,
      active_connections: metricsData.metrics.