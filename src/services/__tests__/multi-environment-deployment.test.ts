```typescript
import { 
  MultiEnvironmentDeploymentService,
  DeploymentOrchestrator,
  EnvironmentConfigManager,
  DependencyResolver,
  DeploymentValidator,
  RollbackManager,
  DeploymentStatusTracker
} from '../multi-environment-deployment';
import { SupabaseClient } from '@supabase/supabase-js';
import { KubernetesApi } from '@kubernetes/client-node';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@kubernetes/client-node');
jest.mock('dockerode');
jest.mock('node-vault');
jest.mock('@slack/web-api');

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: mockDeploymentConfig }),
        order: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue({ data: [] })
        }))
      })),
      insert: jest.fn().mockResolvedValue({ data: { id: 'deploy-123' } }),
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: { id: 'deploy-123' } })
      })),
      delete: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: null })
      }))
    })),
    rpc: jest.fn().mockResolvedValue({ data: [] })
  }))
} as unknown as SupabaseClient;

const mockK8sApi = {
  createNamespacedDeployment: jest.fn().mockResolvedValue({}),
  patchNamespacedDeployment: jest.fn().mockResolvedValue({}),
  deleteNamespacedDeployment: jest.fn().mockResolvedValue({}),
  readNamespacedDeployment: jest.fn().mockResolvedValue({
    body: { status: { readyReplicas: 3, replicas: 3 } }
  }),
  listNamespacedPod: jest.fn().mockResolvedValue({
    body: { items: [] }
  })
};

const mockDockerRegistry = {
  getImage: jest.fn().mockResolvedValue({ Id: 'sha256:abc123' }),
  listImages: jest.fn().mockResolvedValue([]),
  pull: jest.fn().mockResolvedValue({})
};

const mockVault = {
  read: jest.fn().mockResolvedValue({
    data: { data: { API_KEY: 'secret-key' } }
  })
};

const mockSlack = {
  chat: {
    postMessage: jest.fn().mockResolvedValue({ ok: true })
  }
};

// Mock data
const mockDeploymentConfig = {
  id: 'config-123',
  name: 'test-deployment',
  environments: ['dev', 'staging', 'prod'],
  dependencies: ['database', 'redis'],
  configuration: {
    dev: { replicas: 1, resources: { cpu: '100m' } },
    staging: { replicas: 2, resources: { cpu: '200m' } },
    prod: { replicas: 3, resources: { cpu: '500m' } }
  }
};

const mockDeploymentRequest = {
  id: 'req-123',
  configId: 'config-123',
  targetEnvironments: ['dev', 'staging'],
  version: '1.2.3',
  triggeredBy: 'user-123',
  strategy: 'rolling' as const,
  parallelExecution: true
};

const mockDependencyGraph = {
  nodes: [
    { id: 'database', type: 'service', dependencies: [] },
    { id: 'redis', type: 'service', dependencies: [] },
    { id: 'api', type: 'service', dependencies: ['database', 'redis'] },
    { id: 'frontend', type: 'service', dependencies: ['api'] }
  ],
  edges: [
    { from: 'api', to: 'database' },
    { from: 'api', to: 'redis' },
    { from: 'frontend', to: 'api' }
  ]
};

describe('MultiEnvironmentDeploymentService', () => {
  let service: MultiEnvironmentDeploymentService;
  let orchestrator: DeploymentOrchestrator;
  let configManager: EnvironmentConfigManager;
  let dependencyResolver: DependencyResolver;
  let validator: DeploymentValidator;
  let rollbackManager: RollbackManager;
  let statusTracker: DeploymentStatusTracker;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize service components
    configManager = new EnvironmentConfigManager(mockSupabase, mockVault);
    dependencyResolver = new DependencyResolver();
    validator = new DeploymentValidator(mockK8sApi, mockDockerRegistry);
    rollbackManager = new RollbackManager(mockSupabase, mockK8sApi);
    statusTracker = new DeploymentStatusTracker(mockSupabase, mockSlack);
    orchestrator = new DeploymentOrchestrator(
      dependencyResolver,
      validator,
      statusTracker
    );
    
    service = new MultiEnvironmentDeploymentService({
      supabase: mockSupabase,
      orchestrator,
      configManager,
      rollbackManager,
      statusTracker
    });
  });

  describe('initiateDeployment', () => {
    it('should successfully initiate multi-environment deployment', async () => {
      const result = await service.initiateDeployment(mockDeploymentRequest);

      expect(result).toMatchObject({
        deploymentId: expect.any(String),
        status: 'initiated',
        environments: ['dev', 'staging'],
        estimatedDuration: expect.any(Number)
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('deployments');
    });

    it('should validate deployment request before initiation', async () => {
      const invalidRequest = { ...mockDeploymentRequest, targetEnvironments: [] };

      await expect(service.initiateDeployment(invalidRequest))
        .rejects.toThrow('Target environments cannot be empty');
    });

    it('should handle configuration loading failure', async () => {
      mockSupabase.from().select().eq().single.mockRejectedValueOnce(
        new Error('Configuration not found')
      );

      await expect(service.initiateDeployment(mockDeploymentRequest))
        .rejects.toThrow('Configuration not found');
    });

    it('should create deployment tracking record', async () => {
      await service.initiateDeployment(mockDeploymentRequest);

      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          config_id: 'config-123',
          target_environments: ['dev', 'staging'],
          status: 'initiated'
        })
      );
    });
  });

  describe('executeDeployment', () => {
    it('should execute deployment with dependency resolution', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(dependencyResolver, 'resolveDependencies')
        .mockResolvedValue(mockDependencyGraph);
      jest.spyOn(orchestrator, 'executeParallel')
        .mockResolvedValue({ success: true, results: [] });

      const result = await service.executeDeployment(deploymentId);

      expect(result.status).toBe('completed');
      expect(dependencyResolver.resolveDependencies).toHaveBeenCalled();
      expect(orchestrator.executeParallel).toHaveBeenCalled();
    });

    it('should handle dependency resolution failure', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(dependencyResolver, 'resolveDependencies')
        .mockRejectedValue(new Error('Circular dependency detected'));

      await expect(service.executeDeployment(deploymentId))
        .rejects.toThrow('Circular dependency detected');
    });

    it('should execute environments in parallel when enabled', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(dependencyResolver, 'resolveDependencies')
        .mockResolvedValue(mockDependencyGraph);
      jest.spyOn(orchestrator, 'executeParallel')
        .mockResolvedValue({ success: true, results: [] });

      await service.executeDeployment(deploymentId);

      expect(orchestrator.executeParallel).toHaveBeenCalledWith(
        expect.arrayContaining(['dev', 'staging']),
        expect.any(Object)
      );
    });

    it('should update deployment status during execution', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(dependencyResolver, 'resolveDependencies')
        .mockResolvedValue(mockDependencyGraph);
      jest.spyOn(orchestrator, 'executeParallel')
        .mockResolvedValue({ success: true, results: [] });

      await service.executeDeployment(deploymentId);

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
  });

  describe('rollbackDeployment', () => {
    it('should successfully rollback deployment', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(rollbackManager, 'rollback')
        .mockResolvedValue({ success: true, rolledBackServices: ['api', 'frontend'] });

      const result = await service.rollbackDeployment(deploymentId, 'user-123');

      expect(result).toMatchObject({
        success: true,
        rolledBackServices: ['api', 'frontend']
      });
      expect(rollbackManager.rollback).toHaveBeenCalledWith(deploymentId);
    });

    it('should handle rollback failure gracefully', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(rollbackManager, 'rollback')
        .mockRejectedValue(new Error('Rollback failed'));

      await expect(service.rollbackDeployment(deploymentId, 'user-123'))
        .rejects.toThrow('Rollback failed');
    });

    it('should update deployment status after rollback', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(rollbackManager, 'rollback')
        .mockResolvedValue({ success: true, rolledBackServices: [] });

      await service.rollbackDeployment(deploymentId, 'user-123');

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'rolled_back' })
      );
    });
  });

  describe('getDeploymentStatus', () => {
    it('should return comprehensive deployment status', async () => {
      const deploymentId = 'deploy-123';
      jest.spyOn(statusTracker, 'getDetailedStatus')
        .mockResolvedValue({
          id: deploymentId,
          status: 'in_progress',
          environments: {
            dev: { status: 'completed', progress: 100 },
            staging: { status: 'in_progress', progress: 60 }
          },
          services: { api: 'healthy', frontend: 'deploying' }
        });

      const result = await service.getDeploymentStatus(deploymentId);

      expect(result).toMatchObject({
        id: deploymentId,
        status: 'in_progress',
        environments: expect.any(Object),
        services: expect.any(Object)
      });
    });

    it('should handle non-existent deployment', async () => {
      const deploymentId = 'non-existent';
      jest.spyOn(statusTracker, 'getDetailedStatus')
        .mockRejectedValue(new Error('Deployment not found'));

      await expect(service.getDeploymentStatus(deploymentId))
        .rejects.toThrow('Deployment not found');
    });
  });
});

describe('DeploymentOrchestrator', () => {
  let orchestrator: DeploymentOrchestrator;

  beforeEach(() => {
    orchestrator = new DeploymentOrchestrator(
      new DependencyResolver(),
      new DeploymentValidator(mockK8sApi, mockDockerRegistry),
      new DeploymentStatusTracker(mockSupabase, mockSlack)
    );
  });

  describe('executeParallel', () => {
    it('should execute multiple environments in parallel', async () => {
      const environments = ['dev', 'staging'];
      const deploymentPlan = {
        services: ['api', 'frontend'],
        configuration: mockDeploymentConfig.configuration
      };

      const result = await orchestrator.executeParallel(environments, deploymentPlan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should handle partial failures in parallel execution', async () => {
      const environments = ['dev', 'staging'];
      const deploymentPlan = {
        services: ['api', 'frontend'],
        configuration: mockDeploymentConfig.configuration
      };

      mockK8sApi.createNamespacedDeployment
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Deployment failed'));

      const result = await orchestrator.executeParallel(environments, deploymentPlan);

      expect(result.success).toBe(false);
      expect(result.results.some(r => r.success === false)).toBe(true);
    });

    it('should maintain isolation between environment deployments', async () => {
      const environments = ['dev', 'staging'];
      const deploymentPlan = {
        services: ['api'],
        configuration: mockDeploymentConfig.configuration
      };

      await orchestrator.executeParallel(environments, deploymentPlan);

      expect(mockK8sApi.createNamespacedDeployment).toHaveBeenCalledTimes(2);
      expect(mockK8sApi.createNamespacedDeployment).toHaveBeenCalledWith(
        'dev-namespace',
        expect.any(Object)
      );
      expect(mockK8sApi.createNamespacedDeployment).toHaveBeenCalledWith(
        'staging-namespace',
        expect.any(Object)
      );
    });
  });

  describe('executeSequential', () => {
    it('should execute environments sequentially', async () => {
      const environments = ['dev', 'staging', 'prod'];
      const deploymentPlan = {
        services: ['api'],
        configuration: mockDeploymentConfig.configuration
      };

      const result = await orchestrator.executeSequential(environments, deploymentPlan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
    });

    it('should stop execution on first failure in sequential mode', async () => {
      const environments = ['dev', 'staging', 'prod'];
      const deploymentPlan = {
        services: ['api'],
        configuration: mockDeploymentConfig.configuration
      };

      mockK8sApi.createNamespacedDeployment
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Staging deployment failed'));

      const result = await orchestrator.executeSequential(environments, deploymentPlan);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2); // Only dev and staging attempted
    });
  });
});

describe('EnvironmentConfigManager', () => {
  let configManager: EnvironmentConfigManager;

  beforeEach(() => {
    configManager = new EnvironmentConfigManager(mockSupabase, mockVault);
  });

  describe('mergeEnvironmentConfig', () => {
    it('should merge base config with environment overrides', () => {
      const baseConfig = {
        image: 'app:latest',
        port: 8080,
        replicas: 1,
        resources: { cpu: '100m', memory: '128Mi' }
      };

      const envOverrides = {
        replicas: 3,
        resources: { cpu: '500m' },
        env: { NODE_ENV: 'production' }
      };

      const result = configManager.mergeEnvironmentConfig(baseConfig, envOverrides);

      expect(result).toEqual({
        image: 'app:latest',
        port: 8080,
        replicas: 3,
        resources: { cpu: '500m', memory: '128Mi' },
        env: { NODE_ENV: 'production' }
      });
    });

    it('should handle nested object merging', () => {
      const baseConfig = {
        resources: { cpu: '100m', memory: '128Mi' },
        env: { DEBUG: 'false', PORT: '8080' }
      };

      const envOverrides = {
        resources: { cpu: '500m' },
        env: { DEBUG: 'true', NODE_ENV: 'production' }
      };

      const result = configManager.mergeEnvironmentConfig(baseConfig, envOverrides);

      expect(result.resources).toEqual({ cpu: '500m', memory: '128Mi' });
      expect(result.env).toEqual({
        DEBUG: 'true',
        PORT: '8080',
        NODE_ENV: 'production'
      });
    });
  });

  describe('loadSecrets', () => {
    it('should load secrets from Vault', async () => {
      const secretPaths = ['secret/app/dev', 'secret/database/dev'];

      const result = await configManager.loadSecrets('dev', secretPaths);

      expect(result).toEqual({ API_KEY: 'secret-key' });
      expect(mockVault.read).toHaveBeenCalledWith('secret/app/dev');
    });

    it('should handle Vault connection failure', async () => {
      mockVault.read.mockRejectedValueOnce(new Error('Vault unreachable'));

      await expect(configManager.loadSecrets('dev', ['secret/app/dev']))
        .rejects.toThrow('Vault unreachable');
    });
  });
});

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('resolveDependencies', () => {
    it('should resolve dependency graph correctly', async () => {
      const services = [
        { name: 'frontend', dependencies: ['api'] },
        { name: 'api', dependencies: ['database', 'redis'] },
        { name: 'database', dependencies: [] },
        { name: 'redis', dependencies: [] }
      ];

      const result = await resolver.resolveDependencies(services);

      expect(result.deploymentOrder).toEqual([
        'database', 'redis', 'api', 'frontend'
      ]);
    });

    it('should detect circular dependencies', async () => {
      const services = [
        { name: 'api', dependencies: ['frontend'] },
        { name: 'frontend', dependencies: ['api'] }
      ];

      await expect(resolver.resolveDependencies(services))
        .rejects.toThrow('Circular dependency detected');
    });

    it('should handle complex dependency graphs', async () => {
      const services = [
        { name: 'web', dependencies: ['api', 'cdn'] },
        { name: 'api', dependencies: ['auth', 'database'] },
        { name: 'auth', dependencies: ['database', 'redis'] },
        { name: 'database', dependencies: [] },
        { name: 'redis', dependencies: [] },
        { name: 'cdn', dependencies: [] }
      ];

      const result = await resolver.resolveDependencies(services);

      const order = result.deploymentOrder;
      expect(order.indexOf('database')).toBeLessThan(order.indexOf('auth'));
      expect(order.indexOf('auth')).toBeLessThan(order.indexOf('api'));
      expect(order.indexOf('api')).toBeLessThan(order.indexOf('web'));
    });
  });
});

describe('DeploymentValidator', () => {
  let validator: DeploymentValidator;

  beforeEach(() => {
    validator = new DeploymentValidator(mockK8sApi, mockDockerRegistry);
  });

  describe('validateDeploymentPlan', () => {
    it('should validate successful deployment plan', async () => {
      const plan = {
        environment: 'dev',
        services: ['api'],
        configuration: { api: { image: 'api:1.0.0', replicas: 2 } }
      };

      const result = await validator.validateDeploymentPlan(plan);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid image references', async () => {
      mockDockerRegistry.getImage.mockRejectedValueOnce(new Error('Image not found'));

      const plan = {
        environment: 'dev',
        services: ['api'],
        configuration: { api: { image: 'api:invalid', replicas: 1 } }
      };

      const result = await validator.validateDeploymentPlan(plan);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Image not found'))).toBe(true);
    });

    it('should validate resource requirements', async () => {
      const plan = {
        environment: 'prod',
        services: ['api'],
        configuration: {
          api: {
            image: 'api:1.0.0',
            replicas: 10,
            resources: { cpu: '10000m', memory: '100Gi' }
          }
        }
      };

      const result = await validator.validateDeploymentPlan(plan);

      expect(result.warnings.some(w => w.includes('High resource usage'))).toBe(true);
    });
  });

  describe('validateEnvironmentHealth', () => {
    it('should validate healthy environment', async () => {
      mockK8sApi.listNamespacedPod.mockResolvedValueOnce({
        body: { items: [{ status: { phase: 'Running' } }] }
      });

      const result = await validator.validateEnvironmentHealth('dev');

      expect(result.isHealthy).toBe(true);
    });

    it('should detect unhealthy environment', async () => {
      mockK8sApi.listNamespacedPod.mockResolvedValueOnce({
        body: { items: [{ status: { phase: 'Failed' } }] }
      });

      const result = await validator.validateEnvironmentHealth('dev');

      expect(result.isHealthy).toBe(false);
      expect(result.issues).toContain('Pods in Failed state detected');
    });
  });
});

describe('RollbackManager', () => {
  let rollbackManager: RollbackManager;

  beforeEach(() => {
    rollbackManager = new RollbackManager(mockSupabase, mockK8sApi);
  });

  describe('rollback', () => {
    it('should successfully rollback deployment', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValueOn