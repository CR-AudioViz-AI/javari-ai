```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Validation schemas
const MonitoringQuerySchema = z.object({
  environment: z.string().optional(),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
  metrics: z.array(z.enum(['success_rate', 'performance', 'resources', 'predictions'])).optional(),
  deploymentId: z.string().optional()
});

const MetricsUpdateSchema = z.object({
  deploymentId: z.string(),
  environment: z.string(),
  metrics: z.object({
    cpu_usage: z.number().min(0).max(100),
    memory_usage: z.number().min(0).max(100),
    disk_usage: z.number().min(0).max(100),
    network_io: z.number().min(0),
    response_time: z.number().min(0),
    error_rate: z.number().min(0).max(100),
    request_count: z.number().min(0),
    uptime: z.number().min(0)
  }),
  status: z.enum(['healthy', 'warning', 'critical', 'failed']),
  timestamp: z.string().datetime().optional()
});

const AlertConfigSchema = z.object({
  threshold: z.number(),
  metric: z.string(),
  condition: z.enum(['gt', 'lt', 'eq']),
  environment: z.string().optional(),
  enabled: z.boolean().default(true)
});

interface DeploymentMetrics {
  deployment_id: string;
  environment: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io: number;
  response_time: number;
  error_rate: number;
  request_count: number;
  uptime: number;
  status: string;
  timestamp: string;
}

interface PredictionResult {
  deployment_id: string;
  failure_probability: number;
  predicted_failure_time: string | null;
  risk_factors: string[];
  confidence: number;
}

class DeploymentMonitor {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async collectMetrics(deploymentId: string, environment: string): Promise<DeploymentMetrics | null> {
    try {
      const { data, error } = await this.supabase
        .from('deployment_metrics')
        .select('*')
        .eq('deployment_id', deploymentId)
        .eq('environment', environment)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error collecting metrics:', error);
      return null;
    }
  }

  async getPerformanceAnalysis(environment?: string, timeRange: string = '24h'): Promise<any> {
    try {
      const timeMap = {
        '1h': '1 hour',
        '6h': '6 hours', 
        '24h': '1 day',
        '7d': '7 days',
        '30d': '30 days'
      };

      let query = this.supabase
        .from('deployment_metrics')
        .select('*')
        .gte('timestamp', `now() - interval '${timeMap[timeRange as keyof typeof timeMap]}'`);

      if (environment) {
        query = query.eq('environment', environment);
      }

      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) throw error;

      // Aggregate performance metrics
      const analysis = this.aggregateMetrics(data);
      return analysis;
    } catch (error) {
      console.error('Error in performance analysis:', error);
      throw error;
    }
  }

  private aggregateMetrics(metrics: DeploymentMetrics[]) {
    if (!metrics.length) return null;

    const successRate = (metrics.filter(m => m.status === 'healthy').length / metrics.length) * 100;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.response_time, 0) / metrics.length;
    const avgCpuUsage = metrics.reduce((sum, m) => sum + m.cpu_usage, 0) / metrics.length;
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memory_usage, 0) / metrics.length;
    const totalErrors = metrics.reduce((sum, m) => sum + (m.error_rate * m.request_count / 100), 0);

    return {
      success_rate: Math.round(successRate * 100) / 100,
      avg_response_time: Math.round(avgResponseTime * 100) / 100,
      avg_cpu_usage: Math.round(avgCpuUsage * 100) / 100,
      avg_memory_usage: Math.round(avgMemoryUsage * 100) / 100,
      total_errors: totalErrors,
      total_requests: metrics.reduce((sum, m) => sum + m.request_count, 0),
      environments: [...new Set(metrics.map(m => m.environment))],
      time_range_covered: {
        start: metrics[metrics.length - 1]?.timestamp,
        end: metrics[0]?.timestamp
      }
    };
  }

  async getPredictiveAnalysis(deploymentId?: string): Promise<PredictionResult[]> {
    try {
      // Get recent metrics for ML analysis
      let query = this.supabase
        .from('deployment_metrics')
        .select('*')
        .gte('timestamp', "now() - interval '7 days'")
        .order('timestamp', { ascending: false });

      if (deploymentId) {
        query = query.eq('deployment_id', deploymentId);
      }

      const { data: metrics, error } = await query;
      if (error) throw error;

      // Group by deployment for individual predictions
      const groupedMetrics = metrics.reduce((acc: Record<string, DeploymentMetrics[]>, metric) => {
        if (!acc[metric.deployment_id]) acc[metric.deployment_id] = [];
        acc[metric.deployment_id].push(metric);
        return acc;
      }, {});

      const predictions: PredictionResult[] = [];

      for (const [depId, depMetrics] of Object.entries(groupedMetrics)) {
        const prediction = await this.generateFailurePrediction(depId, depMetrics);
        predictions.push(prediction);
      }

      return predictions;
    } catch (error) {
      console.error('Error in predictive analysis:', error);
      return [];
    }
  }

  private async generateFailurePrediction(deploymentId: string, metrics: DeploymentMetrics[]): Promise<PredictionResult> {
    // Simple ML-like prediction based on trends and thresholds
    const recent = metrics.slice(0, 10);
    const historical = metrics.slice(10);

    if (recent.length < 5) {
      return {
        deployment_id: deploymentId,
        failure_probability: 0,
        predicted_failure_time: null,
        risk_factors: [],
        confidence: 0.1
      };
    }

    let riskScore = 0;
    const riskFactors: string[] = [];

    // CPU usage trend analysis
    const cpuTrend = this.calculateTrend(recent.map(m => m.cpu_usage));
    if (cpuTrend > 0.1 && recent[0].cpu_usage > 80) {
      riskScore += 0.3;
      riskFactors.push('High CPU usage with increasing trend');
    }

    // Memory usage analysis
    const memoryTrend = this.calculateTrend(recent.map(m => m.memory_usage));
    if (memoryTrend > 0.1 && recent[0].memory_usage > 85) {
      riskScore += 0.25;
      riskFactors.push('High memory usage with increasing trend');
    }

    // Error rate analysis
    const errorTrend = this.calculateTrend(recent.map(m => m.error_rate));
    if (errorTrend > 0.05 && recent[0].error_rate > 5) {
      riskScore += 0.4;
      riskFactors.push('Increasing error rate');
    }

    // Response time degradation
    const responseTrend = this.calculateTrend(recent.map(m => m.response_time));
    if (responseTrend > 0.1) {
      riskScore += 0.2;
      riskFactors.push('Degrading response times');
    }

    // Disk usage check
    if (recent[0].disk_usage > 90) {
      riskScore += 0.35;
      riskFactors.push('Critical disk usage');
    }

    const failureProbability = Math.min(riskScore, 0.99);
    let predictedFailureTime: string | null = null;

    if (failureProbability > 0.7) {
      // Estimate time to failure based on current trends
      const hoursToFailure = Math.max(1, (1 - failureProbability) * 24);
      predictedFailureTime = new Date(Date.now() + hoursToFailure * 60 * 60 * 1000).toISOString();
    }

    return {
      deployment_id: deploymentId,
      failure_probability: Math.round(failureProbability * 10000) / 100,
      predicted_failure_time: predictedFailureTime,
      risk_factors: riskFactors,
      confidence: recent.length >= 10 ? 0.85 : 0.6
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + (val * idx), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  async checkAlertThresholds(metrics: DeploymentMetrics): Promise<void> {
    try {
      const { data: alerts, error } = await this.supabase
        .from('alert_configurations')
        .select('*')
        .eq('enabled', true)
        .or(`environment.eq.${metrics.environment},environment.is.null`);

      if (error) throw error;

      for (const alert of alerts) {
        const metricValue = (metrics as any)[alert.metric];
        if (metricValue === undefined) continue;

        let triggered = false;
        switch (alert.condition) {
          case 'gt':
            triggered = metricValue > alert.threshold;
            break;
          case 'lt':
            triggered = metricValue < alert.threshold;
            break;
          case 'eq':
            triggered = metricValue === alert.threshold;
            break;
        }

        if (triggered) {
          await this.triggerAlert(alert, metrics, metricValue);
        }
      }
    } catch (error) {
      console.error('Error checking alert thresholds:', error);
    }
  }

  private async triggerAlert(alert: any, metrics: DeploymentMetrics, value: number): Promise<void> {
    try {
      // Store alert in database
      await this.supabase
        .from('deployment_alerts')
        .insert({
          deployment_id: metrics.deployment_id,
          environment: metrics.environment,
          alert_type: alert.metric,
          threshold: alert.threshold,
          actual_value: value,
          severity: this.determineSeverity(alert.metric, value),
          message: `${alert.metric} threshold exceeded: ${value} ${alert.condition} ${alert.threshold}`,
          timestamp: new Date().toISOString()
        });

      // Send notifications (webhook, email, etc.)
      await this.sendNotification(alert, metrics, value);
    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }

  private determineSeverity(metric: string, value: number): string {
    const severityMap: Record<string, (val: number) => string> = {
      cpu_usage: (val) => val > 95 ? 'critical' : val > 85 ? 'warning' : 'info',
      memory_usage: (val) => val > 95 ? 'critical' : val > 85 ? 'warning' : 'info',
      disk_usage: (val) => val > 95 ? 'critical' : val > 90 ? 'warning' : 'info',
      error_rate: (val) => val > 10 ? 'critical' : val > 5 ? 'warning' : 'info',
      response_time: (val) => val > 5000 ? 'critical' : val > 2000 ? 'warning' : 'info'
    };

    return severityMap[metric]?.(value) || 'info';
  }

  private async sendNotification(alert: any, metrics: DeploymentMetrics, value: number): Promise<void> {
    // Implementation for webhook notifications, Slack, Discord, etc.
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Deployment Alert: ${alert.metric} threshold exceeded`,
            attachments: [{
              color: this.determineSeverity(alert.metric, value) === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'Deployment ID', value: metrics.deployment_id, short: true },
                { title: 'Environment', value: metrics.environment, short: true },
                { title: 'Metric', value: alert.metric, short: true },
                { title: 'Value', value: `${value}`, short: true },
                { title: 'Threshold', value: `${alert.threshold}`, short: true },
                { title: 'Timestamp', value: metrics.timestamp, short: true }
              ]
            }]
          })
        });
      } catch (error) {
        console.error('Error sending Slack notification:', error);
      }
    }
  }
}

