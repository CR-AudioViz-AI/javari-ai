/**
 * Automated Compliance Assessment Framework
 * Evaluates security posture against SOC 2, ISO 27001, and GDPR standards
 * with gap analysis and remediation planning capabilities
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * Compliance standard types
 */
export enum ComplianceStandard {
  SOC2 = 'SOC2',
  ISO27001 = 'ISO27001',
  GDPR = 'GDPR'
}

/**
 * Control implementation status
 */
export enum ControlStatus {
  IMPLEMENTED = 'IMPLEMENTED',
  PARTIALLY_IMPLEMENTED = 'PARTIALLY_IMPLEMENTED',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  NOT_APPLICABLE = 'NOT_APPLICABLE'
}

/**
 * Risk severity levels
 */
export enum RiskLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Evidence types
 */
export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  SCREENSHOT = 'SCREENSHOT',
  LOG_FILE = 'LOG_FILE',
  CONFIGURATION = 'CONFIGURATION',
  CERTIFICATE = 'CERTIFICATE'
}

/**
 * Remediation task status
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED'
}

/**
 * Schema definitions
 */
const ControlSchema = z.object({
  id: z.string(),
  standard: z.nativeEnum(ComplianceStandard),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  requirements: z.array(z.string()),
  evidenceRequirements: z.array(z.string()),
  riskLevel: z.nativeEnum(RiskLevel),
  frequency: z.enum(['CONTINUOUS', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'])
});

const EvidenceSchema = z.object({
  id: z.string(),
  controlId: z.string(),
  type: z.nativeEnum(EvidenceType),
  title: z.string(),
  description: z.string(),
  filePath: z.string().optional(),
  content: z.string().optional(),
  collectedAt: z.date(),
  expiresAt: z.date().optional(),
  isValid: z.boolean(),
  validatedBy: z.string().optional(),
  validatedAt: z.date().optional()
});

const AssessmentResultSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  controlId: z.string(),
  status: z.nativeEnum(ControlStatus),
  score: z.number().min(0).max(100),
  findings: z.array(z.string()),
  evidence: z.array(z.string()),
  lastAssessed: z.date(),
  assessedBy: z.string(),
  notes: z.string().optional()
});

const GapAnalysisSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  standard: z.nativeEnum(ComplianceStandard),
  overallScore: z.number().min(0).max(100),
  implementedCount: z.number(),
  partiallyImplementedCount: z.number(),
  notImplementedCount: z.number(),
  notApplicableCount: z.number(),
  criticalGaps: z.array(z.string()),
  highRiskGaps: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  estimatedEffort: z.number(),
  targetCompletionDate: z.date().optional()
});

const RemediationTaskSchema = z.object({
  id: z.string(),
  planId: z.string(),
  controlId: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.nativeEnum(RiskLevel),
  status: z.nativeEnum(TaskStatus),
  assignedTo: z.string().optional(),
  estimatedHours: z.number(),
  dueDate: z.date(),
  completedAt: z.date().optional(),
  dependencies: z.array(z.string()),
  resources: z.array(z.string())
});

export type Control = z.infer<typeof ControlSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;
export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;
export type RemediationTask = z.infer<typeof RemediationTaskSchema>;

/**
 * Assessment configuration
 */
export interface AssessmentConfig {
  id: string;
  name: string;
  standards: ComplianceStandard[];
  scope: string[];
  scheduledDate: Date;
  assessor: string;
  automatedChecks: boolean;
  includeEvidence: boolean;
  notifyOnCompletion: boolean;
}

/**
 * Compliance dashboard metrics
 */
export interface ComplianceMetrics {
  overallScore: number;
  standardScores: Record<ComplianceStandard, number>;
  controlsByStatus: Record<ControlStatus, number>;
  riskDistribution: Record<RiskLevel, number>;
  trendsOverTime: Array<{
    date: Date;
    score: number;
    standard: ComplianceStandard;
  }>;
  upcomingDeadlines: Array<{
    taskId: string;
    title: string;
    dueDate: Date;
    priority: RiskLevel;
  }>;
}

/**
 * Standards registry that maintains compliance control definitions
 */
