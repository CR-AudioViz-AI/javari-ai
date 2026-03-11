import { QualityGateService } from '../../src/quality-gate/quality-gate.service';
import { SecurityScanValidator } from '../../src/quality-gate/validators/security-scan.validator';
import { PerformanceBenchmarkValidator } from '../../src/quality-gate/validators/performance-benchmark.validator';
import { TestCoverageValidator } from '../../src/quality-gate/validators/test-coverage.validator';
import { BusinessRuleValidator } from '../../src/quality-gate/validators/business-rule.validator';
import { DeploymentBlocker } from '../../src/quality-gate/deployment-blocker';
import { QualityReportGenerator } from '../../src/quality-gate/quality-report-generator';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('axios');

const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnValue({ data: null, error: null }),
    select: jest.fn().mockReturnValue({ data: [], error: null }),
    update: jest.fn().mockReturnValue({ data: null, error: null })
  })),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null })
} as unknown as SupabaseClient;

const mockAxios = {
  get: jest.fn(),
  post: jest.fn()
};

// Mock GitHub Actions context
const mockGitHubContext = {
  sha: 'abc123',
  ref: 'refs/heads/main',
  repo: { owner: 'test-org', repo: 'test-repo' },
  workflow: 'CI/CD',
  runId: 12345
};

// Mock Slack/Discord webhook
const mockWebhook = {
  send: jest.fn().mockResolvedValue({ status: 200 })
};

