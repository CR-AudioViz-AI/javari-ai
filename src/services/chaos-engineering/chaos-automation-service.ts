import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ChaosAutomationService } from '../../src/services/chaos-engineering/chaos-automation-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { KubernetesApi } from '@kubernetes/client-node';
import { PrometheusRegistry } from 'prom-client';

// Mock dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@kubernetes/client-node');
jest.mock('prom-client');
jest.mock('node-fetch');

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    then: jest.fn()
  })),
  realtime: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    }))
  }
};

const mockK8sApi = {
  listNamespacedPod: jest.fn(),
  deleteNamespacedPod: jest.fn(),
  patchNamespacedDeployment: jest.fn(),
  readNamespacedService: jest.fn()
};

const mockPrometheusRegistry = {
  register: jest.fn(),
  metrics: jest.fn().mockResolvedValue('# metrics'),
  getSingleMetric: jest.fn(),
  clear: jest.fn()
};

// Mock fetch for external API calls
global.fetch = jest.fn();

describe('ChaosAutomationService', () => {
  let chaosService: ChaosAutomationService;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      supabase: {
        url: 'https://test.supabase.co',
        key: 'test-key'
      },
      kubernetes: {
        configPath: '/test/kubeconfig',
        namespace: 'test-namespace'
      },
      safety: {
        maxConcurrentExperiments: 3,
        cooldownPeriodMs: 300000,
        emergencyStopEnabled: true
      },
      notifications: {
        slack: {
          webhook: 'https://hooks.slack.com/test',
          channel: '#chaos-engineering'
        },
        pagerDuty: {
          integrationKey: 'test-pd-key'
        }
      }
    };

    (SupabaseClient as jest.MockedClass<typeof SupabaseClient>).mockImplementation(() => mockSupabaseClient as any);
    
    chaosService = new ChaosAutomationService(mockConfig);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Chaos Experiment Orchestration', () => {
    it('should initialize chaos automation service successfully', () => {
      expect(chaosService).toBeDefined();
      expect(chaosService.isInitialized()).toBe(true);
    });

    it('should create and schedule chaos experiment', async () => {
      const experimentConfig = {
        id: 'exp-001',
        name: 'Pod Failure Test',
        type: 'pod_termination',
        target: {
          namespace: 'audio-processing',
          selector: { app: 'audio-worker' },
          percentage: 25
        },
        duration: 300000,
        schedule: '0 */6 * * *'
      };

      mockSupabaseClient.from().insert().mockResolvedValue({
        data: { ...experimentConfig, status: 'scheduled' },
        error: null
      });

      const result = await chaosService.createExperiment(experimentConfig);

      expect(result.success).toBe(true);
      expect(result.experimentId).toBe('exp-001');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chaos_experiments');
    });

    it('should execute chaos experiment with safety checks', async () => {
      const experimentId = 'exp-001';
      
      mockSupabaseClient.from().select().single.mockResolvedValue({
        data: {
          id: experimentId,
          status: 'scheduled',
          type: 'pod_termination',
          target: { namespace: 'test', selector: { app: 'test-app' } }
        },
        error: null
      });

      mockK8sApi.listNamespacedPod.mockResolvedValue({
        body: {
          items: [
            { metadata: { name: 'test-pod-1', namespace: 'test' } },
            { metadata: { name: 'test-pod-2', namespace: 'test' } }
          ]
        }
      });

      const result = await chaosService.executeExperiment(experimentId);

      expect(result.success).toBe(true);
      expect(result.status).toBe('running');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'running',
        started_at: expect.any(String)
      });
    });

    it('should abort experiment when safety threshold exceeded', async () => {
      const experimentId = 'exp-danger';
      
      jest.spyOn(chaosService as any, 'checkSafetyThresholds').mockResolvedValue({
        safe: false,
        reason: 'System load too high: 95%',
        metrics: { cpuUsage: 95, errorRate: 0.15 }
      });

      mockSupabaseClient.from().select().single.mockResolvedValue({
        data: {
          id: experimentId,
          status: 'scheduled',
          type: 'cpu_stress'
        },
        error: null
      });

      const result = await chaosService.executeExperiment(experimentId);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Safety threshold exceeded');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'aborted',
        aborted_at: expect.any(String),
        abort_reason: 'System load too high: 95%'
      });
    });

    it('should handle experiment execution errors gracefully', async () => {
      const experimentId = 'exp-error';
      
      mockSupabaseClient.from().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Experiment not found' }
      });

      const result = await chaosService.executeExperiment(experimentId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Experiment not found');
    });
  });

  describe('Failure Injection Engine', () => {
    it('should inject pod termination failure', async () => {
      const failureConfig = {
        type: 'pod_termination',
        target: {
          namespace: 'audio-processing',
          selector: { app: 'audio-worker' },
          count: 1
        }
      };

      mockK8sApi.listNamespacedPod.mockResolvedValue({
        body: {
          items: [
            { metadata: { name: 'audio-worker-123', namespace: 'audio-processing' } }
          ]
        }
      });

      mockK8sApi.deleteNamespacedPod.mockResolvedValue({ response: { statusCode: 200 } });

      const result = await chaosService.injectFailure(failureConfig);

      expect(result.success).toBe(true);
      expect(result.affectedResources).toEqual(['audio-worker-123']);
      expect(mockK8sApi.deleteNamespacedPod).toHaveBeenCalledWith(
        'audio-worker-123',
        'audio-processing'
      );
    });

    it('should inject network latency failure', async () => {
      const failureConfig = {
        type: 'network_latency',
        target: {
          namespace: 'api-gateway',
          selector: { app: 'gateway' },
          latency: '100ms',
          jitter: '10ms'
        }
      };

      // Mock network chaos injection
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, id: 'chaos-net-001' })
      });

      const result = await chaosService.injectFailure(failureConfig);

      expect(result.success).toBe(true);
      expect(result.chaosId).toBe('chaos-net-001');
    });

    it('should inject resource exhaustion failure', async () => {
      const failureConfig = {
        type: 'memory_pressure',
        target: {
          namespace: 'audio-processing',
          selector: { app: 'audio-analyzer' },
          memoryMB: 512,
          duration: 180000
        }
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, processId: 'stress-001' })
      });

      const result = await chaosService.injectFailure(failureConfig);

      expect(result.success).toBe(true);
      expect(result.processId).toBe('stress-001');
    });

    it('should handle failure injection errors', async () => {
      const failureConfig = {
        type: 'invalid_failure_type',
        target: {}
      };

      const result = await chaosService.injectFailure(failureConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported failure type');
    });
  });

  describe('Resilience Metrics Collection', () => {
    it('should collect system resilience metrics', async () => {
      const mockMetrics = {
        timestamp: new Date().toISOString(),
        systemHealth: {
          cpuUsage: 65.2,
          memoryUsage: 78.5,
          diskUsage: 45.1
        },
        applicationMetrics: {
          responseTime: 150,
          errorRate: 0.02,
          throughput: 1250
        },
        infrastructureStatus: {
          podsRunning: 24,
          podsReady: 22,
          servicesHealthy: 8
        }
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('cpu_usage{} 65.2\nmemory_usage{} 78.5')
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: Array(24).fill({ status: { phase: 'Running' } })
          })
        });

      const result = await chaosService.collectResilienceMetrics();

      expect(result.success).toBe(true);
      expect(result.metrics.systemHealth.cpuUsage).toBeGreaterThan(0);
      expect(result.metrics.infrastructureStatus.podsRunning).toBeGreaterThan(0);
    });

    it('should calculate blast radius for experiment', async () => {
      const experimentId = 'exp-001';
      
      mockSupabaseClient.from().select().single.mockResolvedValue({
        data: {
          id: experimentId,
          type: 'pod_termination',
          target: { namespace: 'audio-processing', selector: { app: 'worker' } }
        },
        error: null
      });

      const result = await chaosService.calculateBlastRadius(experimentId);

      expect(result.success).toBe(true);
      expect(result.blastRadius.estimatedAffectedServices).toBeGreaterThan(0);
      expect(result.blastRadius.criticalityScore).toBeDefined();
    });

    it('should track experiment recovery time', async () => {
      const experimentId = 'exp-001';
      const startTime = Date.now() - 300000; // 5 minutes ago
      
      mockSupabaseClient.from().select().single.mockResolvedValue({
        data: {
          id: experimentId,
          started_at: new Date(startTime).toISOString(),
          status: 'running'
        },
        error: null
      });

      // Mock health check returning healthy status
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy', timestamp: Date.now() })
      });

      const result = await chaosService.validateRecovery(experimentId);

      expect(result.success).toBe(true);
      expect(result.recoveryTime).toBeGreaterThan(0);
      expect(result.systemHealthy).toBe(true);
    });
  });

  describe('Safety Guard System', () => {
    it('should enforce maximum concurrent experiments limit', async () => {
      // Mock 3 running experiments (at limit)
      mockSupabaseClient.from().select.mockResolvedValue({
        data: Array(3).fill({ status: 'running' }),
        error: null
      });

      const experimentConfig = {
        id: 'exp-004',
        name: 'Fourth Experiment',
        type: 'pod_termination'
      };

      const result = await chaosService.createExperiment(experimentConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum concurrent experiments limit reached');
    });

    it('should enforce cooldown period between experiments', async () => {
      const lastExperimentEnd = Date.now() - 60000; // 1 minute ago (less than 5 min cooldown)
      
      mockSupabaseClient.from().select().mockResolvedValue({
        data: [{ 
          ended_at: new Date(lastExperimentEnd).toISOString(),
          target: { namespace: 'test-namespace' }
        }],
        error: null
      });

      const experimentConfig = {
        id: 'exp-cooldown',
        target: { namespace: 'test-namespace' }
      };

      const result = await chaosService.createExperiment(experimentConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cooldown period not elapsed');
    });

    it('should trigger emergency stop for all experiments', async () => {
      mockSupabaseClient.from().select.mockResolvedValue({
        data: [
          { id: 'exp-001', status: 'running' },
          { id: 'exp-002', status: 'running' }
        ],
        error: null
      });

      const result = await chaosService.emergencyStop();

      expect(result.success).toBe(true);
      expect(result.stoppedExperiments).toBe(2);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        status: 'emergency_stopped',
        stopped_at: expect.any(String)
      });
    });

    it('should validate system health before experiment execution', async () => {
      // Mock unhealthy system metrics
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('error_rate{} 0.25\ncpu_usage{} 95.0')
      });

      const safetyCheck = await (chaosService as any).checkSafetyThresholds();

      expect(safetyCheck.safe).toBe(false);
      expect(safetyCheck.reason).toContain('error rate too high');
    });
  });

  describe('Experiment Scheduler', () => {
    it('should schedule recurring chaos experiment', async () => {
      const scheduleConfig = {
        experimentId: 'exp-recurring',
        cronExpression: '0 2 * * 1', // Every Monday at 2 AM
        enabled: true,
        timezone: 'UTC'
      };

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: { ...scheduleConfig, id: 'schedule-001' },
        error: null
      });

      const result = await chaosService.scheduleExperiment(scheduleConfig);

      expect(result.success).toBe(true);
      expect(result.scheduleId).toBe('schedule-001');
    });

    it('should execute scheduled experiments', async () => {
      const mockScheduledExperiments = [
        {
          id: 'schedule-001',
          experimentId: 'exp-001',
          nextRun: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          enabled: true
        }
      ];

      mockSupabaseClient.from().select.mockResolvedValue({
        data: mockScheduledExperiments,
        error: null
      });

      jest.spyOn(chaosService, 'executeExperiment').mockResolvedValue({
        success: true,
        experimentId: 'exp-001',
        status: 'running'
      });

      const result = await chaosService.processScheduledExperiments();

      expect(result.success).toBe(true);
      expect(result.executedCount).toBe(1);
      expect(chaosService.executeExperiment).toHaveBeenCalledWith('exp-001');
    });

    it('should disable schedule after failed experiments', async () => {
      const scheduleId = 'schedule-failing';
      
      mockSupabaseClient.from().select().single.mockResolvedValue({
        data: {
          id: scheduleId,
          failureCount: 3,
          maxRetries: 3
        },
        error: null
      });

      const result = await chaosService.updateScheduleStatus(scheduleId, false);

      expect(result.success).toBe(true);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        enabled: false,
        disabled_reason: 'Max retries exceeded'
      });
    });
  });

  describe('Recovery Validation', () => {
    it('should validate system recovery after experiment', async () => {
      const experimentId = 'exp-recovery';
      
      // Mock successful health checks
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ 
          ok: true, 
          json: () => Promise.resolve({ status: 'healthy' }) 
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('response_time{} 120\nerror_rate{} 0.01')
        });

      const result = await chaosService.validateRecovery(experimentId);

      expect(result.success).toBe(true);
      expect(result.systemHealthy).toBe(true);
      expect(result.recoveryMetrics.responseTime).toBeLessThan(200);
      expect(result.recoveryMetrics.errorRate).toBeLessThan(0.05);
    });

    it('should detect incomplete recovery', async () => {
      const experimentId = 'exp-slow-recovery';
      
      // Mock degraded health checks
      global.fetch = jest.fn()
        .mockResolvedValue({ 
          ok: true, 
          text: () => Promise.resolve('error_rate{} 0.15\nresponse_time{} 5000')
        });

      const result = await chaosService.validateRecovery(experimentId);

      expect(result.success).toBe(false);
      expect(result.systemHealthy).toBe(false);
      expect(result.issues).toContain('High error rate');
      expect(result.issues).toContain('Slow response time');
    });
  });

  describe('Dashboard and Alerting', () => {
    it('should send Slack notification for experiment events', async () => {
      const notification = {
        type: 'experiment_started',
        experimentId: 'exp-001',
        message: 'Chaos experiment "Pod Failure Test" has started'
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true })
      });

      const result = await chaosService.sendNotification('slack', notification);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        mockConfig.notifications.slack.webhook,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Pod Failure Test')
        })
      );
    });

    it('should trigger PagerDuty incident for critical failures', async () => {
      const incident = {
        type: 'experiment_critical_failure',
        experimentId: 'exp-critical',
        severity: 'critical',
        description: 'Chaos experiment caused system-wide outage'
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'success', incident_key: 'INC123' })
      });

      const result = await chaosService.sendNotification('pagerduty', incident);

      expect(result.success).toBe(true);
      expect(result.incidentKey).toBe('INC123');
    });

    it('should generate experiment dashboard data', async () => {
      mockSupabaseClient.from().select.mockResolvedValue({
        data: [
          { id: 'exp-001', status: 'completed', success: true },
          { id: 'exp-002', status: 'running', success: null },
          { id: 'exp-003', status: 'failed', success: false }
        ],
        error: null
      });

      const result = await chaosService.getDashboardData();

      expect(result.success).toBe(true);
      expect(result.data.totalExperiments).toBe(3);
      expect(result.data.activeExperiments).toBe(1);
      expect(result.data.successRate).toBeCloseTo(0.5, 1);
    });

    it('should handle dashboard data generation errors', async () => {
      mockSupabaseClient.from().select.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await chaosService.getDashboardData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      mockSupabaseClient.from().select.mockRejectedValue(
        new Error('Connection timeout')
      );

      const result = await chaosService.getExperimentStatus('exp-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection timeout');
    });

    it('should handle Kubernetes API errors', async () => {
      mockK8sApi.listNamespacedPod.mockRejectedValue(
        new Error('Kubernetes API unavailable')
      );

      const failureConfig = {
        type: 'pod_termination',
        target: { namespace: