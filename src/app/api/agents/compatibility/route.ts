import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Input validation schema
const compatibilityRequestSchema = z.object({
  agentIds: z.array(z.string().uuid()).min(1).max(10),
  targetPlatforms: z.array(z.string()).min(1).max(5),
  includePerformanceMetrics: z.boolean().optional().default(true),
  includeSecurityAnalysis: z.boolean().optional().default(false)
});

// Response types
interface CompatibilityScore {
  agentId: string;
  platform: string;
  overallScore: number;
  runtimeCompatibility: number;
  dependencyCompatibility: number;
  performanceScore: number;
  securityScore?: number;
  warnings: string[];
  recommendations: string[];
}

interface CompatibilityMatrix {
  matrix: CompatibilityScore[];
  summary: {
    totalAgents: number;
    totalPlatforms: number;
    averageCompatibility: number;
    highestScore: number;
    lowestScore: number;
  };
  conflicts: Array<{
    type: 'dependency' | 'runtime' | 'performance' | 'security';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedAgents: string[];
    affectedPlatforms: string[];
  }>;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Compatibility scoring engine
class CompatibilityAnalyzer {
  private static readonly WEIGHT_RUNTIME = 0.3;
  private static readonly WEIGHT_DEPENDENCIES = 0.3;
  private static readonly WEIGHT_PERFORMANCE = 0.25;
  private static readonly WEIGHT_SECURITY = 0.15;

  static calculateRuntimeCompatibility(
    agentRuntime: any,
    platformSpecs: any
  ): { score: number; warnings: string[] } {
    const warnings: string[] = [];
    let score = 100;

    // Node.js version compatibility
    if (agentRuntime.nodeVersion && platformSpecs.nodeVersions) {
      const isSupported = platformSpecs.nodeVersions.some((v: string) =>
        this.isVersionCompatible(agentRuntime.nodeVersion, v)
      );
      if (!isSupported) {
        score -= 40;
        warnings.push(`Node.js version ${agentRuntime.nodeVersion} not supported`);
      }
    }

    // Memory requirements
    if (agentRuntime.memoryRequirement > platformSpecs.maxMemory) {
      score -= 30;
      warnings.push(`Memory requirement exceeds platform limit`);
    }

    // CPU architecture
    if (agentRuntime.architecture && !platformSpecs.supportedArchitectures?.includes(agentRuntime.architecture)) {
      score -= 20;
      warnings.push(`Architecture ${agentRuntime.architecture} not supported`);
    }

    return { score: Math.max(0, score), warnings };
  }

  static calculateDependencyCompatibility(
    agentDependencies: any[],
    platformConstraints: any
  ): { score: number; warnings: string[] } {
    const warnings: string[] = [];
    let score = 100;
    let conflictCount = 0;

    for (const dep of agentDependencies) {
      // Check for blocked dependencies
      if (platformConstraints.blockedPackages?.includes(dep.name)) {
        score -= 25;
        conflictCount++;
        warnings.push(`Dependency ${dep.name} is blocked on this platform`);
        continue;
      }

      // Version conflicts
      const platformDep = platformConstraints.dependencies?.find((d: any) => d.name === dep.name);
      if (platformDep && !this.isVersionCompatible(dep.version, platformDep.version)) {
        score -= 15;
        conflictCount++;
        warnings.push(`Version conflict: ${dep.name}@${dep.version} vs ${platformDep.version}`);
      }

      // Native dependencies check
      if (dep.hasNativeDependencies && !platformConstraints.supportsNativeModules) {
        score -= 20;
        warnings.push(`Native dependency ${dep.name} not supported`);
      }
    }

    return { score: Math.max(0, score), warnings };
  }

  static calculatePerformanceScore(
    agentMetrics: any,
    platformBenchmarks: any
  ): { score: number; warnings: string[] } {
    const warnings: string[] = [];
    let score = 100;

    // CPU performance requirements
    if (agentMetrics.cpuIntensive && platformBenchmarks.cpuScore < 70) {
      score -= 25;
      warnings.push('Platform may not meet CPU performance requirements');
    }

    // I/O performance
    if (agentMetrics.ioIntensive && platformBenchmarks.ioScore < 60) {
      score -= 20;
      warnings.push('Platform I/O performance may be insufficient');
    }

    // Network latency sensitivity
    if (agentMetrics.networkSensitive && platformBenchmarks.networkLatency > 100) {
      score -= 15;
      warnings.push('High network latency may affect performance');
    }

    return { score: Math.max(0, score), warnings };
  }

  static calculateOverallScore(
    runtimeScore: number,
    dependencyScore: number,
    performanceScore: number,
    securityScore?: number
  ): number {
    const baseScore = 
      runtimeScore * this.WEIGHT_RUNTIME +
      dependencyScore * this.WEIGHT_DEPENDENCIES +
      performanceScore * this.WEIGHT_PERFORMANCE;

    if (securityScore !== undefined) {
      return baseScore + (securityScore * this.WEIGHT_SECURITY);
    }

    return baseScore;
  }

