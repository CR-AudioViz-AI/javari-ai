```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';
import { performance } from 'perf_hooks';
import * as os from 'os';
import { promisify } from 'util';

// Types
interface PerformanceMetrics {
  timestamp: string;
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    totalRequests: number;
  };
  errorRates: {
    total: number;
    rate: number;
    breakdown: Record<string, number>;
  };
  resourceUtilization: {
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  customMetrics?: Record<string, number>;
}

interface HistoricalTrend {
  metric: string;
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
}

// Validation schema
const QuerySchema = z.object({
  timeRange: z.enum(['1m', '5m', '15m', '1h', '6h', '24h', '7d', '30d']).default('1h'),
  granularity: z.enum(['1s', '10s', '1m', '5m', '15m', '1h', '1d']).default('1m'),
  metricTypes: z.string().optional(),
  format: z.enum(['json', 'prometheus']).default('json'),
  includeHistorical: z.boolean().default(true),
});

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Performance collector class
class PerformanceCollector {
  private static instance: PerformanceCollector;
  private metricsBuffer: Map<string, number[]> = new Map();
  private lastCollection = Date.now();
  
  static getInstance(): PerformanceCollector {
    if (!PerformanceCollector.instance) {
      PerformanceCollector.instance = new PerformanceCollector();
    }
    return PerformanceCollector.instance;
  }

  async collectCurrentMetrics(): Promise<PerformanceMetrics> {
    const now = new Date().toISOString();
    const currentTime = Date.now();
    
    // Get cached request metrics
    const requestMetrics = await this.getRequestMetrics();
    
    // Collect system resource metrics
    const resourceMetrics = await this.getResourceMetrics();
    
    // Get error metrics
    const errorMetrics = await this.getErrorMetrics();
    
    return {
      timestamp: now,
      responseTime: requestMetrics.responseTime,
      throughput: requestMetrics.throughput,
      errorRates: errorMetrics,
      resourceUtilization: resourceMetrics,
    };
  }

  private async getRequestMetrics() {
    const cached = await redis.hgetall('metrics:requests:current');
    const responseTimes = await redis.lrange('metrics:response_times', 0, -1);
    const times = responseTimes.map(Number).filter(Boolean);
    
    if (times.length === 0) {
      return {
        responseTime: { avg: 0, p95: 0, p99: 0, min: 0, max: 0 },
        throughput: { requestsPerSecond: 0, totalRequests: 0 }
      };
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.floor(times.length * 0.95);
    const p99Index = Math.floor(times.length * 0.99);

    return {
      responseTime: {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        p95: times[p95Index] || 0,
        p99: times[p99Index] || 0,
        min: times[0] || 0,
        max: times[times.length - 1] || 0,
      },
      throughput: {
        requestsPerSecond: parseFloat(cached.rps || '0'),
        totalRequests: parseInt(cached.total || '0'),
      }
    };
  }

  private async getResourceMetrics() {
    const cpuUsage = os.loadavg()[0];
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: Math.min(100, (cpuUsage / os.cpus().length) * 100),
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(totalMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100),
      },
      disk: {
        used: 0, // Would integrate with disk usage library
        total: 0,
        percentage: 0,
      }
    };
  }

  private async getErrorMetrics() {
    const errorData = await redis.hgetall('metrics:errors:current');
    const total = parseInt(errorData.total || '0');
    const requests = parseInt(errorData.requests || '1');
    
    return {
      total,
      rate: total / requests,
      breakdown: {
        '4xx': parseInt(errorData.errors_4xx || '0'),
        '5xx': parseInt(errorData.errors_5xx || '0'),
        timeout: parseInt(errorData.errors_timeout || '0'),
      }
    };
  }
}

// Historical data aggregator
class HistoricalAnalyzer {
  async getHistoricalTrends(
    timeRange: string,
    granularity: string,
    metricTypes?: string[]
  ): Promise<HistoricalTrend[]> {
    const endTime = new Date();
    const startTime = this.calculateStartTime(endTime, timeRange);
    
    const { data: historicalData, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error fetching historical data:', error);
      return [];
    }

    return this.analyzeMetricTrends(historicalData, metricTypes);
  }

  private calculateStartTime(endTime: Date, timeRange: string): Date {
    const start = new Date(endTime);
    const ranges: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    
    start.setTime(start.getTime() - ranges[timeRange]);
    return start;
  }

  private analyzeMetricTrends(data: any[], metricTypes?: string[]): HistoricalTrend[] {
    if (!data || data.length === 0) return [];

    const trends: HistoricalTrend[] = [];
    const metrics = ['response_time_avg', 'throughput_rps', 'error_rate', 'cpu_usage'];

    for (const metric of metrics) {
      if (metricTypes && !metricTypes.includes(metric)) continue;

      const dataPoints = data.map(d => ({
        timestamp: d.timestamp,
        value: d.metrics?.[metric] || 0
      }));

      if (dataPoints.length < 2) continue;

      // Calculate trend
      const firstValue = dataPoints[0].value;
      const lastValue = dataPoints[dataPoints.length - 1].value;
      const changeRate = ((lastValue - firstValue) / firstValue) * 100;

      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(changeRate) < 5) {
        trend = 'stable';
      } else if (changeRate > 0) {
        trend = 'increasing';
      } else {
        trend = 'decreasing';
      }

      trends.push({
        metric,
        dataPoints,
        trend,
        changeRate: Math.round(changeRate * 100) / 100
      });
    }

    return trends;
  }
}

// Rate limiting helper
class RateLimiter {
  private static requests = new Map<string, number[]>();

  static async checkLimit(ip: string, limit = 100, window = 60000): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(ip) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < window);
    
    if (validRequests.length >= limit) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(ip, validRequests);
    return true;
  }
}

// Prometheus format converter
class PrometheusFormatter {
  static format(metrics: PerformanceMetrics): string {
    const lines: string[] = [];
    const timestamp = Date.now();

    // Response time metrics
    lines.push(`# HELP http_request_duration_seconds HTTP request duration in seconds`);
    lines.push(`# TYPE http_request_duration_seconds summary`);
    lines.push(`http_request_duration_seconds{quantile="0.5"} ${metrics.responseTime.avg / 1000} ${timestamp}`);
    lines.push(`http_request_duration_seconds{quantile="0.95"} ${metrics.responseTime.p95 / 1000} ${timestamp}`);
    lines.push(`http_request_duration_seconds{quantile="0.99"} ${metrics.responseTime.p99 / 1000} ${timestamp}`);

    // Throughput metrics
    lines.push(`# HELP http_requests_per_second HTTP requests per second`);
    lines.push(`# TYPE http_requests_per_second gauge`);
    lines.push(`http_requests_per_second ${metrics.throughput.requestsPerSecond} ${timestamp}`);

    // Error rate metrics
    lines.push(`# HELP http_error_rate HTTP error rate`);
    lines.push(`# TYPE http_error_rate gauge`);
    lines.push(`http_error_rate ${metrics.errorRates.rate} ${timestamp}`);

    // Resource utilization
    lines.push(`# HELP system_cpu_usage CPU usage percentage`);
    lines.push(`# TYPE system_cpu_usage gauge`);
    lines.push(`system_cpu_usage ${metrics.resourceUtilization.cpu} ${timestamp}`);

    lines.push(`# HELP system_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE system_memory_usage_bytes gauge`);
    lines.push(`system_memory_usage_bytes ${metrics.resourceUtilization.memory.used * 1024 * 1024} ${timestamp}`);

    return lines.join('\n');
  }
}

