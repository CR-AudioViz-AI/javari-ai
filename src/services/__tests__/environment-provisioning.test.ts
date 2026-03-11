```typescript
import { jest } from '@jest/globals';
import { EnvironmentProvisioningService } from '../environment-provisioning';
import { EnvironmentConfigManager } from '../environment-config-manager';
import { ResourceOrchestrator } from '../resource-orchestrator';
import { DeploymentPipeline } from '../deployment-pipeline';
import { EnvironmentValidator } from '../environment-validator';
import { ConfigTemplateEngine } from '../config-template-engine';
import { createClient } from '@supabase/supabase-js';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('aws-sdk');
jest.mock('@google-cloud/compute');
jest.mock('@octokit/rest');
jest.mock('dockerode');
jest.mock('@kubernetes/client-node');

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    execute: jest.fn()
  }))
};

const mockConfigManager = {
  generateConfig: jest.fn(),
  validateConfig: jest.fn(),
  mergeConfigs: jest.fn(),
  getDefaultConfig: jest.fn()
} as jest.Mocked<EnvironmentConfigManager>;

const mockResourceOrchestrator = {
  provisionResources: jest.fn(),
  deallocateResources: jest.fn(),
  scaleResources: jest.fn(),
  getResourceStatus: jest.fn(),
  optimizeResources: jest.fn()
} as jest.Mocked<ResourceOrchestrator>;

const mockDeploymentPipeline = {
  createPipeline: jest.fn(),
  triggerDeployment: jest.fn(),
  getPipelineStatus: jest.fn(),
  cancelDeployment: jest.fn(),
  rollbackDeployment: jest.fn()
} as jest.Mocked<DeploymentPipeline>;

const mockEnvironmentValidator = {
  validateEnvironment: jest.fn(),
  runHealthChecks: jest.fn(),
  validateConnectivity: jest.fn(),
  checkResourceLimits: jest.fn()
} as jest.Mocked<EnvironmentValidator>;

const mockConfigTemplateEngine = {
  renderTemplate: jest.fn(),
  loadTemplate: jest.fn(),
  validateTemplate: jest.fn(),
  getAvailableTemplates: jest.fn()
} as jest.Mocked<ConfigTemplateEngine>;

// Mock AWS SDK
const mockEC2 = {
  runInstances: jest.fn().mockReturnValue({
    promise: () => Promise.resolve({
      Instances: [{ InstanceId: 'i-123456789', State: { Name: 'running' } }]
    })
  }),
  terminateInstances: jest.fn().mockReturnValue({
    promise: () => Promise.resolve({})
  }),
  describeInstances: jest.fn().mockReturnValue({
    promise: () => Promise.resolve({
      Reservations: [{
        Instances: [{ InstanceId: 'i-123456789', State: { Name: 'running' } }]
      }]
    })
  })
};

// Mock Google Cloud
const mockGCPCompute = {
  createVM: jest.fn(),
  deleteVM: jest.fn(),
  getVM: jest.fn()
};

// Mock Docker
const mockDocker = {
  createContainer: jest.fn(),
  startContainer: jest.fn(),
  stopContainer: jest.fn(),
  removeContainer: jest.fn(),
  listContainers: jest.fn()
};

// Mock Kubernetes
const mockK8sClient = {
  createNamespace: jest.fn(),
  createDeployment: jest.fn(),
  deleteDeployment: jest.fn(),
  createService: jest.fn(),
  deleteService: jest.fn()
};

interface EnvironmentSpec {
  name: string;
  type: 'development' | 'staging' | 'production';
  resources: {
    cpu: number;
    memory: string;
    storage: string;
  };
  configuration: Record<string, any>;
  services: string[];
  teamId: string;
}

interface ProvisioningRequest {
  id: string;
  environmentSpec: EnvironmentSpec;
  requestedBy: string;
  priority: 'low' | 'medium' | 'high';
  deadline?: Date;
}

interface EnvironmentStatus {
  id: string;
  status: 'provisioning' | 'ready' | 'failed' | 'destroying';
  progress: number;
  resources: any[];
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastUpdated: Date;
}

describe('EnvironmentProvisioningService', () => {
  let service: EnvironmentProvisioningService;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeAll(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    service = new EnvironmentProvisioningService(
      mockConfigManager,
      mockResourceOrchestrator,
      mockDeploymentPipeline,
      mockEnvironmentValidator,
      mockConfigTemplateEngine
    );
  });

  describe('Environment Provisioning', () => {
    const mockEnvironmentSpec: EnvironmentSpec = {
      name: 'test-environment',
      type: 'development',
      resources: {
        cpu: 2,
        memory: '4GB',
        storage: '20GB'
      },
      configuration: {
        nodeVersion: '18',
        database: 'postgresql'
      },
      services: ['api', 'frontend', 'database'],
      teamId: 'team-123'
    };

    const mockProvisioningRequest: ProvisioningRequest = {
      id: 'req-123',
      environmentSpec: mockEnvironmentSpec,
      requestedBy: 'user-123',
      priority: 'medium'
    };

    it('should successfully provision a development environment', async () => {
      // Arrange
      mockConfigManager.generateConfig.mockResolvedValue({
        nodeVersion: '18',
        database: 'postgresql',
        apiConfig: { port: 3000 }
      });
      mockResourceOrchestrator.provisionResources.mockResolvedValue({
        resourceId: 'res-123',
        status: 'allocated',
        resources: ['vm-123', 'db-123']
      });
      mockDeploymentPipeline.createPipeline.mockResolvedValue({
        pipelineId: 'pipe-123',
        status: 'created'
      });
      mockEnvironmentValidator.validateEnvironment.mockResolvedValue({
        isValid: true,
        checks: ['connectivity', 'resources', 'services']
      });

      mockSupabaseClient.from().insert().mockResolvedValue({
        data: [{ id: 'env-123', status: 'provisioning' }],
        error: null
      });

      // Act
      const result = await service.provisionEnvironment(mockProvisioningRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('provisioning');
      expect(mockConfigManager.generateConfig).toHaveBeenCalledWith(mockEnvironmentSpec);
      expect(mockResourceOrchestrator.provisionResources).toHaveBeenCalled();
      expect(mockDeploymentPipeline.createPipeline).toHaveBeenCalled();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('environments');
    });

    it('should handle staging environment provisioning with enhanced resources', async () => {
      // Arrange
      const stagingSpec = {
        ...mockEnvironmentSpec,
        type: 'staging' as const,
        resources: {
          cpu: 4,
          memory: '8GB',
          storage: '50GB'
        }
      };

      mockConfigManager.generateConfig.mockResolvedValue({
        nodeVersion: '18',
        database: 'postgresql',
        loadBalancer: true,
        monitoring: true
      });

      // Act
      const result = await service.provisionEnvironment({
        ...mockProvisioningRequest,
        environmentSpec: stagingSpec
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockConfigManager.generateConfig).toHaveBeenCalledWith(stagingSpec);
      expect(mockResourceOrchestrator.provisionResources).toHaveBeenCalledWith(
        expect.objectContaining({
          cpu: 4,
          memory: '8GB',
          storage: '50GB'
        })
      );
    });

    it('should handle production environment provisioning with high availability', async () => {
      // Arrange
      const productionSpec = {
        ...mockEnvironmentSpec,
        type: 'production' as const,
        resources: {
          cpu: 8,
          memory: '16GB',
          storage: '100GB'
        }
      };

      mockConfigManager.generateConfig.mockResolvedValue({
        nodeVersion: '18',
        database: 'postgresql',
        loadBalancer: true,
        monitoring: true,
        backups: true,
        replication: true
      });

      // Act
      const result = await service.provisionEnvironment({
        ...mockProvisioningRequest,
        environmentSpec: productionSpec,
        priority: 'high'
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockConfigManager.generateConfig).toHaveBeenCalledWith(productionSpec);
      expect(mockResourceOrchestrator.provisionResources).toHaveBeenCalledWith(
        expect.objectContaining({
          highAvailability: true,
          replication: true
        })
      );
    });

    it('should handle provisioning errors gracefully', async () => {
      // Arrange
      mockConfigManager.generateConfig.mockResolvedValue({});
      mockResourceOrchestrator.provisionResources.mockRejectedValue(
        new Error('Insufficient resources')
      );

      // Act & Assert
      await expect(service.provisionEnvironment(mockProvisioningRequest))
        .rejects
        .toThrow('Insufficient resources');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to provision environment'),
        expect.any(Error)
      );
    });

    it('should validate environment specifications before provisioning', async () => {
      // Arrange
      const invalidSpec = {
        ...mockEnvironmentSpec,
        resources: {
          cpu: 0, // Invalid CPU count
          memory: '4GB',
          storage: '20GB'
        }
      };

      // Act & Assert
      await expect(service.provisionEnvironment({
        ...mockProvisioningRequest,
        environmentSpec: invalidSpec
      })).rejects.toThrow('Invalid environment specification');
    });
  });

  describe('Environment Configuration Management', () => {
    it('should generate configuration from templates', async () => {
      // Arrange
      const templateName = 'nodejs-api';
      const variables = {
        nodeVersion: '18',
        port: 3000,
        database: 'postgresql'
      };

      mockConfigTemplateEngine.loadTemplate.mockResolvedValue({
        name: templateName,
        content: 'NODE_VERSION={{nodeVersion}}\nPORT={{port}}'
      });

      mockConfigTemplateEngine.renderTemplate.mockResolvedValue({
        content: 'NODE_VERSION=18\nPORT=3000',
        variables: variables
      });

      // Act
      const result = await service.generateEnvironmentConfig(templateName, variables);

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toContain('NODE_VERSION=18');
      expect(mockConfigTemplateEngine.loadTemplate).toHaveBeenCalledWith(templateName);
      expect(mockConfigTemplateEngine.renderTemplate).toHaveBeenCalled();
    });

    it('should merge multiple configuration sources', async () => {
      // Arrange
      const baseConfig = { nodeVersion: '18', port: 3000 };
      const overrideConfig = { port: 8080, database: 'postgresql' };
      const expectedMerged = { nodeVersion: '18', port: 8080, database: 'postgresql' };

      mockConfigManager.mergeConfigs.mockResolvedValue(expectedMerged);

      // Act
      const result = await service.mergeConfigurations([baseConfig, overrideConfig]);

      // Assert
      expect(result).toEqual(expectedMerged);
      expect(mockConfigManager.mergeConfigs).toHaveBeenCalledWith([baseConfig, overrideConfig]);
    });

    it('should validate configuration before applying', async () => {
      // Arrange
      const config = {
        nodeVersion: '18',
        port: 3000,
        database: 'postgresql'
      };

      mockConfigManager.validateConfig.mockResolvedValue({
        isValid: true,
        errors: []
      });

      // Act
      const isValid = await service.validateConfiguration(config);

      // Assert
      expect(isValid).toBe(true);
      expect(mockConfigManager.validateConfig).toHaveBeenCalledWith(config);
    });

    it('should handle configuration validation errors', async () => {
      // Arrange
      const invalidConfig = {
        nodeVersion: 'invalid',
        port: -1
      };

      mockConfigManager.validateConfig.mockResolvedValue({
        isValid: false,
        errors: ['Invalid node version', 'Invalid port number']
      });

      // Act
      const isValid = await service.validateConfiguration(invalidConfig);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Resource Orchestration', () => {
    it('should provision cloud resources successfully', async () => {
      // Arrange
      const resourceSpec = {
        provider: 'aws',
        region: 'us-east-1',
        instanceType: 't3.medium',
        count: 2
      };

      mockResourceOrchestrator.provisionResources.mockResolvedValue({
        resourceId: 'aws-res-123',
        instances: ['i-123', 'i-456'],
        status: 'allocated'
      });

      // Act
      const result = await service.provisionCloudResources(resourceSpec);

      // Assert
      expect(result).toBeDefined();
      expect(result.instances).toHaveLength(2);
      expect(mockResourceOrchestrator.provisionResources).toHaveBeenCalledWith(resourceSpec);
    });

    it('should handle resource scaling', async () => {
      // Arrange
      const environmentId = 'env-123';
      const scaleConfig = {
        minInstances: 2,
        maxInstances: 10,
        targetCPU: 70
      };

      mockResourceOrchestrator.scaleResources.mockResolvedValue({
        resourceId: 'res-123',
        currentInstances: 3,
        status: 'scaled'
      });

      // Act
      const result = await service.scaleEnvironmentResources(environmentId, scaleConfig);

      // Assert
      expect(result).toBeDefined();
      expect(result.currentInstances).toBe(3);
      expect(mockResourceOrchestrator.scaleResources).toHaveBeenCalledWith(
        environmentId,
        scaleConfig
      );
    });

    it('should monitor resource utilization', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockResourceOrchestrator.getResourceStatus.mockResolvedValue({
        resourceId: 'res-123',
        utilization: {
          cpu: 45,
          memory: 60,
          storage: 30
        },
        health: 'healthy'
      });

      // Act
      const status = await service.getResourceStatus(environmentId);

      // Assert
      expect(status).toBeDefined();
      expect(status.utilization.cpu).toBe(45);
      expect(status.health).toBe('healthy');
    });

    it('should optimize resource allocation', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockResourceOrchestrator.optimizeResources.mockResolvedValue({
        optimizations: [
          { type: 'downsize', resource: 'compute', savings: 25 },
          { type: 'rightsizing', resource: 'storage', savings: 15 }
        ],
        totalSavings: 40
      });

      // Act
      const result = await service.optimizeResources(environmentId);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalSavings).toBe(40);
      expect(result.optimizations).toHaveLength(2);
    });
  });

  describe('Deployment Pipeline Management', () => {
    it('should create deployment pipeline successfully', async () => {
      // Arrange
      const pipelineConfig = {
        environmentId: 'env-123',
        stages: ['build', 'test', 'deploy'],
        triggers: ['push', 'manual']
      };

      mockDeploymentPipeline.createPipeline.mockResolvedValue({
        pipelineId: 'pipe-123',
        status: 'created',
        stages: pipelineConfig.stages
      });

      // Act
      const result = await service.createDeploymentPipeline(pipelineConfig);

      // Assert
      expect(result).toBeDefined();
      expect(result.pipelineId).toBe('pipe-123');
      expect(result.stages).toEqual(pipelineConfig.stages);
    });

    it('should trigger deployment successfully', async () => {
      // Arrange
      const deploymentRequest = {
        pipelineId: 'pipe-123',
        branch: 'main',
        environmentId: 'env-123'
      };

      mockDeploymentPipeline.triggerDeployment.mockResolvedValue({
        deploymentId: 'deploy-123',
        status: 'running',
        startedAt: new Date()
      });

      // Act
      const result = await service.triggerDeployment(deploymentRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.deploymentId).toBe('deploy-123');
      expect(result.status).toBe('running');
    });

    it('should handle deployment rollback', async () => {
      // Arrange
      const rollbackRequest = {
        deploymentId: 'deploy-123',
        targetVersion: 'v1.0.0'
      };

      mockDeploymentPipeline.rollbackDeployment.mockResolvedValue({
        rollbackId: 'rollback-123',
        status: 'completed',
        targetVersion: 'v1.0.0'
      });

      // Act
      const result = await service.rollbackDeployment(rollbackRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.targetVersion).toBe('v1.0.0');
      expect(result.status).toBe('completed');
    });

    it('should get deployment status', async () => {
      // Arrange
      const pipelineId = 'pipe-123';
      mockDeploymentPipeline.getPipelineStatus.mockResolvedValue({
        pipelineId,
        status: 'running',
        currentStage: 'test',
        progress: 60
      });

      // Act
      const status = await service.getDeploymentStatus(pipelineId);

      // Assert
      expect(status).toBeDefined();
      expect(status.currentStage).toBe('test');
      expect(status.progress).toBe(60);
    });
  });

  describe('Environment Validation and Health Checks', () => {
    it('should validate environment successfully', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockEnvironmentValidator.validateEnvironment.mockResolvedValue({
        isValid: true,
        checks: [
          { name: 'connectivity', status: 'passed' },
          { name: 'resources', status: 'passed' },
          { name: 'services', status: 'passed' }
        ]
      });

      // Act
      const result = await service.validateEnvironment(environmentId);

      // Assert
      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
      expect(result.checks).toHaveLength(3);
    });

    it('should run comprehensive health checks', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockEnvironmentValidator.runHealthChecks.mockResolvedValue({
        overall: 'healthy',
        checks: {
          api: { status: 'healthy', responseTime: 120 },
          database: { status: 'healthy', connections: 5 },
          storage: { status: 'healthy', utilization: 45 }
        }
      });

      // Act
      const result = await service.runHealthChecks(environmentId);

      // Assert
      expect(result).toBeDefined();
      expect(result.overall).toBe('healthy');
      expect(result.checks.api.responseTime).toBe(120);
    });

    it('should validate connectivity between services', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockEnvironmentValidator.validateConnectivity.mockResolvedValue({
        connectivity: [
          { from: 'api', to: 'database', status: 'connected' },
          { from: 'frontend', to: 'api', status: 'connected' }
        ],
        allConnected: true
      });

      // Act
      const result = await service.validateConnectivity(environmentId);

      // Assert
      expect(result).toBeDefined();
      expect(result.allConnected).toBe(true);
      expect(result.connectivity).toHaveLength(2);
    });

    it('should check resource limits', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockEnvironmentValidator.checkResourceLimits.mockResolvedValue({
        cpu: { used: 45, limit: 100, status: 'ok' },
        memory: { used: 60, limit: 100, status: 'warning' },
        storage: { used: 30, limit: 100, status: 'ok' }
      });

      // Act
      const result = await service.checkResourceLimits(environmentId);

      // Assert
      expect(result).toBeDefined();
      expect(result.memory.status).toBe('warning');
      expect(result.cpu.status).toBe('ok');
    });
  });

  describe('Environment Lifecycle Management', () => {
    it('should handle environment destruction', async () => {
      // Arrange
      const environmentId = 'env-123';
      mockResourceOrchestrator.deallocateResources.mockResolvedValue({
        deallocatedResources: ['vm-123', 'db-123'],
        status: 'deal