import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/error-handler';

/**
 * Application requirements specification
 */
export interface ApplicationRequirements {
  id: string;
  name: string;
  type: 'web' | 'api' | 'microservice' | 'ml' | 'batch' | 'streaming';
  expectedTraffic: {
    requests: number;
    concurrent_users: number;
    data_volume_gb: number;
  };
  performance: {
    response_time_ms: number;
    availability_percent: number;
    throughput_rps: number;
  };
  resources: {
    cpu_cores: number;
    memory_gb: number;
    storage_gb: number;
    gpu_required: boolean;
  };
  compliance: string[];
  geographic_requirements: {
    primary_regions: string[];
    data_residency: string[];
    latency_zones: string[];
  };
}

/**
 * Historical performance metrics
 */
export interface PerformanceMetrics {
  application_id: string;
  timestamp: Date;
  cpu_utilization: number;
  memory_utilization: number;
  network_io: number;
  storage_io: number;
  response_time: number;
  error_rate: number;
  concurrent_connections: number;
}

/**
 * Instance type specification
 */
export interface InstanceType {
  provider: string;
  type: string;
  vcpus: number;
  memory_gb: number;
  network_performance: string;
  storage_type: string;
  gpu_type?: string;
  cost_per_hour: number;
  availability_zones: string[];
}

/**
 * Region information
 */
export interface Region {
  provider: string;
  code: string;
  name: string;
  location: {
    continent: string;
    country: string;
    coordinates: [number, number];
  };
  services_available: string[];
  compliance_certifications: string[];
  latency_zones: string[];
}

/**
 * Scaling configuration
 */
export interface ScalingConfiguration {
  min_instances: number;
  max_instances: number;
  target_cpu_utilization: number;
  target_memory_utilization: number;
  scale_up_threshold: number;
  scale_down_threshold: number;
  scale_up_cooldown: number;
  scale_down_cooldown: number;
  predictive_scaling: boolean;
}

/**
 * Cost estimation breakdown
 */
export interface CostEstimation {
  compute_monthly: number;
  storage_monthly: number;
  network_monthly: number;
  total_monthly: number;
  breakdown: {
    component: string;
    cost: number;
    percentage: number;
  }[];
  savings_opportunities: {
    type: string;
    description: string;
    potential_savings: number;
  }[];
}

/**
 * Deployment configuration recommendation
 */
export interface DeploymentConfiguration {
  primary_region: string;
  secondary_regions: string[];
  instance_type: string;
  instance_count: number;
  scaling: ScalingConfiguration;
  load_balancing: {
    type: 'application' | 'network';
    health_check_path: string;
    health_check_interval: number;
  };
  storage: {
    type: 'ssd' | 'hdd' | 'nvme';
    size_gb: number;
    backup_enabled: boolean;
    encryption: boolean;
  };
  networking: {
    vpc_enabled: boolean;
    cdn_enabled: boolean;
    firewall_rules: string[];
  };
}

/**
 * Complete optimization recommendation
 */
export interface OptimizationRecommendation {
  id: string;
  application_id: string;
  created_at: Date;
  confidence_score: number;
  deployment: DeploymentConfiguration;
  cost_estimation: CostEstimation;
  performance_prediction: {
    expected_response_time: number;
    expected_throughput: number;
    expected_availability: number;
  };
  risk_assessment: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    mitigation_strategies: string[];
  };
  implementation_timeline: {
    phase: string;
    duration_days: number;
    dependencies: string[];
  }[];
}

/**
 * Requirements analysis result
 */
interface RequirementsAnalysis {
  resource_tier: 'small' | 'medium' | 'large' | 'xlarge';
  workload_pattern: 'steady' | 'spiky' | 'seasonal' | 'unpredictable';
  criticality_level: 'low' | 'medium' | 'high' | 'critical';
  complexity_score: number;
}

/**
 * Performance history analysis
 */
interface PerformanceAnalysis {
  usage_patterns: {
    peak_hours: number[];
    peak_days: string[];
    seasonal_trends: string[];
  };
  resource_utilization: {
    avg_cpu: number;
    avg_memory: number;
    avg_network: number;
    avg_storage: number;
  };
  growth_trends: {
    traffic_growth_rate: number;
    resource_growth_rate: number;
    projected_scaling_needs: number;
  };
}

/**
 * Analyzes application requirements for deployment optimization
 */
