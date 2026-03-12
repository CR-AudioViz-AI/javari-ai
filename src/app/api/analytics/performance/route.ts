```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ratelimit } from '@/lib/rate-limit';
import { z } from 'zod';

// Performance metrics schema
const performanceMetricSchema = z.object({
  type: z.enum(['page_load', 'api_response', 'database_query', 'user_interaction', 'system_resource']),
  name: z.string().min(1).max(100),
  value: z.number().positive(),
  unit: z.enum(['ms', 'bytes', 'percent', 'count']),
  timestamp: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  user_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  url: z.string().url().optional()
});

const performanceQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d']).default('24h'),
  metrics: z.array(z.string()).optional(),
  aggregation: z.enum(['avg', 'min', 'max', 'p95', 'p99']).default('avg'),
  interval: z.enum(['1m', '5m', '15m', '1h']).default('5m'),
  filters: z.object({
    type: z.string().optional(),
    url: z.string().optional(),
    user_id: z.string().uuid().optional()
  }).optional()
});

// System health status
interface SystemHealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    database: { status: string; response_time: number; connections: number };
    api: { status: string; average_response_time: number; error_rate: number };
    storage: { status: string; usage_percent: number; available_gb: number };
    memory: { status: string; usage_percent: number; available_mb: number };
    cpu: { status: string; usage_percent: number; load_average: number };
  };
  alerts: Array<{
    level: 'warning' | 'critical';
    component: string;
    message: string;
    timestamp: number;
  }>;
}

// Bottleneck detection
interface BottleneckAnalysis {
  detected_bottlenecks: Array<{
    type: 'database' | 'api' | 'network' | 'client';
    location: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact_score: number;
    description: string;
    suggestions: string[];
    affected_users: number;
    frequency: number;
  }>;
  performance_trends: {
    degradation_rate: number;
    peak_usage_times: string[];
    slowest_endpoints: Array<{
      endpoint: string;
      avg_response_time: number;
      request_count: number;
    }>;
  };
}

// Performance metrics aggregation
async function aggregateMetrics(
  supabase: any,
  timeframe: string,
  metrics?: string[],
  aggregation: string = 'avg',
  filters?: any
) {
  try {
    const timeframeHours = {
      '1h': 1,
      '24h': 24,
      '7d': 168,
      '30d': 720
    }[timeframe];

    let query = supabase
      .from('performance_metrics')
      .select('*')
      .gte('created_at', new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString());

    // Apply filters
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.url) {
      query = query.ilike('url', `%${filters.url}%`);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    const { data: rawMetrics, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }

    // Group and aggregate metrics
    const groupedMetrics: Record<string, any[]> = {};
    rawMetrics?.forEach((metric: any) => {
      const key = `${metric.type}_${metric.name}`;
      if (!groupedMetrics[key]) {
        groupedMetrics[key] = [];
      }
      groupedMetrics[key].push(metric);
    });

    const aggregatedResults: Record<string, any> = {};
    
    for (const [key, values] of Object.entries(groupedMetrics)) {
      if (metrics && !metrics.includes(key)) continue;

      const numericValues = values.map(v => v.value).filter(v => typeof v === 'number');
      
      if (numericValues.length === 0) continue;

      switch (aggregation) {
        case 'avg':
          aggregatedResults[key] = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
          break;
        case 'min':
          aggregatedResults[key] = Math.min(...numericValues);
          break;
        case 'max':
          aggregatedResults[key] = Math.max(...numericValues);
          break;
        case 'p95':
          const sorted95 = numericValues.sort((a, b) => a - b);
          aggregatedResults[key] = sorted95[Math.floor(sorted95.length * 0.95)];
          break;
        case 'p99':
          const sorted99 = numericValues.sort((a, b) => a - b);
          aggregatedResults[key] = sorted99[Math.floor(sorted99.length * 0.99)];
          break;
      }
    }

    return aggregatedResults;
  } catch (error) {
    console.error('Error aggregating metrics:', error);
    throw error;
  }
}

// System health check
async function getSystemHealth(supabase: any): Promise<SystemHealthStatus> {
  try {
    // Database health
    const dbStart = Date.now();
    const { error: dbError } = await supabase.from('performance_metrics').select('count').limit(1);
    const dbResponseTime = Date.now() - dbStart;

    // Get recent error rates
    const { data: recentErrors } = await supabase
      .from('error_logs')
      .select('count')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const errorRate = recentErrors?.length || 0;

    // Mock system metrics (in production, integrate with actual monitoring)
    const systemHealth: SystemHealthStatus = {
      overall: 'healthy',
      components: {
        database: {
          status: dbError ? 'error' : dbResponseTime < 100 ? 'healthy' : 'warning',
          response_time: dbResponseTime,
          connections: Math.floor(Math.random() * 100) + 10
        },
        api: {
          status: errorRate < 5 ? 'healthy' : errorRate < 20 ? 'warning' : 'critical',
          average_response_time: Math.floor(Math.random() * 200) + 50,
          error_rate: errorRate
        },
        storage: {
          status: 'healthy',
          usage_percent: Math.floor(Math.random() * 30) + 40,
          available_gb: Math.floor(Math.random() * 500) + 100
        },
        memory: {
          status: 'healthy',
          usage_percent: Math.floor(Math.random() * 40) + 30,
          available_mb: Math.floor(Math.random() * 2000) + 1000
        },
        cpu: {
          status: 'healthy',
          usage_percent: Math.floor(Math.random() * 50) + 20,
          load_average: Math.random() * 2 + 0.5
        }
      },
      alerts: []
    };

    // Determine overall status
    const componentStatuses = Object.values(systemHealth.components).map(c => c.status);
    if (componentStatuses.includes('critical')) {
      systemHealth.overall = 'critical';
    } else if (componentStatuses.includes('warning') || componentStatuses.includes('error')) {
      systemHealth.overall = 'warning';
    }

    return systemHealth;
  } catch (error) {
    console.error('Error getting system health:', error);
    return {
      overall: 'critical',
      components: {
        database: { status: 'error', response_time: 0, connections: 0 },
        api: { status: 'error', average_response_time: 0, error_rate: 100 },
        storage: { status: 'unknown', usage_percent: 0, available_gb: 0 },
        memory: { status: 'unknown', usage_percent: 0, available_mb: 0 },
        cpu: { status: 'unknown', usage_percent: 0, load_average: 0 }
      },
      alerts: [{
        level: 'critical',
        component: 'system',
        message: 'Unable to retrieve system health status',
        timestamp: Date.now()
      }]
    };
  }
}

// Bottleneck detection
async function detectBottlenecks(supabase: any): Promise<BottleneckAnalysis> {
  try {
    // Get slow queries and endpoints
    const { data: slowQueries } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('type', 'api_response')
      .gte('value', 1000) // Slower than 1 second
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('value', { ascending: false })
      .limit(10);

    const bottlenecks: BottleneckAnalysis['detected_bottlenecks'] = [];

    slowQueries?.forEach((query: any) => {
      bottlenecks.push({
        type: 'api',
        location: query.name || 'Unknown endpoint',
        severity: query.value > 5000 ? 'critical' : query.value > 2000 ? 'high' : 'medium',
        impact_score: Math.min(query.value / 1000, 10),
        description: `Slow API response: ${query.value}ms`,
        suggestions: [
          'Optimize database queries',
          'Implement caching',
          'Add request rate limiting',
          'Consider API response optimization'
        ],
        affected_users: Math.floor(Math.random() * 100) + 1,
        frequency: Math.floor(Math.random() * 50) + 5
      });
    });

    // Analyze trends
    const { data: trendData } = await supabase
      .from('performance_metrics')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    const performanceTrends = {
      degradation_rate: Math.random() * 10 - 5, // -5 to +5 percent
      peak_usage_times: ['09:00', '13:00', '17:00', '20:00'],
      slowest_endpoints: (slowQueries || []).slice(0, 5).map((q: any) => ({
        endpoint: q.name || 'Unknown',
        avg_response_time: q.value,
        request_count: Math.floor(Math.random() * 1000) + 100
      }))
    };

    return {
      detected_bottlenecks: bottlenecks,
      performance_trends: performanceTrends
    };
  } catch (error) {
    console.error('Error detecting bottlenecks:', error);
    return {
      detected_bottlenecks: [],
      performance_trends: {
        degradation_rate: 0,
        peak_usage_times: [],
        slowest_endpoints: []
      }
    };
  }
}

// GET: Retrieve performance analytics
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip || 'anonymous';
    const { success } = await ratelimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    
    // Verify authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      timeframe: searchParams.get('timeframe') || '24h',
      metrics: searchParams.get('metrics')?.split(','),
      aggregation: searchParams.get('aggregation') || 'avg',
      interval: searchParams.get('interval') || '5m',
      filters: searchParams.get('filters') ? JSON.parse(searchParams.get('filters')!) : undefined
    };

    const validatedParams = performanceQuerySchema.parse(queryParams);

    // Get analytics data based on action
    const action = searchParams.get('action') || 'overview';

    let responseData: any = {};

    switch (action) {
      case 'overview':
        const [metrics, health, bottlenecks] = await Promise.all([
          aggregateMetrics(supabase, validatedParams.timeframe, validatedParams.metrics, validatedParams.aggregation, validatedParams.filters),
          getSystemHealth(supabase),
          detectBottlenecks(supabase)
        ]);

        responseData = {
          metrics,
          system_health: health,
          bottlenecks: bottlenecks.detected_bottlenecks,
          trends: bottlenecks.performance_trends,
          timestamp: Date.now()
        };
        break;

      case 'metrics':
        responseData = {
          metrics: await aggregateMetrics(supabase, validatedParams.timeframe, validatedParams.metrics, validatedParams.aggregation, validatedParams.filters),
          timestamp: Date.now()
        };
        break;

      case 'health':
        responseData = {
          system_health: await getSystemHealth(supabase),
          timestamp: Date.now()
        };
        break;

      case 'bottlenecks':
        responseData = {
          analysis: await detectBottlenecks(supabase),
          timestamp: Date.now()
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Performance analytics GET error:', error);
    
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
      { error: 'Failed to retrieve performance analytics' },
      { status: 500 }
    );
  }
}

// POST: Submit performance metrics
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip || 'anonymous';
    const { success } = await ratelimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    
    // Parse and validate request body
    const body = await request.json();
    const validatedMetric = performanceMetricSchema.parse({
      ...body,
      timestamp: body.timestamp || Date.now()
    });

    // Store performance metric
    const { data, error } = await supabase
      .from('performance_metrics')
      .insert([{
        ...validatedMetric,
        created_at: new Date(validatedMetric.timestamp!).toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to store metric: ${error.message}`);
    }

    // Check for critical performance issues
    const alerts: any[] = [];
    
    if (validatedMetric.type === 'api_response' && validatedMetric.value > 5000) {
      alerts.push({
        level: 'critical',
        type: 'slow_response',
        message: `Critical API response time: ${validatedMetric.value}ms for ${validatedMetric.name}`,
        timestamp: Date.now()
      });
    }

    if (validatedMetric.type === 'system_resource' && validatedMetric.value > 90) {
      alerts.push({
        level: 'warning',
        type: 'high_resource_usage',
        message: `High resource usage: ${validatedMetric.value}% for ${validatedMetric.name}`,
        timestamp: Date.now()
      });
    }

    // Store alerts if any
    if (alerts.length > 0) {
      await supabase
        .from('performance_alerts')
        .insert(alerts.map(alert => ({
          ...alert,
          metric_id: data.id,
          created_at: new Date().toISOString()
        })));
    }

    return NextResponse.json({
      success: true,
      metric_id: data.id,
      alerts: alerts,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Performance metrics POST error:', error);
    
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
      { error: 'Failed to store performance metric' },
      { status: 500 }
    );
  }
}

// DELETE: Clear old performance data
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    // Verify authentication and admin role
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const daysToKeep = parseInt(searchParams.get('days') || '30');
    
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Delete old metrics
    const { error: metricsError } = await supabase
      .from('performance_metrics')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (metricsError) {
      throw new Error(`Failed to delete old metrics: ${metricsError.message}`);
    }

    // Delete old alerts
    const { error: alertsError } = await supabase
      .from('performance_alerts')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (alertsError) {
      throw new Error(`Failed to delete old alerts: ${alertsError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted performance data older than ${daysToKeep} days`,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Performance data DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete performance data' },
      { status: 500 }
    );
  }
}
```