// GET - Retrieve monitoring data and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams);
    
    const validatedParams = MonitoringQuerySchema.parse(params);
    const monitor = new DeploymentMonitor();

    const results: any = {};

    // Get performance analysis if requested
    if (!validatedParams.metrics || validatedParams.metrics.includes('performance')) {
      results.performance = await monitor.getPerformanceAnalysis(
        validatedParams.environment,
        validatedParams.timeRange
      );
    }

    // Get predictive analysis if requested
    if (!validatedParams.metrics || validatedParams.metrics.includes('predictions')) {
      results.predictions = await monitor.getPredictiveAnalysis(validatedParams.deploymentId);
    }

    // Get success rates if requested
    if (!validatedParams.metrics || validatedParams.metrics.includes('success_rate')) {
      const { data: successData } = await monitor.supabase
        .from('deployment_metrics')
        .select('status, environment, timestamp')
        .gte('timestamp', `now() - interval '${validatedParams.timeRange === '1h' ? '1 hour' : 
          validatedParams.timeRange === '6h' ? '6 hours' : 
          validatedParams.timeRange === '24h' ? '1 day' : 
          validatedParams.timeRange === '7d' ? '7 days' : '30 days'}'`)
        .eq('environment', validatedParams.environment || undefined);

      if (successData) {
        const totalDeployments = successData.length;
        const successfulDeployments = successData.filter(d => d.status === 'healthy').length;
        results.success_rate = {
          rate: totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0,
          total: totalDeployments,
          successful: successfulDeployments,
          failed: totalDeployments - successfulDeployments
        };
      }
    }

    // Get resource utilization if requested
    if (!validatedParams.metrics || validatedParams.metrics.includes('resources')) {
      const { data: resourceData } = await monitor.supabase
        .from('deployment_metrics')
        .select('cpu_usage, memory_usage, disk_usage, network_io, environment, timestamp')
        .gte('timestamp', `now() - interval '${validatedParams.timeRange === '1h' ? '1 hour' : 
          validatedParams.timeRange === '6h' ? '6 hours' : 
          validatedParams.timeRange === '24h' ? '1 day' : 
          validatedParams.timeRange === '7d' ? '7 days' : '30 days'}'`)
        .eq('environment', validatedParams.environment || undefined)
        .order('timestamp', { ascending: false });

      if (resourceData?.length) {
        results.resources = {
          avg_cpu: resourceData.reduce((sum, d) => sum + d.cpu_usage, 0) / resourceData.length,
          avg_memory: resourceData.reduce((sum, d) => sum + d.memory_usage, 0) / resourceData.length,
          avg_disk: resourceData.reduce((sum, d) => sum + d.disk_usage, 0) / resourceData.length,
          avg_network: resourceData.reduce((sum, d) => sum + d.network_io, 0) / resourceData.length,
          peak_cpu: Math.max(...resourceData.map(d => d.cpu_usage)),
          peak_memory: Math.max(...resourceData.map(d => d.memory_usage)),
          peak_disk: Math.max(...resourceData.map(d => d.disk_usage))
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in monitoring GET:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to retrieve monitoring data' },
      { status: 500 }
    );
  }
}

