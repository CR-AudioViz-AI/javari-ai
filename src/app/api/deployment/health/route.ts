```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ratelimit } from '@/lib/ratelimit';

// Environment variables validation
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request schemas
const healthCheckSchema = z.object({
  deploymentId: z.string().uuid(),
  environment: z.enum(['production', 'staging', 'development']),
  cloudProvider: z.enum(['aws', 'azure', 'gcp', 'kubernetes']),
  includeMetrics: z.boolean().optional().default(true),
  anomalyDetection: z.boolean().optional().default(true)
});

const metricsSubmissionSchema = z.object({
  deploymentId: z.string().uuid(),
  timestamp: z.string().datetime(),
  metrics: z.object({
    cpu_usage: z.number().min(0).max(100),
    memory_usage: z.number().min(0).max(100),
    disk_usage: z.number().min(0).max(100),
    network_io: z.number().min(0),
    response_time: z.number().min(0),
    error_rate: z.number().min(0).max(100),
    throughput: z.number().min(0),
    active_connections: z.number().min(0)
  }),
  cloudProvider: z.enum(['aws', 'azure', 'gcp', 'kubernetes']),
  region: z.string(),
  instanceId: z.string()
});

const remediationTriggerSchema = z.object({
  deploymentId: z.string().uuid(),
  action: z.enum(['restart', 'scale_up', 'scale_down', 'rollback', 'alert_only']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  reason: z.string().min(1).max(500),
  autoExecute: z.boolean().optional().default(false)
});

// Health Metrics Collector
class HealthMetricsCollector {
  static async collectMetrics(deploymentId: string, cloudProvider: string) {
    try {
      const { data: deployment, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deploymentId)
        .single();

      if (error) throw error;

      // Collect metrics based on cloud provider
      const metrics = await this.getCloudProviderMetrics(deployment, cloudProvider);
      
      // Store metrics in database
      const { error: insertError } = await supabase
        .from('deployment_metrics')
        .insert({
          deployment_id: deploymentId,
          metrics: metrics,
          collected_at: new Date().toISOString(),
          cloud_provider: cloudProvider
        });

      if (insertError) throw insertError;

      return metrics;
    } catch (error) {
      console.error('Metrics collection failed:', error);
      throw new Error('Failed to collect deployment metrics');
    }
  }

  private static async getCloudProviderMetrics(deployment: any, provider: string) {
    // Mock implementation - replace with actual cloud provider API calls
    const baseMetrics = {
      cpu_usage: Math.random() * 80 + 10,
      memory_usage: Math.random() * 70 + 15,
      disk_usage: Math.random() * 60 + 20,
      network_io: Math.random() * 1000,
      response_time: Math.random() * 200 + 50,
      error_rate: Math.random() * 5,
      throughput: Math.random() * 10000,
      active_connections: Math.floor(Math.random() * 1000)
    };

    return {
      ...baseMetrics,
      provider_specific: await this.getProviderSpecificMetrics(provider, deployment)
    };
  }

  private static async getProviderSpecificMetrics(provider: string, deployment: any) {
    switch (provider) {
      case 'aws':
        return { 
          ec2_instances: deployment.instance_count || 1,
          load_balancer_health: 'healthy',
          rds_connections: Math.floor(Math.random() * 100)
        };
      case 'azure':
        return {
          vm_instances: deployment.instance_count || 1,
          app_service_health: 'healthy',
          storage_usage: Math.random() * 1000
        };
      case 'gcp':
        return {
          compute_instances: deployment.instance_count || 1,
          cloud_run_health: 'healthy',
          pub_sub_messages: Math.floor(Math.random() * 10000)
        };
      case 'kubernetes':
        return {
          pod_count: deployment.pod_count || 3,
          node_health: 'ready',
          persistent_volume_usage: Math.random() * 100
        };
      default:
        return {};
    }
  }
}

// Anomaly Detection Engine
class AnomalyDetectionEngine {
  static async detectAnomalies(deploymentId: string, currentMetrics: any) {
    try {
      // Get historical metrics for baseline
      const { data: historicalMetrics, error } = await supabase
        .from('deployment_metrics')
        .select('metrics, collected_at')
        .eq('deployment_id', deploymentId)
        .gte('collected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('collected_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const anomalies = [];
      
      // CPU usage anomaly detection
      if (this.detectCPUAnomaly(currentMetrics, historicalMetrics)) {
        anomalies.push({
          metric: 'cpu_usage',
          current_value: currentMetrics.cpu_usage,
          severity: currentMetrics.cpu_usage > 90 ? 'critical' : 'high',
          description: `CPU usage spike detected: ${currentMetrics.cpu_usage.toFixed(2)}%`
        });
      }

      // Memory usage anomaly detection
      if (this.detectMemoryAnomaly(currentMetrics, historicalMetrics)) {
        anomalies.push({
          metric: 'memory_usage',
          current_value: currentMetrics.memory_usage,
          severity: currentMetrics.memory_usage > 95 ? 'critical' : 'high',
          description: `Memory usage anomaly: ${currentMetrics.memory_usage.toFixed(2)}%`
        });
      }

      // Error rate anomaly detection
      if (this.detectErrorRateAnomaly(currentMetrics, historicalMetrics)) {
        anomalies.push({
          metric: 'error_rate',
          current_value: currentMetrics.error_rate,
          severity: currentMetrics.error_rate > 10 ? 'critical' : 'medium',
          description: `Error rate spike: ${currentMetrics.error_rate.toFixed(2)}%`
        });
      }

      // Store anomalies
      if (anomalies.length > 0) {
        await supabase
          .from('deployment_anomalies')
          .insert({
            deployment_id: deploymentId,
            anomalies: anomalies,
            detected_at: new Date().toISOString(),
            status: 'active'
          });
      }

      return anomalies;
    } catch (error) {
      console.error('Anomaly detection failed:', error);
      throw new Error('Failed to detect anomalies');
    }
  }

  private static detectCPUAnomaly(current: any, historical: any[]): boolean {
    if (!historical.length) return current.cpu_usage > 85;
    
    const avgCPU = historical.reduce((sum, record) => sum + record.metrics.cpu_usage, 0) / historical.length;
    const threshold = avgCPU + (avgCPU * 0.5); // 50% increase threshold
    
    return current.cpu_usage > Math.max(threshold, 80);
  }

  private static detectMemoryAnomaly(current: any, historical: any[]): boolean {
    if (!historical.length) return current.memory_usage > 90;
    
    const avgMemory = historical.reduce((sum, record) => sum + record.metrics.memory_usage, 0) / historical.length;
    const threshold = avgMemory + (avgMemory * 0.4); // 40% increase threshold
    
    return current.memory_usage > Math.max(threshold, 85);
  }

  private static detectErrorRateAnomaly(current: any, historical: any[]): boolean {
    if (!historical.length) return current.error_rate > 5;
    
    const avgErrorRate = historical.reduce((sum, record) => sum + record.metrics.error_rate, 0) / historical.length;
    const threshold = avgErrorRate * 3; // 3x normal error rate
    
    return current.error_rate > Math.max(threshold, 2);
  }
}

// Remediation Trigger Service
class RemediationTriggerService {
  static async triggerRemediation(deploymentId: string, action: string, severity: string, reason: string, autoExecute: boolean = false) {
    try {
      const remediationId = crypto.randomUUID();
      
      // Log remediation action
      const { error: logError } = await supabase
        .from('remediation_actions')
        .insert({
          id: remediationId,
          deployment_id: deploymentId,
          action: action,
          severity: severity,
          reason: reason,
          status: autoExecute ? 'executing' : 'pending',
          triggered_at: new Date().toISOString(),
          auto_execute: autoExecute
        });

      if (logError) throw logError;

      if (autoExecute) {
        await this.executeRemediation(remediationId, deploymentId, action);
      }

      // Send alert notification
      await this.sendAlert(deploymentId, action, severity, reason);

      return { remediationId, status: autoExecute ? 'executing' : 'pending' };
    } catch (error) {
      console.error('Remediation trigger failed:', error);
      throw new Error('Failed to trigger remediation');
    }
  }

  private static async executeRemediation(remediationId: string, deploymentId: string, action: string) {
    try {
      let result = { success: false, message: 'Unknown action' };

      switch (action) {
        case 'restart':
          result = await this.restartDeployment(deploymentId);
          break;
        case 'scale_up':
          result = await this.scaleDeployment(deploymentId, 'up');
          break;
        case 'scale_down':
          result = await this.scaleDeployment(deploymentId, 'down');
          break;
        case 'rollback':
          result = await this.rollbackDeployment(deploymentId);
          break;
        default:
          result = { success: false, message: `Unsupported action: ${action}` };
      }

      // Update remediation status
      await supabase
        .from('remediation_actions')
        .update({
          status: result.success ? 'completed' : 'failed',
          result: result.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', remediationId);

      return result;
    } catch (error) {
      await supabase
        .from('remediation_actions')
        .update({
          status: 'failed',
          result: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', remediationId);
      
      throw error;
    }
  }

  private static async restartDeployment(deploymentId: string) {
    // Mock implementation - replace with actual deployment restart logic
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, message: 'Deployment restarted successfully' };
  }

  private static async scaleDeployment(deploymentId: string, direction: 'up' | 'down') {
    // Mock implementation - replace with actual scaling logic
    await new Promise(resolve => setTimeout(resolve, 3000));
    return { success: true, message: `Deployment scaled ${direction} successfully` };
  }

  private static async rollbackDeployment(deploymentId: string) {
    // Mock implementation - replace with actual rollback logic
    await new Promise(resolve => setTimeout(resolve, 5000));
    return { success: true, message: 'Deployment rolled back successfully' };
  }

  private static async sendAlert(deploymentId: string, action: string, severity: string, reason: string) {
    // Mock implementation - integrate with actual alerting services
    console.log(`ALERT [${severity.toUpperCase()}]: Deployment ${deploymentId} - ${action} triggered. Reason: ${reason}`);
  }
}

// Health Score Calculator
class HealthScoreCalculator {
  static calculateHealthScore(metrics: any, anomalies: any[]): number {
    let score = 100;

    // Deduct points based on metrics
    if (metrics.cpu_usage > 80) score -= (metrics.cpu_usage - 80) * 2;
    if (metrics.memory_usage > 85) score -= (metrics.memory_usage - 85) * 3;
    if (metrics.error_rate > 1) score -= metrics.error_rate * 10;
    if (metrics.response_time > 1000) score -= Math.min((metrics.response_time - 1000) / 100, 30);

    // Deduct points based on anomalies
    anomalies.forEach(anomaly => {
      switch (anomaly.severity) {
        case 'critical': score -= 40; break;
        case 'high': score -= 25; break;
        case 'medium': score -= 15; break;
        case 'low': score -= 5; break;
      }
    });

    return Math.max(0, Math.round(score));
  }
}

// GET - Retrieve deployment health status
export async function GET(request: NextRequest) {
  try {
    const { success } = await ratelimit.limit('deployment-health-get');
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('deploymentId');
    const environment = searchParams.get('environment');
    const cloudProvider = searchParams.get('cloudProvider');
    const includeMetrics = searchParams.get('includeMetrics') === 'true';
    const anomalyDetection = searchParams.get('anomalyDetection') === 'true';

    if (!deploymentId) {
      return NextResponse.json(
        { error: 'Deployment ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deploymentId)) {
      return NextResponse.json(
        { error: 'Invalid deployment ID format' },
        { status: 400 }
      );
    }

    // Get deployment info
    const { data: deployment, error: deploymentError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .single();

    if (deploymentError || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    let healthData: any = {
      deploymentId,
      status: deployment.status || 'unknown',
      lastUpdated: new Date().toISOString()
    };

    if (includeMetrics) {
      // Get latest metrics
      const { data: latestMetrics } = await supabase
        .from('deployment_metrics')
        .select('*')
        .eq('deployment_id', deploymentId)
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();

      if (latestMetrics) {
        healthData.metrics = latestMetrics.metrics;
        healthData.metricsTimestamp = latestMetrics.collected_at;

        // Calculate health score
        const anomalies = anomalyDetection ? await AnomalyDetectionEngine.detectAnomalies(deploymentId, latestMetrics.metrics) : [];
        healthData.healthScore = HealthScoreCalculator.calculateHealthScore(latestMetrics.metrics, anomalies);
        
        if (anomalyDetection) {
          healthData.anomalies = anomalies;
        }
      }
    }

    // Get recent remediation actions
    const { data: remediations } = await supabase
      .from('remediation_actions')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('triggered_at', { ascending: false })
      .limit(5);

    healthData.recentActions = remediations || [];

    return NextResponse.json(healthData);

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Submit health metrics or trigger remediation
export async function POST(request: NextRequest) {
  try {
    const { success } = await ratelimit.limit('deployment-health-post');
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const action = body.action;

    if (action === 'submit_metrics') {
      const validation = metricsSubmissionSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid metrics data', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { deploymentId, timestamp, metrics, cloudProvider, region, instanceId } = validation.data;

      // Store metrics
      const { error: insertError } = await supabase
        .from('deployment_metrics')
        .insert({
          deployment_id: deploymentId,
          metrics: metrics,
          collected_at: timestamp,
          cloud_provider: cloudProvider,
          region: region,
          instance_id: instanceId
        });

      if (insertError) {
        console.error('Failed to store metrics:', insertError);
        return NextResponse.json(
          { error: 'Failed to store metrics' },
          { status: 500 }
        );
      }

      // Run anomaly detection
      const anomalies = await AnomalyDetectionEngine.detectAnomalies(deploymentId, metrics);
      
      // Calculate health score
      const healthScore = HealthScoreCalculator.calculateHealthScore(metrics, anomalies);

      // Trigger automatic remediation if critical anomalies detected
      const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
      if (criticalAnomalies.length > 0) {
        await RemediationTriggerService.triggerRemediation(
          deploymentId,
          'restart',
          'critical',
          `Critical anomalies detected: ${criticalAnomalies.map(a => a.description).join(', ')}`,
          true
        );
      }

      return NextResponse.json({
        success: true,
        healthScore,
        anomalies: anomalies.length,
        criticalAnomalies: criticalAnomalies.length,
        autoRemediationTriggered: criticalAnomalies.length > 0
      });

    } else if (action === 'trigger_remediation') {
      const validation = remediationTriggerSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid remediation request', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { deploymentId, action: remediationAction, severity, reason, autoExecute } = validation.data;

      const result = await RemediationTriggerService.triggerRemediation(
        deploymentId,
        remediationAction,
        severity,
        reason,
        autoExecute
      );

      return NextResponse.json(result);

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: submit_metrics, trigger_remediation' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Health API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update deployment health configuration
export async function PUT(request: NextRequest) {
  try {
    const { success } = await ratelimit.limit('deployment-health-put');
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { deploymentId, healthConfig } = body;

    if (!deploymentId || !healthConfig) {
      return NextResponse.json(
        { error: 'Deployment ID and health configuration are required' },
        { status: 400 }
      );
    }

    // Update deployment health configuration
    const { error } = await supabase
      .from('deployments')
      .update({ health_config: healthConfig })
      .eq('id', deploymentId);

    if (error) {
      console.error('Failed to update health config:', error);
      return NextResponse.json(
        { error: 'Failed to update health configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Health configuration updated successfully'
    });

  } catch (error) {
    console.error('Health config update failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Remove deployment health monitoring
export async function DELETE(request: NextRequest) {
  try {
    const { success } = await ratelimit.limit('deployment-health-delete');
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit