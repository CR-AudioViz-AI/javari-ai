```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Types
interface Server {
  id: string;
  url: string;
  region: string;
  weight: number;
  healthScore: number;
  lastHealthCheck: Date;
  metadata: Record<string, any>;
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailure: Date;
  nextAttempt: Date;
}

interface LoadBalancerConfig {
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  maxRetries: number;
  requestTimeout: number;
  regions: string[];
}

interface RoutingRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  clientIp?: string;
  region?: string;
  userId?: string;
}

interface MetricData {
  serverId: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  region: string;
}

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis(process.env.REDIS_URL!);

class LoadBalancerService {
  private servers: Map<string, Server> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private config: LoadBalancerConfig;
  private requestQueues: Map<string, Array<any>> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.config = {
      healthCheckInterval: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      maxRetries: 3,
      requestTimeout: 30000,
      regions: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
    };
    this.initializeHealthMonitoring();
  }

  async routeRequest(request: RoutingRequest): Promise<{
    server: Server | null;
    fallback: boolean;
    queuePosition?: number;
  }> {
    try {
      // Rate limiting check
      if (!await this.checkRateLimit(request.clientIp || 'anonymous')) {
        throw new Error('Rate limit exceeded');
      }

      // Detect client region
      const clientRegion = await this.detectRegion(request.clientIp);
      
      // Get available servers
      const availableServers = await this.getAvailableServers(clientRegion);
      
      if (availableServers.length === 0) {
        return await this.handleNoServersAvailable(request);
      }

      // Select best server using weighted algorithm
      const selectedServer = this.selectServerWeighted(availableServers);
      
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(selectedServer.id)) {
        const fallbackServer = this.getFallbackServer(availableServers, selectedServer.id);
        if (fallbackServer) {
          return { server: fallbackServer, fallback: true };
        } else {
          return await this.handleGracefulDegradation(request);
        }
      }

      return { server: selectedServer, fallback: false };
    } catch (error) {
      console.error('Load balancer routing error:', error);
      return await this.handleGracefulDegradation(request);
    }
  }

  private async detectRegion(clientIp?: string): Promise<string> {
    if (!clientIp) return 'us-east-1'; // Default region

    try {
      // Use geographic IP detection service
      const response = await fetch(`http://ip-api.com/json/${clientIp}?fields=countryCode`, {
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        return this.mapCountryToRegion(data.countryCode);
      }
    } catch (error) {
      console.error('Region detection failed:', error);
    }

    return 'us-east-1'; // Fallback to default
  }

  private mapCountryToRegion(countryCode: string): string {
    const regionMap: Record<string, string> = {
      'US': 'us-east-1',
      'CA': 'us-east-1',
      'GB': 'eu-west-1',
      'DE': 'eu-west-1',
      'FR': 'eu-west-1',
      'SG': 'ap-southeast-1',
      'JP': 'ap-southeast-1',
      'AU': 'ap-southeast-1'
    };

    return regionMap[countryCode] || 'us-east-1';
  }

  private async getAvailableServers(preferredRegion: string): Promise<Server[]> {
    const { data: servers, error } = await supabase
      .from('load_balancer_servers')
      .select('*')
      .eq('status', 'active')
      .gte('health_score', 0.5);

    if (error) {
      console.error('Failed to fetch servers:', error);
      return [];
    }

    // Convert to Server objects and filter healthy servers
    const serverList: Server[] = servers
      .map(s => ({
        id: s.id,
        url: s.url,
        region: s.region,
        weight: s.weight,
        healthScore: s.health_score,
        lastHealthCheck: new Date(s.last_health_check),
        metadata: s.metadata
      }))
      .filter(s => !this.isCircuitBreakerOpen(s.id));

    // Sort by region preference and health score
    return serverList.sort((a, b) => {
      if (a.region === preferredRegion && b.region !== preferredRegion) return -1;
      if (b.region === preferredRegion && a.region !== preferredRegion) return 1;
      return b.healthScore - a.healthScore;
    });
  }

  private selectServerWeighted(servers: Server[]): Server {
    const totalWeight = servers.reduce((sum, server) => {
      return sum + (server.weight * server.healthScore);
    }, 0);

    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const server of servers) {
      currentWeight += server.weight * server.healthScore;
      if (random <= currentWeight) {
        return server;
      }
    }

    return servers[0]; // Fallback to first server
  }

  private isCircuitBreakerOpen(serverId: string): boolean {
    const state = this.circuitBreakers.get(serverId);
    if (!state) return false;

    const now = new Date();
    
    if (state.state === 'OPEN' && now >= state.nextAttempt) {
      // Transition to half-open
      state.state = 'HALF_OPEN';
      this.circuitBreakers.set(serverId, state);
      return false;
    }

    return state.state === 'OPEN';
  }

  private getFallbackServer(servers: Server[], excludeId: string): Server | null {
    const fallbacks = servers.filter(s => s.id !== excludeId);
    return fallbacks.length > 0 ? fallbacks[0] : null;
  }

  private async handleNoServersAvailable(request: RoutingRequest): Promise<{
    server: Server | null;
    fallback: boolean;
    queuePosition?: number;
  }> {
    // Add to queue
    const queueKey = request.region || 'global';
    if (!this.requestQueues.has(queueKey)) {
      this.requestQueues.set(queueKey, []);
    }

    const queue = this.requestQueues.get(queueKey)!;
    queue.push({
      request,
      timestamp: new Date(),
      id: Math.random().toString(36)
    });

    return {
      server: null,
      fallback: true,
      queuePosition: queue.length
    };
  }

  private async handleGracefulDegradation(request: RoutingRequest): Promise<{
    server: Server | null;
    fallback: boolean;
  }> {
    // Try to find any server with minimal health requirements
    const { data: emergencyServers } = await supabase
      .from('load_balancer_servers')
      .select('*')
      .eq('status', 'active')
      .gte('health_score', 0.1)
      .limit(1);

    if (emergencyServers && emergencyServers.length > 0) {
      const server: Server = {
        id: emergencyServers[0].id,
        url: emergencyServers[0].url,
        region: emergencyServers[0].region,
        weight: emergencyServers[0].weight,
        healthScore: emergencyServers[0].health_score,
        lastHealthCheck: new Date(emergencyServers[0].last_health_check),
        metadata: emergencyServers[0].metadata
      };

      return { server, fallback: true };
    }

    return { server: null, fallback: true };
  }

  async recordMetrics(metric: MetricData): Promise<void> {
    try {
      // Update circuit breaker state
      await this.updateCircuitBreaker(metric);

      // Store metrics in Supabase
      await supabase
        .from('load_balancer_metrics')
        .insert({
          server_id: metric.serverId,
          response_time: metric.responseTime,
          status_code: metric.statusCode,
          timestamp: metric.timestamp.toISOString(),
          region: metric.region
        });

      // Update Redis metrics for real-time monitoring
      await redis.zadd(
        `metrics:${metric.serverId}`,
        metric.timestamp.getTime(),
        JSON.stringify({
          responseTime: metric.responseTime,
          statusCode: metric.statusCode,
          timestamp: metric.timestamp
        })
      );

      // Expire old metrics (keep last 24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      await redis.zremrangebyscore(`metrics:${metric.serverId}`, '-inf', oneDayAgo);

    } catch (error) {
      console.error('Failed to record metrics:', error);
    }
  }

  private async updateCircuitBreaker(metric: MetricData): Promise<void> {
    const serverId = metric.serverId;
    let state = this.circuitBreakers.get(serverId) || {
      state: 'CLOSED' as const,
      failures: 0,
      lastFailure: new Date(),
      nextAttempt: new Date()
    };

    if (metric.statusCode >= 500 || metric.responseTime > 30000) {
      state.failures++;
      state.lastFailure = new Date();

      if (state.failures >= this.config.circuitBreakerThreshold) {
        state.state = 'OPEN';
        state.nextAttempt = new Date(Date.now() + this.config.circuitBreakerTimeout);
      }
    } else if (state.state === 'HALF_OPEN') {
      // Success in half-open state - close circuit
      state.state = 'CLOSED';
      state.failures = 0;
    } else if (state.state === 'CLOSED' && state.failures > 0) {
      // Gradual recovery
      state.failures = Math.max(0, state.failures - 1);
    }

    this.circuitBreakers.set(serverId, state);

    // Persist to Redis
    await redis.setex(
      `circuit:${serverId}`,
      300, // 5 minutes TTL
      JSON.stringify(state)
    );
  }

  private async checkRateLimit(clientId: string): Promise<boolean> {
    const key = `rate_limit:${clientId}`;
    const limit = 1000; // Requests per hour
    const window = 3600; // 1 hour in seconds

    try {
      const current = await redis.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= limit) {
        return false;
      }

      await redis.multi()
        .incr(key)
        .expire(key, window)
        .exec();

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow request on error
    }
  }

  private async initializeHealthMonitoring(): Promise<void> {
    // Load circuit breaker states from Redis
    try {
      const keys = await redis.keys('circuit:*');
      for (const key of keys) {
        const serverId = key.replace('circuit:', '');
        const stateData = await redis.get(key);
        if (stateData) {
          this.circuitBreakers.set(serverId, JSON.parse(stateData));
        }
      }
    } catch (error) {
      console.error('Failed to load circuit breaker states:', error);
    }

    // Set up periodic health checks
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const { data: servers } = await supabase
        .from('load_balancer_servers')
        .select('*')
        .eq('status', 'active');

      if (!servers) return;

      const healthCheckPromises = servers.map(async (server) => {
        try {
          const startTime = Date.now();
          const response = await fetch(`${server.url}/health`, {
            method: 'GET',
            timeout: 10000,
            signal: AbortSignal.timeout(10000)
          });

          const responseTime = Date.now() - startTime;
          const healthScore = response.ok ? Math.max(0, 1 - (responseTime / 5000)) : 0;

          // Update server health
          await supabase
            .from('load_balancer_servers')
            .update({
              health_score: healthScore,
              last_health_check: new Date().toISOString(),
              last_response_time: responseTime
            })
            .eq('id', server.id);

          // Record metrics
          await this.recordMetrics({
            serverId: server.id,
            responseTime,
            statusCode: response.status,
            timestamp: new Date(),
            region: server.region
          });

        } catch (error) {
          console.error(`Health check failed for server ${server.id}:`, error);
          
          // Mark server as unhealthy
          await supabase
            .from('load_balancer_servers')
            .update({
              health_score: 0,
              last_health_check: new Date().toISOString()
            })
            .eq('id', server.id);

          // Record failure metric
          await this.recordMetrics({
            serverId: server.id,
            responseTime: 30000,
            statusCode: 500,
            timestamp: new Date(),
            region: server.region
          });
        }
      });

      await Promise.allSettled(healthCheckPromises);
    } catch (error) {
      console.error('Health check batch failed:', error);
    }
  }

  async getServerStats(): Promise<any> {
    try {
      const { data: servers } = await supabase
        .from('load_balancer_servers')
        .select('*');

      const stats = {
        totalServers: servers?.length || 0,
        healthyServers: servers?.filter(s => s.health_score > 0.5).length || 0,
        circuitBreakersOpen: Array.from(this.circuitBreakers.values())
          .filter(cb => cb.state === 'OPEN').length,
        averageHealthScore: servers?.length ? 
          servers.reduce((sum, s) => sum + s.health_score, 0) / servers.length : 0,
        regionDistribution: servers?.reduce((acc, server) => {
          acc[server.region] = (acc[server.region] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {}
      };

      return stats;
    } catch (error) {
      console.error('Failed to get server stats:', error);
      return {};
    }
  }
}

// Global instance
const loadBalancer = new LoadBalancerService();

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    switch (endpoint) {
      case 'health':
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          stats: await loadBalancer.getServerStats()
        });

      case 'stats':
        const stats = await loadBalancer.getServerStats();
        return NextResponse.json({ stats });

      case 'servers':
        const { data: servers, error } = await supabase
          .from('load_balancer_servers')
          .select('*')
          .order('region');

        if (error) throw error;
        return NextResponse.json({ servers });

      default:
        return NextResponse.json(
          { error: 'Invalid endpoint' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Load balancer GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'route':
        const routingRequest: RoutingRequest = {
          path: body.path,
          method: body.method,
          headers: body.headers || {},
          clientIp: request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
          region: body.region,
          userId: body.userId
        };

        const result = await loadBalancer.routeRequest(routingRequest);
        return NextResponse.json(result);

      case 'metrics':
        const metric: MetricData = {
          serverId: body.serverId,
          responseTime: body.responseTime,
          statusCode: body.statusCode,
          timestamp: new Date(body.timestamp || Date.now()),
          region: body.region
        };

        await loadBalancer.recordMetrics(metric);
        return NextResponse.json({ success: true });

      case 'add_server':
        const { data: newServer, error: addError } = await supabase
          .from('load_balancer_servers')
          .insert({
            url: body.url,
            region: body.region,
            weight: body.weight || 1,
            health_score: 1,
            status: 'active',
            metadata: body.metadata || {}
          })
          .select()
          .single();

        if (addError) throw addError;
        return NextResponse.json({ server: newServer });

      case 'remove_server':
        const { error: removeError } = await supabase
          .from('load_balancer_servers')
          .update({ status: 'inactive' })
          .eq('id', body.serverId);

        if (removeError) throw removeError;
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Load balancer POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { serverId, ...updates } = body;

    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const { data: updatedServer, error } = await supabase
      .from('load_balancer_servers')
      .update(updates)
      .eq('id', serverId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ server: updatedServer });
  } catch (error: any) {
    console.error('Load balancer PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('load_balancer_servers')
      .delete()
      .eq('id', serverId);

    if (error) throw error;

    // Clean up circuit breaker state
    await redis.del(`circuit:${serverId}`);
    await redis.del(`metrics:${serverId}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Load balancer DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
```