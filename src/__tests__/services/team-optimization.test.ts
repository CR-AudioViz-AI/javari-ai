```typescript
import { TeamOptimizationService } from '../../services/team-optimization';
import { PerformanceAnalyzer } from '../../services/performance-analyzer';
import { TeamCompositionScorer } from '../../services/team-composition-scorer';
import { RoleAssignmentOptimizer } from '../../services/role-assignment-optimizer';
import { MLModelInterface } from '../../services/ml-model-interface';
import { TeamMetricsCollector } from '../../services/team-metrics-collector';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@tensorflow/tfjs');

// Mock data types
interface Agent {
  id: string;
  name: string;
  skills: Record<string, number>;
  experience: number;
  availability: boolean;
  performance_rating: number;
}

interface Task {
  id: string;
  type: string;
  complexity: number;
  required_skills: Record<string, number>;
  estimated_duration: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface TeamComposition {
  agents: Agent[];
  roles: Record<string, string>;
  predicted_performance: number;
  confidence: number;
}

interface OptimizationResult {
  recommended_team: TeamComposition;
  alternatives: TeamComposition[];
  performance_score: number;
  reasoning: string;
  optimization_time: number;
}

describe('TeamOptimizationService', () => {
  let teamOptimizationService: TeamOptimizationService;
  let performanceAnalyzer: PerformanceAnalyzer;
  let teamCompositionScorer: TeamCompositionScorer;
  let roleAssignmentOptimizer: RoleAssignmentOptimizer;
  let mlModelInterface: MLModelInterface;
  let teamMetricsCollector: TeamMetricsCollector;
  let mockSupabaseClient: jest.Mocked<SupabaseClient>;

  // Mock agents data
  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Alice Developer',
      skills: { 'frontend': 0.9, 'react': 0.85, 'typescript': 0.8, 'testing': 0.7 },
      experience: 5,
      availability: true,
      performance_rating: 8.5
    },
    {
      id: 'agent-2',
      name: 'Bob Backend',
      skills: { 'backend': 0.95, 'nodejs': 0.9, 'database': 0.85, 'api': 0.8 },
      experience: 7,
      availability: true,
      performance_rating: 9.0
    },
    {
      id: 'agent-3',
      name: 'Carol Designer',
      skills: { 'ui_design': 0.9, 'ux_design': 0.85, 'prototyping': 0.8 },
      experience: 4,
      availability: false,
      performance_rating: 8.0
    },
    {
      id: 'agent-4',
      name: 'David DevOps',
      skills: { 'devops': 0.9, 'kubernetes': 0.8, 'ci_cd': 0.85, 'monitoring': 0.7 },
      experience: 6,
      availability: true,
      performance_rating: 8.7
    }
  ];

  const mockTask: Task = {
    id: 'task-1',
    type: 'feature_development',
    complexity: 7,
    required_skills: { 'frontend': 0.8, 'backend': 0.7, 'testing': 0.6 },
    estimated_duration: 40,
    priority: 'high'
  };

  beforeEach(() => {
    // Setup mocks
    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: mockAgents,
            error: null
          }))
        })),
        insert: jest.fn(() => ({
          data: null,
          error: null
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      }))
    } as any;

    (createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

    // Setup service dependencies
    mlModelInterface = new MLModelInterface();
    teamMetricsCollector = new TeamMetricsCollector(mockSupabaseClient);
    performanceAnalyzer = new PerformanceAnalyzer(mlModelInterface);
    teamCompositionScorer = new TeamCompositionScorer();
    roleAssignmentOptimizer = new RoleAssignmentOptimizer();
    
    teamOptimizationService = new TeamOptimizationService(
      mockSupabaseClient,
      performanceAnalyzer,
      teamCompositionScorer,
      roleAssignmentOptimizer,
      teamMetricsCollector
    );

    // Mock TensorFlow.js
    (tf.sequential as jest.Mock).mockReturnValue({
      add: jest.fn(),
      compile: jest.fn(),
      fit: jest.fn().mockResolvedValue({ history: {} }),
      predict: jest.fn().mockReturnValue({
        dataSync: jest.fn().mockReturnValue([0.85])
      })
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Team Optimization Core Functionality', () => {
    it('should optimize team composition for given task requirements', async () => {
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(result).toBeDefined();
      expect(result.recommended_team).toBeDefined();
      expect(result.recommended_team.agents.length).toBeGreaterThan(0);
      expect(result.performance_score).toBeGreaterThan(0);
      expect(result.performance_score).toBeLessThanOrEqual(10);
      expect(result.alternatives).toBeInstanceOf(Array);
      expect(result.reasoning).toBeTruthy();
    });

    it('should handle empty agent pool gracefully', async () => {
      const result = await teamOptimizationService.optimizeTeam(mockTask, []);

      expect(result.recommended_team.agents).toHaveLength(0);
      expect(result.performance_score).toBe(0);
      expect(result.reasoning).toContain('no available agents');
    });

    it('should filter unavailable agents from consideration', async () => {
      const availableAgents = mockAgents.filter(agent => agent.availability);
      
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);
      
      result.recommended_team.agents.forEach(agent => {
        expect(agent.availability).toBe(true);
      });
    });

    it('should prioritize agents with matching skills', async () => {
      const taskRequiringFrontend: Task = {
        ...mockTask,
        required_skills: { 'frontend': 0.9, 'react': 0.8 }
      };

      const result = await teamOptimizationService.optimizeTeam(taskRequiringFrontend, mockAgents);
      
      expect(result.recommended_team.agents.some(agent => 
        agent.skills.frontend && agent.skills.frontend > 0.8
      )).toBe(true);
    });

    it('should optimize for team size based on task complexity', async () => {
      const simpleTask: Task = { ...mockTask, complexity: 3 };
      const complexTask: Task = { ...mockTask, complexity: 9 };

      const simpleResult = await teamOptimizationService.optimizeTeam(simpleTask, mockAgents);
      const complexResult = await teamOptimizationService.optimizeTeam(complexTask, mockAgents);

      expect(complexResult.recommended_team.agents.length)
        .toBeGreaterThanOrEqual(simpleResult.recommended_team.agents.length);
    });
  });

  describe('Performance Analysis Integration', () => {
    it('should analyze historical performance data for predictions', async () => {
      jest.spyOn(performanceAnalyzer, 'predictTeamPerformance')
        .mockResolvedValue({ score: 8.5, confidence: 0.92 });

      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(performanceAnalyzer.predictTeamPerformance).toHaveBeenCalled();
      expect(result.recommended_team.predicted_performance).toBeCloseTo(8.5);
      expect(result.recommended_team.confidence).toBeCloseTo(0.92);
    });

    it('should handle performance prediction failures gracefully', async () => {
      jest.spyOn(performanceAnalyzer, 'predictTeamPerformance')
        .mockRejectedValue(new Error('Model prediction failed'));

      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(result.recommended_team.predicted_performance).toBeGreaterThan(0);
      expect(result.recommended_team.confidence).toBeLessThan(0.5);
    });

    it('should incorporate performance ratings in team scoring', async () => {
      const highPerformers = mockAgents.filter(agent => agent.performance_rating > 8.5);
      const lowPerformers = mockAgents.filter(agent => agent.performance_rating < 8.5);

      jest.spyOn(teamCompositionScorer, 'scoreTeam').mockImplementation((team) => {
        const avgRating = team.reduce((sum, agent) => sum + agent.performance_rating, 0) / team.length;
        return avgRating * 10;
      });

      const highPerformResult = await teamOptimizationService.optimizeTeam(mockTask, highPerformers);
      const lowPerformResult = await teamOptimizationService.optimizeTeam(mockTask, lowPerformers);

      expect(highPerformResult.performance_score)
        .toBeGreaterThan(lowPerformResult.performance_score);
    });
  });

  describe('Role Assignment Optimization', () => {
    it('should assign optimal roles based on agent skills', async () => {
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(result.recommended_team.roles).toBeDefined();
      expect(Object.keys(result.recommended_team.roles).length)
        .toEqual(result.recommended_team.agents.length);

      // Check that frontend specialist gets frontend role
      const frontendAgent = result.recommended_team.agents
        .find(agent => agent.skills.frontend > 0.8);
      if (frontendAgent) {
        expect(result.recommended_team.roles[frontendAgent.id])
          .toMatch(/frontend|ui|client/i);
      }
    });

    it('should avoid role conflicts in team composition', async () => {
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);
      
      const assignedRoles = Object.values(result.recommended_team.roles);
      const criticalRoles = assignedRoles.filter(role => 
        ['lead', 'architect', 'project_manager'].includes(role.toLowerCase())
      );

      // Should not have multiple leads/architects in small teams
      if (result.recommended_team.agents.length <= 3) {
        expect(criticalRoles.length).toBeLessThanOrEqual(1);
      }
    });

    it('should handle role optimization failures', async () => {
      jest.spyOn(roleAssignmentOptimizer, 'optimizeRoles')
        .mockImplementation(() => { throw new Error('Role optimization failed'); });

      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      // Should fall back to basic role assignment
      expect(result.recommended_team.roles).toBeDefined();
      expect(Object.keys(result.recommended_team.roles).length)
        .toEqual(result.recommended_team.agents.length);
    });
  });

  describe('ML Model Integration', () => {
    it('should train model with historical team performance data', async () => {
      const historicalData = [
        { team: [mockAgents[0], mockAgents[1]], performance: 8.5 },
        { team: [mockAgents[1], mockAgents[3]], performance: 9.0 },
        { team: [mockAgents[0], mockAgents[2]], performance: 7.5 }
      ];

      jest.spyOn(teamMetricsCollector, 'getHistoricalPerformance')
        .mockResolvedValue(historicalData);

      await teamOptimizationService.trainModel();

      expect(mlModelInterface.trainPerformanceModel).toHaveBeenCalledWith(
        expect.arrayContaining(historicalData)
      );
    });

    it('should handle model training failures', async () => {
      jest.spyOn(mlModelInterface, 'trainPerformanceModel')
        .mockRejectedValue(new Error('Training failed'));

      await expect(teamOptimizationService.trainModel()).resolves.not.toThrow();
    });

    it('should use cached model predictions when available', async () => {
      const cacheKey = 'team_prediction_task-1';
      
      jest.spyOn(teamOptimizationService, 'getCachedPrediction')
        .mockResolvedValue({ score: 8.2, confidence: 0.88 });

      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(teamOptimizationService.getCachedPrediction).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('Database Integration', () => {
    it('should persist optimization results to database', async () => {
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);
      
      await teamOptimizationService.saveOptimizationResult(mockTask.id, result);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('team_optimizations');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          task_id: mockTask.id,
          recommended_team: expect.any(Object),
          performance_score: expect.any(Number)
        })
      );
    });

    it('should handle database connection errors', async () => {
      mockSupabaseClient.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          data: null,
          error: { message: 'Database connection failed' }
        }))
      })) as any;

      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      await expect(
        teamOptimizationService.saveOptimizationResult(mockTask.id, result)
      ).resolves.not.toThrow();
    });

    it('should retrieve agent capabilities from database', async () => {
      await teamOptimizationService.getAvailableAgents();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('agents');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*');
    });
  });

  describe('Performance Benchmarking', () => {
    it('should complete optimization within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await teamOptimizationService.optimizeTeam(mockTask, mockAgents);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle large agent pools efficiently', async () => {
      const largeAgentPool: Agent[] = Array.from({ length: 100 }, (_, i) => ({
        id: `agent-${i}`,
        name: `Agent ${i}`,
        skills: { 'generic': Math.random() },
        experience: Math.floor(Math.random() * 10),
        availability: Math.random() > 0.3,
        performance_rating: Math.random() * 10
      }));

      const startTime = Date.now();
      const result = await teamOptimizationService.optimizeTeam(mockTask, largeAgentPool);
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(10000); // 10 seconds max for large datasets
      expect(result.recommended_team.agents.length).toBeGreaterThan(0);
    });

    it('should provide multiple optimization alternatives', async () => {
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(result.alternatives).toBeInstanceOf(Array);
      expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
      expect(result.alternatives.length).toBeLessThanOrEqual(5);

      // Each alternative should be valid
      result.alternatives.forEach(alternative => {
        expect(alternative.agents.length).toBeGreaterThan(0);
        expect(alternative.predicted_performance).toBeGreaterThan(0);
        expect(alternative.confidence).toBeBetween(0, 1);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tasks with no matching agent skills', async () => {
      const impossibleTask: Task = {
        ...mockTask,
        required_skills: { 'quantum_computing': 0.9, 'ai_research': 0.8 }
      };

      const result = await teamOptimizationService.optimizeTeam(impossibleTask, mockAgents);

      expect(result.performance_score).toBeLessThan(5);
      expect(result.reasoning).toContain('skill gap');
      expect(result.recommended_team.agents.length).toBeGreaterThan(0); // Best effort
    });

    it('should handle invalid task parameters', async () => {
      const invalidTask: Task = {
        ...mockTask,
        complexity: -1,
        required_skills: {}
      };

      const result = await teamOptimizationService.optimizeTeam(invalidTask, mockAgents);

      expect(result).toBeDefined();
      expect(result.reasoning).toContain('invalid');
    });

    it('should gracefully handle ML model unavailability', async () => {
      jest.spyOn(mlModelInterface, 'isModelLoaded').mockReturnValue(false);

      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      expect(result.recommended_team.confidence).toBeLessThan(0.7);
      expect(result.reasoning).toContain('heuristic');
    });

    it('should handle concurrent optimization requests', async () => {
      const promises = Array.from({ length: 5 }, () =>
        teamOptimizationService.optimizeTeam(mockTask, mockAgents)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.recommended_team).toBeDefined();
      });
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should complete full optimization workflow', async () => {
      // 1. Train model
      await teamOptimizationService.trainModel();

      // 2. Optimize team
      const result = await teamOptimizationService.optimizeTeam(mockTask, mockAgents);

      // 3. Save results
      await teamOptimizationService.saveOptimizationResult(mockTask.id, result);

      // 4. Verify workflow completion
      expect(result.recommended_team).toBeDefined();
      expect(result.performance_score).toBeGreaterThan(0);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalled();
    });

    it('should handle real-world team composition scenarios', async () => {
      const scenarios = [
        {
          name: 'Small startup team',
          agents: mockAgents.slice(0, 2),
          task: { ...mockTask, complexity: 5 }
        },
        {
          name: 'Enterprise project team',
          agents: mockAgents,
          task: { ...mockTask, complexity: 9, priority: 'critical' }
        },
        {
          name: 'Maintenance team',
          agents: mockAgents.slice(1, 3),
          task: { ...mockTask, type: 'bug_fix', complexity: 3 }
        }
      ];

      for (const scenario of scenarios) {
        const result = await teamOptimizationService.optimizeTeam(
          scenario.task as Task, 
          scenario.agents
        );

        expect(result.recommended_team.agents.length).toBeGreaterThan(0);
        expect(result.performance_score).toBeGreaterThan(0);
        expect(result.reasoning).toContain(scenario.name.toLowerCase().replace(/\s+/g, ''));
      }
    });
  });
});

// Helper extension for Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeBetween(a: number, b: number): R;
    }
  }
}

expect.extend({
  toBeBetween(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be between ${floor} and ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be between ${floor} and ${ceiling}`,
        pass: false,
      };
    }
  },
});
```