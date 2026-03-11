import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';

// Types
interface CodeChange {
  id: string;
  files: string[];
  additions: number;
  deletions: number;
  complexity_score: number;
  test_coverage: number;
  security_issues: number;
  dependencies_changed: boolean;
}

interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_throughput: number;
  active_connections: number;
  error_rate: number;
  response_time: number;
  timestamp: string;
}

interface DeploymentHistory {
  id: string;
  strategy: string;
  duration: number;
  success: boolean;
  rollback_time?: number;
  code_changes: CodeChange;
  system_state: SystemMetrics;
  failure_reason?: string;
  created_at: string;
}

interface RiskAssessment {
  overall_risk: number;
  code_risk: number;
  system_risk: number;
  timing_risk: number;
  confidence: number;
  risk_factors: string[];
}

interface DeploymentRecommendation {
  strategy: 'blue-green' | 'rolling' | 'canary' | 'immediate' | 'delayed';
  timing: 'immediate' | 'off-peak' | 'maintenance-window';
  preconditions: string[];
  monitoring_focus: string[];
  rollback_plan: string[];
  estimated_duration: number;
  success_probability: number;
}

interface DeploymentDecision {
  recommendation: DeploymentRecommendation;
  risk_assessment: RiskAssessment;
  predicted_outcomes: {
    failure_probability: number;
    performance_impact: number;
    recovery_time: number;
  };
  ml_insights: {
    similar_deployments: number;
    pattern_confidence: number;
    anomaly_score: number;
  };
}

// Core Engine Classes
class CodeAnalysisProcessor {
  async analyzeCodeChanges(changes: Partial<CodeChange>): Promise<CodeChange> {
    const complexity = this.calculateComplexity(changes.files || []);
    const securityScore = await this.assessSecurityRisk(changes);
    
    return {
      id: changes.id || crypto.randomUUID(),
      files: changes.files || [],
      additions: changes.additions || 0,
      deletions: changes.deletions || 0,
      complexity_score: complexity,
      test_coverage: changes.test_coverage || 0,
      security_issues: securityScore,
      dependencies_changed: changes.dependencies_changed || false
    };
  }

  private calculateComplexity(files: string[]): number {
    const highRiskPatterns = [
      /\/database\/migrations\//,
      /\/config\//,
      /\/security\//,
      /package\.json$/,
      /dockerfile$/i
    ];

    let complexity = files.length * 0.1;
    
    files.forEach(file => {
      if (highRiskPatterns.some(pattern => pattern.test(file))) {
        complexity += 0.3;
      }
    });

    return Math.min(complexity, 1.0);
  }

  private async assessSecurityRisk(changes: Partial<CodeChange>): Promise<number> {
    // Simulate security analysis
    const riskFactors = [
      changes.dependencies_changed ? 0.2 : 0,
      (changes.files || []).some(f => f.includes('auth')) ? 0.3 : 0,
      (changes.files || []).some(f => f.includes('database')) ? 0.2 : 0
    ];

    return riskFactors.reduce((sum, risk) => sum + risk, 0);
  }
}

class SystemLoadMonitor {
  async getCurrentMetrics(): Promise<SystemMetrics> {
    // Simulate real system metrics collection
    return {
      cpu_usage: Math.random() * 100,
      memory_usage: Math.random() * 100,
      disk_usage: Math.random() * 100,
      network_throughput: Math.random() * 1000,
      active_connections: Math.floor(Math.random() * 1000),
      error_rate: Math.random() * 5,
      response_time: Math.random() * 500,
      timestamp: new Date().toISOString()
    };
  }

  assessSystemLoad(metrics: SystemMetrics): number {
    const weights = {
      cpu: 0.3,
      memory: 0.3,
      disk: 0.2,
      error_rate: 0.2
    };

    const normalizedLoad = (
      (metrics.cpu_usage / 100) * weights.cpu +
      (metrics.memory_usage / 100) * weights.memory +
      (metrics.disk_usage / 100) * weights.disk +
      (metrics.error_rate / 10) * weights.error_rate
    );

    return Math.min(normalizedLoad, 1.0);
  }
}