  private static isVersionCompatible(required: string, available: string): boolean {
    // Simplified version compatibility check
    const requiredParts = required.replace(/[^\d.]/g, '').split('.').map(Number);
    const availableParts = available.replace(/[^\d.]/g, '').split('.').map(Number);
    
    // Major version must match, minor version can be higher
    return requiredParts[0] === availableParts[0] && 
           (availableParts[1] || 0) >= (requiredParts[1] || 0);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validatedInput = compatibilityRequestSchema.parse(body);
    const { agentIds, targetPlatforms, includePerformanceMetrics, includeSecurityAnalysis } = validatedInput;

    // Fetch agent data and requirements
    const { data: agentsData, error: agentsError } = await supabase
      .from('agents')
      .select(`
        id,
        name,
        runtime_requirements,
        dependencies,
        performance_metrics,
        security_requirements
      `)
      .in('id', agentIds);

    if (agentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch agent data' },
        { status: 500 }
      );
    }

    // Fetch platform specifications
    const { data: platformsData, error: platformsError } = await supabase
      .from('platforms')
      .select(`
        name,
        specifications,
        constraints,
        benchmarks,
        security_features
      `)
      .in('name', targetPlatforms);

    if (platformsError) {
      return NextResponse.json(
        { error: 'Failed to fetch platform data' },
        { status: 500 }
      );
    }

    // Generate compatibility matrix
    const compatibilityMatrix: CompatibilityScore[] = [];
    const conflicts: CompatibilityMatrix['conflicts'] = [];

    for (const agent of agentsData || []) {
      for (const platform of platformsData || []) {
        // Calculate individual compatibility scores
        const runtimeResult = CompatibilityAnalyzer.calculateRuntimeCompatibility(
          agent.runtime_requirements,
          platform.specifications
        );

        const dependencyResult = CompatibilityAnalyzer.calculateDependencyCompatibility(
          agent.dependencies || [],
          platform.constraints
        );

        let performanceResult = { score: 100, warnings: [] as string[] };
        if (includePerformanceMetrics) {
          performanceResult = CompatibilityAnalyzer.calculatePerformanceScore(
            agent.performance_metrics,
            platform.benchmarks
          );
        }

        let securityScore: number | undefined;
        if (includeSecurityAnalysis) {
          // Simplified security score calculation
          securityScore = this.calculateSecurityScore(
            agent.security_requirements,
            platform.security_features
          );
        }

        // Calculate overall compatibility score
        const overallScore = CompatibilityAnalyzer.calculateOverallScore(
          runtimeResult.score,
          dependencyResult.score,
          performanceResult.score,
          securityScore
        );

        // Collect all warnings and generate recommendations
        const allWarnings = [
          ...runtimeResult.warnings,
          ...dependencyResult.warnings,
          ...performanceResult.warnings
        ];

        const recommendations = this.generateRecommendations(
          overallScore,
          runtimeResult,
          dependencyResult,
          performanceResult
        );

        compatibilityMatrix.push({
          agentId: agent.id,
          platform: platform.name,
          overallScore: Math.round(overallScore),
          runtimeCompatibility: Math.round(runtimeResult.score),
          dependencyCompatibility: Math.round(dependencyResult.score),
          performanceScore: Math.round(performanceResult.score),
          securityScore: securityScore ? Math.round(securityScore) : undefined,
          warnings: allWarnings,
          recommendations
        });

        // Detect critical conflicts
        if (overallScore < 50) {
          conflicts.push({
            type: 'runtime',
            severity: 'high',
            description: `Agent ${agent.name} has low compatibility with ${platform.name}`,
            affectedAgents: [agent.id],
            affectedPlatforms: [platform.name]
          });
        }
      }
    }

    // Calculate summary statistics
    const scores = compatibilityMatrix.map(m => m.overallScore);
    const summary = {
      totalAgents: agentIds.length,
      totalPlatforms: targetPlatforms.length,
      averageCompatibility: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores)
    };

    // Cache results (simplified - would use Redis in production)
    const cacheKey = `compatibility_${agentIds.join(',')}_${targetPlatforms.join(',')}`;
    await supabase
      .from('compatibility_cache')
      .upsert({
        cache_key: cacheKey,
        results: { matrix: compatibilityMatrix, summary, conflicts },
        expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
      })
      .select()
      .single();

    const response: CompatibilityMatrix = {
      matrix: compatibilityMatrix,
      summary,
      conflicts
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Compatibility analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper methods
function calculateSecurityScore(agentSecurityReqs: any, platformSecurityFeatures: any): number {
  let score = 100;
  
  if (agentSecurityReqs?.requiresEncryption && !platformSecurityFeatures?.supportsEncryption) {
    score -= 30;
  }
  
  if (agentSecurityReqs?.requiresSandbox && !platformSecurityFeatures?.supportsSandbox) {
    score -= 25;
  }
  
  if (agentSecurityReqs?.requiresNetworkIsolation && !platformSecurityFeatures?.supportsNetworkIsolation) {
    score -= 20;
  }
  
  return Math.max(0, score);
}

function generateRecommendations(
  overallScore: number,
  runtimeResult: any,
  dependencyResult: any,
  performanceResult: any
): string[] {
  const recommendations: string[] = [];
  
  if (overallScore < 70) {
    recommendations.push('Consider alternative platforms for better compatibility');
  }
  
  if (runtimeResult.score < 80) {
    recommendations.push('Update runtime requirements or use platform-specific configurations');
  }
  
  if (dependencyResult.score < 80) {
    recommendations.push('Review and optimize dependency versions for platform compatibility');
  }
  
  if (performanceResult.score < 80) {
    recommendations.push('Consider performance optimizations or higher-tier platform instances');
  }
  
  return recommendations;
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to analyze compatibility.' },
    { status: 405 }
  );
}