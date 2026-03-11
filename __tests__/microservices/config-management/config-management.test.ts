import { jest } from '@jest/globals';
import { ConfigManagementService } from '../../../src/microservices/config-management/config-management.service';
import { ConfigValidator } from '../../../src/microservices/config-management/config-validator';
import { RollbackManager } from '../../../src/microservices/config-management/rollback-manager';
import { ABTestingEngine } from '../../../src/microservices/config-management/ab-testing-engine';
import { SecretManager } from '../../../src/microservices/config-management/secret-manager';
import { EnvironmentManager } from '../../../src/microservices/config-management/environment-manager';
import { ConfigurationRepository } from '../../../src/microservices/config-management/configuration-repository';
import { ValidationEngine } from '../../../src/microservices/config-management/validation-engine';
import { DeploymentOrchestrator } from '../../../src/microservices/config-management/deployment-orchestrator';

// Mock external dependencies
jest.mock('ioredis');
jest.mock('@supabase/supabase-js');
jest.mock('ws');
jest.mock('node-vault');
jest.mock('aws-sdk');
jest.mock('kubernetes-client');

describe('ConfigManagementService', () => {
  let configService: ConfigManagementService;
  let mockRepository: jest.Mocked<ConfigurationRepository>;
  let mockValidator: jest.Mocked<ConfigValidator>;
  let mockRollbackManager: jest.Mocked<RollbackManager>;
  let mockABTestingEngine: jest.Mocked<ABTestingEngine>;
  let mockSecretManager: jest.Mocked<SecretManager>;
  let mockEnvironmentManager: jest.Mocked<EnvironmentManager>;
  let mockValidationEngine: jest.Mocked<ValidationEngine>;
  let mockDeploymentOrchestrator: jest.Mocked<DeploymentOrchestrator>;
  let mockRedisClient: any;
  let mockWebSocketServer: any;

  const mockConfig = {
    id: 'config-123',
    name: 'app-config',
    environment: 'production',
    version: '1.0.0',
    data: {
      database: { host: 'localhost', port: 5432 },
      api: { timeout: 30000, retries: 3 }
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-123',
    status: 'active' as const
  };

  beforeEach(() => {
    // Setup mocks
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEnvironment: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getVersions: jest.fn(),
      saveVersion: jest.fn()
    } as any;

    mockValidator = {
      validateConfig: jest.fn(),
      validateSchema: jest.fn(),
      validateEnvironmentConstraints: jest.fn()
    } as any;

    mockRollbackManager = {
      createSnapshot: jest.fn(),
      rollback: jest.fn(),
      getSnapshots: jest.fn(),
      canRollback: jest.fn()
    } as any;

    mockABTestingEngine = {
      createTest: jest.fn(),
      updateTrafficSplit: jest.fn(),
      getTestResults: jest.fn(),
      promoteWinner: jest.fn(),
      stopTest: jest.fn()
    } as any;

    mockSecretManager = {
      storeSecret: jest.fn(),
      retrieveSecret: jest.fn(),
      rotateSecret: jest.fn(),
      deleteSecret: jest.fn(),
      listSecrets: jest.fn()
    } as any;

    mockEnvironmentManager = {
      promoteConfig: jest.fn(),
      validatePromotion: jest.fn(),
      getEnvironmentHierarchy: jest.fn(),
      createEnvironment: jest.fn()
    } as any;

    mockValidationEngine = {
      validateConfiguration: jest.fn(),
      runHealthChecks: jest.fn(),
      validateDependencies: jest.fn()
    } as any;

    mockDeploymentOrchestrator = {
      deploy: jest.fn(),
      rollback: jest.fn(),
      getDeploymentStatus: jest.fn(),
      scheduleDeployment: jest.fn()
    } as any;

    mockRedisClient = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn()
    };

    mockWebSocketServer = {
      clients: new Set(),
      broadcast: jest.fn()
    };

    configService = new ConfigManagementService(
      mockRepository,
      mockValidator,
      mockRollbackManager,
      mockABTestingEngine,
      mockSecretManager,
      mockEnvironmentManager,
      mockValidationEngine,
      mockDeploymentOrchestrator,
      mockRedisClient,
      mockWebSocketServer
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration CRUD Operations', () => {
    describe('createConfiguration', () => {
      it('should create a new configuration successfully', async () => {
        const configData = {
          name: 'test-config',
          environment: 'development',
          data: { key: 'value' }
        };

        mockValidator.validateConfig.mockResolvedValue({ valid: true, errors: [] });
        mockRepository.create.mockResolvedValue(mockConfig);
        mockRedisClient.set.mockResolvedValue('OK');

        const result = await configService.createConfiguration(configData, 'user-123');

        expect(mockValidator.validateConfig).toHaveBeenCalledWith(configData.data);
        expect(mockRepository.create).toHaveBeenCalled();
        expect(mockRedisClient.set).toHaveBeenCalled();
        expect(result).toEqual(mockConfig);
      });

      it('should throw error when validation fails', async () => {
        const configData = {
          name: 'invalid-config',
          environment: 'development',
          data: { invalidKey: null }
        };

        mockValidator.validateConfig.mockResolvedValue({
          valid: false,
          errors: ['Invalid configuration structure']
        });

        await expect(
          configService.createConfiguration(configData, 'user-123')
        ).rejects.toThrow('Configuration validation failed');

        expect(mockRepository.create).not.toHaveBeenCalled();
      });

      it('should handle repository errors gracefully', async () => {
        const configData = {
          name: 'test-config',
          environment: 'development',
          data: { key: 'value' }
        };

        mockValidator.validateConfig.mockResolvedValue({ valid: true, errors: [] });
        mockRepository.create.mockRejectedValue(new Error('Database connection failed'));

        await expect(
          configService.createConfiguration(configData, 'user-123')
        ).rejects.toThrow('Database connection failed');
      });
    });

    describe('getConfiguration', () => {
      it('should retrieve configuration from cache first', async () => {
        const cachedConfig = JSON.stringify(mockConfig);
        mockRedisClient.get.mockResolvedValue(cachedConfig);

        const result = await configService.getConfiguration('config-123');

        expect(mockRedisClient.get).toHaveBeenCalledWith('config:config-123');
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(result).toEqual(mockConfig);
      });

      it('should fallback to repository when cache miss', async () => {
        mockRedisClient.get.mockResolvedValue(null);
        mockRepository.findById.mockResolvedValue(mockConfig);
        mockRedisClient.set.mockResolvedValue('OK');

        const result = await configService.getConfiguration('config-123');

        expect(mockRedisClient.get).toHaveBeenCalledWith('config:config-123');
        expect(mockRepository.findById).toHaveBeenCalledWith('config-123');
        expect(mockRedisClient.set).toHaveBeenCalled();
        expect(result).toEqual(mockConfig);
      });

      it('should return null when configuration not found', async () => {
        mockRedisClient.get.mockResolvedValue(null);
        mockRepository.findById.mockResolvedValue(null);

        const result = await configService.getConfiguration('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('updateConfiguration', () => {
      it('should update configuration with validation and versioning', async () => {
        const updateData = {
          data: { key: 'new-value' },
          version: '1.1.0'
        };

        mockRepository.findById.mockResolvedValue(mockConfig);
        mockValidator.validateConfig.mockResolvedValue({ valid: true, errors: [] });
        mockRollbackManager.createSnapshot.mockResolvedValue(true);
        mockRepository.update.mockResolvedValue({ ...mockConfig, ...updateData });
        mockRedisClient.del.mockResolvedValue(1);

        const result = await configService.updateConfiguration('config-123', updateData, 'user-123');

        expect(mockRollbackManager.createSnapshot).toHaveBeenCalledWith(mockConfig);
        expect(mockValidator.validateConfig).toHaveBeenCalledWith(updateData.data);
        expect(mockRepository.update).toHaveBeenCalled();
        expect(mockRedisClient.del).toHaveBeenCalledWith('config:config-123');
        expect(result.version).toBe('1.1.0');
      });

      it('should reject invalid updates', async () => {
        const updateData = {
          data: { invalidKey: undefined },
          version: '1.1.0'
        };

        mockRepository.findById.mockResolvedValue(mockConfig);
        mockValidator.validateConfig.mockResolvedValue({
          valid: false,
          errors: ['Invalid data structure']
        });

        await expect(
          configService.updateConfiguration('config-123', updateData, 'user-123')
        ).rejects.toThrow('Configuration validation failed');

        expect(mockRepository.update).not.toHaveBeenCalled();
      });
    });

    describe('deleteConfiguration', () => {
      it('should delete configuration and clear cache', async () => {
        mockRepository.findById.mockResolvedValue(mockConfig);
        mockRepository.delete.mockResolvedValue(true);
        mockRedisClient.del.mockResolvedValue(1);

        const result = await configService.deleteConfiguration('config-123');

        expect(mockRepository.delete).toHaveBeenCalledWith('config-123');
        expect(mockRedisClient.del).toHaveBeenCalledWith('config:config-123');
        expect(result).toBe(true);
      });

      it('should handle deletion of non-existent configuration', async () => {
        mockRepository.findById.mockResolvedValue(null);

        await expect(
          configService.deleteConfiguration('non-existent')
        ).rejects.toThrow('Configuration not found');
      });
    });
  });

  describe('Environment Management', () => {
    describe('promoteConfiguration', () => {
      it('should promote configuration between environments', async () => {
        const promotionRequest = {
          configId: 'config-123',
          sourceEnvironment: 'staging',
          targetEnvironment: 'production'
        };

        mockRepository.findById.mockResolvedValue(mockConfig);
        mockEnvironmentManager.validatePromotion.mockResolvedValue({ valid: true, errors: [] });
        mockEnvironmentManager.promoteConfig.mockResolvedValue({
          ...mockConfig,
          environment: 'production',
          id: 'config-124'
        });

        const result = await configService.promoteConfiguration(promotionRequest, 'user-123');

        expect(mockEnvironmentManager.validatePromotion).toHaveBeenCalled();
        expect(mockEnvironmentManager.promoteConfig).toHaveBeenCalled();
        expect(result.environment).toBe('production');
      });

      it('should reject invalid promotions', async () => {
        const promotionRequest = {
          configId: 'config-123',
          sourceEnvironment: 'production',
          targetEnvironment: 'development'
        };

        mockRepository.findById.mockResolvedValue(mockConfig);
        mockEnvironmentManager.validatePromotion.mockResolvedValue({
          valid: false,
          errors: ['Cannot promote from production to development']
        });

        await expect(
          configService.promoteConfiguration(promotionRequest, 'user-123')
        ).rejects.toThrow('Promotion validation failed');
      });
    });

    describe('getEnvironmentConfigurations', () => {
      it('should retrieve all configurations for an environment', async () => {
        const mockConfigs = [mockConfig, { ...mockConfig, id: 'config-124' }];
        mockRepository.findByEnvironment.mockResolvedValue(mockConfigs);

        const result = await configService.getEnvironmentConfigurations('production');

        expect(mockRepository.findByEnvironment).toHaveBeenCalledWith('production');
        expect(result).toEqual(mockConfigs);
      });
    });
  });

  describe('A/B Testing', () => {
    describe('createABTest', () => {
      it('should create A/B test with traffic splitting', async () => {
        const testConfig = {
          name: 'feature-test',
          configIdA: 'config-123',
          configIdB: 'config-124',
          trafficSplit: 50,
          environment: 'production'
        };

        const mockTest = {
          id: 'test-123',
          ...testConfig,
          status: 'active' as const,
          createdAt: new Date()
        };

        mockABTestingEngine.createTest.mockResolvedValue(mockTest);

        const result = await configService.createABTest(testConfig, 'user-123');

        expect(mockABTestingEngine.createTest).toHaveBeenCalledWith(testConfig, 'user-123');
        expect(result).toEqual(mockTest);
      });

      it('should validate A/B test configurations exist', async () => {
        const testConfig = {
          name: 'feature-test',
          configIdA: 'non-existent',
          configIdB: 'config-124',
          trafficSplit: 50,
          environment: 'production'
        };

        mockRepository.findById.mockResolvedValueOnce(null);

        await expect(
          configService.createABTest(testConfig, 'user-123')
        ).rejects.toThrow('Configuration A not found');
      });
    });

    describe('updateTrafficSplit', () => {
      it('should update traffic split for active test', async () => {
        mockABTestingEngine.updateTrafficSplit.mockResolvedValue(true);

        const result = await configService.updateTrafficSplit('test-123', 70);

        expect(mockABTestingEngine.updateTrafficSplit).toHaveBeenCalledWith('test-123', 70);
        expect(result).toBe(true);
      });
    });

    describe('promoteABTestWinner', () => {
      it('should promote winning configuration', async () => {
        const mockResults = {
          testId: 'test-123',
          winner: 'B',
          confidenceLevel: 95,
          metrics: { conversionRate: 0.15 }
        };

        mockABTestingEngine.getTestResults.mockResolvedValue(mockResults);
        mockABTestingEngine.promoteWinner.mockResolvedValue(true);

        const result = await configService.promoteABTestWinner('test-123');

        expect(mockABTestingEngine.getTestResults).toHaveBeenCalledWith('test-123');
        expect(mockABTestingEngine.promoteWinner).toHaveBeenCalledWith('test-123', 'B');
        expect(result).toBe(true);
      });
    });
  });

  describe('Rollback Management', () => {
    describe('rollbackConfiguration', () => {
      it('should rollback to previous version successfully', async () => {
        const rollbackRequest = {
          configId: 'config-123',
          targetVersion: '0.9.0'
        };

        mockRollbackManager.canRollback.mockResolvedValue(true);
        mockRollbackManager.rollback.mockResolvedValue({
          ...mockConfig,
          version: '0.9.0'
        });
        mockRedisClient.del.mockResolvedValue(1);

        const result = await configService.rollbackConfiguration(rollbackRequest, 'user-123');

        expect(mockRollbackManager.canRollback).toHaveBeenCalled();
        expect(mockRollbackManager.rollback).toHaveBeenCalled();
        expect(mockRedisClient.del).toHaveBeenCalledWith('config:config-123');
        expect(result.version).toBe('0.9.0');
      });

      it('should reject rollback when not possible', async () => {
        const rollbackRequest = {
          configId: 'config-123',
          targetVersion: '0.5.0'
        };

        mockRollbackManager.canRollback.mockResolvedValue(false);

        await expect(
          configService.rollbackConfiguration(rollbackRequest, 'user-123')
        ).rejects.toThrow('Rollback not possible');
      });
    });

    describe('getConfigurationHistory', () => {
      it('should retrieve version history', async () => {
        const mockVersions = [
          { version: '1.0.0', createdAt: new Date(), createdBy: 'user-123' },
          { version: '0.9.0', createdAt: new Date(), createdBy: 'user-456' }
        ];

        mockRollbackManager.getSnapshots.mockResolvedValue(mockVersions);

        const result = await configService.getConfigurationHistory('config-123');

        expect(mockRollbackManager.getSnapshots).toHaveBeenCalledWith('config-123');
        expect(result).toEqual(mockVersions);
      });
    });
  });

  describe('Secret Management', () => {
    describe('storeSecret', () => {
      it('should store encrypted secret', async () => {
        const secretData = {
          key: 'database-password',
          value: 'super-secret-password',
          environment: 'production'
        };

        mockSecretManager.storeSecret.mockResolvedValue('secret-123');

        const result = await configService.storeSecret(secretData, 'user-123');

        expect(mockSecretManager.storeSecret).toHaveBeenCalledWith(secretData, 'user-123');
        expect(result).toBe('secret-123');
      });

      it('should handle secret storage failures', async () => {
        const secretData = {
          key: 'api-key',
          value: 'test-key',
          environment: 'development'
        };

        mockSecretManager.storeSecret.mockRejectedValue(new Error('Encryption failed'));

        await expect(
          configService.storeSecret(secretData, 'user-123')
        ).rejects.toThrow('Encryption failed');
      });
    });

    describe('retrieveSecret', () => {
      it('should retrieve and decrypt secret', async () => {
        const mockSecret = {
          id: 'secret-123',
          key: 'database-password',
          value: 'decrypted-password',
          environment: 'production'
        };

        mockSecretManager.retrieveSecret.mockResolvedValue(mockSecret);

        const result = await configService.retrieveSecret('secret-123');

        expect(mockSecretManager.retrieveSecret).toHaveBeenCalledWith('secret-123');
        expect(result).toEqual(mockSecret);
      });

      it('should handle secret not found', async () => {
        mockSecretManager.retrieveSecret.mockResolvedValue(null);

        const result = await configService.retrieveSecret('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('rotateSecret', () => {
      it('should rotate secret successfully', async () => {
        mockSecretManager.rotateSecret.mockResolvedValue(true);

        const result = await configService.rotateSecret('secret-123', 'user-123');

        expect(mockSecretManager.rotateSecret).toHaveBeenCalledWith('secret-123', 'user-123');
        expect(result).toBe(true);
      });
    });
  });

  describe('Deployment Orchestration', () => {
    describe('deployConfiguration', () => {
      it('should orchestrate configuration deployment', async () => {
        const deploymentRequest = {
          configId: 'config-123',
          environment: 'production',
          strategy: 'rolling' as const
        };

        mockValidationEngine.validateConfiguration.mockResolvedValue({ valid: true, errors: [] });
        mockDeploymentOrchestrator.deploy.mockResolvedValue({
          deploymentId: 'deploy-123',
          status: 'success',
          startTime: new Date(),
          endTime: new Date()
        });

        const result = await configService.deployConfiguration(deploymentRequest, 'user-123');

        expect(mockValidationEngine.validateConfiguration).toHaveBeenCalled();
        expect(mockDeploymentOrchestrator.deploy).toHaveBeenCalled();
        expect(result.status).toBe('success');
      });

      it('should fail deployment for invalid configurations', async () => {
        const deploymentRequest = {
          configId: 'config-123',
          environment: 'production',
          strategy: 'rolling' as const
        };

        mockValidationEngine.validateConfiguration.mockResolvedValue({
          valid: false,
          errors: ['Health check failed']
        });

        await expect(
          configService.deployConfiguration(deploymentRequest, 'user-123')
        ).rejects.toThrow('Deployment validation failed');

        expect(mockDeploymentOrchestrator.deploy).not.toHaveBeenCalled();
      });
    });

    describe('getDeploymentStatus', () => {
      it('should return deployment status', async () => {
        const mockStatus = {
          deploymentId: 'deploy-123',
          status: 'in-progress',
          progress: 50,
          logs: ['Starting deployment', 'Validating configuration']
        };

        mockDeploymentOrchestrator.getDeploymentStatus.mockResolvedValue(mockStatus);

        const result = await configService.getDeploymentStatus('deploy-123');

        expect(mockDeploymentOrchestrator.getDeploymentStatus).toHaveBeenCalledWith('deploy-123');
        expect(result).toEqual(mockStatus);
      });
    });
  });

  describe('Real-time Updates', () => {
    describe('subscribeToConfigChanges', () => {
      it('should setup WebSocket subscription for configuration changes', async () => {
        const mockClient = { send: jest.fn() };
        mockWebSocketServer.clients.add(mockClient);

        await configService.subscribeToConfigChanges('config-123', mockClient