```typescript
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AutomatedQASystem } from '../automated-qa-system';
import type { 
  AgentSubmission, 
  QATestResult, 
  QAReport, 
  PerformanceBenchmark,
  SafetyValidationResult,
  UXEvaluationResult
} from '../types/qa-types';

// Mock external dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    }))
  }
}));

jest.mock('@/lib/agent-sandbox', () => ({
  AgentSandbox: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
    getMetrics: jest.fn(),
    cleanup: jest.fn()
  }))
}));

jest.mock('@/lib/performance-monitor', () => ({
  PerformanceMonitor: jest.fn().mockImplementation(() => ({
    measureExecution: jest.fn(),
    getResourceUsage: jest.fn(),
    getBenchmarkData: jest.fn()
  }))
}));

jest.mock('@/lib/safety-validator', () => ({
  SafetyValidator: jest.fn().mockImplementation(() => ({
    validateCode: jest.fn(),
    checkPolicyCompliance: jest.fn(),
    scanForVulnerabilities: jest.fn()
  }))
}));

jest.mock('@/lib/notifications', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendQAResults: jest.fn(),
    notifyApproval: jest.fn(),
    notifyRejection: jest.fn()
  }))
}));

describe('AutomatedQASystem', () => {
  let qaSystem: AutomatedQASystem;
  let mockAgentSubmission: AgentSubmission;
  let mockPerformanceBenchmark: PerformanceBenchmark;

  beforeEach(() => {
    qaSystem = new AutomatedQASystem();
    
    mockAgentSubmission = {
      id: 'agent-123',
      name: 'Test Agent',
      version: '1.0.0',
      code: 'const agent = { process: () => "test" };',
      metadata: {
        description: 'A test agent',
        tags: ['test', 'automation'],
        category: 'utility'
      },
      submittedBy: 'user-456',
      submittedAt: new Date('2024-01-01T00:00:00Z'),
      status: 'pending_qa'
    };

    mockPerformanceBenchmark = {
      maxExecutionTime: 5000,
      maxMemoryUsage: 128 * 1024 * 1024, // 128MB
      minThroughput: 100,
      maxErrorRate: 0.01
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processAgentSubmission', () => {
    it('should successfully process a valid agent submission', async () => {
      const mockQAResult: QATestResult = {
        agentId: 'agent-123',
        overallScore: 85,
        performanceScore: 90,
        safetyScore: 85,
        uxScore: 80,
        passed: true,
        executedAt: new Date(),
        testResults: {
          performance: { passed: true, score: 90, details: {} },
          safety: { passed: true, score: 85, violations: [] },
          ux: { passed: true, score: 80, issues: [] }
        }
      };

      jest.spyOn(qaSystem as any, 'runTestSuite').mockResolvedValue(mockQAResult);
      jest.spyOn(qaSystem as any, 'generateReport').mockResolvedValue({
        agentId: 'agent-123',
        summary: 'Agent passed all tests',
        recommendations: []
      });

      const result = await qaSystem.processAgentSubmission(mockAgentSubmission);

      expect(result.passed).toBe(true);
      expect(result.overallScore).toBe(85);
      expect(result.agentId).toBe('agent-123');
    });

    it('should reject agent submission with low quality scores', async () => {
      const mockQAResult: QATestResult = {
        agentId: 'agent-123',
        overallScore: 45,
        performanceScore: 30,
        safetyScore: 40,
        uxScore: 65,
        passed: false,
        executedAt: new Date(),
        testResults: {
          performance: { passed: false, score: 30, details: { timeout: true } },
          safety: { passed: false, score: 40, violations: ['unsafe-eval'] },
          ux: { passed: true, score: 65, issues: [] }
        }
      };

      jest.spyOn(qaSystem as any, 'runTestSuite').mockResolvedValue(mockQAResult);

      const result = await qaSystem.processAgentSubmission(mockAgentSubmission);

      expect(result.passed).toBe(false);
      expect(result.overallScore).toBe(45);
    });

    it('should handle agent submission processing errors', async () => {
      jest.spyOn(qaSystem as any, 'runTestSuite').mockRejectedValue(new Error('Sandbox execution failed'));

      await expect(qaSystem.processAgentSubmission(mockAgentSubmission))
        .rejects.toThrow('QA processing failed: Sandbox execution failed');
    });

    it('should validate required agent metadata', async () => {
      const invalidSubmission = {
        ...mockAgentSubmission,
        metadata: { description: '' } // Missing required fields
      };

      await expect(qaSystem.processAgentSubmission(invalidSubmission))
        .rejects.toThrow('Invalid agent metadata');
    });
  });

  describe('runPerformanceBenchmarks', () => {
    it('should execute performance tests and return valid results', async () => {
      const mockPerformanceResult = {
        executionTime: 2500,
        memoryUsage: 64 * 1024 * 1024, // 64MB
        throughput: 150,
        errorRate: 0.005,
        cpuUsage: 0.3
      };

      jest.spyOn(qaSystem as any, 'executeInSandbox').mockResolvedValue(mockPerformanceResult);

      const result = await qaSystem.runPerformanceBenchmarks(mockAgentSubmission, mockPerformanceBenchmark);

      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(70);
      expect(result.details.executionTime).toBe(2500);
      expect(result.details.memoryUsage).toBe(64 * 1024 * 1024);
    });

    it('should fail performance tests when benchmarks are not met', async () => {
      const mockPerformanceResult = {
        executionTime: 8000, // Exceeds maxExecutionTime
        memoryUsage: 200 * 1024 * 1024, // Exceeds maxMemoryUsage
        throughput: 50, // Below minThroughput
        errorRate: 0.02, // Above maxErrorRate
        cpuUsage: 0.9
      };

      jest.spyOn(qaSystem as any, 'executeInSandbox').mockResolvedValue(mockPerformanceResult);

      const result = await qaSystem.runPerformanceBenchmarks(mockAgentSubmission, mockPerformanceBenchmark);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(50);
    });

    it('should handle sandbox execution timeout', async () => {
      jest.spyOn(qaSystem as any, 'executeInSandbox').mockRejectedValue(new Error('Execution timeout'));

      const result = await qaSystem.runPerformanceBenchmarks(mockAgentSubmission, mockPerformanceBenchmark);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details.error).toContain('Execution timeout');
    });
  });

  describe('validateSafetyGuidelines', () => {
    it('should pass safety validation for clean code', async () => {
      const cleanCode = `
        const agent = {
          process: (input: string) => {
            return input.toLowerCase();
          }
        };
      `;

      const mockValidationResult: SafetyValidationResult = {
        passed: true,
        score: 95,
        violations: [],
        warnings: [],
        securityScan: { passed: true, vulnerabilities: [] }
      };

      jest.spyOn(qaSystem as any, 'scanForVulnerabilities').mockResolvedValue(mockValidationResult);

      const result = await qaSystem.validateSafetyGuidelines({ ...mockAgentSubmission, code: cleanCode });

      expect(result.passed).toBe(true);
      expect(result.score).toBe(95);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect safety violations in malicious code', async () => {
      const maliciousCode = `
        eval('process.exit(1)');
        require('fs').writeFileSync('/tmp/malicious', 'data');
      `;

      const mockValidationResult: SafetyValidationResult = {
        passed: false,
        score: 10,
        violations: ['unsafe-eval', 'file-system-access'],
        warnings: ['process-manipulation'],
        securityScan: { passed: false, vulnerabilities: ['code-injection'] }
      };

      jest.spyOn(qaSystem as any, 'scanForVulnerabilities').mockResolvedValue(mockValidationResult);

      const result = await qaSystem.validateSafetyGuidelines({ ...mockAgentSubmission, code: maliciousCode });

      expect(result.passed).toBe(false);
      expect(result.score).toBe(10);
      expect(result.violations).toContain('unsafe-eval');
      expect(result.violations).toContain('file-system-access');
    });

    it('should handle code analysis errors gracefully', async () => {
      jest.spyOn(qaSystem as any, 'scanForVulnerabilities').mockRejectedValue(new Error('Analysis failed'));

      const result = await qaSystem.validateSafetyGuidelines(mockAgentSubmission);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.violations).toContain('analysis-error');
    });
  });

  describe('evaluateUXStandards', () => {
    it('should pass UX evaluation for well-structured agent', async () => {
      const mockUXResult: UXEvaluationResult = {
        passed: true,
        score: 88,
        issues: [],
        accessibility: { score: 90, issues: [] },
        usability: { score: 85, issues: [] },
        documentation: { score: 90, completeness: 0.95 }
      };

      jest.spyOn(qaSystem as any, 'analyzeUserExperience').mockResolvedValue(mockUXResult);

      const result = await qaSystem.evaluateUXStandards(mockAgentSubmission);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(88);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify UX issues and provide recommendations', async () => {
      const mockUXResult: UXEvaluationResult = {
        passed: false,
        score: 55,
        issues: ['missing-error-handling', 'poor-documentation'],
        accessibility: { score: 60, issues: ['missing-aria-labels'] },
        usability: { score: 50, issues: ['confusing-interface'] },
        documentation: { score: 55, completeness: 0.6 }
      };

      jest.spyOn(qaSystem as any, 'analyzeUserExperience').mockResolvedValue(mockUXResult);

      const result = await qaSystem.evaluateUXStandards(mockAgentSubmission);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(55);
      expect(result.issues).toContain('missing-error-handling');
      expect(result.issues).toContain('poor-documentation');
    });
  });

  describe('generateQAReport', () => {
    it('should generate comprehensive QA report', async () => {
      const mockQAResult: QATestResult = {
        agentId: 'agent-123',
        overallScore: 82,
        performanceScore: 85,
        safetyScore: 90,
        uxScore: 70,
        passed: true,
        executedAt: new Date(),
        testResults: {
          performance: { passed: true, score: 85, details: {} },
          safety: { passed: true, score: 90, violations: [] },
          ux: { passed: true, score: 70, issues: ['minor-usability'] }
        }
      };

      const report = await qaSystem.generateQAReport(mockQAResult);

      expect(report.agentId).toBe('agent-123');
      expect(report.overallScore).toBe(82);
      expect(report.summary).toContain('passed');
      expect(report.breakdown).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should include detailed failure analysis for failed agents', async () => {
      const mockQAResult: QATestResult = {
        agentId: 'agent-123',
        overallScore: 35,
        performanceScore: 20,
        safetyScore: 30,
        uxScore: 55,
        passed: false,
        executedAt: new Date(),
        testResults: {
          performance: { passed: false, score: 20, details: { timeout: true } },
          safety: { passed: false, score: 30, violations: ['unsafe-eval'] },
          ux: { passed: true, score: 55, issues: [] }
        }
      };

      const report = await qaSystem.generateQAReport(mockQAResult);

      expect(report.passed).toBe(false);
      expect(report.summary).toContain('failed');
      expect(report.recommendations).not.toHaveLength(0);
      expect(report.breakdown.performance.issues).toBeDefined();
      expect(report.breakdown.safety.violations).toContain('unsafe-eval');
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate weighted quality score correctly', () => {
      const scores = {
        performance: 80,
        safety: 90,
        ux: 70
      };

      const result = qaSystem.calculateQualityScore(scores);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
      // Safety should have higher weight
      expect(result).toBe(78); // Expected weighted average
    });

    it('should handle edge cases in score calculation', () => {
      const zeroScores = { performance: 0, safety: 0, ux: 0 };
      expect(qaSystem.calculateQualityScore(zeroScores)).toBe(0);

      const perfectScores = { performance: 100, safety: 100, ux: 100 };
      expect(qaSystem.calculateQualityScore(perfectScores)).toBe(100);

      const mixedScores = { performance: 50, safety: 100, ux: 0 };
      const result = qaSystem.calculateQualityScore(mixedScores);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });
  });

  describe('updateAgentStatus', () => {
    it('should update agent status to approved for passing agents', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.from().update().eq().mockResolvedValue({ data: {}, error: null });

      await qaSystem.updateAgentStatus('agent-123', 'approved', 85);

      expect(mockSupabase.from).toHaveBeenCalledWith('marketplace_agents');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        qa_status: 'approved',
        qa_score: 85,
        approved_at: expect.any(Date)
      });
    });

    it('should update agent status to rejected for failing agents', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.from().update().eq().mockResolvedValue({ data: {}, error: null });

      await qaSystem.updateAgentStatus('agent-123', 'rejected', 35);

      expect(mockSupabase.from).toHaveBeenCalledWith('marketplace_agents');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        qa_status: 'rejected',
        qa_score: 35,
        rejected_at: expect.any(Date)
      });
    });

    it('should handle database update errors', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.from().update().eq().mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(qaSystem.updateAgentStatus('agent-123', 'approved', 85))
        .rejects.toThrow('Failed to update agent status');
    });
  });

  describe('getQADashboardData', () => {
    it('should return dashboard metrics for QA overview', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.from().select().mockResolvedValue({
        data: [
          { qa_status: 'approved', qa_score: 85 },
          { qa_status: 'rejected', qa_score: 45 },
          { qa_status: 'pending_qa', qa_score: null }
        ],
        error: null
      });

      const dashboardData = await qaSystem.getQADashboardData();

      expect(dashboardData.totalAgents).toBe(3);
      expect(dashboardData.approvedCount).toBe(1);
      expect(dashboardData.rejectedCount).toBe(1);
      expect(dashboardData.pendingCount).toBe(1);
      expect(dashboardData.averageScore).toBe(65); // (85 + 45) / 2
    });

    it('should handle empty dashboard data', async () => {
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      const dashboardData = await qaSystem.getQADashboardData();

      expect(dashboardData.totalAgents).toBe(0);
      expect(dashboardData.averageScore).toBe(0);
    });
  });

  describe('integration tests', () => {
    it('should handle complete QA workflow end-to-end', async () => {
      // Mock all external services for integration test
      const mockSupabase = require('@/lib/supabase').supabase;
      mockSupabase.from().select().single().mockResolvedValue({
        data: mockAgentSubmission,
        error: null
      });
      mockSupabase.from().update().eq().mockResolvedValue({ data: {}, error: null });

      jest.spyOn(qaSystem as any, 'executeInSandbox').mockResolvedValue({
        executionTime: 2000,
        memoryUsage: 50 * 1024 * 1024,
        throughput: 120,
        errorRate: 0.002
      });

      jest.spyOn(qaSystem as any, 'scanForVulnerabilities').mockResolvedValue({
        passed: true,
        score: 88,
        violations: [],
        warnings: [],
        securityScan: { passed: true, vulnerabilities: [] }
      });

      jest.spyOn(qaSystem as any, 'analyzeUserExperience').mockResolvedValue({
        passed: true,
        score: 82,
        issues: [],
        accessibility: { score: 85, issues: [] },
        usability: { score: 80, issues: [] },
        documentation: { score: 80, completeness: 0.85 }
      });

      const result = await qaSystem.processAgentSubmission(mockAgentSubmission);

      expect(result.passed).toBe(true);
      expect(result.overallScore).toBeGreaterThan(70);
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });
  });
});
```