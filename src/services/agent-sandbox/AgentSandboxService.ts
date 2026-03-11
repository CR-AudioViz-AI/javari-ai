```typescript
import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { AgentSandboxService } from './AgentSandboxService';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Docker from 'dockerode';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('dockerode');
jest.mock('socket.io');
jest.mock('fs/promises');
jest.mock('path');

// Mock types
interface MockAgent {
  id: string;
  name: string;
  version: string;
  code: string;
  manifest: {
    platform_api_version: string;
    required_permissions: string[];
    resource_limits: {
      memory: string;
      cpu: string;
      storage: string;
    };
  };
  submitted_at: string;
  status: 'pending' | 'testing' | 'approved' | 'rejected';
}

interface MockTestResult {
  agent_id: string;
  security_score: number;
  performance_score: number;
  compatibility_score: number;
  overall_score: number;
  status: 'passed' | 'failed';
  details: {
    security_issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      line_number?: number;
    }>;
    performance_metrics: {
      memory_usage: number;
      cpu_usage: number;
      response_time: number;
      throughput: number;
    };
    compatibility_issues: Array<{
      api_endpoint: string;
      expected_version: string;
      actual_version: string;
      status: 'compatible' | 'deprecated' | 'incompatible';
    }>;
  };
  tested_at: string;
}

describe('AgentSandboxService', () => {
  let service: AgentSandboxService;
  let mockSupabase: jest.Mocked<SupabaseClient>;
  let mockDocker: jest.Mocked<Docker>;
  let mockSocketIO: jest.Mocked<SocketIOServer>;
  let mockContainer: jest.Mocked<Docker.Container>;

  const mockAgent: MockAgent = {
    id: 'agent-123',
    name: 'TestAgent',
    version: '1.0.0',
    code: 'console.log("Hello World");',
    manifest: {
      platform_api_version: '2.0.0',
      required_permissions: ['read_data', 'write_files'],
      resource_limits: {
        memory: '512MB',
        cpu: '0.5',
        storage: '1GB'
      }
    },
    submitted_at: '2024-01-01T00:00:00Z',
    status: 'pending'
  };

  const mockTestResult: MockTestResult = {
    agent_id: 'agent-123',
    security_score: 85,
    performance_score: 90,
    compatibility_score: 95,
    overall_score: 90,
    status: 'passed',
    details: {
      security_issues: [],
      performance_metrics: {
        memory_usage: 256,
        cpu_usage: 0.3,
        response_time: 150,
        throughput: 1000
      },
      compatibility_issues: []
    },
    tested_at: '2024-01-01T01:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      })
    } as any;

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock Docker container
    mockContainer = {
      id: 'container-123',
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      exec: jest.fn().mockResolvedValue({
        start: jest.fn().mockResolvedValue(undefined),
        inspect: jest.fn().mockResolvedValue({
          ExitCode: 0,
          State: { ExitCode: 0 }
        })
      }),
      stats: jest.fn().mockReturnValue(new EventEmitter()),
      logs: jest.fn().mockResolvedValue('Test output')
    } as any;

    // Mock Docker
    mockDocker = {
      createContainer: jest.fn().mockResolvedValue(mockContainer),
      getContainer: jest.fn().mockReturnValue(mockContainer),
      listContainers: jest.fn().mockResolvedValue([])
    } as any;

    (Docker as jest.Mock).mockImplementation(() => mockDocker);

    // Mock Socket.IO
    mockSocketIO = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    } as any;

    service = new AgentSandboxService(
      mockSupabase,
      mockDocker,
      mockSocketIO,
      { secure: true, performanceTimeout: 30000, compatibilityApiUrl: 'http://api.test' }
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('testAgent', () => {
    it('should successfully test an agent and return results', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({ data: mockAgent, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: mockTestResult, error: null });

      // Act
      const result = await service.testAgent('agent-123', { userId: 'user-123' });

      // Assert
      expect(result).toBeDefined();
      expect(result.overall_score).toBe(90);
      expect(result.status).toBe('passed');
      expect(mockSupabase.from).toHaveBeenCalledWith('agent_submissions');
      expect(mockSupabase.from).toHaveBeenCalledWith('sandbox_test_results');
      expect(mockDocker.createContainer).toHaveBeenCalled();
    });

    it('should handle agent not found error', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Agent not found' } 
      });

      // Act & Assert
      await expect(service.testAgent('invalid-agent')).rejects.toThrow('Agent not found: invalid-agent');
    });

    it('should handle container creation failure', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({ data: mockAgent, error: null });
      mockDocker.createContainer.mockRejectedValueOnce(new Error('Docker daemon not available'));

      // Act & Assert
      await expect(service.testAgent('agent-123')).rejects.toThrow('Failed to create sandbox container');
    });

    it('should fail security scan for malicious code', async () => {
      // Arrange
      const maliciousAgent = {
        ...mockAgent,
        code: 'require("child_process").exec("rm -rf /")'
      };
      mockSupabase.single.mockResolvedValueOnce({ data: maliciousAgent, error: null });
      
      const failedResult = {
        ...mockTestResult,
        security_score: 10,
        overall_score: 30,
        status: 'failed',
        details: {
          ...mockTestResult.details,
          security_issues: [{
            severity: 'critical',
            description: 'Detected system command execution',
            line_number: 1
          }]
        }
      };
      mockSupabase.single.mockResolvedValueOnce({ data: failedResult, error: null });

      // Act
      const result = await service.testAgent('agent-123');

      // Assert
      expect(result.status).toBe('failed');
      expect(result.security_score).toBe(10);
      expect(result.details.security_issues).toHaveLength(1);
      expect(result.details.security_issues[0].severity).toBe('critical');
    });

    it('should emit progress updates via WebSocket', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({ data: mockAgent, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: mockTestResult, error: null });

      // Act
      await service.testAgent('agent-123', { userId: 'user-123' });

      // Assert
      expect(mockSocketIO.to).toHaveBeenCalledWith('user-123');
      expect(mockSocketIO.emit).toHaveBeenCalledWith('sandbox_progress', expect.objectContaining({
        agent_id: 'agent-123',
        stage: expect.any(String),
        progress: expect.any(Number)
      }));
    });
  });

  describe('runSecurityScan', () => {
    it('should detect no security issues in clean code', async () => {
      // Act
      const result = await service.runSecurityScan(mockAgent);

      // Assert
      expect(result.score).toBeGreaterThan(80);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect malicious patterns', async () => {
      // Arrange
      const maliciousAgent = {
        ...mockAgent,
        code: `
          const fs = require('fs');
          const { exec } = require('child_process');
          eval(userInput);
          exec('rm -rf /');
        `
      };

      // Act
      const result = await service.runSecurityScan(maliciousAgent);

      // Assert
      expect(result.score).toBeLessThan(50);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.severity === 'critical')).toBe(true);
    });

    it('should detect permission violations', async () => {
      // Arrange
      const agent = {
        ...mockAgent,
        code: 'require("net").createServer()',
        manifest: {
          ...mockAgent.manifest,
          required_permissions: ['read_data'] // Missing network permission
        }
      };

      // Act
      const result = await service.runSecurityScan(agent);

      // Assert
      expect(result.issues.some(issue => 
        issue.description.includes('network') && issue.severity === 'high'
      )).toBe(true);
    });
  });

  describe('runPerformanceBenchmark', () => {
    it('should measure performance metrics within limits', async () => {
      // Arrange
      const mockStats = new EventEmitter();
      mockContainer.stats.mockReturnValue(mockStats);

      // Simulate stats data
      setTimeout(() => {
        mockStats.emit('data', JSON.stringify({
          memory_stats: { usage: 268435456 }, // 256MB
          cpu_stats: {
            cpu_usage: { total_usage: 300000000 },
            system_cpu_usage: 1000000000
          }
        }));
      }, 100);

      // Act
      const resultPromise = service.runPerformanceBenchmark(mockAgent, mockContainer);
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for stats

      const result = await resultPromise;

      // Assert
      expect(result.score).toBeGreaterThan(70);
      expect(result.metrics.memory_usage).toBeLessThan(512); // Within 512MB limit
      expect(result.metrics.cpu_usage).toBeLessThan(1.0); // Within CPU limit
    });

    it('should fail when resource limits exceeded', async () => {
      // Arrange
      const mockStats = new EventEmitter();
      mockContainer.stats.mockReturnValue(mockStats);

      setTimeout(() => {
        mockStats.emit('data', JSON.stringify({
          memory_stats: { usage: 1073741824 }, // 1GB (exceeds 512MB limit)
          cpu_stats: {
            cpu_usage: { total_usage: 800000000 },
            system_cpu_usage: 1000000000
          }
        }));
      }, 100);

      // Act
      const resultPromise = service.runPerformanceBenchmark(mockAgent, mockContainer);
      const result = await resultPromise;

      // Assert
      expect(result.score).toBeLessThan(50);
      expect(result.metrics.memory_usage).toBeGreaterThan(512);
    });

    it('should timeout long-running benchmarks', async () => {
      // Arrange
      const longRunningService = new AgentSandboxService(
        mockSupabase,
        mockDocker,
        mockSocketIO,
        { secure: true, performanceTimeout: 1000, compatibilityApiUrl: 'http://api.test' }
      );

      // Never emit stats to simulate hanging
      mockContainer.stats.mockReturnValue(new EventEmitter());

      // Act & Assert
      await expect(
        longRunningService.runPerformanceBenchmark(mockAgent, mockContainer)
      ).rejects.toThrow('Performance benchmark timed out');
    });
  });

  describe('runCompatibilityValidation', () => {
    it('should validate platform API compatibility', async () => {
      // Arrange
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ version: '2.0.0', status: 'compatible' })
        } as Response);

      // Act
      const result = await service.runCompatibilityValidation(mockAgent);

      // Assert
      expect(result.score).toBeGreaterThan(90);
      expect(result.issues).toHaveLength(0);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/version'),
        expect.any(Object)
      );
    });

    it('should detect API version incompatibility', async () => {
      // Arrange
      const incompatibleAgent = {
        ...mockAgent,
        manifest: {
          ...mockAgent.manifest,
          platform_api_version: '1.0.0' // Outdated version
        }
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            version: '2.0.0', 
            status: 'incompatible',
            min_supported: '1.5.0'
          })
        } as Response);

      // Act
      const result = await service.runCompatibilityValidation(incompatibleAgent);

      // Assert
      expect(result.score).toBeLessThan(70);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].status).toBe('incompatible');
    });

    it('should handle API endpoint failures', async () => {
      // Arrange
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await service.runCompatibilityValidation(mockAgent);

      // Assert
      expect(result.score).toBeLessThan(50);
      expect(result.issues.some(issue => 
        issue.description.includes('Network error')
      )).toBe(true);
    });
  });

  describe('aggregateTestResults', () => {
    it('should calculate weighted overall score', () => {
      // Arrange
      const securityResult = { score: 80, issues: [] };
      const performanceResult = { score: 90, metrics: mockTestResult.details.performance_metrics };
      const compatibilityResult = { score: 85, issues: [] };

      // Act
      const result = service.aggregateTestResults(
        mockAgent,
        securityResult,
        performanceResult,
        compatibilityResult
      );

      // Assert
      expect(result.overall_score).toBe(84); // Weighted average
      expect(result.status).toBe('passed');
      expect(result.security_score).toBe(80);
      expect(result.performance_score).toBe(90);
      expect(result.compatibility_score).toBe(85);
    });

    it('should fail agents with critical security issues', () => {
      // Arrange
      const securityResult = { 
        score: 30, 
        issues: [{ severity: 'critical', description: 'Critical vulnerability', line_number: 1 }] 
      };
      const performanceResult = { score: 95, metrics: mockTestResult.details.performance_metrics };
      const compatibilityResult = { score: 90, issues: [] };

      // Act
      const result = service.aggregateTestResults(
        mockAgent,
        securityResult,
        performanceResult,
        compatibilityResult
      );

      // Assert
      expect(result.status).toBe('failed');
      expect(result.overall_score).toBeLessThan(70);
    });

    it('should pass agents with minor warnings', () => {
      // Arrange
      const securityResult = { 
        score: 75, 
        issues: [{ severity: 'low', description: 'Minor warning', line_number: 5 }] 
      };
      const performanceResult = { score: 88, metrics: mockTestResult.details.performance_metrics };
      const compatibilityResult = { score: 92, issues: [] };

      // Act
      const result = service.aggregateTestResults(
        mockAgent,
        securityResult,
        performanceResult,
        compatibilityResult
      );

      // Assert
      expect(result.status).toBe('passed');
      expect(result.overall_score).toBeGreaterThan(70);
    });
  });

  describe('cleanup', () => {
    it('should cleanup container and temporary files', async () => {
      // Act
      await service.cleanup(mockContainer, ['temp-file-1', 'temp-file-2']);

      // Assert
      expect(mockContainer.stop).toHaveBeenCalled();
      expect(mockContainer.remove).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      mockContainer.stop.mockRejectedValueOnce(new Error('Container already stopped'));
      mockContainer.remove.mockRejectedValueOnce(new Error('Container not found'));

      // Act & Assert
      await expect(
        service.cleanup(mockContainer, [])
      ).resolves.not.toThrow();
    });
  });

  describe('getTestResults', () => {
    it('should retrieve test results for an agent', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({ data: mockTestResult, error: null });

      // Act
      const result = await service.getTestResults('agent-123');

      // Assert
      expect(result).toEqual(mockTestResult);
      expect(mockSupabase.from).toHaveBeenCalledWith('sandbox_test_results');
      expect(mockSupabase.eq).toHaveBeenCalledWith('agent_id', 'agent-123');
    });

    it('should throw error when test results not found', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Not found' } 
      });

      // Act & Assert
      await expect(service.getTestResults('invalid-agent')).rejects.toThrow('Test results not found');
    });
  });

  describe('getPendingTests', () => {
    it('should retrieve pending test queue', async () => {
      // Arrange
      const pendingAgents = [mockAgent, { ...mockAgent, id: 'agent-456' }];
      mockSupabase.single = jest.fn(); // Reset single mock
      
      // Mock the query chain
      const mockQuery = {
        data: pendingAgents,
        error: null
      };
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockQuery)
        })
      });

      // Act
      const result = await service.getPendingTests();

      // Assert
      expect(result).toEqual(pendingAgents);
      expect(mockSupabase.from).toHaveBeenCalledWith('agent_submissions');
    });

    it('should handle empty test queue', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mkResolvedValue({ data: [], error: null })
        })
      });

      // Act
      const result = await service.getPendingTests();

      // Assert
      expect(result).toEqual([]);
    });
  });
});
```