describe('QualityGateService', () => {
  let qualityGateService: QualityGateService;
  let securityValidator: SecurityScanValidator;
  let performanceValidator: PerformanceBenchmarkValidator;
  let testCoverageValidator: TestCoverageValidator;
  let businessRuleValidator: BusinessRuleValidator;
  let deploymentBlocker: DeploymentBlocker;
  let reportGenerator: QualityReportGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    securityValidator = new SecurityScanValidator(mockSupabaseClient, mockAxios);
    performanceValidator = new PerformanceBenchmarkValidator(mockSupabaseClient);
    testCoverageValidator = new TestCoverageValidator(mockSupabaseClient);
    businessRuleValidator = new BusinessRuleValidator(mockSupabaseClient);
    deploymentBlocker = new DeploymentBlocker(mockSupabaseClient, mockWebhook);
    reportGenerator = new QualityReportGenerator(mockSupabaseClient);

    qualityGateService = new QualityGateService({
      supabaseClient: mockSupabaseClient,
      validators: {
        security: securityValidator,
        performance: performanceValidator,
        testCoverage: testCoverageValidator,
        businessRule: businessRuleValidator
      },
      deploymentBlocker,
      reportGenerator,
      webhooks: { slack: mockWebhook, discord: mockWebhook }
    });
  });

  describe('evaluateDeploymentReadiness', () => {
    const mockDeploymentContext = {
      projectId: 'proj-123',
      environment: 'production',
      version: '1.2.3',
      gitContext: mockGitHubContext,
      triggeredBy: 'github-actions',
      timestamp: new Date().toISOString()
    };

    it('should pass quality gate when all validations succeed', async () => {
      // Arrange
      jest.spyOn(securityValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 95,
        issues: [],
        metrics: { vulnerabilities: { critical: 0, high: 0, medium: 2, low: 5 } }
      });

      jest.spyOn(performanceValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 88,
        issues: [],
        metrics: { 
          lighthouse: { performance: 88, accessibility: 92, bestPractices: 85, seo: 90 },
          loadTime: 1200,
          firstContentfulPaint: 800
        }
      });

      jest.spyOn(testCoverageValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 92,
        issues: [],
        metrics: { coverage: 92, lines: 1850, statements: 2100, functions: 340, branches: 580 }
      });

      jest.spyOn(businessRuleValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 100,
        issues: [],
        metrics: { complianceRules: 12, passedRules: 12, failedRules: 0 }
      });

      jest.spyOn(reportGenerator, 'generate').mockResolvedValue({
        id: 'report-123',
        overallScore: 94,
        passed: true,
        summary: 'All quality gates passed',
        detailedResults: {},
        recommendations: []
      });

      // Act
      const result = await qualityGateService.evaluateDeploymentReadiness(mockDeploymentContext);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(94);
      expect(result.blockers).toHaveLength(0);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('quality_gate_evaluations');
      expect(mockWebhook.send).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Quality Gate PASSED')
      }));
    });

    it('should fail quality gate when security validation fails', async () => {
      // Arrange
      jest.spyOn(securityValidator, 'validate').mockResolvedValue({
        passed: false,
        score: 45,
        issues: [
          { severity: 'critical', type: 'sql-injection', description: 'SQL injection vulnerability found' },
          { severity: 'high', type: 'xss', description: 'Cross-site scripting vulnerability' }
        ],
        metrics: { vulnerabilities: { critical: 1, high: 2, medium: 3, low: 1 } }
      });

      jest.spyOn(performanceValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 85,
        issues: [],
        metrics: { lighthouse: { performance: 85, accessibility: 88, bestPractices: 82, seo: 87 } }
      });

      jest.spyOn(testCoverageValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 89,
        issues: [],
        metrics: { coverage: 89 }
      });

      jest.spyOn(businessRuleValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 100,
        issues: [],
        metrics: { complianceRules: 10, passedRules: 10, failedRules: 0 }
      });

      jest.spyOn(deploymentBlocker, 'blockDeployment').mockResolvedValue({
        blocked: true,
        reason: 'Critical security vulnerabilities detected',
        blockerId: 'blocker-456'
      });

      // Act
      const result = await qualityGateService.evaluateDeploymentReadiness(mockDeploymentContext);

      // Assert
      expect(result.passed).toBe(false);
      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0].validator).toBe('security');
      expect(deploymentBlocker.blockDeployment).toHaveBeenCalledWith(
        mockDeploymentContext,
        expect.objectContaining({ reason: expect.stringContaining('security') })
      );
      expect(mockWebhook.send).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Quality Gate FAILED')
      }));
    });

    it('should handle multiple validation failures', async () => {
      // Arrange
      jest.spyOn(securityValidator, 'validate').mockResolvedValue({
        passed: false,
        score: 35,
        issues: [{ severity: 'critical', type: 'vulnerability', description: 'Critical vulnerability' }],
        metrics: { vulnerabilities: { critical: 1, high: 0, medium: 0, low: 0 } }
      });

      jest.spyOn(performanceValidator, 'validate').mockResolvedValue({
        passed: false,
        score: 42,
        issues: [{ severity: 'high', type: 'performance', description: 'Load time exceeds threshold' }],
        metrics: { lighthouse: { performance: 42 }, loadTime: 5000 }
      });

      jest.spyOn(testCoverageValidator, 'validate').mockResolvedValue({
        passed: false,
        score: 65,
        issues: [{ severity: 'medium', type: 'coverage', description: 'Coverage below minimum threshold' }],
        metrics: { coverage: 65 }
      });

      jest.spyOn(businessRuleValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 100,
        issues: [],
        metrics: { complianceRules: 8, passedRules: 8, failedRules: 0 }
      });

      // Act
      const result = await qualityGateService.evaluateDeploymentReadiness(mockDeploymentContext);

      // Assert
      expect(result.passed).toBe(false);
      expect(result.blockers).toHaveLength(3);
      expect(result.blockers.map(b => b.validator)).toEqual(['security', 'performance', 'testCoverage']);
      expect(result.overallScore).toBeLessThan(70);
    });

    it('should handle validator errors gracefully', async () => {
      // Arrange
      jest.spyOn(securityValidator, 'validate').mockRejectedValue(new Error('SonarQube API unavailable'));
      jest.spyOn(performanceValidator, 'validate').mockResolvedValue({
        passed: true,
        score: 80,
        issues: [],
        metrics: { lighthouse: { performance: 80 } }
      });

      // Act & Assert
      await expect(qualityGateService.evaluateDeploymentReadiness(mockDeploymentContext))
        .rejects.toThrow('Quality gate evaluation failed: SonarQube API unavailable');
    });
  });
});