export class StandardsRegistry {
  private supabase: SupabaseClient;
  private controlsCache = new Map<string, Control[]>();
  private lastCacheUpdate = new Map<ComplianceStandard, Date>();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get controls for a specific compliance standard
   */
  async getControls(standard: ComplianceStandard, forceRefresh = false): Promise<Control[]> {
    const cacheKey = standard;
    const lastUpdate = this.lastCacheUpdate.get(standard);
    const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

    if (!forceRefresh && this.controlsCache.has(cacheKey) && lastUpdate && 
        Date.now() - lastUpdate.getTime() < cacheExpiry) {
      return this.controlsCache.get(cacheKey)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('compliance_standards')
        .select('controls')
        .eq('standard', standard)
        .eq('active', true)
        .single();

      if (error) throw error;

      const controls = data.controls.map((control: any) => ControlSchema.parse(control));
      this.controlsCache.set(cacheKey, controls);
      this.lastCacheUpdate.set(standard, new Date());

      return controls;
    } catch (error) {
      throw new Error(`Failed to fetch controls for ${standard}: ${error}`);
    }
  }

  /**
   * Update control definition
   */
  async updateControl(standard: ComplianceStandard, control: Control): Promise<void> {
    try {
      const controls = await this.getControls(standard, true);
      const updatedControls = controls.map(c => c.id === control.id ? control : c);

      const { error } = await this.supabase
        .from('compliance_standards')
        .update({ 
          controls: updatedControls,
          updated_at: new Date().toISOString()
        })
        .eq('standard', standard);

      if (error) throw error;

      // Invalidate cache
      this.controlsCache.delete(standard);
      this.lastCacheUpdate.delete(standard);
    } catch (error) {
      throw new Error(`Failed to update control: ${error}`);
    }
  }

  /**
   * Get control by ID across all standards
   */
  async getControlById(controlId: string): Promise<Control | null> {
    for (const standard of Object.values(ComplianceStandard)) {
      const controls = await this.getControls(standard);
      const control = controls.find(c => c.id === controlId);
      if (control) return control;
    }
    return null;
  }
}

/**
 * Evidence collector for gathering compliance artifacts
 */