// POST - Update metrics or configure alerts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const monitor = new DeploymentMonitor();

    if (body.type === 'metrics') {
      const validatedMetrics = MetricsUpdateSchema.parse(body.data);
      
      // Insert metrics into database
      const metricsData = {
        deployment_id: validatedMetrics.deploymentId,
        environment: validatedMetrics.environment,
        cpu_usage: validatedMetrics.metrics.cpu_usage,
        memory_usage: validatedMetrics.metrics.memory_usage,
        disk_usage: validatedMetrics.metrics.disk_usage,
        network_io: validatedMetrics.metrics.network_io,
        response_time: validatedMetrics.metrics.response_time,
        error_rate: validatedMetrics.metrics.error_rate,
        request_count: validatedMetrics.metrics.request_count,
        uptime: validatedMetrics.metrics.uptime,
        status: validatedMetrics.status,
        timestamp: validatedMetrics.timestamp || new Date().toISOString()
      };

      const { error } = await monitor.supabase
        .from('deployment_metrics')
        .insert(metricsData);

      if (error) throw error;

      // Check alert thresholds
      await monitor.checkAlertThresholds(metricsData);

      return NextResponse.json({
        success: true,
        message: 'Metrics updated successfully',
        data: metricsData
      });

    } else if (body.type === 'alert_config') {
      const validatedAlert = AlertConfigSchema.parse(body.data);
      
      const { error } = await monitor.supabase
        .from('alert_configurations')
        .upsert(validatedAlert);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Alert configuration updated successfully',
        data: validatedAlert
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request type' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error in monitoring POST:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update monitoring data' },
      { status: 500 }
    );
  }
}

// DELETE - Remove old metrics or alert configurations
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const monitor = new DeploymentMonitor();

    if (action === 'cleanup_metrics') {
      const retentionDays = parseInt(searchParams.get('retention_days') || '30');
      
      const { error } = await monitor.supabase
        .from('deployment_metrics')
        .delete()
        .lt('timestamp', new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Cleaned up metrics older than ${retentionDays} days`
      });

    } else if (action === 'delete_alert') {
      const alertId = searchParams.get('alert_id');
      if (!alertId) {
        return NextResponse.json(
          { success: false, error: 'Alert ID is required' },
          { status: 400 }
        );
      }

      const { error } = await monitor.supabase
        .from('alert_configurations')
        .delete()
        .eq('