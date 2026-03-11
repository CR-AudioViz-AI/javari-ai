import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

/**
 * Policy rule definition interface
 */
export interface PolicyRule {
  id: string;
  name: string;
  category: 'content' | 'privacy' | 'safety' | 'regulatory' | 'platform';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  patterns: string[];
  description: string;
  regulatoryBasis?: string;
  lastUpdated: Date;
  version: string;
}

/**
 * Compliance violation details
 */
export interface ComplianceViolation {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  matchedContent: string;
  confidence: number;
  location: {
    startIndex: number;
    endIndex: number;
    context: string;
  };
  suggestedRemediation: string[];
  regulatoryImplications?: string;
}

/**
 * External compliance API response
 */
export interface ExternalComplianceResult {
  provider: 'moderatrix' | 'aws-comprehend' | 'azure-content-safety';
  verdict: 'compliant' | 'violation' | 'review_required';
  confidence: number;
  categories: string[];
  details: Record<string, any>;
  processingTime: number;
}

/**
 * Comprehensive compliance report
 */
export interface ComplianceReport {
  id: string;
  agentOutputId: string;
  agentId: string;
  userId: string;
  timestamp: Date;
  overallStatus: 'compliant' | 'violations_detected' | 'review_required' | 'blocked';
  riskScore: number;
  violations: ComplianceViolation[];
  externalResults: ExternalComplianceResult[];
  metadata: {
    contentType: string;
    contentLength: number;
    processingDuration: number;
    validationMethods: string[];
  };
  auditTrail: {
    validatedBy: string;
    validatedAt: Date;
    reviewedBy?: string;
    reviewedAt?: Date;
    status: string;
  };
  remediationRequired: boolean;
  blockingViolations: boolean;
}

/**
 * Compliance metrics and analytics
 */
export interface ComplianceMetrics {
  totalValidations: number;
  violationRate: number;
  averageRiskScore: number;
  categoryBreakdown: Record<string, number>;
  severityDistribution: Record<string, number>;
  trendsOverTime: Array<{
    date: string;
    violations: number;
    riskScore: number;
  }>;
  topViolatedRules: Array<{
    ruleId: string;
    ruleName: string;
    count: number;
  }>;
}

/**
 * Agent output validation input
 */
const AgentOutputSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  userId: z.string(),
  content: z.string(),
  contentType: z.enum(['text', 'html', 'markdown', 'json']),
  metadata: z.record(z.any()).optional(),
  timestamp: z.date().optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

/**
 * Validation configuration
 */
export interface ValidationConfig {
  enableExternalAPIs: boolean;
  externalProviders: string[];
  cacheTTL: number;
  riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  autoBlock: boolean;
  notifyOnViolations: boolean;
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
}

/**
 * External compliance API wrapper
 */
class ExternalComplianceAPI {
  private moderatrixClient: AxiosInstance;
  private awsClient: AxiosInstance;
  private azureClient: AxiosInstance;