export class EvidenceCollector {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Collect evidence for a control
   */
  async collectEvidence(controlId: string, evidence: Omit<Evidence, 'id'>): Promise<string> {
    try {
      const validatedEvidence = EvidenceSchema.omit({ id: true }).parse(evidence);
      
      const { data, error } = await this.supabase
        .from('compliance_evidence')
        .insert({
          ...validatedEvidence,
          control_id: controlId,
          collected_at: new Date().toISOString(),
          expires_at: validatedEvidence.expiresAt?.toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      return data.id;
    } catch (error) {
      throw new Error(`Failed to collect evidence: ${error}`);
    }
  }

  /**
   * Get evidence for a control
   */
  async getEvidence(controlId: string): Promise<Evidence[]> {
    try {
      const { data, error } = await this.supabase
        .from('compliance_evidence')
        .select('*')
        .eq('control_id', controlId)
        .order('collected_at', { ascending: false });

      if (error) throw error;

      return data.map(item => EvidenceSchema.parse({
        id: item.id,
        controlId: item.control_id,
        type: item.type,
        title: item.title,
        description: item.description,
        filePath: item.file_path,
        content: item.content,
        collectedAt: new Date(item.collected_at),
        expiresAt: item.expires_at ? new Date(item.expires_at) : undefined,
        isValid: item.is_valid,
        validatedBy: item.validated_by,
        validatedAt: item.validated_at ? new Date(item.validated_at) : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to get evidence: ${error}`);
    }
  }

  /**
   * Validate evidence
   */
  async validateEvidence(evidenceId: string, isValid: boolean, validatedBy: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('compliance_evidence')
        .update({
          is_valid: isValid,
          validated_by: validatedBy,
          validated_at: new Date().toISOString()
        })
        .eq('id', evidenceId);

      if (error) throw error;
    } catch (error) {
      throw new Error(`Failed to validate evidence: ${error}`);
    }
  }

  /**
   * Get expired evidence
   */
  async getExpiredEvidence(): Promise<Evidence[]> {
    try {
      const { data, error } = await this.supabase
        .from('compliance_evidence')
        .select('*')
        .lt('expires_at', new Date().toISOString())
        .eq('is_valid', true);

      if (error) throw error;

      return data.map(item => EvidenceSchema.parse({
        id: item.id,
        controlId: item.control_id,
        type: item.type,
        title: item.title,
        description: item.description,
        filePath: item.file_path,
        content: item.content,
        collectedAt: new Date(item.collected_at),
        expiresAt: item.expires_at ? new Date(item.expires_at) : undefined,
        isValid: item.is_valid,
        validatedBy: item.validated_by,
        validatedAt: item.validated_at ? new Date(item.validated_at) : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to get expired evidence: ${error}`);
    }
  }
}

/**
 * Risk scorer for compliance controls
 */
export class RiskScorer {
  /**
   * Calculate risk score for a control based on implementation status and inherent risk
   */
  calculateControlRisk(control: Control, status: ControlStatus, evidence: Evidence[]): number {
    let baseRisk = this.getRiskLevelScore(control.riskLevel);
    let implementationMultiplier = this.getImplementationMultiplier(status);
    let evidenceQualityScore = this.calculateEvidenceQuality(evidence);

    // Adjust risk based on implementation status
    let adjustedRisk = baseRisk * implementationMultiplier;

    // Reduce risk based on evidence quality
    adjustedRisk = adjustedRisk * (1 - (evidenceQualityScore * 0.2));

    return Math.max(0, Math.min(100, adjustedRisk));
  }

  /**
   * Calculate overall compliance score
   */
  calculateComplianceScore(results: AssessmentResult[]): number {
    if (results.length === 0) return 0;

    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return Math.round(totalScore / results.length);
  }

  /**
   * Calculate gap analysis metrics
   */
  calculateGapMetrics(results: AssessmentResult[]): {
    implemented: number;
    partiallyImplemented: number;
    notImplemented: number;
    notApplicable: number;
  } {
    const counts = {
      implemented: 0,
      partiallyImplemented: 0,
      notImplemented: 0,
      notApplicable: 0
    };

    results.forEach(result => {
      switch (result.status) {
        case ControlStatus.IMPLEMENTED:
          counts.implemented++;
          break;
        case ControlStatus.PARTIALLY_IMPLEMENTED:
          counts.partiallyImplemented++;
          break;
        case ControlStatus.NOT_IMPLEMENTED:
          counts.notImplemented++;
          break;
        case ControlStatus.NOT_APPLICABLE:
          counts.notApplicable++;
          break;
      }
    });

    return counts;
  }

  private getRiskLevelScore(riskLevel: RiskLevel): number {
    const scores = {
      [RiskLevel.CRITICAL]: 100,
      [RiskLevel.HIGH]: 75,
      [RiskLevel.MEDIUM]: 50,
      [RiskLevel.LOW]: 25
    };
    return scores[riskLevel];
  }

  private getImplementationMultiplier(status: ControlStatus): number {
    const multipliers = {
      [ControlStatus.IMPLEMENTED]: 0.1,
      [ControlStatus.PARTIALLY_IMPLEMENTED]: 0.5,
      [ControlStatus.NOT_IMPLEMENTED]: 1.0,
      [ControlStatus.NOT_APPLICABLE]: 0.0
    };
    return multipliers[status];
  }

  private calculateEvidenceQuality(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    const validEvidence = evidence.filter(e => e.isValid);
    const recentEvidence = evidence.filter(e => {
      const daysSinceCollection = (Date.now() - e.collectedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCollection <= 90; // Evidence is recent if collected within 90 days
    });

    const validityScore = validEvidence.length / evidence.length;
    const recencyScore = recentEvidence.length / evidence.length;

    return (validityScore + recencyScore) / 2;
  }
}

/**
 * Gap analysis processor
 */
export class GapAnalysisProcessor {
  private riskScorer: RiskScorer;

  constructor() {
    this.riskScorer = new RiskScorer();
  }

  /**
   * Process gap analysis for assessment results
   */
  async processGapAnalysis(
    assessmentId: string,
    standard: ComplianceStandard,
    results: AssessmentResult[],
    controls: Control[]
  ): Promise<GapAnalysis> {
    const overallScore = this.riskScorer.calculateComplianceScore(results);
    const metrics = this.riskScorer.calculateGapMetrics(results);
    
    const criticalGaps = this.identifyCriticalGaps(results, controls);
    const highRiskGaps = this.identifyHighRiskGaps(results, controls);
    const recommendedActions = this.generateRecommendations(results, controls);
    const estimatedEffort = this.estimateRemediationEffort(results, controls);

    return {
      id: crypto.randomUUID(),
      assessmentId,
      standard,
      overallScore,
      implementedCount: metrics.implemented,
      partiallyImplementedCount: metrics.partiallyImplemented,
      notImplementedCount: metrics.notImplemented,
      notApplicableCount: metrics.notApplicable,
      criticalGaps,
      highRiskGaps,
      recommendedActions,
      estimatedEffort,
      targetCompletionDate: this.calculateTargetDate(estimatedEffort)
    };
  }

  private identifyCriticalGaps(results: AssessmentResult[], controls: Control[]): string[] {
    return results
      .filter(result => result.status === ControlStatus.NOT_IMPLEMENTED)
      .map(result => controls.find(c => c.id === result.controlId))
      .filter((control): control is Control => control !== undefined && control.riskLevel === RiskLevel.CRITICAL)
      .map(control => control.id);
  }

  private identifyHighRiskGaps(results: AssessmentResult[], controls: Control[]): string[] {
    return results
      .filter(result => result.status === ControlStatus.NOT_IMPLEMENTED || result.status === ControlStatus.PARTIALLY_IMPLEMENTED)
      .map(result => controls.find(c => c.id === result.controlId))
      .filter((control): control is Control => control !== undefined && control.riskLevel === RiskLevel.HIGH)
      .map(control => control.id);
  }

  private generateRecommendations(results: AssessmentResult[], controls: Control[]): string[] {
    const recommendations: string[] = [];
    
    const notImplementedControls = results.filter(r => r.status === ControlStatus.NOT_IMPLEMENTED);
    const partialControls = results.filter(r => r.status === ControlStatus.PARTIALLY_IMPLEMENTED);

    if (notImplementedControls.length > 0) {
      recommendations.push(`Implement ${notImplementedControls.length} missing controls to improve compliance posture`);
    }

    if (partialControls.length > 0) {
      recommendations.push(`Complete implementation of ${partialControls.length} partially implemented controls`);
    }

    const criticalControls = notImplementedControls.filter(result => {
      const control = controls.find(c => c.id === result.controlId);
      return control?.riskLevel === RiskLevel.CRITICAL;
    });

    if (criticalControls.length > 0) {
      recommendations.push(`Prioritize ${criticalControls.length} critical controls for immediate implementation`);
    }

    return recommendations;
  }

  private estimateRemediationEffort(results: AssessmentResult[], controls: Control[]): number {
    const baseHours = {
      [RiskLevel.CRITICAL]: 40,
      [RiskLevel.HIGH]: 24,
      [RiskLevel.MEDIUM]: 16,
      [RiskLevel.LOW]: 8
    };

    let totalHours = 0;

    results.forEach(result => {
      const control = controls.find(c => c.id === result.controlId);
      if (!control) return;

      let multiplier = 1;
      switch (result.status) {
        case ControlStatus.NOT_IMPLEMENTED:
          multiplier = 1;
          break;
        case ControlStatus.PARTIALLY_IMPLEMENTED:
          multiplier = 0.5;
          break;
        default:
          multiplier = 0;
      }

      totalHours += baseHours[control.riskLevel] * multiplier;
    });

    return Math.ceil(totalHours);
  }

  private calculateTargetDate(estimatedHours: number): Date {
    const workingHoursPerWeek = 40;
    const weeksNeeded = Math.ceil(estimatedHours / workingHoursPerWeek);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (weeksNeeded * 7));
    return targetDate;
  }
}

/**
 * Remediation planner for generating action plans
 */
export class RemediationPlanner {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Create remediation plan from gap analysis
   */
  async createRemediationPlan(
    gapAnalysis: GapAnalysis,
    results: AssessmentResult[],
    controls: Control[]
  ): Promise<string> {
    try {
      const { data: plan, error: planError } = await this.supabase
        .from('remediation_plans')
        .insert({
          assessment_id: gapAnalysis.assessmentId,
          standard: gapAnalysis.standard,
          total_tasks: 0,
          estimated_hours: gapAnalysis.estimatedEffort,
          target_completion: gapAnalysis.targetCompletionDate?.toISOString(),
          status: 'DRAFT'
        })
        .select('id')
        .single();

      if (planError) throw planError;

      const tasks = this.generateRemediationTasks(plan.id, results, controls);
      await this.saveTasks(tasks);

      // Update task count
      await this.supabase
        .from('remediation_plans')
        .update({ total_tasks: tasks.length })
        .eq('id', plan.id);

      return plan.id;
    } catch (error) {
      throw new Error(`Failed to create remediation plan: ${error}`);
    }
  }

  /**
   * Get remediation tasks for a plan
   */
  async getTasks(planId: string): Promise<RemediationTask[]> {
    try {
      const { data, error } = await this.supabase
        .from('remediation_tasks')
        .select('*')
        .eq('plan_id', planId)
        .order('priority', { ascending: true });

      if (error) throw error;

      return data.