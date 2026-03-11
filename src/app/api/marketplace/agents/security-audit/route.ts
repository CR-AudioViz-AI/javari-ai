import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ratelimit } from '@/lib/redis';
import { withAuth } from '@/lib/auth-middleware';
import crypto from 'crypto';

// Validation schemas
const SecurityAuditRequestSchema = z.object({
  agentId: z.string().uuid(),
  auditType: z.enum(['full', 'quick', 'dependency', 'behavioral', 'compliance']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  includeStaticAnalysis: z.boolean().default(true),
  includeDependencyCheck: z.boolean().default(true),
  includeBehavioralAnalysis: z.boolean().default(true),
  includeComplianceCheck: z.boolean().default(false),
  scheduledAudit: z.boolean().default(false)
});

const SecurityQuerySchema = z.object({
  agentId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  auditType: z.enum(['full', 'quick', 'dependency', 'behavioral', 'compliance']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Security analysis engines
class CodeAnalysisEngine {
  private static readonly SECURITY_PATTERNS = [
    { pattern: /eval\s*\(/, severity: 'critical', type: 'code-injection' },
    { pattern: /document\.write\s*\(/, severity: 'high', type: 'xss-risk' },
    { pattern: /innerHTML\s*=/, severity: 'medium', type: 'dom-manipulation' },
    { pattern: /localStorage\.setItem/, severity: 'low', type: 'data-storage' },
    { pattern: /fetch\s*\(.*http:\/\//, severity: 'medium', type: 'insecure-request' },
    { pattern: /process\.env/, severity: 'low', type: 'environment-access' }
  ];

  static async analyzeCode(codeContent: string): Promise<any> {
    const issues: any[] = [];
    const lines = codeContent.split('\n');

    lines.forEach((line, index) => {
      this.SECURITY_PATTERNS.forEach(({ pattern, severity, type }) => {
        if (pattern.test(line)) {
          issues.push({
            type,
            severity,
            line: index + 1,
            content: line.trim(),
            description: this.getVulnerabilityDescription(type),
            recommendation: this.getRecommendation(type)
          });
        }
      });
    });

    return {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      issues,
      riskScore: this.calculateRiskScore(issues)
    };
  }

  private static getVulnerabilityDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'code-injection': 'Potential code injection vulnerability through eval usage',
      'xss-risk': 'Cross-site scripting risk through document.write',
      'dom-manipulation': 'Unsafe DOM manipulation that could lead to XSS',
      'data-storage': 'Sensitive data storage in localStorage',
      'insecure-request': 'Insecure HTTP request detected',
      'environment-access': 'Environment variable access detected'
    };
    return descriptions[type] || 'Unknown security issue';
  }

  private static getRecommendation(type: string): string {
    const recommendations: Record<string, string> = {
      'code-injection': 'Replace eval with safer alternatives like JSON.parse or Function constructor',
      'xss-risk': 'Use textContent or createElement instead of document.write',
      'dom-manipulation': 'Sanitize content before setting innerHTML or use textContent',
      'data-storage': 'Consider encrypting sensitive data or using secure storage',
      'insecure-request': 'Use HTTPS instead of HTTP for all requests',
      'environment-access': 'Ensure no sensitive environment variables are exposed'
    };
    return recommendations[type] || 'Review and remediate security issue';
  }

  private static calculateRiskScore(issues: any[]): number {
    const weights = { critical: 10, high: 7, medium: 4, low: 1 };
    return issues.reduce((score, issue) => score + (weights[issue.severity as keyof typeof weights] || 0), 0);
  }
}

class DependencyScanner {
  static async scanDependencies(packageJson: any): Promise<any> {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const vulnerabilities: any[] = [];
    let totalDeps = 0;
    let outdatedDeps = 0;

    // Mock CVE database check
    for (const [name, version] of Object.entries(dependencies)) {
      totalDeps++;
      
      // Simulate vulnerability check
      const vulnCheck = await this.checkVulnerability(name, version as string);
      if (vulnCheck.hasVulnerability) {
        vulnerabilities.push({
          package: name,
          version: version as string,
          severity: vulnCheck.severity,
          cve: vulnCheck.cve,
          description: vulnCheck.description,
          fixedVersion: vulnCheck.fixedVersion
        });
      }

      if (vulnCheck.isOutdated) {
        outdatedDeps++;
      }
    }

    return {
      totalDependencies: totalDeps,
      vulnerableDependencies: vulnerabilities.length,
      outdatedDependencies: outdatedDeps,
      vulnerabilities,
      riskLevel: this.calculateDependencyRisk(vulnerabilities),
      lastScan: new Date().toISOString()
    };
  }

  private static async checkVulnerability(name: string, version: string): Promise<any> {
    // Mock vulnerability database check
    const knownVulns: Record<string, any> = {
      'lodash': {
        hasVulnerability: version.startsWith('4.17.') && version < '4.17.21',
        severity: 'high',
        cve: 'CVE-2021-23337',
        description: 'Prototype pollution vulnerability',
        fixedVersion: '4.17.21',
        isOutdated: version < '4.17.21'
      },
      'axios': {
        hasVulnerability: version.startsWith('0.') && version < '0.28.0',
        severity: 'medium',
        cve: 'CVE-2022-1214',
        description: 'Regular expression denial of service',
        fixedVersion: '0.28.0',
        isOutdated: version < '1.6.0'
      }
    };

    return knownVulns[name] || {
      hasVulnerability: false,
      isOutdated: Math.random() < 0.3
    };
  }

  private static calculateDependencyRisk(vulnerabilities: any[]): string {
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0 || mediumCount > 5) return 'medium';
    return 'low';
  }
}

class BehavioralDetector {
  static async analyzeBehavior(agentId: string, supabase: any): Promise<any> {
    // Fetch behavioral data
    const { data: behaviors } = await supabase
      .from('agent_behaviors')
      .select('*')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(1000);

    const patterns = this.detectPatterns(behaviors || []);
    const anomalies = this.detectAnomalies(behaviors || []);
    
    return {
      patternCount: patterns.length,
      anomalyCount: anomalies.length,
      patterns,
      anomalies,
      riskScore: this.calculateBehavioralRisk(patterns, anomalies),
      analysisTimestamp: new Date().toISOString()
    };
  }

  private static detectPatterns(behaviors: any[]): any[] {
    const patterns: any[] = [];
    
    // Detect unusual API call patterns
    const apiCalls = behaviors.filter(b => b.type === 'api_call');
    if (apiCalls.length > 1000) {
      patterns.push({
        type: 'high_api_usage',
        severity: 'medium',
        description: 'Unusually high API call frequency detected',
        occurrences: apiCalls.length
      });
    }

    // Detect data access patterns
    const dataAccess = behaviors.filter(b => b.type === 'data_access');
    const sensitiveAccess = dataAccess.filter(b => b.data_type === 'sensitive');
    if (sensitiveAccess.length > 50) {
      patterns.push({
        type: 'excessive_sensitive_access',
        severity: 'high',
        description: 'Excessive access to sensitive data detected',
        occurrences: sensitiveAccess.length
      });
    }

    return patterns;
  }

  private static detectAnomalies(behaviors: any[]): any[] {
    const anomalies: any[] = [];
    
    // Time-based anomalies
    const hourlyActivity = this.groupByHour(behaviors);
    Object.entries(hourlyActivity).forEach(([hour, count]) => {
      if ((count as number) > 100 && (parseInt(hour) < 6 || parseInt(hour) > 22)) {
        anomalies.push({
          type: 'unusual_time_activity',
          severity: 'medium',
          description: `High activity during off-hours (${hour}:00)`,
          count: count as number
        });
      }
    });

    return anomalies;
  }

  private static groupByHour(behaviors: any[]): Record<string, number> {
    return behaviors.reduce((acc, behavior) => {
      const hour = new Date(behavior.timestamp).getHours().toString();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private static calculateBehavioralRisk(patterns: any[], anomalies: any[]): number {
    const patternRisk = patterns.reduce((sum, p) => {
      const weights = { low: 1, medium: 3, high: 7, critical: 10 };
      return sum + (weights[p.severity as keyof typeof weights] || 0);
    }, 0);

    const anomalyRisk = anomalies.length * 2;
    return Math.min(patternRisk + anomalyRisk, 100);
  }
}

class ComplianceChecker {
  static async checkCompliance(agentData: any): Promise<any> {
    const checks = [
      this.checkGDPRCompliance(agentData),
      this.checkSOX404Compliance(agentData),
      this.checkHIPAACompliance(agentData),
      this.checkOWASPCompliance(agentData)
    ];

    const results = await Promise.all(checks);
    const overallScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;

    return {
      overallScore: Math.round(overallScore),
      complianceLevel: this.getComplianceLevel(overallScore),
      frameworks: results,
      recommendations: this.generateRecommendations(results),
      lastChecked: new Date().toISOString()
    };
  }

  private static async checkGDPRCompliance(agentData: any): Promise<any> {
    let score = 100;
    const issues: string[] = [];

    if (!agentData.privacy_policy) {
      score -= 20;
      issues.push('Missing privacy policy');
    }

    if (!agentData.data_retention_policy) {
      score -= 15;
      issues.push('No data retention policy specified');
    }

    if (!agentData.user_consent_mechanism) {
      score -= 25;
      issues.push('No user consent mechanism');
    }

    return {
      framework: 'GDPR',
      score: Math.max(score, 0),
      status: score >= 80 ? 'compliant' : score >= 60 ? 'partially_compliant' : 'non_compliant',
      issues
    };
  }

  private static async checkSOX404Compliance(agentData: any): Promise<any> {
    let score = 100;
    const issues: string[] = [];

    if (!agentData.audit_logging) {
      score -= 30;
      issues.push('No audit logging implemented');
    }

    if (!agentData.access_controls) {
      score -= 25;
      issues.push('Insufficient access controls');
    }

    if (!agentData.change_management) {
      score -= 20;
      issues.push('No change management process');
    }

    return {
      framework: 'SOX 404',
      score: Math.max(score, 0),
      status: score >= 80 ? 'compliant' : score >= 60 ? 'partially_compliant' : 'non_compliant',
      issues
    };
  }

  private static async checkHIPAACompliance(agentData: any): Promise<any> {
    let score = 100;
    const issues: string[] = [];

    if (agentData.handles_phi && !agentData.encryption_at_rest) {
      score -= 40;
      issues.push('PHI data not encrypted at rest');
    }

    if (agentData.handles_phi && !agentData.encryption_in_transit) {
      score -= 35;
      issues.push('PHI data not encrypted in transit');
    }

    if (agentData.handles_phi && !agentData.baa_agreement) {
      score -= 25;
      issues.push('No Business Associate Agreement');
    }

    return {
      framework: 'HIPAA',
      score: Math.max(score, 0),
      status: score >= 80 ? 'compliant' : score >= 60 ? 'partially_compliant' : 'non_compliant',
      issues
    };
  }

  private static async checkOWASPCompliance(agentData: any): Promise<any> {
    let score = 100;
    const issues: string[] = [];

    if (!agentData.input_validation) {
      score -= 20;
      issues.push('No input validation');
    }

    if (!agentData.output_encoding) {
      score -= 15;
      issues.push('No output encoding');
    }

    if (!agentData.authentication_mechanism) {
      score -= 25;
      issues.push('No proper authentication');
    }

    if (!agentData.authorization_controls) {
      score -= 20;
      issues.push('No authorization controls');
    }

    return {
      framework: 'OWASP',
      score: Math.max(score, 0),
      status: score >= 80 ? 'compliant' : score >= 60 ? 'partially_compliant' : 'non_compliant',
      issues
    };
  }

  private static getComplianceLevel(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'fair';
    if (score >= 60) return 'poor';
    return 'critical';
  }

  private static generateRecommendations(results: any[]): string[] {
    const recommendations: string[] = [];
    
    results.forEach(result => {
      result.issues.forEach((issue: string) => {
        recommendations.push(`${result.framework}: ${issue}`);
      });
    });

    return recommendations;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', limit, remaining, reset },
        { status: 429 }
      );
    }

    // Authentication
    const authResult = await withAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validate request
    const body = await request.json();
    const validatedData = SecurityAuditRequestSchema.parse(body);

    // Check if agent exists and user has permission
    const { data: agent, error: agentError } = await supabase
      .from('marketplace_agents')
      .select('*, owner_id, code_content, package_json')
      .eq('id', validatedData.agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.owner_id !== authResult.user.id && !authResult.user.isAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Create audit record
    const auditId = crypto.randomUUID();
    const { error: auditError } = await supabase
      .from('security_audits')
      .insert({
        id: auditId,
        agent_id: validatedData.agentId,
        audit_type: validatedData.auditType,
        status: 'running',
        priority: validatedData.priority,
        initiated_by: authResult.user.id,
        scheduled_audit: validatedData.scheduledAudit,
        created_at: new Date().toISOString()
      });

    if (auditError) {
      return NextResponse.json({ error: 'Failed to create audit record' }, { status: 500 });
    }

    // Start audit process
    const auditPromise = performSecurityAudit(
      supabase,
      auditId,
      agent,
      validatedData
    );

    // Don't await the audit if it's not a quick audit
    if (validatedData.auditType !== 'quick') {
      // Run in background
      auditPromise.catch(error => {
        console.error('Audit failed:', error);
        // Update audit status to failed
        supabase
          .from('security_audits')
          .update({ 
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', auditId)
          .then(() => {});
      });

      return NextResponse.json({
        success: true,
        auditId,
        status: 'started',
        message: 'Security audit initiated',
        estimatedCompletion: new Date(Date.now() + (validatedData.auditType === 'full' ? 600000 : 180000)).toISOString()
      });
    } else {
      // Wait for quick audit to complete
      const result = await auditPromise;
      return NextResponse.json({
        success: true,
        auditId,
        status: 'completed',
        result
      });
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Security audit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = request.ip ?? 'anonymous';
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Authentication
    const authResult = await withAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = SecurityQuerySchema.parse(queryParams);

    // Build query
    let query = supabase
      .from('security_audits')
      .select(`
        *,
        marketplace_agents!inner(id, name, owner_id),
        vulnerability_reports(*)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (validatedQuery.agentId) {
      query = query.eq('agent_id', validatedQuery.agentId);
    }

    if (validatedQuery.status) {
      query = query.eq('status', validatedQuery.status);
    }

    if (validatedQuery.auditType) {
      query = query.eq('audit_type', validatedQuery.auditType);
    }

    if (validatedQuery.startDate) {
      query = query.gte('created_at', validatedQuery.startDate);
    }

    if (validatedQuery.endDate) {
      query = query.lte('created_at', validatedQuery.endDate);
    }

    // Check permissions - only show user's agents unless admin
    if (!authResult.user.isAdmin) {
      query = query.eq('marketplace_agents.owner_id', authResult.user.id);
    }

    // Apply pagination
    const from = (validatedQuery.page - 1) * validatedQuery.limit;
    const to = from + validatedQuery.limit - 1;
    query = query.range(from, to);

    const { data: audits, error