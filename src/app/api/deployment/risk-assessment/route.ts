```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';

// Validation schemas
const deploymentRiskRequestSchema = z.object({
  repository: z.string().min(1),
  branch: z.string().min(1),
  targetEnvironment: z.enum(['development', 'staging', 'production']),
  commitSha: z.string().min(1),
  baseSha: z.string().optional(),
  deploymentType: z.enum(['hotfix', 'feature', 'release', 'rollback']),
  metadata: z.object({
    author: z.string(),
    pullRequestId: z.number().optional(),
    buildId: z.string().optional(),
  }).optional(),
});

// Types
interface CodeMetrics {
  linesChanged: number;
  filesChanged: number;
  complexity: number;
  testCoverage: number;
  criticalFilesAffected: string[];
}

interface HistoricalPattern {
  similarDeployments: number;
  successRate: number;
  averageRollbackTime: number;
  commonFailureReasons: string[];
}

interface EnvironmentalHealth {
  systemLoad: number;
  dependencyHealth: number;
  maintenanceWindow: boolean;
  recentIncidents: number;
}

interface RiskScore {
  overall: number;
  code: number;
  historical: number;
  environmental: number;
  confidence: number;
}

interface MitigationRecommendation {
  type: 'pre-deployment' | 'during-deployment' | 'post-deployment';
  priority: 'high' | 'medium' | 'low';
  action: string;
  description: string;
  estimatedImpact: number;
}

interface RiskAssessmentResult {
  riskScore: RiskScore;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  codeMetrics: CodeMetrics;
  historicalPattern: HistoricalPattern;
  environmentalHealth: EnvironmentalHealth;
  mitigationRecommendations: MitigationRecommendation[];
  assessmentTimestamp: string;
}

class RiskAssessmentEngine {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  private octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  async assessDeploymentRisk(
    request: z.infer<typeof deploymentRiskRequestSchema>
  ): Promise<RiskAssessmentResult> {
    try {
      // Parallel analysis of different risk factors
      const [codeMetrics, historicalPattern, environmentalHealth] = await Promise.all([
        this.analyzeCode(request),
        this.analyzeHistoricalData(request),
        this.analyzeEnvironmentalFactors(request.targetEnvironment),
      ]);

      // Calculate risk scores
      const riskScore = this.calculateRiskScore(codeMetrics, historicalPattern, environmentalHealth);
      
      // Generate mitigation recommendations
      const mitigationRecommendations = this.generateMitigationRecommendations(
        riskScore,
        codeMetrics,
        historicalPattern,
        environmentalHealth
      );

      // Determine overall risk level
      const riskLevel = this.determineRiskLevel(riskScore.overall);

      // Store assessment for future reference
      await this.storeAssessment(request, riskScore, riskLevel);

      return {
        riskScore,
        riskLevel,
        codeMetrics,
        historicalPattern,
        environmentalHealth,
        mitigationRecommendations,
        assessmentTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Risk assessment failed:', error);
      throw new Error('Failed to assess deployment risk');
    }
  }

  private async analyzeCode(
    request: z.infer<typeof deploymentRiskRequestSchema>
  ): Promise<CodeMetrics> {
    try {
      const [owner, repo] = request.repository.split('/');
      
      // Get commit comparison
      const comparison = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base: request.baseSha || 'HEAD~1',
        head: request.commitSha,
      });

      const files = comparison.data.files || [];
      const linesChanged = files.reduce((sum, file) => sum + (file.changes || 0), 0);
      const filesChanged = files.length;

      // Analyze complexity and critical files
      const criticalFilesAffected = files
        .filter(file => this.isCriticalFile(file.filename))
        .map(file => file.filename);

      const complexity = this.calculateComplexity(files);
      const testCoverage = await this.getTestCoverage(request.repository, request.commitSha);

      return {
        linesChanged,
        filesChanged,
        complexity,
        testCoverage,
        criticalFilesAffected,
      };
    } catch (error) {
      console.error('Code analysis failed:', error);
      return {
        linesChanged: 0,
        filesChanged: 0,
        complexity: 1,
        testCoverage: 0,
        criticalFilesAffected: [],
      };
    }
  }

  private async analyzeHistoricalData(
    request: z.infer<typeof deploymentRiskRequestSchema>
  ): Promise<HistoricalPattern> {
    try {
      // Query historical deployments
      const { data: deployments } = await this.supabase
        .from('deployments')
        .select('*')
        .eq('repository', request.repository)
        .eq('target_environment', request.targetEnvironment)
        .order('created_at', { ascending: false })
        .limit(50);

      // Query deployment failures
      const { data: failures } = await this.supabase
        .from('deployment_failures')
        .select('*')
        .eq('repository', request.repository)
        .eq('target_environment', request.targetEnvironment)
        .order('created_at', { ascending: false })
        .limit(20);

      const similarDeployments = deployments?.length || 0;
      const failureCount = failures?.length || 0;
      const successRate = similarDeployments > 0 
        ? ((similarDeployments - failureCount) / similarDeployments) * 100 
        : 100;

      const averageRollbackTime = failures?.reduce((sum, failure) => 
        sum + (failure.rollback_time_minutes || 0), 0
      ) / Math.max(failureCount, 1);

      const commonFailureReasons = this.extractCommonFailureReasons(failures || []);

      return {
        similarDeployments,
        successRate,
        averageRollbackTime,
        commonFailureReasons,
      };
    } catch (error) {
      console.error('Historical data analysis failed:', error);
      return {
        similarDeployments: 0,
        successRate: 100,
        averageRollbackTime: 0,
        commonFailureReasons: [],
      };
    }
  }

  private async analyzeEnvironmentalFactors(environment: string): Promise<EnvironmentalHealth> {
    try {
      // Query environment health metrics
      const { data: healthData } = await this.supabase
        .from('environment_health')
        .select('*')
        .eq('environment', environment)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // Query recent incidents
      const { data: incidents } = await this.supabase
        .from('incidents')
        .select('*')
        .eq('environment', environment)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const systemLoad = healthData?.system_load || 50;
      const dependencyHealth = healthData?.dependency_health || 100;
      const maintenanceWindow = this.isMaintenanceWindow();
      const recentIncidents = incidents?.length || 0;

      return {
        systemLoad,
        dependencyHealth,
        maintenanceWindow,
        recentIncidents,
      };
    } catch (error) {
      console.error('Environmental analysis failed:', error);
      return {
        systemLoad: 50,
        dependencyHealth: 100,
        maintenanceWindow: false,
        recentIncidents: 0,
      };
    }
  }

  private calculateRiskScore(
    codeMetrics: CodeMetrics,
    historicalPattern: HistoricalPattern,
    environmentalHealth: EnvironmentalHealth
  ): RiskScore {
    // Code risk factors (0-100)
    const codeRisk = Math.min(100, 
      (codeMetrics.linesChanged * 0.1) +
      (codeMetrics.filesChanged * 2) +
      (codeMetrics.complexity * 20) +
      (codeMetrics.criticalFilesAffected.length * 15) +
      Math.max(0, (80 - codeMetrics.testCoverage))
    );

    // Historical risk factors (0-100)
    const historicalRisk = Math.min(100,
      Math.max(0, (100 - historicalPattern.successRate)) +
      (historicalPattern.averageRollbackTime * 0.5) +
      (historicalPattern.commonFailureReasons.length * 5)
    );

    // Environmental risk factors (0-100)
    const environmentalRisk = Math.min(100,
      (environmentalHealth.systemLoad * 0.8) +
      Math.max(0, (100 - environmentalHealth.dependencyHealth)) +
      (environmentalHealth.recentIncidents * 10) +
      (environmentalHealth.maintenanceWindow ? -10 : 0)
    );

    // Weighted overall score
    const overall = (codeRisk * 0.4) + (historicalRisk * 0.35) + (environmentalRisk * 0.25);

    // Confidence based on data availability
    const confidence = Math.min(100,
      (historicalPattern.similarDeployments > 10 ? 30 : historicalPattern.similarDeployments * 3) +
      (codeMetrics.testCoverage > 0 ? 25 : 0) +
      (environmentalHealth.dependencyHealth > 0 ? 25 : 0) +
      20
    );

    return {
      overall: Math.round(overall),
      code: Math.round(codeRisk),
      historical: Math.round(historicalRisk),
      environmental: Math.round(environmentalRisk),
      confidence: Math.round(confidence),
    };
  }

  private generateMitigationRecommendations(
    riskScore: RiskScore,
    codeMetrics: CodeMetrics,
    historicalPattern: HistoricalPattern,
    environmentalHealth: EnvironmentalHealth
  ): MitigationRecommendation[] {
    const recommendations: MitigationRecommendation[] = [];

    // Code-based recommendations
    if (codeMetrics.criticalFilesAffected.length > 0) {
      recommendations.push({
        type: 'pre-deployment',
        priority: 'high',
        action: 'additional_review',
        description: `Critical files affected: ${codeMetrics.criticalFilesAffected.join(', ')}. Require senior developer review.`,
        estimatedImpact: 15,
      });
    }

    if (codeMetrics.testCoverage < 70) {
      recommendations.push({
        type: 'pre-deployment',
        priority: 'medium',
        action: 'increase_testing',
        description: `Test coverage is ${codeMetrics.testCoverage}%. Consider adding more tests before deployment.`,
        estimatedImpact: 10,
      });
    }

    // Historical pattern recommendations
    if (historicalPattern.successRate < 90) {
      recommendations.push({
        type: 'during-deployment',
        priority: 'high',
        action: 'gradual_rollout',
        description: `Success rate is ${historicalPattern.successRate.toFixed(1)}%. Use canary deployment strategy.`,
        estimatedImpact: 20,
      });
    }

    // Environmental recommendations
    if (environmentalHealth.systemLoad > 80) {
      recommendations.push({
        type: 'pre-deployment',
        priority: 'medium',
        action: 'wait_for_load_reduction',
        description: `System load is ${environmentalHealth.systemLoad}%. Consider deploying during off-peak hours.`,
        estimatedImpact: 12,
      });
    }

    if (environmentalHealth.recentIncidents > 0) {
      recommendations.push({
        type: 'post-deployment',
        priority: 'high',
        action: 'enhanced_monitoring',
        description: `${environmentalHealth.recentIncidents} recent incidents detected. Enable enhanced monitoring for 24 hours.`,
        estimatedImpact: 8,
      });
    }

    // Overall risk recommendations
    if (riskScore.overall > 70) {
      recommendations.push({
        type: 'pre-deployment',
        priority: 'high',
        action: 'stakeholder_approval',
        description: 'High risk deployment detected. Require additional stakeholder approval.',
        estimatedImpact: 25,
      });
    }

    return recommendations.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
  }

  private determineRiskLevel(overallScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (overallScore >= 80) return 'critical';
    if (overallScore >= 60) return 'high';
    if (overallScore >= 30) return 'medium';
    return 'low';
  }

  private async storeAssessment(
    request: z.infer<typeof deploymentRiskRequestSchema>,
    riskScore: RiskScore,
    riskLevel: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('risk_assessments')
        .insert({
          repository: request.repository,
          branch: request.branch,
          commit_sha: request.commitSha,
          target_environment: request.targetEnvironment,
          deployment_type: request.deploymentType,
          risk_score: riskScore.overall,
          risk_level: riskLevel,
          code_risk: riskScore.code,
          historical_risk: riskScore.historical,
          environmental_risk: riskScore.environmental,
          confidence: riskScore.confidence,
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to store assessment:', error);
      // Non-fatal error, continue execution
    }
  }

  private isCriticalFile(filename: string): boolean {
    const criticalPatterns = [
      /package\.json$/,
      /docker/i,
      /config/i,
      /migration/i,
      /schema/i,
      /auth/i,
      /security/i,
    ];
    return criticalPatterns.some(pattern => pattern.test(filename));
  }

  private calculateComplexity(files: any[]): number {
    // Simplified complexity calculation based on file types and changes
    let complexity = 0;
    files.forEach(file => {
      if (file.filename.endsWith('.ts') || file.filename.endsWith('.js')) {
        complexity += (file.changes || 0) * 0.01;
      }
      if (file.filename.includes('test')) {
        complexity -= (file.changes || 0) * 0.005; // Tests reduce complexity risk
      }
    });
    return Math.max(0, Math.min(5, complexity));
  }

  private async getTestCoverage(repository: string, commitSha: string): Promise<number> {
    try {
      // Query test coverage from stored metrics
      const { data } = await this.supabase
        .from('code_metrics')
        .select('test_coverage')
        .eq('repository', repository)
        .eq('commit_sha', commitSha)
        .single();
      
      return data?.test_coverage || 0;
    } catch {
      return 0;
    }
  }

  private extractCommonFailureReasons(failures: any[]): string[] {
    const reasons = failures
      .map(f => f.failure_reason)
      .filter(Boolean)
      .reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(reasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([reason]) => reason);
  }

  private isMaintenanceWindow(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();
    // Assume maintenance window is 2-4 AM UTC
    return hour >= 2 && hour <= 4;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = deploymentRiskRequestSchema.parse(body);

    const engine = new RiskAssessmentEngine();
    const result = await engine.assessDeploymentRisk(validatedData);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Deployment risk assessment error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repository = searchParams.get('repository');
    const environment = searchParams.get('environment');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!repository) {
      return NextResponse.json(
        { success: false, error: 'Repository parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('risk_assessments')
      .select('*')
      .eq('repository', repository)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (environment) {
      query = query.eq('target_environment', environment);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Failed to fetch risk assessments:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch risk assessments',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```