```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { z } from 'zod';

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  PERFORMANCE_API_KEY: z.string().min(32),
});

const env = envSchema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  REDIS_URL: process.env.REDIS_URL!,
  PERFORMANCE_API_KEY: process.env.PERFORMANCE_API_KEY!,
});

// Initialize clients
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const redis = new Redis(env.REDIS_URL, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

// Type definitions
interface PerformanceMetric {
  id: string;
  service: string;
  endpoint: string;
  method: string;
  response_time: number;
  throughput: number;
  error_rate: number;
  status_code: number;
  timestamp: string;
  user_id?: string;
  region: string;
  version: string;
}

interface AggregatedMetrics {
  service: string;
  avg_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  total_requests: number;
  error_count: number;
  error_rate: number;
  throughput: number;
  peak_throughput: number;
  uptime_percentage: number;
  window_start: string;
  window_end: string;
}

interface AlertThreshold {
  id: string;
  service: string;
  metric_type: 'response_time' | 'error_rate' | 'throughput' | 'uptime';
  threshold_value: number;
  comparison: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  window_minutes: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  created_by: string;
}

interface Alert {
  id: string;
  threshold_id: string;
  service: string;
  metric_type: string;
  current_value: number;
  threshold_value: number;
  severity: string;
  message: string;
  triggered_at: string;
  resolved_at?: string;
  status: 'active' | 'resolved' | 'acknowledged';
}

// Validation schemas
const metricsQuerySchema = z.object({
  service: z.string().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  window: z.enum(['1m', '5m', '15m', '30m', '1h', '6h', '24h']).optional().default('5m'),
  aggregation: z.enum(['avg', 'p95', 'p99', 'sum']).optional().default('avg'),
  live: z.string().transform(val => val === 'true').optional(),
});

const metricSubmissionSchema = z.object({
  service: z.string().min(1).max(100),
  endpoint: z.string().min(1).max(500),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
  response_time: z.number().min(0).max(60000),
  status_code: z.number().min(100).max(599),
  user_id: z.string().uuid().optional(),
  region: z.string().min(1).max(50).default('us-east-1'),
  version: z.string().min(1).max(50).default('1.0.0'),
});

// Performance collector class
class PerformanceCollector {
  private static readonly BUFFER_KEY_PREFIX = 'perf_metrics';
  private static readonly BUFFER_SIZE = 1000;
  private static readonly FLUSH_INTERVAL = 5000; // 5 seconds

  static async collectMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'throughput' | 'error_rate'>) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    // Calculate throughput and error rate from Redis counters
    const throughput = await this.calculateThroughput(metric.service, metric.endpoint);
    const error_rate = await this.calculateErrorRate(metric.service, metric.endpoint, metric.status_code);
    
    const fullMetric: PerformanceMetric = {
      id,
      timestamp,
      throughput,
      error_rate,
      ...metric,
    };

    // Buffer in Redis for real-time processing
    const bufferKey = `${this.BUFFER_KEY_PREFIX}:${metric.service}`;
    await redis.lpush(bufferKey, JSON.stringify(fullMetric));
    await redis.ltrim(bufferKey, 0, this.BUFFER_SIZE - 1);
    await redis.expire(bufferKey, 3600); // 1 hour TTL

    // Increment counters
    const counterKey = `counters:${metric.service}:${metric.endpoint}`;
    const errorKey = `errors:${metric.service}:${metric.endpoint}`;
    
    await redis.incr(counterKey);
    await redis.expire(counterKey, 300); // 5 minutes
    
    if (metric.status_code >= 400) {
      await redis.incr(errorKey);
      await redis.expire(errorKey, 300);
    }

    return fullMetric;
  }

  private static async calculateThroughput(service: string, endpoint: string): Promise<number> {
    const counterKey = `counters:${service}:${endpoint}`;
    const count = await redis.get(counterKey);
    const ttl = await redis.ttl(counterKey);
    
    if (!count || ttl <= 0) return 0;
    
    const timeWindow = 300 - ttl; // seconds elapsed
    return timeWindow > 0 ? parseInt(count) / timeWindow : 0;
  }

  private static async calculateErrorRate(service: string, endpoint: string, statusCode: number): Promise<number> {
    const counterKey = `counters:${service}:${endpoint}`;
    const errorKey = `errors:${service}:${endpoint}`;
    
    const [totalCount, errorCount] = await Promise.all([
      redis.get(counterKey),
      redis.get(errorKey),
    ]);

    const total = parseInt(totalCount || '0');
    const errors = parseInt(errorCount || '0');
    
    return total > 0 ? (errors / total) * 100 : 0;
  }
}

// Alert engine class
class AlertEngine {
  static async evaluateThresholds(metric: PerformanceMetric) {
    const { data: thresholds } = await supabase
      .from('alert_thresholds')
      .select('*')
      .eq('service', metric.service)
      .eq('enabled', true);

    if (!thresholds?.length) return;

    for (const threshold of thresholds) {
      const shouldTrigger = await this.shouldTriggerAlert(threshold, metric);
      
      if (shouldTrigger) {
        await this.triggerAlert(threshold, metric);
      }
    }
  }

  private static async shouldTriggerAlert(threshold: AlertThreshold, metric: PerformanceMetric): Promise<boolean> {
    let currentValue: number;

    switch (threshold.metric_type) {
      case 'response_time':
        currentValue = metric.response_time;
        break;
      case 'error_rate':
        currentValue = metric.error_rate;
        break;
      case 'throughput':
        currentValue = metric.throughput;
        break;
      default:
        return false;
    }

    switch (threshold.comparison) {
      case 'gt':
        return currentValue > threshold.threshold_value;
      case 'gte':
        return currentValue >= threshold.threshold_value;
      case 'lt':
        return currentValue < threshold.threshold_value;
      case 'lte':
        return currentValue <= threshold.threshold_value;
      case 'eq':
        return currentValue === threshold.threshold_value;
      default:
        return false;
    }
  }

  private static async triggerAlert(threshold: AlertThreshold, metric: PerformanceMetric) {
    const alert: Omit<Alert, 'id'> = {
      threshold_id: threshold.id,
      service: threshold.service,
      metric_type: threshold.metric_type,
      current_value: threshold.metric_type === 'response_time' ? metric.response_time :
                     threshold.metric_type === 'error_rate' ? metric.error_rate : metric.throughput,
      threshold_value: threshold.threshold_value,
      severity: threshold.severity,
      message: this.generateAlertMessage(threshold, metric),
      triggered_at: new Date().toISOString(),
      status: 'active',
    };

    const { error } = await supabase
      .from('performance_alerts')
      .insert([alert]);

    if (!error) {
      // Publish to real-time channel
      await supabase
        .channel('performance_alerts')
        .send({
          type: 'broadcast',
          event: 'alert_triggered',
          payload: alert,
        });
    }
  }

  private static generateAlertMessage(threshold: AlertThreshold, metric: PerformanceMetric): string {
    const value = threshold.metric_type === 'response_time' ? metric.response_time :
                  threshold.metric_type === 'error_rate' ? metric.error_rate : metric.throughput;
    
    return `${threshold.service} ${threshold.metric_type} ${threshold.comparison} ${threshold.threshold_value} (current: ${value})`;
  }
}

// Metrics aggregator class
class MetricsAggregator {
  static async getAggregatedMetrics(
    service?: string,
    startTime?: string,
    endTime?: string,
    window: string = '5m'
  ): Promise<AggregatedMetrics[]> {
    const windowSeconds = this.parseWindow(window);
    const now = new Date();
    const start = startTime ? new Date(startTime) : new Date(now.getTime() - windowSeconds * 1000);
    const end = endTime ? new Date(endTime) : now;

    let query = supabase
      .from('performance_metrics')
      .select(`
        service,
        response_time,
        status_code,
        throughput,
        error_rate,
        timestamp
      `)
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: false });

    if (service) {
      query = query.eq('service', service);
    }

    const { data: metrics, error } = await query;

    if (error || !metrics) {
      throw new Error(`Failed to fetch metrics: ${error?.message}`);
    }

    return this.aggregateMetrics(metrics, windowSeconds);
  }

  private static parseWindow(window: string): number {
    const windowMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '6h': 21600,
      '24h': 86400,
    };
    return windowMap[window] || 300;
  }

  private static aggregateMetrics(metrics: any[], windowSeconds: number): AggregatedMetrics[] {
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.service]) {
        acc[metric.service] = [];
      }
      acc[metric.service].push(metric);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).map(([service, serviceMetrics]) => {
      const responseTimes = serviceMetrics.map(m => m.response_time).sort((a, b) => a - b);
      const errors = serviceMetrics.filter(m => m.status_code >= 400);
      const totalRequests = serviceMetrics.length;

      const p95Index = Math.ceil(responseTimes.length * 0.95) - 1;
      const p99Index = Math.ceil(responseTimes.length * 0.99) - 1;

      return {
        service,
        avg_response_time: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
        p95_response_time: responseTimes[p95Index] || 0,
        p99_response_time: responseTimes[p99Index] || 0,
        total_requests: totalRequests,
        error_count: errors.length,
        error_rate: totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0,
        throughput: serviceMetrics.reduce((sum, m) => sum + m.throughput, 0) / serviceMetrics.length || 0,
        peak_throughput: Math.max(...serviceMetrics.map(m => m.throughput), 0),
        uptime_percentage: totalRequests > 0 ? ((totalRequests - errors.length) / totalRequests) * 100 : 100,
        window_start: serviceMetrics[serviceMetrics.length - 1]?.timestamp || new Date().toISOString(),
        window_end: serviceMetrics[0]?.timestamp || new Date().toISOString(),
      };
    });
  }
}

// Authentication helper
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  return apiKey === env.PERFORMANCE_API_KEY;
}

// GET - Retrieve performance metrics
export async function GET(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validated = metricsQuerySchema.parse(queryParams);

    if (validated.live) {
      // Return buffered real-time metrics from Redis
      const pattern = validated.service 
        ? `${PerformanceCollector['BUFFER_KEY_PREFIX']}:${validated.service}`
        : `${PerformanceCollector['BUFFER_KEY_PREFIX']}:*`;
      
      const keys = await redis.keys(pattern);
      const metrics: PerformanceMetric[] = [];
      
      for (const key of keys) {
        const buffer = await redis.lrange(key, 0, 99); // Last 100 metrics
        for (const item of buffer) {
          metrics.push(JSON.parse(item));
        }
      }

      return NextResponse.json({
        success: true,
        data: metrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        count: metrics.length,
        live: true,
        timestamp: new Date().toISOString(),
      });
    }

    const aggregatedMetrics = await MetricsAggregator.getAggregatedMetrics(
      validated.service,
      validated.start_time,
      validated.end_time,
      validated.window
    );

    return NextResponse.json({
      success: true,
      data: aggregatedMetrics,
      count: aggregatedMetrics.length,
      window: validated.window,
      aggregation: validated.aggregation,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit performance metric
export async function POST(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = metricSubmissionSchema.parse(body);

    const metric = await PerformanceCollector.collectMetric(validated);

    // Store in Supabase for historical analysis
    const { error: dbError } = await supabase
      .from('performance_metrics')
      .insert([metric]);

    if (dbError) {
      console.error('Database insertion error:', dbError);
    }

    // Evaluate alert thresholds
    await AlertEngine.evaluateThresholds(metric);

    // Publish to real-time channel
    await supabase
      .channel('performance_metrics')
      .send({
        type: 'broadcast',
        event: 'metric_received',
        payload: metric,
      });

    return NextResponse.json({
      success: true,
      data: metric,
      timestamp: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error submitting performance metric:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid metric data',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update alert thresholds
export async function PUT(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { threshold_id, ...updates } = body;

    if (!threshold_id) {
      return NextResponse.json(
        { error: 'threshold_id is required' },
        { status: 400 }
      );
    }

    const { data: threshold, error } = await supabase
      .from('alert_thresholds')
      .update(updates)
      .eq('id', threshold_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update threshold' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: threshold,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating alert threshold:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Clear old metrics
export async function DELETE(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const beforeDate = searchParams.get('before');
    const service = searchParams.get('service');

    if (!beforeDate) {
      return NextResponse.json(
        { error: 'before parameter is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('performance_metrics')
      .delete()
      .lt('timestamp', beforeDate);

    if (service) {
      query = query.eq('service', service);
    }

    const { error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete metrics' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted_count: count,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error deleting performance metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```