class HistoricalPerformanceAnalyzer {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async analyzeHistoricalData(codeChanges: CodeChange): Promise<{
    similar_deployments: DeploymentHistory[];
    success_rate: number;
    avg_duration: number;
    common_failures: string[];
  }> {
    const { data: history } = await this.supabase
      .from('deployment_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!history?.length) {
      return {
        similar_deployments: [],
        success_rate: 0.8,
        avg_duration: 300,
        common_failures: []
      };
    }

    const similar = this.findSimilarDeployments(history, codeChanges);
    const successRate = similar.filter(d => d.success).length / similar.length;
    const avgDuration = similar.reduce((sum, d) => sum + d.duration, 0) / similar.length;
    
    const failures = similar
      .filter(d => !d.success && d.failure_reason)
      .map(d => d.failure_reason!);
    
    const commonFailures = this.getCommonFailures(failures);

    return {
      similar_deployments: similar,
      success_rate: successRate,
      avg_duration: avgDuration,
      common_failures: commonFailures
    };
  }

  private findSimilarDeployments(history: DeploymentHistory[], target: CodeChange): DeploymentHistory[] {
    return history.filter(deployment => {
      const similarity = this.calculateSimilarity(deployment.code_changes, target);
      return similarity > 0.7;
    });
  }

  private calculateSimilarity(a: CodeChange, b: CodeChange): number {
    const filesSimilarity = this.jacardSimilarity(a.files, b.files);
    const complexitySimilarity = 1 - Math.abs(a.complexity_score - b.complexity_score);
    const sizeSimilarity = 1 - Math.abs((a.additions + a.deletions) - (b.additions + b.deletions)) / 1000;

    return (filesSimilarity + complexitySimilarity + sizeSimilarity) / 3;
  }

