```typescript
import { SandboxService } from './sandbox-service';
import { DockerContainerManager } from './docker-container-manager';
import { ResourceLimitEnforcer } from './resource-limit-enforcer';
import { TimeoutController } from './timeout-controller';
import { ResultCapture } from './result-capture';
import { IsolationValidator } from './isolation-validator';
import Docker from 'dockerode';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

// Mock external dependencies
jest.mock('dockerode');
jest.mock('ioredis');
jest.mock('@supabase/supabase-js');

const MockedDocker = Docker as jest.MockedClass<typeof Docker>;
const MockedRedis = Redis as jest.MockedClass<typeof Redis>;

describe('SandboxService', () => {
  let sandboxService: SandboxService;
  let dockerManager: jest.Mocked<DockerContainerManager>;
  let resourceEnforcer: jest.Mocked<ResourceLimitEnforcer>;
  let timeoutController: jest.Mocked<TimeoutController>;
  let resultCapture: jest.Mocked<ResultCapture>;
  let isolationValidator: jest.Mocked<IsolationValidator>;
  let mockDocker: jest.Mocked<Docker>;
  let mockRedis: jest.Mocked<Redis>;
  let mockSupabase: any;

  beforeEach(() => {
    // Setup mocks
    mockDocker = new MockedDocker() as jest.Mocked<Docker>;
    mockRedis = new MockedRedis() as jest.Mocked<Redis>;
    mockSupabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null })
        }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Create service instances with mocked dependencies
    dockerManager = {
      createContainer: jest.fn(),
      startContainer: jest.fn(),
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
      getContainerStats: jest.fn(),
      inspectContainer: jest.fn(),
      pullImage: jest.fn()
    } as jest.Mocked<DockerContainerManager>;

    resourceEnforcer = {
      setLimits: jest.fn(),
      enforceMemoryLimit: jest.fn(),
      enforceCpuLimit: jest.fn(),
      enforceNetworkLimit: jest.fn(),
      getResourceUsage: jest.fn(),
      isWithinLimits: jest.fn()
    } as jest.Mocked<ResourceLimitEnforcer>;

    timeoutController = {
      setTimeout: jest.fn(),
      clearTimeout: jest.fn(),
      isTimedOut: jest.fn(),
      getRemainingTime: jest.fn(),
      onTimeout: jest.fn()
    } as jest.Mocked<TimeoutController>;

    resultCapture = {
      captureOutput: jest.fn(),
      captureError: jest.fn(),
      captureMetrics: jest.fn(),
      serializeResults: jest.fn(),
      getResults: jest.fn()
    } as jest.Mocked<ResultCapture>;

    isolationValidator = {
      validateNetworkIsolation: jest.fn(),
      validateFileSystemIsolation: jest.fn(),
      validateProcessIsolation: jest.fn(),
      validateResourceIsolation: jest.fn(),
      generateIsolationReport: jest.fn()
    } as jest.Mocked<IsolationValidator>;

    sandboxService = new SandboxService(
      dockerManager,
      resourceEnforcer,
      timeoutController,
      resultCapture,
      isolationValidator,
      mockRedis,
      mockSupabase
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSandbox', () => {
    const mockSandboxConfig = {
      agentId: 'agent-123',
      userId: 'user-456',
      imageTag: 'cr-audio-viz/agent:latest',
      resourceLimits: {
        memory: '512MB',
        cpu: '0.5',
        timeout: 30000,
        networkBandwidth: '10MB'
      },
      environment: {
        NODE_ENV: 'sandbox',
        AGENT_ID: 'agent-123'
      }
    };

    it('should create a sandbox successfully with valid configuration', async () => {
      const mockContainerId = 'container-789';
      const mockSandboxId = 'sandbox-abc';

      dockerManager.pullImage.mockResolvedValue(undefined);
      dockerManager.createContainer.mockResolvedValue(mockContainerId);
      dockerManager.startContainer.mockResolvedValue(undefined);
      isolationValidator.validateNetworkIsolation.mockResolvedValue(true);
      isolationValidator.validateFileSystemIsolation.mockResolvedValue(true);
      isolationValidator.validateProcessIsolation.mockResolvedValue(true);
      resourceEnforcer.setLimits.mockResolvedValue(undefined);
      timeoutController.setTimeout.mockResolvedValue(undefined);
      mockRedis.setex.mockResolvedValue('OK');

      jest.spyOn(sandboxService as any, 'generateSandboxId').mockReturnValue(mockSandboxId);

      const result = await sandboxService.createSandbox(mockSandboxConfig);

      expect(result).toEqual({
        sandboxId: mockSandboxId,
        containerId: mockContainerId,
        status: 'running',
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date)
      });

      expect(dockerManager.pullImage).toHaveBeenCalledWith(mockSandboxConfig.imageTag);
      expect(dockerManager.createContainer).toHaveBeenCalledWith({
        image: mockSandboxConfig.imageTag,
        environment: mockSandboxConfig.environment,
        labels: {
          sandboxId: mockSandboxId,
          agentId: mockSandboxConfig.agentId,
          userId: mockSandboxConfig.userId
        }
      });
      expect(resourceEnforcer.setLimits).toHaveBeenCalledWith(
        mockContainerId,
        mockSandboxConfig.resourceLimits
      );
      expect(timeoutController.setTimeout).toHaveBeenCalledWith(
        mockSandboxId,
        mockSandboxConfig.resourceLimits.timeout
      );
    });

    it('should handle Docker image pull failure', async () => {
      const pullError = new Error('Image not found');
      dockerManager.pullImage.mockRejectedValue(pullError);

      await expect(sandboxService.createSandbox(mockSandboxConfig))
        .rejects.toThrow('Failed to pull agent image: Image not found');

      expect(dockerManager.createContainer).not.toHaveBeenCalled();
    });

    it('should handle container creation failure and cleanup', async () => {
      const createError = new Error('Container creation failed');
      dockerManager.pullImage.mockResolvedValue(undefined);
      dockerManager.createContainer.mockRejectedValue(createError);

      await expect(sandboxService.createSandbox(mockSandboxConfig))
        .rejects.toThrow('Failed to create sandbox container: Container creation failed');

      expect(dockerManager.startContainer).not.toHaveBeenCalled();
    });

    it('should validate isolation before starting container', async () => {
      const mockContainerId = 'container-789';
      dockerManager.pullImage.mockResolvedValue(undefined);
      dockerManager.createContainer.mockResolvedValue(mockContainerId);
      isolationValidator.validateNetworkIsolation.mockResolvedValue(false);

      await expect(sandboxService.createSandbox(mockSandboxConfig))
        .rejects.toThrow('Sandbox isolation validation failed');

      expect(dockerManager.removeContainer).toHaveBeenCalledWith(mockContainerId, true);
    });

    it('should store sandbox metadata in Redis', async () => {
      const mockContainerId = 'container-789';
      const mockSandboxId = 'sandbox-abc';

      dockerManager.pullImage.mockResolvedValue(undefined);
      dockerManager.createContainer.mockResolvedValue(mockContainerId);
      dockerManager.startContainer.mockResolvedValue(undefined);
      isolationValidator.validateNetworkIsolation.mockResolvedValue(true);
      isolationValidator.validateFileSystemIsolation.mockResolvedValue(true);
      isolationValidator.validateProcessIsolation.mockResolvedValue(true);
      resourceEnforcer.setLimits.mockResolvedValue(undefined);
      timeoutController.setTimeout.mockResolvedValue(undefined);
      mockRedis.setex.mockResolvedValue('OK');

      jest.spyOn(sandboxService as any, 'generateSandboxId').mockReturnValue(mockSandboxId);

      await sandboxService.createSandbox(mockSandboxConfig);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `sandbox:${mockSandboxId}`,
        3600,
        expect.stringContaining(mockContainerId)
      );
    });
  });

  describe('executeAgent', () => {
    const mockExecutionRequest = {
      sandboxId: 'sandbox-123',
      agentScript: 'console.log("Hello World");',
      inputData: { message: 'test input' },
      timeout: 10000
    };

    it('should execute agent successfully and capture results', async () => {
      const mockContainerId = 'container-789';
      const mockOutput = { result: 'success', data: 'processed data' };

      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: true, ExitCode: 0 }
      });

      resultCapture.captureOutput.mockResolvedValue(mockOutput);
      resourceEnforcer.isWithinLimits.mockReturnValue(true);
      timeoutController.isTimedOut.mockReturnValue(false);

      const result = await sandboxService.executeAgent(mockExecutionRequest);

      expect(result).toEqual({
        success: true,
        output: mockOutput,
        executionTime: expect.any(Number),
        resourceUsage: expect.any(Object)
      });

      expect(resultCapture.captureOutput).toHaveBeenCalledWith(
        mockContainerId,
        mockExecutionRequest.agentScript,
        mockExecutionRequest.inputData
      );
    });

    it('should handle sandbox not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(sandboxService.executeAgent(mockExecutionRequest))
        .rejects.toThrow('Sandbox not found: sandbox-123');
    });

    it('should handle container not running', async () => {
      const mockContainerId = 'container-789';
      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: false, ExitCode: 1 }
      });

      await expect(sandboxService.executeAgent(mockExecutionRequest))
        .rejects.toThrow('Sandbox container is not running');
    });

    it('should handle execution timeout', async () => {
      const mockContainerId = 'container-789';
      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: true, ExitCode: 0 }
      });

      timeoutController.isTimedOut.mockReturnValue(true);

      await expect(sandboxService.executeAgent(mockExecutionRequest))
        .rejects.toThrow('Agent execution timed out');

      expect(dockerManager.stopContainer).toHaveBeenCalledWith(mockContainerId);
    });

    it('should handle resource limit violations', async () => {
      const mockContainerId = 'container-789';
      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: true, ExitCode: 0 }
      });

      resourceEnforcer.isWithinLimits.mockReturnValue(false);
      timeoutController.isTimedOut.mockReturnValue(false);

      await expect(sandboxService.executeAgent(mockExecutionRequest))
        .rejects.toThrow('Resource limits exceeded during execution');

      expect(dockerManager.stopContainer).toHaveBeenCalledWith(mockContainerId);
    });

    it('should capture execution errors properly', async () => {
      const mockContainerId = 'container-789';
      const mockError = new Error('Script execution failed');

      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: true, ExitCode: 0 }
      });

      resultCapture.captureOutput.mockRejectedValue(mockError);
      resultCapture.captureError.mockResolvedValue({
        error: 'Script execution failed',
        stack: mockError.stack
      });

      const result = await sandboxService.executeAgent(mockExecutionRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(resultCapture.captureError).toHaveBeenCalledWith(mockContainerId, mockError);
    });
  });

  describe('destroySandbox', () => {
    const mockSandboxId = 'sandbox-123';

    it('should destroy sandbox successfully', async () => {
      const mockContainerId = 'container-789';
      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.stopContainer.mockResolvedValue(undefined);
      dockerManager.removeContainer.mockResolvedValue(undefined);
      timeoutController.clearTimeout.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      const result = await sandboxService.destroySandbox(mockSandboxId);

      expect(result).toEqual({
        sandboxId: mockSandboxId,
        destroyed: true,
        cleanupTime: expect.any(Number)
      });

      expect(dockerManager.stopContainer).toHaveBeenCalledWith(mockContainerId);
      expect(dockerManager.removeContainer).toHaveBeenCalledWith(mockContainerId, true);
      expect(timeoutController.clearTimeout).toHaveBeenCalledWith(mockSandboxId);
      expect(mockRedis.del).toHaveBeenCalledWith(`sandbox:${mockSandboxId}`);
    });

    it('should handle sandbox not found gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await sandboxService.destroySandbox(mockSandboxId);

      expect(result).toEqual({
        sandboxId: mockSandboxId,
        destroyed: false,
        error: 'Sandbox not found'
      });

      expect(dockerManager.stopContainer).not.toHaveBeenCalled();
    });

    it('should force cleanup even if container stop fails', async () => {
      const mockContainerId = 'container-789';
      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.stopContainer.mockRejectedValue(new Error('Stop failed'));
      dockerManager.removeContainer.mockResolvedValue(undefined);
      timeoutController.clearTimeout.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      const result = await sandboxService.destroySandbox(mockSandboxId, true);

      expect(result.destroyed).toBe(true);
      expect(dockerManager.removeContainer).toHaveBeenCalledWith(mockContainerId, true);
    });
  });

  describe('getSandboxStatus', () => {
    const mockSandboxId = 'sandbox-123';

    it('should return sandbox status successfully', async () => {
      const mockContainerId = 'container-789';
      const mockMetadata = {
        containerId: mockContainerId,
        status: 'running',
        createdAt: new Date().toISOString(),
        agentId: 'agent-123'
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockMetadata));
      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: true, ExitCode: 0 }
      });
      resourceEnforcer.getResourceUsage.mockResolvedValue({
        memoryUsage: '256MB',
        cpuUsage: '25%',
        networkUsage: '5MB'
      });
      timeoutController.getRemainingTime.mockReturnValue(25000);

      const result = await sandboxService.getSandboxStatus(mockSandboxId);

      expect(result).toEqual({
        sandboxId: mockSandboxId,
        status: 'running',
        containerRunning: true,
        resourceUsage: expect.any(Object),
        remainingTime: 25000,
        metadata: mockMetadata
      });
    });

    it('should handle sandbox not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(sandboxService.getSandboxStatus(mockSandboxId))
        .rejects.toThrow('Sandbox not found: sandbox-123');
    });

    it('should detect container state mismatch', async () => {
      const mockContainerId = 'container-789';
      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      dockerManager.inspectContainer.mockResolvedValue({
        State: { Running: false, ExitCode: 1 }
      });

      const result = await sandboxService.getSandboxStatus(mockSandboxId);

      expect(result.status).toBe('stopped');
      expect(result.containerRunning).toBe(false);
    });
  });

  describe('cleanupExpiredSandboxes', () => {
    it('should cleanup expired sandboxes', async () => {
      const mockSandboxKeys = [
        'sandbox:sandbox-1',
        'sandbox:sandbox-2',
        'sandbox:sandbox-3'
      ];

      const mockSandboxData = [
        {
          containerId: 'container-1',
          expiresAt: new Date(Date.now() - 1000).toISOString() // expired
        },
        {
          containerId: 'container-2',
          expiresAt: new Date(Date.now() + 1000).toISOString() // not expired
        },
        {
          containerId: 'container-3',
          expiresAt: new Date(Date.now() - 2000).toISOString() // expired
        }
      ];

      mockRedis.keys.mockResolvedValue(mockSandboxKeys);
      mockRedis.mget.mockResolvedValue(mockSandboxData.map(d => JSON.stringify(d)));
      dockerManager.stopContainer.mockResolvedValue(undefined);
      dockerManager.removeContainer.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      const result = await sandboxService.cleanupExpiredSandboxes();

      expect(result).toEqual({
        cleanedUp: 2,
        failed: 0,
        sandboxIds: ['sandbox-1', 'sandbox-3']
      });

      expect(dockerManager.stopContainer).toHaveBeenCalledTimes(2);
      expect(dockerManager.removeContainer).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup failures gracefully', async () => {
      const mockSandboxKeys = ['sandbox:sandbox-1'];
      const mockSandboxData = [{
        containerId: 'container-1',
        expiresAt: new Date(Date.now() - 1000).toISOString()
      }];

      mockRedis.keys.mockResolvedValue(mockSandboxKeys);
      mockRedis.mget.mockResolvedValue([JSON.stringify(mockSandboxData[0])]);
      dockerManager.stopContainer.mockRejectedValue(new Error('Cleanup failed'));
      dockerManager.removeContainer.mockRejectedValue(new Error('Remove failed'));
      mockRedis.del.mockResolvedValue(1);

      const result = await sandboxService.cleanupExpiredSandboxes();

      expect(result).toEqual({
        cleanedUp: 0,
        failed: 1,
        sandboxIds: [],
        errors: expect.any(Array)
      });
    });
  });

  describe('Resource Monitoring and Enforcement', () => {
    it('should monitor resource usage continuously', async () => {
      const mockSandboxId = 'sandbox-123';
      const mockContainerId = 'container-789';

      mockRedis.get.mockResolvedValue(JSON.stringify({
        containerId: mockContainerId,
        status: 'running'
      }));

      resourceEnforcer.getResourceUsage.mockResolvedValue({
        memoryUsage: '400MB',
        cpuUsage: '80%',
        networkUsage: '8MB'
      });

      const usage = await sandboxService.getResourceUsage(mockSandboxId);

      expect(usage).toBeDefined();
      expect(resourceEnforcer.getResourceUsage).toHaveBeenCalledWith(mockContainerId);
    });

    it('should enforce memory limits', async () => {
      const mockContainerId = 'container-789';
      const limits = { memory: '512MB', cpu: '1.0', timeout: 30000 };

      resourceEnforcer.enforceMemoryLimit.mockResolvedValue(true);
      resourceEnforcer.enforceCpuLimit.mockResolvedValue(true);

      await sandboxService.enforceResourceLimits(mockContainerId, limits);

      expect(resourceEnforcer.enforceMemoryLimit).toHaveBeenCalledWith(mockContainerId, '512MB');
      expect(resourceEnforcer.enforceCpuLimit).toHaveBeenCalledWith(mockContainerId, '1.0');