// Main API handlers
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // Get client IP for rate limiting
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    // Apply rate limiting
    if (!await RateLimiter.checkLimit(ip, 100, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);
    
    const validatedQuery = QuerySchema.safeParse(queryParams);
    if (!validatedQuery.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validatedQuery.error.errors },
        { status: 400 }
      );
    }

    const { timeRange, granularity, metricTypes, format, includeHistorical } = validatedQuery.data;
    const metricTypesArray = metricTypes ? metricTypes.split(',') : undefined;

    // Get performance collector instance
    const collector = PerformanceCollector.getInstance();
    
    // Collect current metrics
    const currentMetrics = await collector.collectCurrentMetrics();
    
    // Get historical trends if requested
    let historicalTrends: HistoricalTrend[] = [];
    if (includeHistorical) {
      const analyzer = new HistoricalAnalyzer();
      historicalTrends = await analyzer.getHistoricalTrends(
        timeRange,
        granularity,
        metricTypesArray
      );
    }

    // Format response based on requested format
    if (format === 'prometheus') {
      const prometheusData = PrometheusFormatter.format(currentMetrics);
      return new NextResponse(prometheusData, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Store current metrics for historical analysis
    await supabase
      .from('performance_metrics')
      .insert({
        timestamp: currentMetrics.timestamp,
        metrics: {
          response_time_avg: currentMetrics.responseTime.avg,
          response_time_p95: currentMetrics.responseTime.p95,
          response_time_p99: currentMetrics.responseTime.p99,
          throughput_rps: currentMetrics.throughput.requestsPerSecond,
          total_requests: currentMetrics.throughput.totalRequests,
          error_rate: currentMetrics.errorRates.rate,
          error_total: currentMetrics.errorRates.total,
          cpu_usage: currentMetrics.resourceUtilization.cpu,
          memory_usage: currentMetrics.resourceUtilization.memory.percentage,
        }
      });

    const response = {
      success: true,
      data: {
        current: currentMetrics,
        ...(includeHistorical && { historical: historicalTrends }),
        metadata: {
          timeRange,
          granularity,
          generatedAt: new Date().toISOString(),
          processingTime: Math.round(performance.now() - startTime),
        }
      }
    };

    // Cache response for 10 seconds
    await redis.setex(
      `metrics:performance:${JSON.stringify(queryParams)}`,
      10,
      JSON.stringify(response)
    );

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=10',
        'X-Processing-Time': `${Math.round(performance.now() - startTime)}ms`,
      },
    });

  } catch (error) {
    console.error('Performance metrics API error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error as Error).message 
          : 'Failed to fetch performance metrics',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    // Quick health checks
    const redisStatus = await redis.ping();
    const supabaseStatus = await supabase.from('performance_metrics').select('count').limit(1);
    
    if (redisStatus === 'PONG' && !supabaseStatus.error) {
      return new NextResponse(null, { status: 200 });
    } else {
      return new NextResponse(null, { status: 503 });
    }
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

// Not allowed methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'GET, HEAD' } }
  );
}
```