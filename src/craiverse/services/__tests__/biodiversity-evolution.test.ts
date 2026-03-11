```typescript
import { jest } from '@jest/globals';
import { BiodiversityEvolutionService } from '../biodiversity-evolution.service';
import { GeneticAlgorithm } from '../../algorithms/genetic-algorithm';
import { NaturalSelectionEngine } from '../../engines/natural-selection.engine';
import { EnvironmentalAdaptationModel } from '../../models/environmental-adaptation.model';
import { SpeciesEvolutionTracker } from '../../trackers/species-evolution.tracker';
import { EcosystemBalanceManager } from '../../managers/ecosystem-balance.manager';
import { BiomeCompatibilityChecker } from '../../checkers/biome-compatibility.checker';
import { CRAIverseDatabase } from '../../database/craiverse.database';
import { BiomeSystem } from '../../systems/biome.system';
import { SpeciesRegistry } from '../../registries/species.registry';
import { EvolutionMetrics } from '../../metrics/evolution.metrics';
import { TimelineService } from '../../timeline/timeline.service';
import { EcosystemMonitoring } from '../../monitoring/ecosystem.monitoring';

// Mock all dependencies
jest.mock('../../algorithms/genetic-algorithm');
jest.mock('../../engines/natural-selection.engine');
jest.mock('../../models/environmental-adaptation.model');
jest.mock('../../trackers/species-evolution.tracker');
jest.mock('../../managers/ecosystem-balance.manager');
jest.mock('../../checkers/biome-compatibility.checker');
jest.mock('../../database/craiverse.database');
jest.mock('../../systems/biome.system');
jest.mock('../../registries/species.registry');
jest.mock('../../metrics/evolution.metrics');
jest.mock('../../timeline/timeline.service');
jest.mock('../../monitoring/ecosystem.monitoring');

describe('BiodiversityEvolutionService', () => {
  let service: BiodiversityEvolutionService;
  let mockGeneticAlgorithm: jest.Mocked<GeneticAlgorithm>;
  let mockNaturalSelectionEngine: jest.Mocked<NaturalSelectionEngine>;
  let mockEnvironmentalAdaptationModel: jest.Mocked<EnvironmentalAdaptationModel>;
  let mockSpeciesEvolutionTracker: jest.Mocked<SpeciesEvolutionTracker>;
  let mockEcosystemBalanceManager: jest.Mocked<EcosystemBalanceManager>;
  let mockBiomeCompatibilityChecker: jest.Mocked<BiomeCompatibilityChecker>;
  let mockCRAIverseDatabase: jest.Mocked<CRAIverseDatabase>;
  let mockBiomeSystem: jest.Mocked<BiomeSystem>;
  let mockSpeciesRegistry: jest.Mocked<SpeciesRegistry>;
  let mockEvolutionMetrics: jest.Mocked<EvolutionMetrics>;
  let mockTimelineService: jest.Mocked<TimelineService>;
  let mockEcosystemMonitoring: jest.Mocked<EcosystemMonitoring>;

  const mockSpeciesData = {
    id: 'species-001',
    name: 'Testicus mockicus',
    genome: {
      traits: {
        strength: 0.7,
        agility: 0.5,
        intelligence: 0.8,
        adaptability: 0.6
      },
      mutations: [],
      generation: 1
    },
    population: 1000,
    biomeId: 'forest-001',
    fitnessScore: 0.65
  };

  const mockBiomeData = {
    id: 'forest-001',
    name: 'Temperate Forest',
    environmentalPressures: {
      temperature: 0.3,
      humidity: 0.7,
      predationRisk: 0.4,
      resourceAvailability: 0.8
    },
    carryingCapacity: 50000
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockGeneticAlgorithm = new GeneticAlgorithm() as jest.Mocked<GeneticAlgorithm>;
    mockNaturalSelectionEngine = new NaturalSelectionEngine() as jest.Mocked<NaturalSelectionEngine>;
    mockEnvironmentalAdaptationModel = new EnvironmentalAdaptationModel() as jest.Mocked<EnvironmentalAdaptationModel>;
    mockSpeciesEvolutionTracker = new SpeciesEvolutionTracker() as jest.Mocked<SpeciesEvolutionTracker>;
    mockEcosystemBalanceManager = new EcosystemBalanceManager() as jest.Mocked<EcosystemBalanceManager>;
    mockBiomeCompatibilityChecker = new BiomeCompatibilityChecker() as jest.Mocked<BiomeCompatibilityChecker>;
    mockCRAIverseDatabase = new CRAIverseDatabase() as jest.Mocked<CRAIverseDatabase>;
    mockBiomeSystem = new BiomeSystem() as jest.Mocked<BiomeSystem>;
    mockSpeciesRegistry = new SpeciesRegistry() as jest.Mocked<SpeciesRegistry>;
    mockEvolutionMetrics = new EvolutionMetrics() as jest.Mocked<EvolutionMetrics>;
    mockTimelineService = new TimelineService() as jest.Mocked<TimelineService>;
    mockEcosystemMonitoring = new EcosystemMonitoring() as jest.Mocked<EcosystemMonitoring>;

    // Setup default mock implementations
    mockCRAIverseDatabase.getSpeciesByBiome.mockResolvedValue([mockSpeciesData]);
    mockBiomeSystem.getBiomeData.mockResolvedValue(mockBiomeData);
    mockSpeciesRegistry.getSpeciesGenome.mockResolvedValue(mockSpeciesData.genome);
    mockBiomeCompatibilityChecker.checkCompatibility.mockReturnValue(0.8);
    mockNaturalSelectionEngine.calculateFitness.mockReturnValue(0.65);
    mockGeneticAlgorithm.evolveGenome.mockReturnValue({
      ...mockSpeciesData.genome,
      generation: 2
    });

    service = new BiodiversityEvolutionService(
      mockGeneticAlgorithm,
      mockNaturalSelectionEngine,
      mockEnvironmentalAdaptationModel,
      mockSpeciesEvolutionTracker,
      mockEcosystemBalanceManager,
      mockBiomeCompatibilityChecker,
      mockCRAIverseDatabase,
      mockBiomeSystem,
      mockSpeciesRegistry,
      mockEvolutionMetrics,
      mockTimelineService,
      mockEcosystemMonitoring
    );
  });

  describe('Service Initialization', () => {
    it('should initialize with all required dependencies', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(BiodiversityEvolutionService);
    });

    it('should throw error when initialized with null dependencies', () => {
      expect(() => {
        new BiodiversityEvolutionService(
          null as any,
          mockNaturalSelectionEngine,
          mockEnvironmentalAdaptationModel,
          mockSpeciesEvolutionTracker,
          mockEcosystemBalanceManager,
          mockBiomeCompatibilityChecker,
          mockCRAIverseDatabase,
          mockBiomeSystem,
          mockSpeciesRegistry,
          mockEvolutionMetrics,
          mockTimelineService,
          mockEcosystemMonitoring
        );
      }).toThrow('GeneticAlgorithm is required');
    });
  });

  describe('Genetic Algorithm Integration', () => {
    it('should successfully evolve species genome', async () => {
      const evolvedGenome = {
        traits: {
          strength: 0.75,
          agility: 0.55,
          intelligence: 0.82,
          adaptability: 0.68
        },
        mutations: ['enhanced_strength'],
        generation: 2
      };

      mockGeneticAlgorithm.evolveGenome.mockReturnValue(evolvedGenome);

      const result = await service.evolveSpecies('species-001', 'forest-001');

      expect(mockGeneticAlgorithm.evolveGenome).toHaveBeenCalledWith(
        mockSpeciesData.genome,
        mockBiomeData.environmentalPressures
      );
      expect(result.genome.generation).toBe(2);
      expect(result.genome.mutations).toContain('enhanced_strength');
    });

    it('should handle genetic algorithm convergence', async () => {
      mockGeneticAlgorithm.hasConverged.mockReturnValue(true);
      mockGeneticAlgorithm.getConvergenceMetrics.mockReturnValue({
        generations: 50,
        fitnessImprovement: 0.3,
        diversityIndex: 0.2
      });

      const result = await service.runEvolutionSimulation('forest-001', 100);

      expect(result.converged).toBe(true);
      expect(result.metrics.generations).toBe(50);
      expect(mockEvolutionMetrics.recordConvergence).toHaveBeenCalledWith(
        'forest-001',
        expect.any(Object)
      );
    });

    it('should validate mutation rates within acceptable bounds', async () => {
      const invalidMutationRate = 1.5; // Above maximum threshold

      mockGeneticAlgorithm.setMutationRate.mockImplementation((rate) => {
        if (rate > 1.0) throw new Error('Mutation rate must be between 0 and 1');
      });

      await expect(service.setMutationRate(invalidMutationRate)).rejects.toThrow(
        'Mutation rate must be between 0 and 1'
      );
    });
  });

  describe('Natural Selection Engine', () => {
    it('should calculate species fitness based on environmental pressures', async () => {
      const expectedFitnessScore = 0.72;
      mockNaturalSelectionEngine.calculateFitness.mockReturnValue(expectedFitnessScore);

      const fitness = await service.calculateSpeciesFitness('species-001', 'forest-001');

      expect(mockNaturalSelectionEngine.calculateFitness).toHaveBeenCalledWith(
        mockSpeciesData.genome,
        mockBiomeData.environmentalPressures
      );
      expect(fitness).toBe(expectedFitnessScore);
    });

    it('should apply natural selection pressure correctly', async () => {
      const selectionPressure = {
        predationPressure: 0.6,
        resourceCompetition: 0.4,
        climateStress: 0.3
      };

      mockNaturalSelectionEngine.applySelectionPressure.mockReturnValue({
        survivingPopulation: 750,
        eliminatedTraits: ['weakness'],
        selectedTraits: ['strength', 'adaptability']
      });

      const result = await service.applySelectionPressure('species-001', selectionPressure);

      expect(result.survivingPopulation).toBe(750);
      expect(result.selectedTraits).toContain('strength');
      expect(mockSpeciesEvolutionTracker.recordSelection).toHaveBeenCalled();
    });

    it('should handle extinction scenarios', async () => {
      mockNaturalSelectionEngine.calculateFitness.mockReturnValue(0.05); // Very low fitness
      mockNaturalSelectionEngine.checkExtinctionRisk.mockReturnValue(true);

      const result = await service.assessExtinctionRisk('species-001', 'desert-001');

      expect(result.extinctionRisk).toBe(true);
      expect(mockEcosystemMonitoring.reportExtinctionRisk).toHaveBeenCalledWith(
        'species-001',
        'desert-001'
      );
    });
  });

  describe('Environmental Adaptation Model', () => {
    it('should calculate environmental adaptation thresholds', async () => {
      const adaptationThresholds = {
        temperature: { min: -10, max: 40, optimal: 20 },
        humidity: { min: 0.2, max: 0.9, optimal: 0.6 },
        altitude: { min: 0, max: 3000, optimal: 500 }
      };

      mockEnvironmentalAdaptationModel.calculateThresholds.mockReturnValue(adaptationThresholds);

      const result = await service.calculateAdaptationThresholds('species-001');

      expect(result.temperature.optimal).toBe(20);
      expect(result.humidity.min).toBe(0.2);
      expect(mockEnvironmentalAdaptationModel.calculateThresholds).toHaveBeenCalledWith(
        mockSpeciesData.genome
      );
    });

    it('should simulate environmental pressure adaptation', async () => {
      const environmentalChange = {
        temperatureIncrease: 5,
        humidityDecrease: 0.2,
        resourceReduction: 0.3
      };

      mockEnvironmentalAdaptationModel.simulateAdaptation.mockResolvedValue({
        adaptationSuccess: true,
        adaptedTraits: ['heat_tolerance', 'water_efficiency'],
        fitnessChange: 0.15
      });

      const result = await service.simulateEnvironmentalAdaptation(
        'species-001',
        environmentalChange
      );

      expect(result.adaptationSuccess).toBe(true);
      expect(result.adaptedTraits).toContain('heat_tolerance');
      expect(result.fitnessChange).toBe(0.15);
    });

    it('should handle adaptation failure scenarios', async () => {
      const extremeEnvironmentalChange = {
        temperatureIncrease: 25, // Extreme change
        humidityDecrease: 0.8,
        resourceReduction: 0.9
      };

      mockEnvironmentalAdaptationModel.simulateAdaptation.mockResolvedValue({
        adaptationSuccess: false,
        adaptedTraits: [],
        fitnessChange: -0.4
      });

      const result = await service.simulateEnvironmentalAdaptation(
        'species-001',
        extremeEnvironmentalChange
      );

      expect(result.adaptationSuccess).toBe(false);
      expect(result.fitnessChange).toBeLessThan(0);
      expect(mockEcosystemMonitoring.reportAdaptationFailure).toHaveBeenCalled();
    });
  });

  describe('Species Evolution Tracking', () => {
    it('should track species evolution over generations', async () => {
      const evolutionHistory = [
        { generation: 1, fitness: 0.6, traits: ['basic_traits'] },
        { generation: 2, fitness: 0.65, traits: ['basic_traits', 'adaptation_1'] },
        { generation: 3, fitness: 0.72, traits: ['basic_traits', 'adaptation_1', 'optimization'] }
      ];

      mockSpeciesEvolutionTracker.getEvolutionHistory.mockResolvedValue(evolutionHistory);

      const history = await service.getSpeciesEvolutionHistory('species-001');

      expect(history).toHaveLength(3);
      expect(history[2].fitness).toBe(0.72);
      expect(history[2].traits).toContain('optimization');
    });

    it('should record evolutionary milestones', async () => {
      const milestone = {
        generation: 10,
        event: 'trait_emergence',
        description: 'New camouflage trait emerged',
        significance: 0.8
      };

      await service.recordEvolutionaryMilestone('species-001', milestone);

      expect(mockSpeciesEvolutionTracker.recordMilestone).toHaveBeenCalledWith(
        'species-001',
        milestone
      );
      expect(mockTimelineService.addEvolutionEvent).toHaveBeenCalled();
    });

    it('should calculate evolutionary rates', async () => {
      mockSpeciesEvolutionTracker.calculateEvolutionRate.mockReturnValue({
        traitsPerGeneration: 0.3,
        fitnessImprovement: 0.05,
        geneticDiversity: 0.7
      });

      const rate = await service.calculateEvolutionRate('species-001', 50);

      expect(rate.traitsPerGeneration).toBe(0.3);
      expect(rate.geneticDiversity).toBe(0.7);
    });
  });

  describe('Ecosystem Balance Management', () => {
    it('should maintain ecosystem balance during evolution', async () => {
      const ecosystemBalance = {
        predatorPreyRatio: 0.15,
        resourceUtilization: 0.7,
        biodiversityIndex: 0.8,
        carryingCapacityUsage: 0.6
      };

      mockEcosystemBalanceManager.calculateBalance.mockReturnValue(ecosystemBalance);

      const balance = await service.assessEcosystemBalance('forest-001');

      expect(balance.biodiversityIndex).toBe(0.8);
      expect(balance.carryingCapacityUsage).toBe(0.6);
      expect(mockEcosystemBalanceManager.calculateBalance).toHaveBeenCalledWith(
        'forest-001'
      );
    });

    it('should handle population dynamics corrections', async () => {
      const overpopulationScenario = {
        speciesId: 'species-001',
        currentPopulation: 60000,
        carryingCapacity: 50000
      };

      mockEcosystemBalanceManager.correctPopulation.mockReturnValue({
        adjustedPopulation: 48000,
        correctionFactor: 0.8,
        migrationSuggested: 12000
      });

      const correction = await service.correctPopulationImbalance(overpopulationScenario);

      expect(correction.adjustedPopulation).toBe(48000);
      expect(correction.migrationSuggested).toBe(12000);
    });

    it('should trigger ecosystem interventions when needed', async () => {
      mockEcosystemBalanceManager.requiresIntervention.mockReturnValue(true);
      mockEcosystemBalanceManager.suggestInterventions.mockReturnValue([
        'introduce_predator',
        'enhance_resources',
        'create_migration_corridor'
      ]);

      const interventions = await service.getEcosystemInterventions('forest-001');

      expect(interventions).toContain('introduce_predator');
      expect(interventions).toContain('create_migration_corridor');
    });
  });

  describe('Biome Compatibility Checking', () => {
    it('should check species compatibility with biomes', async () => {
      const compatibilityScore = 0.85;
      mockBiomeCompatibilityChecker.checkCompatibility.mockReturnValue(compatibilityScore);

      const compatibility = await service.checkBiomeCompatibility('species-001', 'mountain-001');

      expect(compatibility).toBe(0.85);
      expect(mockBiomeCompatibilityChecker.checkCompatibility).toHaveBeenCalledWith(
        mockSpeciesData.genome,
        expect.any(Object)
      );
    });

    it('should suggest migration routes for low compatibility', async () => {
      mockBiomeCompatibilityChecker.checkCompatibility.mockReturnValue(0.2); // Low compatibility
      mockBiomeCompatibilityChecker.findCompatibleBiomes.mockReturnValue([
        { biomeId: 'forest-002', compatibility: 0.9 },
        { biomeId: 'grassland-001', compatibility: 0.7 }
      ]);

      const migrationSuggestions = await service.suggestMigrationRoutes('species-001', 'desert-001');

      expect(migrationSuggestions[0].compatibility).toBe(0.9);
      expect(migrationSuggestions[0].biomeId).toBe('forest-002');
    });

    it('should handle invalid biome conditions', async () => {
      const invalidBiome = {
        id: 'invalid-001',
        environmentalPressures: {
          temperature: 150, // Invalid temperature
          humidity: -0.5,   // Invalid humidity
          predationRisk: 2.0 // Invalid risk value
        }
      };

      mockBiomeSystem.getBiomeData.mockResolvedValue(invalidBiome);
      mockBiomeCompatibilityChecker.validateBiomeConditions.mockImplementation(() => {
        throw new Error('Invalid biome environmental conditions');
      });

      await expect(
        service.checkBiomeCompatibility('species-001', 'invalid-001')
      ).rejects.toThrow('Invalid biome environmental conditions');
    });
  });

  describe('Evolution Metrics and Monitoring', () => {
    it('should collect comprehensive evolution metrics', async () => {
      const metrics = {
        generationCount: 25,
        averageFitness: 0.68,
        geneticDiversity: 0.75,
        adaptationRate: 0.3,
        extinctionEvents: 2,
        speciationEvents: 5
      };

      mockEvolutionMetrics.getComprehensiveMetrics.mockResolvedValue(metrics);

      const result = await service.getEvolutionMetrics('forest-001', 30);

      expect(result.generationCount).toBe(25);
      expect(result.geneticDiversity).toBe(0.75);
      expect(result.speciationEvents).toBe(5);
    });

    it('should monitor ecosystem health during evolution', async () => {
      const healthMetrics = {
        overallHealth: 0.8,
        speciesCount: 45,
        foodChainStability: 0.9,
        resourceSustainability: 0.7,
        pollutionLevel: 0.1
      };

      mockEcosystemMonitoring.assessHealth.mockResolvedValue(healthMetrics);

      const health = await service.monitorEcosystemHealth('forest-001');

      expect(health.overallHealth).toBe(0.8);
      expect(health.foodChainStability).toBe(0.9);
      expect(mockEcosystemMonitoring.assessHealth).toHaveBeenCalledWith('forest-001');
    });

    it('should generate evolution reports', async () => {
      const report = {
        biomeId: 'forest-001',
        timeframe: '30 days',
        totalSpecies: 50,
        evolutionaryChanges: 15,
        extinctions: 3,
        newSpecies: 2,
        fitnessImprovement: 0.12,
        recommendations: ['increase_genetic_diversity', 'monitor_climate_adaptation']
      };

      mockEvolutionMetrics.generateReport.mockResolvedValue(report);

      const result = await service.generateEvolutionReport('forest-001', 30);

      expect(result.totalSpecies).toBe(50);
      expect(result.recommendations).toContain('increase_genetic_diversity');
    });
  });

  describe('Database Operations and Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockCRAIverseDatabase.getSpeciesByBiome.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.evolveSpecies('species-001', 'forest-001')).rejects.toTh