describe('SecurityScanValidator', () => {
  let validator: SecurityScanValidator;

  beforeEach(() => {
    validator = new SecurityScanValidator(mockSupabaseClient, mockAxios);
  });

  describe('validate', () => {
    it('should pass when no critical vulnerabilities found', async () => {
      // Arrange
      mockAxios.get.mockResolvedValueOnce({
        data: {
          component: { measures: [{ metric: 'vulnerabilities', value: '0' }] },
          issues: { issues: [] }
        }
      });

      // Act
      const result = await validator.validate('proj-123', { sonarQubeUrl: 'https://sonar.example.com' });

      // Assert
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(90);
      expect(result.issues).toHaveLength(0);
    });

    it('should fail when critical vulnerabilities detected', async () => {
      // Arrange
      mockAxios.get.mockResolvedValueOnce({
        data: {
          component: { measures: [{ metric: 'vulnerabilities', value: '3' }] },
          issues: { 
            issues: [
              { severity: 'BLOCKER', type: 'VULNERABILITY', message: 'SQL injection risk' },
              { severity: 'CRITICAL', type: 'VULNERABILITY', message: 'XSS vulnerability' }
            ]
          }
        }
      });

      // Act
      const result = await validator.validate('proj-123', { sonarQubeUrl: 'https://sonar.example.com' });

      // Assert
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(70);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should handle SonarQube API errors', async () => {
      // Arrange
      mockAxios.get.mockRejectedValue(new Error('API timeout'));

      // Act & Assert
      await expect(validator.validate('proj-123', { sonarQubeUrl: 'https://sonar.example.com' }))
        .rejects.toThrow('Security scan failed: API timeout');
    });
  });
});

describe('PerformanceBenchmarkValidator', () => {
  let validator: PerformanceBenchmarkValidator;

  beforeEach(() => {
    validator = new PerformanceBenchmarkValidator(mockSupabaseClient);
  });

  describe('validate', () => {
    it('should pass when performance metrics meet thresholds', async () => {
      // Arrange
      const mockLighthouseData = {
        lhr: {
          categories: {
            performance: { score: 0.85 },
            accessibility: { score: 0.92 },
            'best-practices': { score: 0.88 },
            seo: { score: 0.91 }
          },
          audits: {
            'first-contentful-paint': { numericValue: 1200 },
            'largest-contentful-paint': { numericValue: 2100 },
            'cumulative-layout-shift': { numericValue: 0.08 }
          }
        }
      };

      jest.spyOn(validator as any, 'runLighthouseAudit').mockResolvedValue(mockLighthouseData);

      // Act
      const result = await validator.validate('proj-123', { 
        url: 'https://app.example.com',
        thresholds: { performance: 80, accessibility: 90 }
      });

      // Assert
      expect(result.passed).toBe(true);
      expect(result.score).toBe(85);
      expect(result.metrics.lighthouse.performance).toBe(85);
    });

    it('should fail when performance is below threshold', async () => {
      // Arrange
      const mockLighthouseData = {
        lhr: {
          categories: {
            performance: { score: 0.45 },
            accessibility: { score: 0.88 }
          },
          audits: {
            'first-contentful-paint': { numericValue: 4500 },
            'largest-contentful-paint': { numericValue: 8200 }
          }
        }
      };

      jest.spyOn(validator as any, 'runLighthouseAudit').mockResolvedValue(mockLighthouseData);

      // Act
      const result = await validator.validate('proj-123', { 
        url: 'https://app.example.com',
        thresholds: { performance: 80 }
      });

      // Assert
      expect(result.passed).toBe(false);
      expect(result.score).toBe(45);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'performance',
          description: expect.stringContaining('Performance score')
        })
      );
    });
  });
});

describe('TestCoverageValidator', () => {
  let validator: TestCoverageValidator;

  beforeEach(() => {
    validator = new TestCoverageValidator(mockSupabaseClient);
  });

  describe('validate', () => {
    it('should pass when coverage meets minimum threshold', async () => {
      // Arrange
      const mockCoverageData = {
        total: {
          lines: { pct: 92.5 },
          statements: { pct: 94.2 },
          functions: { pct: 88.7 },
          branches: { pct: 85.3 }
        }
      };

      jest.spyOn(validator as any, 'getCoverageReport').mockResolvedValue(mockCoverageData);

      // Act
      const result = await validator.validate('proj-123', { minimumCoverage: 85 });

      // Assert
      expect(result.passed).toBe(true);
      expect(result.score).toBe(92.5);
      expect(result.metrics.coverage).toBe(92.5);
    });

    it('should fail when coverage below minimum threshold', async () => {
      // Arrange
      const mockCoverageData = {
        total: {
          lines: { pct: 72.3 },
          statements: { pct: 74.1 },
          functions: { pct: 68.9 },
          branches: { pct: 65.7 }
        }
      };

      jest.spyOn(validator as any, 'getCoverageReport').mockResolvedValue(mockCoverageData);

      // Act
      const result = await validator.validate('proj-123', { minimumCoverage: 85 });

      // Assert
      expect(result.passed).toBe(false);
      expect(result.score).toBe(72.3);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'medium',
          type: 'coverage',
          description: expect.stringContaining('below minimum threshold')
        })
      );
    });
  });
});