class DeploymentRequirementsAnalyzer {
  /**
   * Analyzes application requirements and determines resource needs
   */
  async analyzeRequirements(requirements: ApplicationRequirements): Promise<RequirementsAnalysis> {
    try {
      // Calculate resource tier based on requirements
      const resourceScore = this.calculateResourceScore(requirements);
      const resource_tier = this.determineResourceTier(resourceScore);

      // Analyze workload pattern
      const workload_pattern = this.analyzeWorkloadPattern(requirements);

      // Determine criticality level
      const criticality_level = this.determineCriticalityLevel(requirements);

      // Calculate complexity score
      const complexity_score = this.calculateComplexityScore(requirements);

      return {
        resource_tier,
        workload_pattern,
        criticality_level,
        complexity_score
      };
    } catch (error) {
      logger.error('Requirements analysis failed:', error);
      throw createError('REQUIREMENTS_ANALYSIS_FAILED', 'Failed to analyze requirements');
    }
  }

  private calculateResourceScore(requirements: ApplicationRequirements): number {
    const { cpu_cores, memory_gb, storage_gb } = requirements.resources;
    const { requests, concurrent_users } = requirements.expectedTraffic;

    return (
      cpu_cores * 10 +
      memory_gb * 5 +
      storage_gb * 0.1 +
      Math.log10(requests + 1) * 20 +
      Math.log10(concurrent_users + 1) * 15
    );
  }

  private determineResourceTier(score: number): 'small' | 'medium' | 'large' | 'xlarge' {
    if (score < 50) return 'small';
    if (score < 150) return 'medium';
    if (score < 300) return 'large';
    return 'xlarge';
  }

  private analyzeWorkloadPattern(requirements: ApplicationRequirements): 'steady' | 'spiky' | 'seasonal' | 'unpredictable' {
    // Simplified pattern analysis based on application type
    const typePatterns = {
      web: 'spiky',
      api: 'steady',
      microservice: 'spiky',
      ml: 'unpredictable',
      batch: 'seasonal',
      streaming: 'steady'
    } as const;

    return typePatterns[requirements.type] || 'unpredictable';
  }

  private determineCriticalityLevel(requirements: ApplicationRequirements): 'low' | 'medium' | 'high' | 'critical' {
    const availability = requirements.performance.availability_percent;
    if (availability >= 99.99) return 'critical';
    if (availability >= 99.9) return 'high';
    if (availability >= 99.5) return 'medium';
    return 'low';
  }

  private calculateComplexityScore(requirements: ApplicationRequirements): number {
    let score = 0;
    score += requirements.compliance.length * 10;
    score += requirements.geographic_requirements.primary_regions.length * 5;
    score += requirements.resources.gpu_required ? 20 : 0;
    score += requirements.type === 'ml' ? 15 : 0;
    return Math.min(score, 100);
  }
}

/**
 * Collects and analyzes historical performance data
 */
class PerformanceHistoryCollector {
  /**
   * Collects and analyzes performance history for an application
   */
  async collectPerformanceHistory(applicationId: string, days: number = 30): Promise<PerformanceAnalysis> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const { data: metrics, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('application_id', applicationId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (!metrics || metrics.length === 0) {
        return this.getDefaultAnalysis();
      }

      return {
        usage_patterns: this.analyzeUsagePatterns(metrics),
        resource_utilization: this.analyzeResourceUtilization(metrics),
        growth_trends: this.analyzeGrowthTrends(metrics)
      };
    } catch (error) {
      logger.error('Performance history collection failed:', error);
      throw createError('PERFORMANCE_HISTORY_FAILED', 'Failed to collect performance history');
    }
  }

