```typescript
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BiodiversityTrackingService } from '../../services/biodiversity-tracking';
import { SpeciesPopulationMonitor } from '../../services/species-population-monitor';
import { HabitatAnalyzer } from '../../services/habitat-analyzer';
import { EnvironmentalHealthMetrics } from '../../services/environmental-health-metrics';
import { EcosystemBalanceCalculator } from '../../services/ecosystem-balance-calculator';
import { BiodiversityRepository } from '../../repositories/biodiversity-repository';

// Mock external dependencies
jest.mock('../../repositories/biodiversity-repository');
jest.mock('../../services/species-population-monitor');
jest.mock('../../services/habitat-analyzer');
jest.mock('../../services/environmental-health-metrics');
jest.mock('../../services/ecosystem-balance-calculator');
jest.mock('@supabase/supabase-js');

// Type definitions for test data
interface SpeciesData {
  id: string;
  name: string;
  scientificName: string;
  population: number;
  habitatId: string;
  status: 'stable' | 'increasing' | 'decreasing' | 'endangered';
  lastObserved: Date;
}

interface HabitatData {
  id: string;
  type: 'forest' | 'ocean' | 'grassland' | 'wetland' | 'desert';
  area: number;
  healthScore: number;
  temperature: number;
  humidity: number;
  coordinates: { lat: number; lng: number };
}

interface EnvironmentalMetrics {
  airQuality: number;
  waterQuality: number;
  soilHealth: number;
  biodiversityIndex: number;
  carbonLevel: number;
  timestamp: Date;
}

describe('BiodiversityTrackingService', () => {
  let service: BiodiversityTrackingService;
  let mockRepository: jest.Mocked<BiodiversityRepository>;
  let mockPopulationMonitor: jest.Mocked<SpeciesPopulationMonitor>;
  let mockHabitatAnalyzer: jest.Mocked<HabitatAnalyzer>;
  let mockHealthMetrics: jest.Mocked<EnvironmentalHealthMetrics>;
  let mockBalanceCalculator: jest.Mocked<EcosystemBalanceCalculator>;

  // Test data
  const mockSpeciesData: SpeciesData[] = [
    {
      id: 'species-1',
      name: 'Forest Owl',
      scientificName: 'Strix sylvatica',
      population: 150,
      habitatId: 'habitat-1',
      status: 'stable',
      lastObserved: new Date('2024-01-15')
    },
    {
      id: 'species-2',
      name: 'River Trout',
      scientificName: 'Salmo aquaticus',
      population: 500,
      habitatId: 'habitat-2',
      status: 'decreasing',
      lastObserved: new Date('2024-01-14')
    }
  ];

  const mockHabitatData: HabitatData[] = [
    {
      id: 'habitat-1',
      type: 'forest',
      area: 1000,
      healthScore: 85,
      temperature: 18.5,
      humidity: 65,
      coordinates: { lat: 45.5231, lng: -122.6765 }
    },
    {
      id: 'habitat-2',
      type: 'ocean',
      area: 5000,
      healthScore: 72,
      temperature: 15.2,
      humidity: 80,
      coordinates: { lat: 36.7783, lng: -119.4179 }
    }
  ];

  const mockEnvironmentalMetrics: EnvironmentalMetrics = {
    airQuality: 78,
    waterQuality: 85,
    soilHealth: 72,
    biodiversityIndex: 0.68,
    carbonLevel: 350,
    timestamp: new Date('2024-01-15T10:00:00Z')
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockRepository = new BiodiversityRepository() as jest.Mocked<BiodiversityRepository>;
    mockPopulationMonitor = new SpeciesPopulationMonitor() as jest.Mocked<SpeciesPopulationMonitor>;
    mockHabitatAnalyzer = new HabitatAnalyzer() as jest.Mocked<HabitatAnalyzer>;
    mockHealthMetrics = new EnvironmentalHealthMetrics() as jest.Mocked<EnvironmentalHealthMetrics>;
    mockBalanceCalculator = new EcosystemBalanceCalculator() as jest.Mocked<EcosystemBalanceCalculator>;

    // Initialize service with mocked dependencies
    service = new BiodiversityTrackingService(
      mockRepository,
      mockPopulationMonitor,
      mockHabitatAnalyzer,
      mockHealthMetrics,
      mockBalanceCalculator
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Species Population Monitoring', () => {
    test('should successfully track species populations', async () => {
      // Arrange
      mockRepository.getSpeciesData.mockResolvedValue(mockSpeciesData);
      mockPopulationMonitor.analyzePopulationTrends.mockResolvedValue({
        trends: [
          { speciesId: 'species-1', trend: 'stable', changeRate: 0.02 },
          { speciesId: 'species-2', trend: 'decreasing', changeRate: -0.15 }
        ]
      });

      // Act
      const result = await service.trackSpeciesPopulations('ecosystem-1');

      // Assert
      expect(mockRepository.getSpeciesData).toHaveBeenCalledWith('ecosystem-1');
      expect(mockPopulationMonitor.analyzePopulationTrends).toHaveBeenCalledWith(mockSpeciesData);
      expect(result).toEqual({
        totalSpecies: 2,
        trends: expect.arrayContaining([
          expect.objectContaining({ trend: 'stable' }),
          expect.objectContaining({ trend: 'decreasing' })
        ])
      });
    });

    test('should handle empty species data gracefully', async () => {
      // Arrange
      mockRepository.getSpeciesData.mockResolvedValue([]);
      mockPopulationMonitor.analyzePopulationTrends.mockResolvedValue({ trends: [] });

      // Act
      const result = await service.trackSpeciesPopulations('ecosystem-empty');

      // Assert
      expect(result).toEqual({
        totalSpecies: 0,
        trends: []
      });
    });

    test('should throw error when species data retrieval fails', async () => {
      // Arrange
      mockRepository.getSpeciesData.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.trackSpeciesPopulations('ecosystem-1')).rejects.toThrow('Database connection failed');
    });

    test('should detect endangered species correctly', async () => {
      // Arrange
      const endangeredSpecies = [
        { ...mockSpeciesData[0], status: 'endangered' as const, population: 25 }
      ];
      mockRepository.getSpeciesData.mockResolvedValue(endangeredSpecies);
      mockPopulationMonitor.identifyEndangeredSpecies.mockResolvedValue([endangeredSpecies[0]]);

      // Act
      const result = await service.identifyEndangeredSpecies('ecosystem-1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('endangered');
      expect(result[0].population).toBeLessThan(50);
    });
  });

  describe('Habitat Analysis', () => {
    test('should analyze habitat health successfully', async () => {
      // Arrange
      mockRepository.getHabitatData.mockResolvedValue(mockHabitatData);
      mockHabitatAnalyzer.assessHabitatHealth.mockResolvedValue({
        overallHealth: 78.5,
        habitats: [
          { id: 'habitat-1', healthScore: 85, issues: [] },
          { id: 'habitat-2', healthScore: 72, issues: ['water_pollution'] }
        ]
      });

      // Act
      const result = await service.analyzeHabitatHealth('ecosystem-1');

      // Assert
      expect(mockRepository.getHabitatData).toHaveBeenCalledWith('ecosystem-1');
      expect(mockHabitatAnalyzer.assessHabitatHealth).toHaveBeenCalledWith(mockHabitatData);
      expect(result.overallHealth).toBe(78.5);
      expect(result.habitats).toHaveLength(2);
    });

    test('should detect habitat degradation', async () => {
      // Arrange
      const degradedHabitat = [
        { ...mockHabitatData[0], healthScore: 45 }
      ];
      mockRepository.getHabitatData.mockResolvedValue(degradedHabitat);
      mockHabitatAnalyzer.detectDegradation.mockResolvedValue([
        { habitatId: 'habitat-1', severity: 'high', causes: ['deforestation', 'pollution'] }
      ]);

      // Act
      const result = await service.detectHabitatDegradation('ecosystem-1');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('high');
      expect(result[0].causes).toContain('deforestation');
    });

    test('should monitor habitat changes over time', async () => {
      // Arrange
      const historicalData = [
        { date: new Date('2024-01-01'), healthScore: 85 },
        { date: new Date('2024-01-15'), healthScore: 72 }
      ];
      mockRepository.getHistoricalHabitatData.mockResolvedValue(historicalData);
      mockHabitatAnalyzer.calculateChangeRate.mockResolvedValue(-15.3);

      // Act
      const result = await service.monitorHabitatChanges('habitat-1', 30);

      // Assert
      expect(mockRepository.getHistoricalHabitatData).toHaveBeenCalledWith('habitat-1', 30);
      expect(result.changeRate).toBe(-15.3);
      expect(result.trend).toBe('declining');
    });
  });

  describe('Environmental Health Metrics', () => {
    test('should collect environmental metrics successfully', async () => {
      // Arrange
      mockHealthMetrics.collectMetrics.mockResolvedValue(mockEnvironmentalMetrics);

      // Act
      const result = await service.collectEnvironmentalMetrics('ecosystem-1');

      // Assert
      expect(mockHealthMetrics.collectMetrics).toHaveBeenCalledWith('ecosystem-1');
      expect(result).toEqual(mockEnvironmentalMetrics);
      expect(result.biodiversityIndex).toBeGreaterThan(0);
      expect(result.biodiversityIndex).toBeLessThanOrEqual(1);
    });

    test('should calculate biodiversity index correctly', async () => {
      // Arrange
      mockHealthMetrics.calculateBiodiversityIndex.mockResolvedValue(0.75);

      // Act
      const result = await service.calculateBiodiversityIndex('ecosystem-1');

      // Assert
      expect(result).toBe(0.75);
      expect(mockHealthMetrics.calculateBiodiversityIndex).toHaveBeenCalledWith('ecosystem-1');
    });

    test('should detect environmental threats', async () => {
      // Arrange
      const threats = [
        { type: 'pollution', severity: 'medium', location: { lat: 45.5, lng: -122.6 } },
        { type: 'climate_change', severity: 'high', location: { lat: 45.6, lng: -122.7 } }
      ];
      mockHealthMetrics.detectThreats.mockResolvedValue(threats);

      // Act
      const result = await service.detectEnvironmentalThreats('ecosystem-1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(expect.objectContaining({ type: 'pollution' }));
      expect(result).toContainEqual(expect.objectContaining({ type: 'climate_change' }));
    });

    test('should handle sensor data collection failures', async () => {
      // Arrange
      mockHealthMetrics.collectMetrics.mockRejectedValue(new Error('Sensor offline'));

      // Act & Assert
      await expect(service.collectEnvironmentalMetrics('ecosystem-1')).rejects.toThrow('Sensor offline');
    });
  });

  describe('Ecosystem Balance Calculations', () => {
    test('should calculate ecosystem balance successfully', async () => {
      // Arrange
      const balanceData = {
        overallBalance: 0.72,
        predatorPreyRatio: 0.15,
        plantAnimalRatio: 4.2,
        foodChainStability: 0.68,
        recommendations: ['increase_predator_population', 'restore_wetlands']
      };
      mockBalanceCalculator.calculateBalance.mockResolvedValue(balanceData);

      // Act
      const result = await service.calculateEcosystemBalance('ecosystem-1');

      // Assert
      expect(mockBalanceCalculator.calculateBalance).toHaveBeenCalledWith('ecosystem-1');
      expect(result.overallBalance).toBe(0.72);
      expect(result.recommendations).toContain('increase_predator_population');
    });

    test('should identify ecosystem imbalances', async () => {
      // Arrange
      const imbalances = [
        { type: 'overpopulation', species: 'Rabbit', severity: 'high' },
        { type: 'predator_shortage', species: 'Wolf', severity: 'medium' }
      ];
      mockBalanceCalculator.identifyImbalances.mockResolvedValue(imbalances);

      // Act
      const result = await service.identifyEcosystemImbalances('ecosystem-1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('overpopulation');
      expect(result[1].severity).toBe('medium');
    });

    test('should generate restoration recommendations', async () => {
      // Arrange
      const recommendations = [
        { action: 'reintroduce_species', target: 'Wolf', priority: 'high', timeline: '6-12 months' },
        { action: 'habitat_restoration', target: 'Wetland Area B', priority: 'medium', timeline: '1-2 years' }
      ];
      mockBalanceCalculator.generateRecommendations.mockResolvedValue(recommendations);

      // Act
      const result = await service.generateRestorationRecommendations('ecosystem-1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe('high');
      expect(result[1].action).toBe('habitat_restoration');
    });
  });

  describe('Real-time Monitoring', () => {
    test('should start real-time species monitoring', async () => {
      // Arrange
      const mockEventStream = {
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      };
      mockPopulationMonitor.startRealTimeMonitoring.mockResolvedValue(mockEventStream);

      // Act
      const result = await service.startRealTimeMonitoring('ecosystem-1');

      // Assert
      expect(mockPopulationMonitor.startRealTimeMonitoring).toHaveBeenCalledWith('ecosystem-1');
      expect(result).toBe(mockEventStream);
    });

    test('should handle real-time data updates', async () => {
      // Arrange
      const updateData = {
        speciesId: 'species-1',
        newPopulation: 155,
        timestamp: new Date(),
        location: { lat: 45.5, lng: -122.6 }
      };
      mockRepository.updateSpeciesData.mockResolvedValue(true);

      // Act
      await service.handleRealTimeUpdate(updateData);

      // Assert
      expect(mockRepository.updateSpeciesData).toHaveBeenCalledWith(
        updateData.speciesId,
        expect.objectContaining({ population: 155 })
      );
    });

    test('should trigger alerts for critical changes', async () => {
      // Arrange
      const criticalUpdate = {
        speciesId: 'species-1',
        newPopulation: 15, // Critical decline
        timestamp: new Date(),
        location: { lat: 45.5, lng: -122.6 }
      };
      const mockAlert = jest.fn();
      service.onCriticalChange = mockAlert;

      // Act
      await service.handleRealTimeUpdate(criticalUpdate);

      // Assert
      expect(mockAlert).toHaveBeenCalledWith({
        type: 'population_decline',
        severity: 'critical',
        species: expect.any(Object)
      });
    });
  });

  describe('Data Persistence and Retrieval', () => {
    test('should save biodiversity snapshot successfully', async () => {
      // Arrange
      const snapshot = {
        ecosystemId: 'ecosystem-1',
        timestamp: new Date(),
        species: mockSpeciesData,
        habitats: mockHabitatData,
        metrics: mockEnvironmentalMetrics,
        balance: 0.72
      };
      mockRepository.saveSnapshot.mockResolvedValue('snapshot-123');

      // Act
      const result = await service.saveSnapshot(snapshot);

      // Assert
      expect(mockRepository.saveSnapshot).toHaveBeenCalledWith(snapshot);
      expect(result).toBe('snapshot-123');
    });

    test('should retrieve historical trends', async () => {
      // Arrange
      const trends = [
        { date: new Date('2024-01-01'), biodiversityIndex: 0.65 },
        { date: new Date('2024-01-15'), biodiversityIndex: 0.68 }
      ];
      mockRepository.getHistoricalTrends.mockResolvedValue(trends);

      // Act
      const result = await service.getHistoricalTrends('ecosystem-1', 30);

      // Assert
      expect(mockRepository.getHistoricalTrends).toHaveBeenCalledWith('ecosystem-1', 30);
      expect(result).toEqual(trends);
    });

    test('should handle database connection errors', async () => {
      // Arrange
      mockRepository.saveSnapshot.mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert
      await expect(service.saveSnapshot({} as any)).rejects.toThrow('Connection timeout');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large species datasets efficiently', async () => {
      // Arrange
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockSpeciesData[0],
        id: `species-${i}`,
        name: `Species ${i}`
      }));
      mockRepository.getSpeciesData.mockResolvedValue(largeDataset);
      mockPopulationMonitor.analyzePopulationTrends.mockResolvedValue({ trends: [] });

      const startTime = performance.now();

      // Act
      await service.trackSpeciesPopulations('ecosystem-large');

      // Assert
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
      expect(mockRepository.getSpeciesData).toHaveBeenCalledTimes(1);
    });

    test('should batch process environmental updates', async () => {
      // Arrange
      const batchUpdates = Array.from({ length: 100 }, (_, i) => ({
        speciesId: `species-${i}`,
        newPopulation: 100 + i,
        timestamp: new Date(),
        location: { lat: 45.5, lng: -122.6 }
      }));
      mockRepository.batchUpdateSpecies.mockResolvedValue(true);

      // Act
      await service.processBatchUpdates(batchUpdates);

      // Assert
      expect(mockRepository.batchUpdateSpecies).toHaveBeenCalledWith(batchUpdates);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should implement circuit breaker for external API failures', async () => {
      // Arrange
      mockHealthMetrics.collectMetrics.mockRejectedValue(new Error('API timeout'));

      // Act & Assert - First few calls should fail normally
      await expect(service.collectEnvironmentalMetrics('ecosystem-1')).rejects.toThrow('API timeout');
      await expect(service.collectEnvironmentalMetrics('ecosystem-1')).rejects.toThrow('API timeout');
      
      // After threshold, should return fallback data
      const fallbackResult = await service.collectEnvironmentalMetricsWithFallback('ecosystem-1');
      expect(fallbackResult).toEqual(expect.objectContaining({
        status: 'fallback',
        metrics: expect.any(Object)
      }));
    });

    test('should retry transient failures', async () => {
      // Arrange
      mockRepository.saveSnapshot
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('snapshot-123');

      // Act
      const result = await service.saveSnapshotWithRetry({} as any);

      // Assert
      expect(mockRepository.saveSnapshot).toHaveBeenCalledTimes(3);
      expect(result).toBe('snapshot-123');
    });

    test('should validate input data integrity', async () => {
      // Arrange
      const invalidSpeciesData = [
        { ...mockSpeciesData[0], population: -50 } // Invalid negative population
      ];

      // Act & Assert
      await expect(service.validateAndTrackSpecies(invalidSpeciesData)).rejects.toThrow('Invalid species data');
    });
  });
});
```