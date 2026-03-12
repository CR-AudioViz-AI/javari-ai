```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { authenticateRequest } from '@/lib/auth';

// Types and schemas
const MetricSchema = z.object({
  component: z.string().min(1).max(50),
  metric_type: z.enum(['cpu', 'memory', 'latency', 'throughput', 'error_rate', 'disk_io', 'network_io']),
  value: z.number().min(0).max(100000),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).max(10).optional()
});

const QuerySchema = z.object({
  components: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  timeRange: z.enum(['1m', '5m', '15m', '1h', '6h', '24h']).default('5m'),
  granularity: z.enum(['1s', '5s', '15s', '1m', '5m']).default('5s'),
  aggregate: z.enum(['avg', 'max', 'min', 'sum', 'count']).default('avg')
});

interface MetricPoint {
  component: string;
  metric_type: string;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
  tags?: string[];
}

interface AggregatedMetric {
  component: string;
  metric_type: string;
  value: number;
  timestamp: Date;
  count: number;
  min: number;
  max: number;
  avg: number;
}

class CircularBuffer {
  private buffer: MetricPoint[];
  private size: number;
  private head: number = 0;
  private count: number = 0;

  constructor(size: number = 10000) {
    this.size = size;
    this.buffer = new Array(size);
  }

  push(metric: MetricPoint): void {
    this.buffer[this.head] = metric;
    this.head = (this.head + 1) % this.size;
    if (this.count < this.size) {
      this.count++;
    }
  }

  getRecent(minutes: number = 5): MetricPoint[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const result: MetricPoint[] = [];
    
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - 1 - i + this.size) % this.size;
      const metric = this.buffer[index];
      if (metric && metric.timestamp >= cutoff) {
        result.push(metric);
      } else {
        break;
      }
    }
    
    return result.reverse();
  }

  aggregate(timeWindow: number = 5): Map<string, AggregatedMetric> {
    const cutoff = new Date(Date.now() - timeWindow * 60 * 1000);
    const aggregates = new Map<string, AggregatedMetric>();

    for (let i = 0; i < this.count; i++) {
      const index = (this.head - 1 - i + this.size) % this.size;
      const metric = this.buffer[index];
      
      if (!metric || metric.timestamp < cutoff) continue;

      const key = `${metric.component}_${metric.metric_type}`;
      
      if (!aggregates.has(key)) {
        aggregates.set(key, {
          component: metric.component,
          metric_type: metric.metric_type,
          value: metric.value,
          timestamp: metric.timestamp,
          count: 1,
          min: metric.value,
          max: metric.value,
          avg: metric.value
        });
      } else {
        const agg = aggregates.get(key)!;
        agg.count++;
        agg.min = Math.min(agg.min, metric.value);
        agg.max = Math.max(agg.max, metric.value);
        agg.avg = (agg.avg * (agg.count - 1) + metric.value) / agg.count;
        agg.value = metric.value; // Latest value
        agg.timestamp = metric.timestamp;
      }
    }

    return aggregates;
  }
}

class MetricsProcessor {
  private buffer: CircularBuffer;
  private redis: Redis;
  private supabase: any;
  private io: Server;
  private alertThresholds: Map<string, number>;
  private lastPersist: Date;

  constructor() {
    this.buffer = new CircularBuffer(50000);
    this.redis = new Redis(process.env.REDIS_URL!);
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.alertThresholds = new Map();
    this.lastPersist = new Date();
    
    this.initializeAlertThresholds();
    this.startPeriodicTasks();
  }

  private initializeAlertThresholds(): void {
    this.alertThresholds.set('cpu_high', 85);
    this.alertThresholds.set('memory_high', 90);
    this.alertThresholds.set('latency_high', 2000);
    this.alertThresholds.set('error_rate_high', 5);
    this.alertThresholds.set('disk_io_high', 80);
  }

  private startPeriodicTasks(): void {
    // Aggregate and broadcast every 5 seconds
    setInterval(() => {
      this.broadcastAggregates();
    }, 5000);

    // Persist to database every 30 seconds
    setInterval(() => {
      this.persistMetrics();
    }, 30000);

    // Cache cleanup every 5 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 300000);
  }

  async processMetric(metric: MetricPoint): Promise<void> {
    try {
      // Add to circular buffer
      this.buffer.push(metric);

      // Cache in Redis with TTL
      const key = `metric:${metric.component}:${metric.metric_type}`;
      await this.redis.zadd(
        key,
        Date.now(),
        JSON.stringify(metric)
      );
      await this.redis.expire(key, 3600); // 1 hour TTL

      // Check alert thresholds
      await this.checkAlertThresholds(metric);

      // Real-time broadcast for critical metrics
      if (this.isCriticalMetric(metric)) {
        this.broadcastMetric(metric);
      }

    } catch (error) {
      console.error('Error processing metric:', error);
    }
  }

  private isCriticalMetric(metric: MetricPoint): boolean {
    const criticalTypes = ['cpu', 'memory', 'latency', 'error_rate'];
    return criticalTypes.includes(metric.metric_type);
  }

  private async checkAlertThresholds(metric: MetricPoint): Promise<void> {
    const thresholdKey = `${metric.metric_type}_high`;
    const threshold = this.alertThresholds.get(thresholdKey);
    
    if (threshold && metric.value > threshold) {
      await this.triggerAlert({
        component: metric.component,
        metric_type: metric.metric_type,
        value: metric.value,
        threshold,
        timestamp: metric.timestamp
      });
    }
  }

  private async triggerAlert(alert: any): Promise<void> {
    try {
      // Store alert in database
      await this.supabase
        .from('performance_alerts')
        .insert({
          component: alert.component,
          metric_type: alert.metric_type,
          value: alert.value,
          threshold: alert.threshold,
          created_at: alert.timestamp.toISOString()
        });

      // Broadcast alert via WebSocket
      if (this.io) {
        this.io.emit('performance_alert', alert);
      }

      // Cache recent alert to prevent spam
      await this.redis.setex(
        `alert:${alert.component}:${alert.metric_type}`,
        300, // 5 minutes
        JSON.stringify(alert)
      );

    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }

  private broadcastMetric(metric: MetricPoint): void {
    if (this.io) {
      this.io.emit('real_time_metric', {
        component: metric.component,
        metric_type: metric.metric_type,
        value: metric.value,
        timestamp: metric.timestamp
      });
    }
  }

  private broadcastAggregates(): void {
    if (!this.io) return;

    try {
      const aggregates = this.buffer.aggregate(1); // 1 minute window
      const aggregateArray = Array.from(aggregates.values());
      
      this.io.emit('metric_aggregates', {
        timestamp: new Date(),
        metrics: aggregateArray,
        count: aggregateArray.length
      });
    } catch (error) {
      console.error('Error broadcasting aggregates:', error);
    }
  }

  private async persistMetrics(): Promise<void> {
    try {
      const recentMetrics = this.buffer.getRecent(1); // Last 1 minute
      
      if (recentMetrics.length === 0) return;

      // Batch insert to Supabase
      const batchSize = 100;
      for (let i = 0; i < recentMetrics.length; i += batchSize) {
        const batch = recentMetrics.slice(i, i + batchSize);
        const records = batch.map(metric => ({
          component: metric.component,
          metric_type: metric.metric_type,
          value: metric.value,
          timestamp: metric.timestamp.toISOString(),
          metadata: metric.metadata,
          tags: metric.tags
        }));

        await this.supabase
          .from('performance_metrics')
          .insert(records);
      }

      this.lastPersist = new Date();
    } catch (error) {
      console.error('Error persisting metrics:', error);
    }
  }

  private async cleanupCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('metric:*');
      const pipeline = this.redis.pipeline();
      
      for (const key of keys) {
        // Remove old entries (older than 1 hour)
        const cutoff = Date.now() - 3600000;
        pipeline.zremrangebyscore(key, '-inf', cutoff);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  getHistoricalMetrics(query: any): Promise<any[]> {
    const timeRange = parseInt(query.timeRange?.replace(/[^\d]/g, '') || '5');
    const metrics = this.buffer.getRecent(timeRange);
    
    // Filter by components and metric types if specified
    let filtered = metrics;
    if (query.components?.length) {
      filtered = filtered.filter(m => query.components.includes(m.component));
    }
    if (query.metrics?.length) {
      filtered = filtered.filter(m => query.metrics.includes(m.metric_type));
    }

    return Promise.resolve(filtered);
  }

  setWebSocketServer(io: Server): void {
    this.io = io;
  }
}

// Global metrics processor instance
let metricsProcessor: MetricsProcessor;

function getMetricsProcessor(): MetricsProcessor {
  if (!metricsProcessor) {
    metricsProcessor = new MetricsProcessor();
  }
  return metricsProcessor;
}

// POST endpoint for submitting metrics
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 1000, 60); // 1000 requests per minute
    if (!rateLimitResult.success) {
      return Response.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate single metric or batch
    const isArray = Array.isArray(body);
    const metrics = isArray ? body : [body];
    
    const validatedMetrics = metrics.map(metric => {
      const result = MetricSchema.safeParse(metric);
      if (!result.success) {
        throw new Error(`Invalid metric data: ${result.error.message}`);
      }
      
      return {
        ...result.data,
        timestamp: result.data.timestamp ? new Date(result.data.timestamp) : new Date()
      } as MetricPoint;
    });

    const processor = getMetricsProcessor();
    
    // Process all metrics
    await Promise.all(
      validatedMetrics.map(metric => processor.processMetric(metric))
    );

    return Response.json({
      success: true,
      processed: validatedMetrics.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Metrics processing error:', error);
    return Response.json(
      { error: 'Failed to process metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for querying historical metrics
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 100, 60); // 100 requests per minute
    if (!rateLimitResult.success) {
      return Response.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      components: searchParams.get('components')?.split(','),
      metrics: searchParams.get('metrics')?.split(','),
      timeRange: searchParams.get('timeRange') || '5m',
      granularity: searchParams.get('granularity') || '5s',
      aggregate: searchParams.get('aggregate') || 'avg'
    };

    const result = QuerySchema.safeParse(queryParams);
    if (!result.success) {
      return Response.json(
        { error: 'Invalid query parameters', details: result.error.message },
        { status: 400 }
      );
    }

    const processor = getMetricsProcessor();
    const metrics = await processor.getHistoricalMetrics(result.data);

    // Transform for dashboard consumption
    const transformed = metrics.reduce((acc, metric) => {
      const key = `${metric.component}_${metric.metric_type}`;
      if (!acc[key]) {
        acc[key] = {
          component: metric.component,
          metric_type: metric.metric_type,
          dataPoints: []
        };
      }
      acc[key].dataPoints.push({
        timestamp: metric.timestamp,
        value: metric.value
      });
      return acc;
    }, {} as Record<string, any>);

    return Response.json({
      success: true,
      query: result.data,
      metrics: Object.values(transformed),
      totalPoints: metrics.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Metrics query error:', error);
    return Response.json(
      { error: 'Failed to query metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// WebSocket upgrade handler
export async function UPGRADE(request: NextRequest) {
  try {
    // Authentication for WebSocket
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return new Response('Unauthorized', { status: 401 });
    }

    // This would typically be handled by a separate WebSocket server
    // In Next.js, you'd need to set up a custom server or use a service like Pusher
    return new Response('WebSocket upgrade not supported in this environment', { 
      status: 501 
    });

  } catch (error) {
    console.error('WebSocket upgrade error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  return new Response(null, { 
    status: 200,
    headers: {
      'X-Service': 'real-time-metrics',
      'X-Status': 'healthy',
      'X-Timestamp': new Date().toISOString()
    }
  });
}
```