  private analyzeUsagePatterns(metrics: PerformanceMetrics[]) {
    const hourlyUsage = new Array(24).fill(0);
    const dailyUsage: { [key: string]: number } = {};

    metrics.forEach(metric => {
      const date = new Date(metric.timestamp);
      const hour = date.getHours();
      const day = date.toLocaleDateString('en', { weekday: 'long' });

      hourlyUsage[hour] += metric.concurrent_connections;
      dailyUsage[day] = (dailyUsage[day] || 0) + metric.concurrent_connections;
    });

    const peak_hours = hourlyUsage
      .map((usage, hour) => ({ hour, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 3)
      .map(item => item.hour);

    const peak_days = Object.entries(dailyUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([day]) => day);

    return {
      peak_hours,
      peak_days,
      seasonal_trends: ['weekday_higher'] // Simplified
    };
  }

  private analyzeResourceUtilization(metrics: PerformanceMetrics[]) {
    const total = metrics.length;
    const sum = metrics.reduce((acc, metric) => ({
      cpu: acc.cpu + metric.cpu_utilization,
      memory: acc.memory + metric.memory_utilization,
      network: acc.network + metric.network_io,
      storage: acc.storage + metric.storage_io
    }), { cpu: 0, memory: 0, network: 0, storage: 0 });

    return {
      avg_cpu: sum.cpu / total,
      avg_memory: sum.memory / total,
      avg_network: sum.network / total,
      avg_storage: sum.storage / total
    };
  }

  private analyzeGrowthTrends(metrics: PerformanceMetrics[]) {
    // Simplified growth trend analysis
    const firstWeek = metrics.slice(0, Math.floor(metrics.length / 4));
    const lastWeek = metrics.slice(-Math.floor(metrics.length / 4));

    const firstWeekAvg = firstWeek.reduce((sum, m) => sum + m.concurrent_connections, 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, m) => sum + m.concurrent_connections, 0) / lastWeek.length;

    const traffic_growth_rate = ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100;

    return {
      traffic_growth_rate,
      resource_growth_rate: traffic_growth_rate * 0.8, // Simplified correlation
      projected_scaling_needs: Math.max(1, Math.ceil(traffic_growth_rate / 20))
    };
  }

  private getDefaultAnalysis(): PerformanceAnalysis {
    return {
      usage_patterns: {
        peak_hours: [9, 14, 18],
        peak_days: ['Monday', 'Wednesday'],
        seasonal_trends: ['weekday_higher']
      },
      resource_utilization: {
        avg_cpu: 45,
        avg_memory: 60,
        avg_network: 30,
        avg_storage: 25
      },
      growth_trends: {
        traffic_growth_rate: 10,
        resource_growth_rate: 8,
        projected_scaling_needs: 1
      }
    };
  }
}

/**
 * Selects optimal instance types based on requirements
 */
class InstanceTypeSelector {
  /**
   * Selects the best instance type for given requirements
   */
  async selectOptimalInstanceType(
    requirements: RequirementsAnalysis,
    appRequirements: ApplicationRequirements,
    performance: PerformanceAnalysis
  ): Promise<string> {
    try {
      const { data: instanceTypes, error } = await supabase
        .from('instance_types')
        .select('*')
        .order('cost_per_hour', { ascending: true });

      if (error) throw error;

      const filtered = this.filterCompatibleInstances(instanceTypes, appRequirements);
      const scored = this.scoreInstances(filtered, requirements, appRequirements, performance);

      return scored.length > 0 ? scored[0].type : 't3.medium'; // Default fallback
    } catch (error) {
      logger.error('Instance type selection failed:', error);
      throw createError('INSTANCE_SELECTION_FAILED', 'Failed to select instance type');
    }
  }

  private filterCompatibleInstances(instances: InstanceType[], requirements: ApplicationRequirements): InstanceType[] {
    return instances.filter(instance => {
      const meetsCompute = instance.vcpus >= requirements.resources.cpu_cores &&
                          instance.memory_gb >= requirements.resources.memory_gb;
      
      const meetsGpu = !requirements.resources.gpu_required || !!instance.gpu_type;

      return meetsCompute && meetsGpu;
    });
  }

  private scoreInstances(
    instances: InstanceType[],
    requirements: RequirementsAnalysis,
    appRequirements: ApplicationRequirements,
    performance: PerformanceAnalysis
  ): InstanceType[] {
    return instances
      .map(instance => ({
        ...instance,
        score: this.calculateInstanceScore(instance, requirements, appRequirements, performance)
      }))
      .sort((a, b) => b.score - a.score);
  }

  private calculateInstanceScore(
    instance: InstanceType,
    requirements: RequirementsAnalysis,
    appRequirements: ApplicationRequirements,
    performance: PerformanceAnalysis
  ): number {
    let score = 100;

    // Performance score (higher is better)
    const cpuRatio = instance.vcpus / appRequirements.resources.cpu_cores;
    const memoryRatio = instance.memory_gb / appRequirements.resources.memory_gb;
    
    // Prefer instances that are not severely over/under-provisioned
    score += Math.max(0, 20 - Math.abs(cpuRatio - 1.5) * 10);
    score += Math.max(0, 20 - Math.abs(memoryRatio - 1.5) * 10);

    // Cost efficiency (lower cost is better)
    score -= instance.cost_per_hour * 2;

    // Network performance bonus for high-traffic apps
    if (appRequirements.expectedTraffic.requests > 10000) {
      score += instance.network_performance === 'high' ? 15 : 0;
    }

    // GPU bonus if required
    if (appRequirements.resources.gpu_required && instance.gpu_type) {
      score += 25;
    }

    return score;
  }
}

/**
 * Optimizes region selection for deployment
 */
class RegionOptimizer {
  /**
   * Selects optimal regions for deployment
   */
  async optimizeRegions(requirements: ApplicationRequirements): Promise<{ primary: string; secondary: string[] }> {
    try {
      const { data: regions, error } = await supabase
        .from('regions')
        .select('*');

      if (error) throw error;

      const filtered = this.filterEligibleRegions(regions, requirements);
      const scored = this.scoreRegions(filtered, requirements);

      const primary = scored[0]?.code || 'us-east-1';
      const secondary = scored.slice(1, 3).map(r => r.code);

      return { primary, secondary };
    } catch (error) {
      logger.error('Region optimization failed:', error);
      throw createError('REGION_OPTIMIZATION_FAILED', 'Failed to optimize regions');
    }
  }

