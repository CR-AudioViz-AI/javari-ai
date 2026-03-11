```typescript
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DeploymentValidationService } from './DeploymentValidationService';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('web-vitals');
jest.mock('axios');
jest.mock('playwright');
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    realtime: {
      channel: jest.fn(),
    },
  },
}));
jest.mock('../../../lib/notifications', () => ({
  NotificationService: {
    send: jest.fn(),
  },
}));

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  update: jest.fn().mockResolvedValue({ data: null, error: null }),
  select: jest.fn().mockResolvedValue({ data: [], error: null }),
  realtime: {
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    }),
  },
};

const mockNotificationService = {
  send: jest.fn().mockResolvedValue(true),
};

// Mock web vitals
const mockWebVitals = {
  getCLS: jest.fn(),
  getFCP: jest.fn(),
  getFID: jest.fn(),
  getLCP: jest.fn(),
  getTTFB: jest.fn(),
};

// Mock axios
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
};

// Mock playwright
const mockPlaywright = {
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn(),
          click: jest.fn(),
          fill: jest.fn(),
          waitForSelector: jest.fn(),
          screenshot: jest.fn(),
          close: jest.fn(),
        }),
        close: jest.fn(),
      }),
      close: jest.fn(),
    }),
  },
};

describe('DeploymentValidationService', () => {
  let validationService: DeploymentValidationService;
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      deployment: {
        id: 'test-deployment-123',
        version: '1.0.0',
        environment: 'staging',
        url: 'https://staging.example.com',
      },
      validation: {
        functional: {
          enabled: true,
          timeout: 300000,
          retries: 3,
          testSuites: ['smoke', 'critical'],
        },
        performance: {
          enabled: true,
          thresholds: {
            lcp: 2500,
            fid: 100,
            cls: 0.1,
            ttfb: 800,
          },
          duration: 60000,
        },
        security: {
          enabled: true,
          scanTypes: ['vulnerability', 'dependency', 'headers'],
          severity: 'medium',
        },
        rollback: {
          enabled: true,
          triggers: {
            functionalFailureThreshold: 0.1,
            performanceRegressionThreshold: 0.2,
            securityVulnerabilityThreshold: 'high',
          },
        },
      },
      notifications: {
        slack: {
          webhook: 'https://hooks.slack.com/test',
          channels: ['#deployments'],
        },
        email: {
          recipients: ['team@example.com'],
        },
      },
    };

    validationService = new DeploymentValidationService(mockConfig);
    
    // Mock implementation methods
    (validationService as any).supabase = mockSupabase;
    (validationService as any).notificationService = mockNotificationService;
    (validationService as any).webVitals = mockWebVitals;
    (validationService as any).axios = mockAxios;
    (validationService as any).playwright = mockPlaywright;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    test('should initialize with valid configuration', () => {
      expect(validationService).toBeInstanceOf(DeploymentValidationService);
      expect((validationService as any).config).toEqual(mockConfig);
      expect((validationService as any).deploymentId).toBe('test-deployment-123');
    });

    test('should throw error with invalid configuration', () => {
      expect(() => {
        new DeploymentValidationService({});
      }).toThrow('Invalid deployment validation configuration');
    });

    test('should throw error when deployment URL is missing', () => {
      const invalidConfig = {
        ...mockConfig,
        deployment: { ...mockConfig.deployment, url: null },
      };

      expect(() => {
        new DeploymentValidationService(invalidConfig);
      }).toThrow('Deployment URL is required for validation');
    });
  });

  describe('Validation Orchestration', () => {
    test('should run complete validation successfully', async () => {
      const mockResults = {
        functional: { passed: 15, failed: 0, success: true },
        performance: { metrics: { lcp: 2000 }, success: true },
        security: { vulnerabilities: [], success: true },
      };

      jest.spyOn(validationService as any, 'runFunctionalTests').mockResolvedValue(mockResults.functional);
      jest.spyOn(validationService as any, 'runPerformanceBenchmark').mockResolvedValue(mockResults.performance);
      jest.spyOn(validationService as any, 'runSecurityScan').mockResolvedValue(mockResults.security);
      jest.spyOn(validationService as any, 'updateValidationStatus').mockResolvedValue(true);
      jest.spyOn(validationService as any, 'evaluateRollbackTriggers').mockReturnValue(false);

      const result = await validationService.validateDeployment();

      expect(result).toEqual({
        success: true,
        deploymentId: 'test-deployment-123',
        results: mockResults,
        rollbackRequired: false,
        completedAt: expect.any(Date),
      });
      
      expect(mockNotificationService.send).toHaveBeenCalledWith({
        type: 'deployment_validation_complete',
        status: 'success',
        deploymentId: 'test-deployment-123',
        summary: expect.any(String),
      });
    });

    test('should handle validation failure and trigger rollback', async () => {
      const mockResults = {
        functional: { passed: 10, failed: 5, success: false },
        performance: { metrics: { lcp: 4000 }, success: false },
        security: { vulnerabilities: [{ severity: 'high' }], success: false },
      };

      jest.spyOn(validationService as any, 'runFunctionalTests').mockResolvedValue(mockResults.functional);
      jest.spyOn(validationService as any, 'runPerformanceBenchmark').mockResolvedValue(mockResults.performance);
      jest.spyOn(validationService as any, 'runSecurityScan').mockResolvedValue(mockResults.security);
      jest.spyOn(validationService as any, 'updateValidationStatus').mockResolvedValue(true);
      jest.spyOn(validationService as any, 'evaluateRollbackTriggers').mockReturnValue(true);
      jest.spyOn(validationService as any, 'triggerRollback').mockResolvedValue(true);

      const result = await validationService.validateDeployment();

      expect(result.success).toBe(false);
      expect(result.rollbackRequired).toBe(true);
      expect((validationService as any).triggerRollback).toHaveBeenCalled();
    });

    test('should handle validation service errors gracefully', async () => {
      jest.spyOn(validationService as any, 'runFunctionalTests').mockRejectedValue(new Error('Test runner failed'));
      jest.spyOn(validationService as any, 'updateValidationStatus').mockResolvedValue(true);

      const result = await validationService.validateDeployment();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test runner failed');
      expect(mockNotificationService.send).toHaveBeenCalledWith({
        type: 'deployment_validation_error',
        deploymentId: 'test-deployment-123',
        error: expect.any(String),
      });
    });
  });

  describe('Functional Testing', () => {
    test('should run functional tests successfully', async () => {
      const mockTestResults = [
        { suite: 'smoke', tests: [{ name: 'homepage', status: 'passed' }] },
        { suite: 'critical', tests: [{ name: 'login', status: 'passed' }] },
      ];

      jest.spyOn(validationService as any, 'executeTestSuite').mockResolvedValue({ passed: true, results: mockTestResults[0] });
      
      const result = await (validationService as any).runFunctionalTests();

      expect(result.success).toBe(true);
      expect(result.passed).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
    });

    test('should handle test failures properly', async () => {
      jest.spyOn(validationService as any, 'executeTestSuite').mockResolvedValue({ 
        passed: false, 
        results: { suite: 'smoke', tests: [{ name: 'homepage', status: 'failed', error: 'Timeout' }] } 
      });

      const result = await (validationService as any).runFunctionalTests();

      expect(result.success).toBe(false);
      expect(result.failed).toBeGreaterThan(0);
    });

    test('should retry failed tests according to configuration', async () => {
      jest.spyOn(validationService as any, 'executeTestSuite')
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ passed: true, results: {} });

      const result = await (validationService as any).runFunctionalTests();

      expect((validationService as any).executeTestSuite).toHaveBeenCalledTimes(6); // 2 suites * 3 retries
    });
  });

  describe('Performance Benchmarking', () => {
    test('should collect performance metrics successfully', async () => {
      const mockMetrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 600,
        fcp: 1200,
      };

      mockWebVitals.getCLS.mockImplementation((callback) => callback({ value: 0.05 }));
      mockWebVitals.getFCP.mockImplementation((callback) => callback({ value: 1200 }));
      mockWebVitals.getFID.mockImplementation((callback) => callback({ value: 50 }));
      mockWebVitals.getLCP.mockImplementation((callback) => callback({ value: 2000 }));
      mockWebVitals.getTTFB.mockImplementation((callback) => callback({ value: 600 }));

      jest.spyOn(validationService as any, 'collectWebVitals').mockResolvedValue(mockMetrics);

      const result = await (validationService as any).runPerformanceBenchmark();

      expect(result.success).toBe(true);
      expect(result.metrics).toEqual(mockMetrics);
      expect(result.thresholdsMet).toBe(true);
    });

    test('should detect performance regressions', async () => {
      const mockMetrics = {
        lcp: 3000, // Above threshold
        fid: 150,  // Above threshold
        cls: 0.15, // Above threshold
        ttfb: 1000, // Above threshold
        fcp: 2000,
      };

      jest.spyOn(validationService as any, 'collectWebVitals').mockResolvedValue(mockMetrics);

      const result = await (validationService as any).runPerformanceBenchmark();

      expect(result.success).toBe(false);
      expect(result.thresholdsMet).toBe(false);
      expect(result.failedThresholds).toHaveLength(4);
    });

    test('should handle performance monitoring errors', async () => {
      jest.spyOn(validationService as any, 'collectWebVitals').mockRejectedValue(new Error('Metrics collection failed'));

      const result = await (validationService as any).runPerformanceBenchmark();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Metrics collection failed');
    });
  });

  describe('Security Scanning', () => {
    test('should run security scan successfully', async () => {
      const mockScanResults = {
        vulnerabilities: [],
        dependencyIssues: [],
        headerIssues: [],
        score: 95,
      };

      jest.spyOn(validationService as any, 'runVulnerabilityScan').mockResolvedValue({ vulnerabilities: [] });
      jest.spyOn(validationService as any, 'runDependencyScan').mockResolvedValue({ issues: [] });
      jest.spyOn(validationService as any, 'runHeaderScan').mockResolvedValue({ issues: [] });

      const result = await (validationService as any).runSecurityScan();

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.securityScore).toBeGreaterThan(90);
    });

    test('should detect security vulnerabilities', async () => {
      const mockVulnerabilities = [
        { severity: 'high', description: 'SQL Injection vulnerability' },
        { severity: 'medium', description: 'XSS vulnerability' },
      ];

      jest.spyOn(validationService as any, 'runVulnerabilityScan').mockResolvedValue({ 
        vulnerabilities: mockVulnerabilities 
      });
      jest.spyOn(validationService as any, 'runDependencyScan').mockResolvedValue({ issues: [] });
      jest.spyOn(validationService as any, 'runHeaderScan').mockResolvedValue({ issues: [] });

      const result = await (validationService as any).runSecurityScan();

      expect(result.success).toBe(false);
      expect(result.vulnerabilities).toHaveLength(2);
      expect(result.highSeverityCount).toBe(1);
    });

    test('should handle security scan errors', async () => {
      jest.spyOn(validationService as any, 'runVulnerabilityScan').mockRejectedValue(new Error('Scanner unavailable'));

      const result = await (validationService as any).runSecurityScan();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Scanner unavailable');
    });
  });

  describe('Rollback Evaluation', () => {
    test('should not trigger rollback when all validations pass', () => {
      const mockResults = {
        functional: { success: true, failureRate: 0 },
        performance: { success: true, regressionRate: 0 },
        security: { success: true, highSeverityCount: 0 },
      };

      const shouldRollback = (validationService as any).evaluateRollbackTriggers(mockResults);

      expect(shouldRollback).toBe(false);
    });

    test('should trigger rollback when functional failure threshold exceeded', () => {
      const mockResults = {
        functional: { success: false, failureRate: 0.15 }, // Above 0.1 threshold
        performance: { success: true, regressionRate: 0 },
        security: { success: true, highSeverityCount: 0 },
      };

      const shouldRollback = (validationService as any).evaluateRollbackTriggers(mockResults);

      expect(shouldRollback).toBe(true);
    });

    test('should trigger rollback when performance regression threshold exceeded', () => {
      const mockResults = {
        functional: { success: true, failureRate: 0 },
        performance: { success: false, regressionRate: 0.25 }, // Above 0.2 threshold
        security: { success: true, highSeverityCount: 0 },
      };

      const shouldRollback = (validationService as any).evaluateRollbackTriggers(mockResults);

      expect(shouldRollback).toBe(true);
    });

    test('should trigger rollback when high severity vulnerabilities found', () => {
      const mockResults = {
        functional: { success: true, failureRate: 0 },
        performance: { success: true, regressionRate: 0 },
        security: { success: false, vulnerabilities: [{ severity: 'critical' }] },
      };

      const shouldRollback = (validationService as any).evaluateRollbackTriggers(mockResults);

      expect(shouldRollback).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    test('should check deployment health successfully', async () => {
      mockAxios.get.mockResolvedValue({
        status: 200,
        data: { status: 'healthy', uptime: 100 },
      });

      const result = await (validationService as any).checkDeploymentHealth();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeDefined();
      expect(result.status).toBe('healthy');
    });

    test('should detect unhealthy deployment', async () => {
      mockAxios.get.mockResolvedValue({
        status: 500,
        data: { status: 'error' },
      });

      const result = await (validationService as any).checkDeploymentHealth();

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('error');
    });

    test('should handle health check network errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await (validationService as any).checkDeploymentHealth();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('Metrics and Reporting', () => {
    test('should update validation status in Supabase', async () => {
      mockSupabase.insert.mockResolvedValue({ data: { id: '123' }, error: null });

      const result = await (validationService as any).updateValidationStatus('running', { test: 'data' });

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('deployment_validations');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        deployment_id: 'test-deployment-123',
        status: 'running',
        metadata: { test: 'data' },
        created_at: expect.any(Date),
      });
    });

    test('should handle Supabase update errors', async () => {
      mockSupabase.insert.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      const result = await (validationService as any).updateValidationStatus('failed');

      expect(result).toBe(false);
    });

    test('should generate validation report', () => {
      const mockResults = {
        functional: { success: true, passed: 15, failed: 0 },
        performance: { success: true, metrics: { lcp: 2000 } },
        security: { success: true, vulnerabilities: [] },
      };

      const report = (validationService as any).generateValidationReport(mockResults);

      expect(report).toContain('Deployment Validation Report');
      expect(report).toContain('test-deployment-123');
      expect(report).toContain('Functional Tests: PASSED');
      expect(report).toContain('Performance: PASSED');
      expect(report).toContain('Security: PASSED');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate required configuration fields', () => {
      const invalidConfigs = [
        { deployment: {} },
        { deployment: { id: 'test' } },
        { deployment: { id: 'test', url: 'invalid-url' } },
        { validation: {} },
      ];

      invalidConfigs.forEach(config => {
        expect(() => {
          (validationService as any).validateConfig(config);
        }).toThrow();
      });
    });

    test('should accept valid configuration', () => {
      expect(() => {
        (validationService as any).validateConfig(mockConfig);
      }).not.toThrow();
    });
  });

  describe('Real-time Updates', () => {
    test('should setup real-time channel for status updates', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
      };
      mockSupabase.realtime.channel.mockReturnValue(mockChannel);

      (validationService as any).setupRealtimeUpdates();

      expect(mockSupabase.realtime.channel).toHaveBeenCalledWith(`validation:${mockConfig.deployment.id}`);
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    test('should send real-time progress updates', () => {
      const mockChannel = {
        send: jest.fn(),
      };
      (validationService as any).channel = mockChannel;

      (validationService as any).sendProgressUpdate('functional_tests_started', { progress: 25 });

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'validation_progress',
        payload: {
          deploymentId: 'test-deployment-123',
          stage: 'functional_tests_started',
          data: { progress: 25 },
          timestamp: expect.any(Date),
        },
      });
    });
  });
});
```