  private jacardSimilarity(setA: string[], setB: string[]): number {
    const intersection = setA.filter(x => setB.includes(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private getCommonFailures(failures: string[]): string[] {
    const counts = failures.reduce((acc, failure) => {
      acc[failure] = (acc[failure] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([failure]) => failure);
  }
}

class PredictiveFailureDetector {
  private model: tf.LayersModel | null = null;

  async initializeModel(): Promise<void> {
    try {
      // Create a simple neural network for failure prediction
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [10], units: 16, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' })
        ]
      });

      this.model.compile({
        optimizer: 'adam',
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
    } catch (error) {
      console.error('Failed to initialize ML model:', error);
    }
  }

  async predictFailureProbability(
    codeChanges: CodeChange,
    systemMetrics: SystemMetrics,
    historicalContext: any
  ): Promise<number> {
    if (!this.model) {
      await this.initializeModel();
    }

    try {
      const features = this.extractFeatures(codeChanges, systemMetrics, historicalContext);
      const input = tf.tensor2d([features]);
      const prediction = this.model!.predict(input) as tf.Tensor;
      const probability = await prediction.data();
      
      input.dispose();
      prediction.dispose();
      
      return probability[0];
    } catch (error) {
      console.error('Prediction failed:', error);
      return 0.5; // Default moderate risk
    }
  }

  private extractFeatures(
    codeChanges: CodeChange,
    systemMetrics: SystemMetrics,
    historicalContext: any
  ): number[] {
    return [
      codeChanges.complexity_score,
      codeChanges.additions / 1000,
      codeChanges.deletions / 1000,
      codeChanges.test_coverage,
      codeChanges.security_issues,
      systemMetrics.cpu_usage / 100,
      systemMetrics.memory_usage / 100,
      systemMetrics.error_rate / 10,
      historicalContext.success_rate || 0.8,
      codeChanges.dependencies_changed ? 1 : 0
    ];
  }
}

class DeploymentStrategyOptimizer {
  optimizeStrategy(
    riskAssessment: RiskAssessment,
    systemLoad: number,
    historicalData: any
  ): DeploymentRecommendation {
    const strategy = this.selectOptimalStrategy(riskAssessment, systemLoad);
    const timing = this.determineOptimalTiming(systemLoad, riskAssessment);
    
    return {
      strategy,
      timing,
      preconditions: this.generatePreconditions(riskAssessment),
      monitoring_focus: this.getMonitoringFocus(riskAssessment),
      rollback_plan: this.generateRollbackPlan(strategy),
      estimated_duration: this.estimateDuration(strategy, riskAssessment),
      success_probability: 1 - riskAssessment.overall_risk
    };
  }

  private selectOptimalStrategy(
    risk: RiskAssessment,
    systemLoad: number
  ): DeploymentRecommendation['strategy'] {
    if (risk.overall_risk > 0.8 || systemLoad > 0.8) return 'delayed';
    if (risk.overall_risk > 0.6) return 'canary';
    if (risk.overall_risk > 0.4) return 'blue-green';
    if (risk.overall_risk > 0.2) return 'rolling';
    return 'immediate';
  }

  private determineOptimalTiming(
    systemLoad: number,
    risk: RiskAssessment
  ): DeploymentRecommendation['timing'] {
    if (systemLoad > 0.7 || risk.overall_risk > 0.7) return 'maintenance-window';
    if (systemLoad > 0.5 || risk.overall_risk > 0.5) return 'off-peak';
    return 'immediate';
  }

  private generatePreconditions(risk: RiskAssessment): string[] {
    const conditions: string[] = [];
    
    if (risk.code_risk > 0.5) conditions.push('Run comprehensive test suite');
    if (risk.system_risk > 0.5) conditions.push('Verify system health metrics');
    if (risk.overall_risk > 0.6) conditions.push('Notify on-call team');
    if (risk.overall_risk > 0.8) conditions.push('Require manual approval');
    
    return conditions;
  }

  private getMonitoringFocus(risk: RiskAssessment): string[] {
    const focus: string[] = ['Error rates', 'Response times'];
    
    if (risk.code_risk > 0.5) focus.push('Application logs');
    if (risk.system_risk > 0.5) focus.push('Resource utilization');
    if (risk.overall_risk > 0.6) focus.push('Database performance');
    
    return focus;
  }

  private generateRollbackPlan(strategy: string): string[] {
    const basePlan = ['Monitor key metrics', 'Prepare rollback triggers'];
    
    switch (strategy) {
      case 'blue-green':
        return [...basePlan, 'Switch traffic back to previous version'];
      case 'canary':
        return [...basePlan, 'Stop canary traffic', 'Scale down new version'];
      case 'rolling':
        return [...basePlan, 'Halt rolling update', 'Revert updated instances'];
      default:
        return [...basePlan, 'Execute automated rollback procedure'];
    }
  }

  private estimateDuration(strategy: string, risk: RiskAssessment): number {
    const baseDuration = {
      'immediate': 60,
      'rolling': 300,
      'blue-green': 180,
      'canary': 600,
      'delayed': 0
    };

    const duration = baseDuration[strategy as keyof typeof baseDuration] || 300;
    return Math.floor(duration * (1 + risk.overall_risk));
  }
}

class RiskAssessmentCalculator {
  calculateRisk(
    codeChanges: CodeChange,
    systemMetrics: SystemMetrics,
    failureProbability: number,
    historicalData: any
  ): RiskAssessment {
    const codeRisk = this.assessCodeRisk(codeChanges);
    const systemRisk = this.assessSystemRisk(systemMetrics);
    const timingRisk = this.assessTimingRisk();
    
    const overallRisk = this.calculateOverallRisk(
      codeRisk,
      systemRisk,
      timingRisk,
      failureProbability
    );

    return {
      overall_risk: overallRisk,
      code_risk: codeRisk,
      system_risk: systemRisk,
      timing_risk: timingRisk,
      confidence: historicalData.similar_deployments?.length > 5 ? 0.8 : 0.5,
      risk_factors: this.identifyRiskFactors(codeChanges, systemMetrics)
    };
  }

  private assessCodeRisk(changes: CodeChange): number {
    const factors = [
      changes.complexity_score * 0.3,
      (1 - changes.test_coverage) * 0.25,
      changes.security_issues * 0.2,
      changes.dependencies_changed ? 0.15 : 0,
      Math.min((changes.additions + changes.deletions) / 1000, 0.1)
    ];

    return Math.min(factors.reduce((sum, factor) => sum + factor, 0), 1.0);
  }

  private assessSystemRisk(metrics: SystemMetrics): number {
    const factors = [
      metrics.cpu_usage / 100 * 0.3,
      metrics.memory_usage / 100 * 0.3,
      metrics.error_rate / 10 * 0.4
    ];

    return Math.min(factors.reduce((sum, factor) => sum + factor, 0), 1.0);
  }

  private assessTimingRisk(): number {
    const hour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    
    // Higher risk during peak hours (9-17) and weekends
    if (isWeekend) return 0.3;
    if (hour >= 9 && hour <= 17) return 0.4;
    return 0.1;
  }

  private calculateOverallRisk(
    codeRisk: number,
    systemRisk: number,
    timingRisk: number,
    failureProbability: number
  ): number {
    const weights = { code: 0.4, system: 0.3, timing: 0.1, ml: 0.2 };
    
    return Math.min(
      codeRisk * weights.code +
      systemRisk * weights.system +
      timingRisk * weights.timing +
      failureProbability * weights.ml,
      1.0
    );
  }

  private identifyRiskFactors(changes: CodeChange, metrics: SystemMetrics): string[] {
    const factors: string[] = [];
    
    if (changes.complexity_score > 0.7) factors.push('High code complexity');
    if (changes.test_coverage < 0.8) factors.push('Low test coverage');
    if (changes.security_issues > 0.3) factors.push('Security concerns');
    if (changes.dependencies_changed) factors.push('Dependency changes');
    if (metrics.cpu_usage > 70) factors.push('High CPU usage');
    if (metrics.memory_usage > 70) factors.push('High memory usage');
    if (metrics.error_rate > 2) factors.push('Elevated error rates');
    
    return factors;
  }
}

class DeploymentDecisionEngine {
  private codeAnalyzer = new CodeAnalysisProcessor();
  private systemMonitor = new SystemLoadMonitor();
  private historicalAnalyzer = new HistoricalPerformanceAnalyzer();
  private failureDetector = new PredictiveFailureDetector();
  private strategyOptimizer = new DeploymentStrategyOptimizer();
  private riskCalculator = new RiskAssessmentCalculator();

  async makeDeploymentDecision(
    codeChanges: Partial<CodeChange>
  ): Promise<DeploymentDecision> {
    try {
      // Analyze code changes
      const analyzedChanges = await this.codeAnalyzer.analyzeCodeChanges(codeChanges);
      
      // Get current system metrics
      const systemMetrics = await this.systemMonitor.getCurrentMetrics();
      const systemLoad = this.systemMonitor.assessSystemLoad(systemMetrics);
      
      // Analyze historical performance
      const historicalData = await this.historicalAnalyzer.analyzeHistoricalData(analyzedChanges);
      
      // Predict failure probability
      const failureProbability = await this.failureDetector.predictFailureProbability(
        analyzedChanges,
        systemMetrics,
        historicalData
      );
      
      // Calculate risk assessment
      const riskAssessment = this.riskCalculator.calculateRisk(
        analyzedChanges,
        systemMetrics,
        failureProbability,
        historicalData
      );
      
      // Optimize deployment strategy
      const recommendation = this.strategyOptimizer.optimizeStrategy(
        riskAssessment,
        systemLoad,
        historicalData
      );
      
      return {
        recommendation,
        risk_assessment: riskAssessment,
        predicted_outcomes: {
          failure_probability: failureProbability,
          performance_impact: systemLoad * riskAssessment.system_risk,
          recovery_time: this.estimateRecoveryTime(riskAssessment, recommendation)
        },
        ml_insights: {
          similar_deployments: historicalData.similar_deployments.length,
          pattern_confidence: riskAssessment.confidence,
          anomaly_score: this.calculateAnomalyScore(analyzedChanges, historicalData)
        }
      };
    } catch (error) {
      console.error('Decision engine error:', error);
      throw error;
    }
  }

  private estimateRecoveryTime(
    risk: RiskAssessment,
    recommendation: DeploymentRecommendation
  ): number {
    const baseTime = {
      'immediate': 30,
      'rolling': 120,
      'blue-green': 60,
      'canary': 180,
      'delayed': 0
    };

    const base = baseTime[recommendation.strategy] || 120;
    return Math.floor(base * (1 + risk.overall_risk * 2));
  }

  private calculateAnomalyScore(
    changes: CodeChange,
    historicalData: any
  ): number {
    if (!historicalData.similar_deployments.length) return 0.5;
    
    const avgComplexity = historicalData.similar_deployments.reduce(
      (sum: number, d: DeploymentHistory) => sum + d.code_changes.complexity_score,
      0
    ) / historicalData.similar_deployments.length;
    
    return Math.abs(changes.complexity_score - avgComplexity);
  }
}

// API Route Handler
export async function POST(request: NextRequest) {
  try {
    const engine = new DeploymentDecisionEngine();
    const body = await request.json();
    
    const decision = await engine.makeDeploymentDecision(body.code_changes);
    
    return NextResponse.json({
      success: true,
      data: decision,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Deployment decision error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate deployment decision',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'deployment-decision-engine',
    status: 'healthy',
    version: '1.0.0',
    capabilities: [
      'code-analysis',
      'system-monitoring',
      'failure-prediction',
      'strategy-optimization',
      'risk-assessment'
    ],
    timestamp: new Date().toISOString()
  });
}