  constructor(
    private config: {
      moderatrix?: { apiKey: string; baseURL: string };
      aws?: { accessKey: string; secretKey: string; region: string };
      azure?: { apiKey: string; endpoint: string };
    }
  ) {
    this.moderatrixClient = axios.create({
      baseURL: this.config.moderatrix?.baseURL,
      headers: {
        'Authorization': `Bearer ${this.config.moderatrix?.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.awsClient = axios.create({
      timeout: 30000,
    });

    this.azureClient = axios.create({
      baseURL: this.config.azure?.endpoint,
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.azure?.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Validate content using Moderatrix API
   */
  async validateWithModeratrix(content: string): Promise<ExternalComplianceResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.moderatrixClient.post('/moderate', {
        text: content,
        categories: ['toxicity', 'hate_speech', 'harassment', 'sexual_content', 'violence'],
        threshold: 0.7,
      });

      const processingTime = Date.now() - startTime;
      const result = response.data;

      return {
        provider: 'moderatrix',
        verdict: result.safe ? 'compliant' : 'violation',
        confidence: result.confidence || 0.8,
        categories: result.flagged_categories || [],
        details: result,
        processingTime,
      };
    } catch (error) {
      console.error('Moderatrix validation failed:', error);
      throw new Error(`Moderatrix API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate content using AWS Comprehend
   */
  async validateWithAWSComprehend(content: string): Promise<ExternalComplianceResult> {
    const startTime = Date.now();
    
    try {
      // This would integrate with AWS SDK in a real implementation
      // For now, simulating the response structure
      const mockResponse = {
        ModerationLabels: [],
        ResultMetadata: { confidence: 0.85 },
      };

      const processingTime = Date.now() - startTime;
      
      return {
        provider: 'aws-comprehend',
        verdict: mockResponse.ModerationLabels.length > 0 ? 'violation' : 'compliant',
        confidence: mockResponse.ResultMetadata.confidence,
        categories: mockResponse.ModerationLabels,
        details: mockResponse,
        processingTime,
      };
    } catch (error) {
      console.error('AWS Comprehend validation failed:', error);
      throw new Error(`AWS Comprehend API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate content using Azure Content Safety
   */
  async validateWithAzure(content: string): Promise<ExternalComplianceResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.azureClient.post('/contentsafety/text:analyze', {
        text: content,
        categories: ['Hate', 'SelfHarm', 'Sexual', 'Violence'],
        haltOnBlocklistHit: false,
        outputType: 'FourSeverityLevels',
      });

      const processingTime = Date.now() - startTime;
      const result = response.data;

      const hasViolations = result.categoriesAnalysis?.some((cat: any) => cat.severity > 2);

      return {
        provider: 'azure-content-safety',
        verdict: hasViolations ? 'violation' : 'compliant',
        confidence: 0.9,
        categories: result.categoriesAnalysis?.map((cat: any) => cat.category) || [],
        details: result,
        processingTime,
      };
    } catch (error) {
      console.error('Azure Content Safety validation failed:', error);
      throw new Error(`Azure Content Safety API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Policy update handler for dynamic rule management
 */
class PolicyUpdateHandler {
  constructor(
    private redis: Redis,
    private supabase: ReturnType<typeof createClient>
  ) {}

  /**
   * Load policy rules from database and cache
   */
  async loadPolicyRules(): Promise<PolicyRule[]> {
    try {
      // Try to get from cache first
      const cachedRules = await this.redis.get('policy:rules');
      if (cachedRules) {
        return JSON.parse(cachedRules);
      }

      // Fetch from database
      const { data: rules, error } = await this.supabase
        .from('policy_rules')
        .select('*')
        .eq('enabled', true)
        .order('severity', { ascending: false });

      if (error) throw error;

      const policyRules: PolicyRule[] = rules?.map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        enabled: rule.enabled,
        patterns: rule.patterns || [],
        description: rule.description,
        regulatoryBasis: rule.regulatory_basis,
        lastUpdated: new Date(rule.updated_at),
        version: rule.version,
      })) || [];

      // Cache for 1 hour
      await this.redis.setex('policy:rules', 3600, JSON.stringify(policyRules));

      return policyRules;
    } catch (error) {
      console.error('Failed to load policy rules:', error);
      return [];
    }
  }

  /**
   * Update policy rule cache
   */
  async updateRuleCache(rules: PolicyRule[]): Promise<void> {
    await this.redis.setex('policy:rules', 3600, JSON.stringify(rules));
  }

  /**
   * Handle real-time policy updates
   */
  async handlePolicyUpdate(ruleId: string): Promise<void> {
    try {
      const { data: rule, error } = await this.supabase
        .from('policy_rules')
        .select('*')
        .eq('id', ruleId)
        .single();

      if (error) throw error;

      // Update cache
      const cachedRules = await this.redis.get('policy:rules');
      if (cachedRules) {
        const rules: PolicyRule[] = JSON.parse(cachedRules);
        const updatedRules = rules.map((r) =>
          r.id === ruleId ? { ...r, ...rule } : r
        );
        await this.updateRuleCache(updatedRules);
      }

      // Notify other services about the update
      await this.redis.publish('policy:updates', JSON.stringify({ ruleId, action: 'update' }));
    } catch (error) {
      console.error('Failed to handle policy update:', error);
    }
  }
}

/**
 * Violation reporter with audit trail
 */
class ViolationReporter {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private redis: Redis
  ) {}

  /**
   * Generate comprehensive compliance report
   */
  async generateReport(
    agentOutput: AgentOutput,
    violations: ComplianceViolation[],
    externalResults: ExternalComplianceResult[],
    processingDuration: number
  ): Promise<ComplianceReport> {
    const reportId = `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const riskScore = this.calculateRiskScore(violations, externalResults);
    const blockingViolations = violations.some((v) => v.severity === 'critical');
    
    let overallStatus: ComplianceReport['overallStatus'] = 'compliant';
    if (blockingViolations) {
      overallStatus = 'blocked';
    } else if (violations.length > 0) {
      overallStatus = 'violations_detected';
    } else if (externalResults.some((r) => r.verdict === 'review_required')) {
      overallStatus = 'review_required';
    }

    const report: ComplianceReport = {
      id: reportId,
      agentOutputId: agentOutput.id,
      agentId: agentOutput.agentId,
      userId: agentOutput.userId,
      timestamp: new Date(),
      overallStatus,
      riskScore,
      violations,
      externalResults,
      metadata: {
        contentType: agentOutput.contentType,
        contentLength: agentOutput.content.length,
        processingDuration,
        validationMethods: [
          'policy_rules',
          ...externalResults.map((r) => r.provider),
        ],
      },
      auditTrail: {
        validatedBy: 'agent-compliance-validation-service',
        validatedAt: new Date(),
        status: overallStatus,
      },
      remediationRequired: violations.length > 0,
      blockingViolations,
    };

    // Store report in database
    await this.storeReport(report);

    return report;
  }

  /**
   * Calculate risk score based on violations and external results
   */
  private calculateRiskScore(
    violations: ComplianceViolation[],
    externalResults: ExternalComplianceResult[]
  ): number {
    let score = 0;

    // Score from violations
    violations.forEach((violation) => {
      const severityWeights = { low: 1, medium: 2.5, high: 5, critical: 10 };
      score += severityWeights[violation.severity] * violation.confidence;
    });

    // Score from external APIs
    externalResults.forEach((result) => {
      if (result.verdict === 'violation') {
        score += 3 * result.confidence;
      } else if (result.verdict === 'review_required') {
        score += 1.5 * result.confidence;
      }
    });

    // Normalize to 0-100 scale
    return Math.min(100, Math.round(score * 10));
  }

  /**
   * Store report in database
   */
  private async storeReport(report: ComplianceReport): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('compliance_reports')
        .insert({
          id: report.id,
          agent_output_id: report.agentOutputId,
          agent_id: report.agentId,
          user_id: report.userId,
          overall_status: report.overallStatus,
          risk_score: report.riskScore,
          violations: report.violations,
          external_results: report.externalResults,
          metadata: report.metadata,
          audit_trail: report.auditTrail,
          remediation_required: report.remediationRequired,
          blocking_violations: report.blockingViolations,
          created_at: report.timestamp.toISOString(),
        });

      if (error) throw error;

      // Store individual violations for detailed tracking
      if (report.violations.length > 0) {
        const violationRecords = report.violations.map((violation) => ({
          compliance_report_id: report.id,
          rule_id: violation.ruleId,
          rule_name: violation.ruleName,
          category: violation.category,
          severity: violation.severity,
          description: violation.description,
          matched_content: violation.matchedContent,
          confidence: violation.confidence,
          location: violation.location,
          suggested_remediation: violation.suggestedRemediation,
          regulatory_implications: violation.regulatoryImplications,
        }));

        const { error: violationsError } = await this.supabase
          .from('policy_violations')
          .insert(violationRecords);

        if (violationsError) {
          console.error('Failed to store violations:', violationsError);
        }
      }
    } catch (error) {
      console.error('Failed to store compliance report:', error);
      throw new Error('Failed to store compliance report');
    }
  }

  /**
   * Send violation notifications
   */
  async sendViolationNotifications(report: ComplianceReport): Promise<void> {
    try {
      if (report.blockingViolations) {
        // Send critical violation webhook
        await this.redis.publish('violations:critical', JSON.stringify({
          reportId: report.id,
          agentId: report.agentId,
          userId: report.userId,
          riskScore: report.riskScore,
          violations: report.violations.filter((v) => v.severity === 'critical'),
        }));
      }

      if (report.violations.length > 0) {
        // Send general violation notification
        await this.redis.publish('violations:detected', JSON.stringify({
          reportId: report.id,
          agentId: report.agentId,
          violationCount: report.violations.length,
          riskScore: report.riskScore,
        }));
      }
    } catch (error) {
      console.error('Failed to send violation notifications:', error);
    }
  }
}

/**
 * Compliance metrics collector and analyzer
 */
class ComplianceMetricsCollector {
  constructor(
    private supabase: ReturnType<typeof createClient>,
    private redis: Redis
  ) {}

  /**
   * Collect comprehensive compliance metrics
   */
  async collectMetrics(timeRange?: { start: Date; end: Date }): Promise<ComplianceMetrics> {
    try {
      const endDate = timeRange?.end || new Date();
      const startDate = timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Get cached metrics if available
      const cacheKey = `metrics:compliance:${startDate.getTime()}:${endDate.getTime()}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch reports from database
      const { data: reports, error } = await this.supabase
        .from('compliance_reports')
        .select(`
          *,
          policy_violations (*)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const metrics = this.analyzeReports(reports || []);

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(metrics));

      return metrics;
    } catch (error) {
      console.error('Failed to collect compliance metrics:', error);
      throw new Error('Failed to collect compliance metrics');
    }
  }

  /**
   * Analyze reports to generate metrics
   */
  private analyzeReports(reports: any[]): ComplianceMetrics {
    const totalValidations = reports.length;
    const reportsWithViolations = reports.filter((r) => r.violations?.length > 0);
    const violationRate = totalValidations > 0 ? reportsWithViolations.length / totalValidations : 0;
    const averageRiskScore = totalValidations > 0 
      ? reports.reduce((sum, r) => sum + r.risk_score, 0) / totalValidations 
      : 0;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    const severityDistribution: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const ruleViolationCounts: Record<string, { name: string; count: number }> = {};

    reports.forEach((report) => {
      report.violations?.forEach((violation: any) => {
        // Category breakdown
        const category = violation.category;
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

        // Severity distribution
        const severity = violation.severity;
        severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;

        // Rule violation counts
        const ruleId = violation.rule_id;
        if (!ruleViolationCounts[ruleId]) {
          ruleViolationCounts[ruleId] = { name: violation.rule_name, count: 0 };
        }
        ruleViolationCounts[ruleId].count++;
      });
    });

    // Top violated rules
    const topViolatedRules = Object.entries(ruleViolationCounts)
      .map(([ruleId, data]) => ({
        ruleId,
        ruleName: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Trends over time (daily aggregation)
    const trendsOverTime = this.calculateTrends(reports);

    return {
      totalValidations,
      violationRate: Math.round(violationRate * 10000) / 100, // Percentage with 2 decimal places
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      categoryBreakdown,
      severityDistribution,
      trendsOverTime,
      topViolatedRules,
    };
  }

  /**
   * Calculate daily trends
   */
  private calculateTrends(reports: any[]): ComplianceMetrics['trendsOverTime'] {
    const dailyData: Record<string, { violations: number; riskScores: number[]; count: number }> = {};

    reports.forEach((report) => {
      const date = new Date(report.created_at).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = { violations: 0, riskScores: [], count: 0 };
      }

      dailyData[date].count++;
      dailyData[date].riskScores.push(report.risk_score);
      
      if (report.violations?.length > 0) {
        dailyData[date].violations++;
      }
    });

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        violations: data.violations,
        riskScore: Math.round((data.riskScores.reduce((sum, score) => sum + score, 0) / data.riskScores.length) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * Main compliance validator service
 */
export class AgentComplianceValidationService {
  private policyUpdate