  private filterEligibleRegions(regions: Region[], requirements: ApplicationRequirements): Region[] {
    return regions.filter(region => {
      // Check compliance requirements
      const hasCompliance = requirements.compliance.every(cert =>
        region.compliance_certifications.includes(cert)
      );

      // Check data residency
      const meetsResidency = requirements.geographic_requirements.data_residency.length === 0 ||
        requirements.geographic_requirements.data_residency.some(country =>
          region.location.country === country
        );

      return hasCompliance && meetsResidency;
    });
  }

  private scoreRegions(regions: Region[], requirements: ApplicationRequirements): Region[] {
    return regions
      .map(region => ({
        ...region,
        score: this.calculateRegionScore(region, requirements)
      }))
      .sort((a, b) => b.score - a.score);
  }

  private calculateRegionScore(region: Region, requirements: ApplicationRequirements): number {
    let score = 50;

    // Primary region preference
    if (requirements.geographic_requirements.primary_regions.includes(region.code)) {
      score += 30;
    }

    // Latency zone coverage
    const latencyMatch = requirements.geographic_requirements.latency_zones.filter(zone =>
      region.latency_zones.includes(zone)
    ).length;
    score += latencyMatch * 10;

    // Service availability
    const requiredServices = ['compute', 'storage', 'networking'];
    const availableServices = requiredServices.filter(service =>
      region.services_available.includes(service)
    ).length;
    score += (availableServices / requiredServices.length) * 20;

    return score;
  }
}

/**
 * Calculates scaling parameters for auto-scaling
 */
class ScalingParameterCalculator {
  /**
   * Calculates optimal scaling configuration
   */
  calculateScalingParameters(
    requirements: RequirementsAnalysis,
    appRequirements: ApplicationRequirements,
    performance: PerformanceAnalysis
  ): ScalingConfiguration {
    const baseInstances = this.calculateBaseInstances(requirements, appRequirements);
    const maxInstances = this.calculateMaxInstances(performance, baseInstances);

    return {
      min_instances: Math.max(1, baseInstances),
      max_instances: maxInstances,
      target_cpu_utilization: this.getTargetCpuUtilization(requirements.criticality_level),
      target_memory_utilization: this.getTargetMemoryUtilization(requirements.criticality_level),
      scale_up_threshold: 75,
      scale_down_threshold: 30,
      scale_up_cooldown: this.getScaleUpCooldown(requirements.workload_pattern),
      scale_down_cooldown: this.getScaleDownCooldown(requirements.workload_pattern),
      predictive_scaling: requirements.workload_pattern === 'seasonal'
    };
  }

  private calculateBaseInstances(requirements: RequirementsAnalysis, appRequirements: ApplicationRequirements): number {
    const availabilityMultiplier = appRequirements.performance.availability_percent >= 99.9 ? 2 : 1;
    
    switch (requirements.resource_tier) {
      case 'small': return 1 * availabilityMultiplier;
      case 'medium': return 2 * availabilityMultiplier;
      case 'large': return 3 * availabilityMultiplier;
      case 'xlarge': return 5 * availabilityMultiplier;
      default: return 1;
    }
  }

  private calculateMaxInstances(performance: PerformanceAnalysis, baseInstances: number): number {
    const growthMultiplier = Math.max(1, 1 + performance.growth_trends.traffic_growth_rate / 100);
    return Math.ceil(baseInstances * 4 * growthMultiplier);
  }

  private getTargetCpuUtilization(criticality: string): number {
    const targets = { low: 80, medium: 70, high: 60, critical: 50 };
    return targets[criticality as keyof typeof targets] || 70;
  }

  private getTargetMemoryUtilization(criticality: string): number {
    const targets = { low: 85, medium: 75, high: 65, critical: 55 };
    return targets[criticality as keyof typeof targets] || 75;
  }

  private getScaleUpCooldown(pattern: string): number {
    const cooldowns = { steady: 300, spiky: 120, seasonal: 600, unpredictable: 180 };
    return cooldowns[pattern as keyof typeof cooldowns] || 300;
  }

  private getScaleDownCooldown(pattern: string): number {
    const cooldowns = { steady: 600, spiky: 900, seasonal: 1200, unpredictable: 800 };
    return cooldowns[pattern as keyof typeof cooldowns] || 600;
  }
}

/**
 * Estimates deployment costs
 */
class CostEstimator {
  /**
   * Estimates deployment costs for the recommended configuration
   */
  async estimateCosts(
    instanceType: string,
    instanceCount: number,
    scaling: ScalingConfiguration,
    regions: { primary: string; secondary: string[] }
  ): Promise<CostEstimation> {