describe('BusinessRuleValidator', () => {
  let validator: BusinessRuleValidator;

  beforeEach(() => {
    validator = new BusinessRuleValidator(mockSupabaseClient);
  });

  describe('validate', () => {
    it('should pass when all business rules are satisfied', async () => {
      // Arrange
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          data: [
            { id: 1, rule_name: 'feature_flag_check', status: 'passed' },
            { id: 2, rule_name: 'database_migration_status', status: 'passed' },
            { id: 3, rule_name: 'api_backward_compatibility', status: 'passed' }
          ],
          error: null
        })
      }));

      // Act
      const result = await validator.validate('proj-123', {
        rules: ['feature_flag_check', 'database_migration_status', 'api_backward_compatibility']
      });

      // Assert
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.metrics.failedRules).toBe(0);
    });

    it('should fail when business rules are violated', async () => {
      // Arrange
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          data: [
            { id: 1, rule_name: 'feature_flag_check', status: 'failed' },
            { id: 2, rule_name: 'database_migration_status', status: 'passed' }
          ],
          error: null
        })
      }));

      // Act
      const result = await validator.validate('proj-123', {
        rules: ['feature_flag_check', 'database_migration_status']
      });

      // Assert
      expect(result.passed).toBe(false);
      expect(result.score).toBe(50);
      expect(result.metrics.failedRules).toBe(1);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          severity: 'high',
          type: 'business_rule',
          description: expect.stringContaining('feature_flag_check')
        })
      );
    });
  });
});

describe('DeploymentBlocker', () => {
  let blocker: DeploymentBlocker;

  beforeEach(() => {
    blocker = new DeploymentBlocker(mockSupabaseClient, mockWebhook);
  });

  describe('blockDeployment', () => {
    it('should create deployment block record and send notification', async () => {
      // Arrange
      const deploymentContext = {
        projectId: 'proj-123',
        environment: 'production',
        version: '1.0.0'
      };

      const blockReason = {
        reason: 'Critical security vulnerabilities detected',
        details: ['SQL injection vulnerability', 'XSS vulnerability'],
        validator: 'security'
      };

      mockSupabaseClient.from = jest.fn(() => ({
        insert: jest.fn().mockReturnValue({
          data: [{ id: 'block-789', created_at: new Date().toISOString() }],
          error: null
        })
      }));

      // Act
      const result = await blocker.blockDeployment(deploymentContext, blockReason);

      // Assert
      expect(result.blocked).toBe(true);
      expect(result.blockerId).toBe('block-789');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('deployment_blocks');
      expect(mockWebhook.send).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('DEPLOYMENT BLOCKED'),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'danger',
              fields: expect.arrayContaining([
                expect.objectContaining({ title: 'Environment', value: 'production' })
              ])
            })
          ])
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSupabaseClient.from = jest.fn(() => ({
        insert: jest.fn().mockReturnValue({
          data: null,
          error: { message: 'Database connection failed' }
        })
      }));

      // Act & Assert
      await expect(blocker.blockDeployment({}, { reason: 'Test failure' }))
        .rejects.toThrow('Failed to create deployment block: Database connection failed');
    });
  });
});

describe('QualityReportGenerator', () => {
  let generator: QualityReportGenerator;

  beforeEach(() => {
    generator = new QualityReportGenerator(mockSupabaseClient);
  });

  describe('generate', () => {
    it('should generate comprehensive quality report', async () => {
      // Arrange
      const validationResults = {
        security: {
          passed: true,
          score: 95,
          issues: [],
          metrics: { vulnerabilities: { critical: 0, high: 0, medium: 1, low: 3 } }
        },
        performance: {
          passed: true,
          score: 88,
          issues: [],
          metrics: { lighthouse: { performance: 88, accessibility: 92 } }
        },
        testCoverage: {
          passed: true,
          score: 91,
          issues: [],
          metrics: { coverage: 91 }
        },
        businessRule: {