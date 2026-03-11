```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import winston from 'winston';
import { TaxEngine } from './tax-engine';
import { JurisdictionResolver } from './jurisdiction-resolver';
import { ComplianceChecker } from './compliance-checker';
import { RecommendationGenerator } from './recommendation-generator';
import { BusinessStructureAnalyzer } from './business-structure-analyzer';
import { IncomeClassifier } from './income-classifier';
import {
  CreatorTaxProfile,
  TaxOptimizationRequest,
  TaxOptimizationResponse,
  TaxRecommendation,
  JurisdictionInfo,
  BusinessStructureAnalysis,
  IncomeClassification,
  ComplianceStatus,
  TaxOptimizationError,
  OptimizationStrategy,
  DeductionOpportunity,
  TaxFilingRequirement,
  EstimatedTaxLiability
} from './types';

/**
 * Creator Tax Optimization Service
 * 
 * Provides comprehensive tax optimization recommendations for content creators
 * based on their jurisdiction, income streams, business structure, and regulatory requirements.
 * 
 * Features:
 * - Multi-jurisdiction tax analysis
 * - Income stream classification and optimization
 * - Business structure recommendations
 * - Regulatory compliance validation
 * - Deduction opportunity identification
 * - Tax liability estimation
 * 
 * @example
 * ```typescript
 * const taxService = new CreatorTaxOptimizationService();
 * const optimization = await taxService.getOptimization({
 *   creatorId: 'creator-123',
 *   taxYear: 2024,
 *   includeProjections: true
 * });
 * ```
 */
export class CreatorTaxOptimizationService {
  private supabase: SupabaseClient;
  private logger: winston.Logger;
  private taxEngine: TaxEngine;
  private jurisdictionResolver: JurisdictionResolver;
  private complianceChecker: ComplianceChecker;
  private recommendationGenerator: RecommendationGenerator;
  private businessStructureAnalyzer: BusinessStructureAnalyzer;
  private incomeClassifier: IncomeClassifier;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'creator-tax-optimization' },
      transports: [
        new winston.transports.File({ filename: 'logs/tax-optimization-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/tax-optimization-combined.log' })
      ]
    });

    this.taxEngine = new TaxEngine(this.supabase, this.logger);
    this.jurisdictionResolver = new JurisdictionResolver(this.supabase, this.logger);
    this.complianceChecker = new ComplianceChecker(this.supabase, this.logger);
    this.recommendationGenerator = new RecommendationGenerator(this.supabase, this.logger);
    this.businessStructureAnalyzer = new BusinessStructureAnalyzer(this.supabase, this.logger);
    this.incomeClassifier = new IncomeClassifier(this.supabase, this.logger);
  }

  /**
   * Get comprehensive tax optimization recommendations for a creator
   */
  async getOptimization(request: TaxOptimizationRequest): Promise<TaxOptimizationResponse> {
    try {
      this.logger.info('Starting tax optimization analysis', { 
        creatorId: request.creatorId,
        taxYear: request.taxYear 
      });

      // Load creator tax profile
      const taxProfile = await this.loadCreatorTaxProfile(request.creatorId);
      
      // Resolve tax jurisdiction
      const jurisdiction = await this.jurisdictionResolver.resolveJurisdiction(taxProfile);
      
      // Classify income streams
      const incomeClassification = await this.incomeClassifier.classifyIncome(
        taxProfile.incomeStreams,
        jurisdiction
      );
      
      // Analyze business structure
      const businessAnalysis = await this.businessStructureAnalyzer.analyzeStructure(
        taxProfile,
        jurisdiction
      );
      
      // Check compliance status
      const complianceStatus = await this.complianceChecker.checkCompliance(
        taxProfile,
        jurisdiction,
        request.taxYear
      );
      
      // Calculate tax liability
      const taxLiability = await this.taxEngine.calculateTaxLiability({
        taxProfile,
        jurisdiction,
        incomeClassification,
        businessStructure: businessAnalysis.currentStructure,
        taxYear: request.taxYear
      });
      
      // Generate optimization strategies
      const strategies = await this.recommendationGenerator.generateStrategies({
        taxProfile,
        jurisdiction,
        incomeClassification,
        businessAnalysis,
        complianceStatus,
        taxLiability
      });
      
      // Identify deduction opportunities
      const deductions = await this.identifyDeductions(
        taxProfile,
        jurisdiction,
        incomeClassification
      );
      
      // Generate filing requirements
      const filingRequirements = await this.generateFilingRequirements(
        taxProfile,
        jurisdiction,
        request.taxYear
      );
      
      const response: TaxOptimizationResponse = {
        creatorId: request.creatorId,
        taxYear: request.taxYear,
        jurisdiction,
        incomeClassification,
        businessAnalysis,
        complianceStatus,
        estimatedTaxLiability: taxLiability,
        optimizationStrategies: strategies,
        deductionOpportunities: deductions,
        filingRequirements,
        recommendations: await this.generateRecommendations(
          taxProfile,
          strategies,
          deductions,
          complianceStatus
        ),
        lastUpdated: new Date(),
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      };
      
      // Save optimization results
      await this.saveOptimizationResults(response);
      
      this.logger.info('Tax optimization analysis completed', {
        creatorId: request.creatorId,
        strategiesCount: strategies.length,
        deductionsCount: deductions.length
      });
      
      return response;
      
    } catch (error) {
      this.logger.error('Tax optimization analysis failed', {
        creatorId: request.creatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new TaxOptimizationError(
        `Failed to generate tax optimization: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'OPTIMIZATION_FAILED',
        { creatorId: request.creatorId }
      );
    }
  }

  /**
   * Get tax optimization history for a creator
   */
  async getOptimizationHistory(
    creatorId: string,
    limit: number = 10
  ): Promise<TaxOptimizationResponse[]> {
    try {
      const { data, error } = await this.supabase
        .from('tax_optimizations')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(record => ({
        ...record,
        lastUpdated: new Date(record.last_updated),
        validUntil: new Date(record.valid_until)
      }));

    } catch (error) {
      this.logger.error('Failed to fetch optimization history', {
        creatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new TaxOptimizationError(
        'Failed to fetch optimization history',
        'HISTORY_FETCH_FAILED',
        { creatorId }
      );
    }
  }

  /**
   * Update creator tax profile
   */
  async updateTaxProfile(
    creatorId: string,
    updates: Partial<CreatorTaxProfile>
  ): Promise<CreatorTaxProfile> {
    try {
      const { data, error } = await this.supabase
        .from('creator_tax_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('creator_id', creatorId)
        .select()
        .single();

      if (error) throw error;

      this.logger.info('Creator tax profile updated', { creatorId });

      return this.mapTaxProfileFromDB(data);

    } catch (error) {
      this.logger.error('Failed to update tax profile', {
        creatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new TaxOptimizationError(
        'Failed to update tax profile',
        'PROFILE_UPDATE_FAILED',
        { creatorId }
      );
    }
  }

  /**
   * Validate optimization recommendations
   */
  async validateRecommendations(
    creatorId: string,
    recommendations: TaxRecommendation[]
  ): Promise<{ valid: boolean; issues: string[] }> {
    try {
      const taxProfile = await this.loadCreatorTaxProfile(creatorId);
      const jurisdiction = await this.jurisdictionResolver.resolveJurisdiction(taxProfile);
      
      const issues: string[] = [];
      
      for (const recommendation of recommendations) {
        const validation = await this.complianceChecker.validateRecommendation(
          recommendation,
          taxProfile,
          jurisdiction
        );
        
        if (!validation.valid) {
          issues.push(...validation.issues);
        }
      }
      
      return {
        valid: issues.length === 0,
        issues
      };
      
    } catch (error) {
      this.logger.error('Failed to validate recommendations', {
        creatorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw new TaxOptimizationError(
        'Failed to validate recommendations',
        'VALIDATION_FAILED',
        { creatorId }
      );
    }
  }

  /**
   * Load creator tax profile from database
   */
  private async loadCreatorTaxProfile(creatorId: string): Promise<CreatorTaxProfile> {
    const { data, error } = await this.supabase
      .from('creator_tax_profiles')
      .select(`
        *,
        income_streams (*),
        business_structures (*),
        tax_jurisdictions (*)
      `)
      .eq('creator_id', creatorId)
      .single();

    if (error) {
      throw new TaxOptimizationError(
        'Creator tax profile not found',
        'PROFILE_NOT_FOUND',
        { creatorId }
      );
    }

    return this.mapTaxProfileFromDB(data);
  }

  /**
   * Identify deduction opportunities
   */
  private async identifyDeductions(
    taxProfile: CreatorTaxProfile,
    jurisdiction: JurisdictionInfo,
    incomeClassification: IncomeClassification
  ): Promise<DeductionOpportunity[]> {
    const deductions: DeductionOpportunity[] = [];
    
    // Business expenses
    if (taxProfile.businessExpenses.length > 0) {
      deductions.push({
        category: 'business_expenses',
        description: 'Business operating expenses',
        estimatedAmount: taxProfile.businessExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        eligibility: 'eligible',
        requirements: ['Maintain detailed records', 'Business purpose required'],
        taxSavings: 0, // Will be calculated by tax engine
        confidence: 0.95
      });
    }
    
    // Home office deduction
    if (taxProfile.homeOfficeUsage > 0) {
      deductions.push({
        category: 'home_office',
        description: 'Home office deduction',
        estimatedAmount: taxProfile.homeOfficeUsage * jurisdiction.homeOfficeRate,
        eligibility: 'eligible',
        requirements: ['Exclusive business use', 'Regular business use'],
        taxSavings: 0,
        confidence: 0.85
      });
    }
    
    // Equipment depreciation
    if (taxProfile.equipment.length > 0) {
      const equipmentValue = taxProfile.equipment
        .filter(eq => eq.purchaseDate.getFullYear() === new Date().getFullYear())
        .reduce((sum, eq) => sum + eq.value, 0);
        
      if (equipmentValue > 0) {
        deductions.push({
          category: 'equipment_depreciation',
          description: 'Equipment and technology depreciation',
          estimatedAmount: equipmentValue,
          eligibility: 'eligible',
          requirements: ['Business use documentation', 'Depreciation schedule'],
          taxSavings: 0,
          confidence: 0.90
        });
      }
    }
    
    // Calculate tax savings for each deduction
    for (const deduction of deductions) {
      deduction.taxSavings = await this.taxEngine.calculateDeductionSavings(
        deduction,
        taxProfile,
        jurisdiction
      );
    }
    
    return deductions.sort((a, b) => b.taxSavings - a.taxSavings);
  }

  /**
   * Generate filing requirements
   */
  private async generateFilingRequirements(
    taxProfile: CreatorTaxProfile,
    jurisdiction: JurisdictionInfo,
    taxYear: number
  ): Promise<TaxFilingRequirement[]> {
    const requirements: TaxFilingRequirement[] = [];
    
    // Federal income tax
    if (taxProfile.estimatedAnnualIncome > jurisdiction.filingThresholds.federal) {
      requirements.push({
        type: 'federal_income_tax',
        description: 'Federal Income Tax Return',
        dueDate: new Date(taxYear + 1, 3, 15), // April 15
        forms: ['1040', '1040-ES'],
        estimatedCost: 0,
        priority: 'high',
        status: 'pending'
      });
    }
    
    // State income tax
    if (jurisdiction.hasStateTax && taxProfile.estimatedAnnualIncome > jurisdiction.filingThresholds.state) {
      requirements.push({
        type: 'state_income_tax',
        description: `${jurisdiction.state} State Income Tax Return`,
        dueDate: new Date(taxYear + 1, 3, 15),
        forms: [jurisdiction.stateForm],
        estimatedCost: 0,
        priority: 'high',
        status: 'pending'
      });
    }
    
    // Quarterly estimated taxes
    if (taxProfile.estimatedTaxOwed > 1000) {
      const quarters = [
        new Date(taxYear, 3, 15), // Q1 - April 15
        new Date(taxYear, 5, 15), // Q2 - June 15
        new Date(taxYear, 8, 15), // Q3 - September 15
        new Date(taxYear + 1, 0, 15) // Q4 - January 15
      ];
      
      quarters.forEach((dueDate, index) => {
        requirements.push({
          type: 'quarterly_estimated',
          description: `Q${index + 1} Estimated Tax Payment`,
          dueDate,
          forms: ['1040-ES'],
          estimatedCost: taxProfile.estimatedTaxOwed / 4,
          priority: 'high',
          status: 'pending'
        });
      });
    }
    
    // Self-employment tax
    if (taxProfile.selfEmploymentIncome > 400) {
      requirements.push({
        type: 'self_employment_tax',
        description: 'Self-Employment Tax',
        dueDate: new Date(taxYear + 1, 3, 15),
        forms: ['Schedule SE'],
        estimatedCost: taxProfile.selfEmploymentIncome * 0.1413,
        priority: 'high',
        status: 'pending'
      });
    }
    
    return requirements.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Generate comprehensive recommendations
   */
  private async generateRecommendations(
    taxProfile: CreatorTaxProfile,
    strategies: OptimizationStrategy[],
    deductions: DeductionOpportunity[],
    complianceStatus: ComplianceStatus
  ): Promise<TaxRecommendation[]> {
    const recommendations: TaxRecommendation[] = [];
    
    // Business structure recommendations
    if (strategies.some(s => s.category === 'business_structure')) {
      recommendations.push({
        id: `rec-${Date.now()}-1`,
        type: 'business_structure',
        title: 'Consider Business Structure Optimization',
        description: 'Your current business structure may not be optimal for your income level and tax situation.',
        priority: 'high',
        estimatedSavings: strategies
          .filter(s => s.category === 'business_structure')
          .reduce((sum, s) => sum + s.estimatedSavings, 0),
        implementationEffort: 'medium',
        timeframe: '1-3 months',
        requirements: [
          'Consult with tax professional',
          'File business registration',
          'Update business banking'
        ],
        risks: ['Setup costs', 'Ongoing compliance requirements'],
        category: 'structure'
      });
    }
    
    // Deduction recommendations
    if (deductions.length > 0) {
      const topDeductions = deductions.slice(0, 3);
      recommendations.push({
        id: `rec-${Date.now()}-2`,
        type: 'deductions',
        title: 'Maximize Business Deductions',
        description: `You could potentially save $${topDeductions.reduce((sum, d) => sum + d.taxSavings, 0).toFixed(2)} through available deductions.`,
        priority: 'high',
        estimatedSavings: topDeductions.reduce((sum, d) => sum + d.taxSavings, 0),
        implementationEffort: 'low',
        timeframe: 'immediate',
        requirements: [
          'Maintain detailed expense records',
          'Document business purpose',
          'Keep receipts and invoices'
        ],
        risks: ['IRS audit if improperly documented'],
        category: 'deductions'
      });
    }
    
    // Compliance recommendations
    if (!complianceStatus.isCompliant) {
      recommendations.push({
        id: `rec-${Date.now()}-3`,
        type: 'compliance',
        title: 'Address Compliance Issues',
        description: 'There are compliance issues that need immediate attention.',
        priority: 'critical',
        estimatedSavings: 0,
        implementationEffort: 'high',
        timeframe: 'immediate',
        requirements: complianceStatus.issues.map(issue => `Resolve: ${issue.description}`),
        risks: ['Penalties and interest', 'Legal issues'],
        category: 'compliance'
      });
    }
    
    // Quarterly tax planning
    if (taxProfile.estimatedTaxOwed > 1000) {
      recommendations.push({
        id: `rec-${Date.now()}-4`,
        type: 'quarterly_payments',
        title: 'Set Up Quarterly Tax Payments',
        description: 'Avoid underpayment penalties by making quarterly estimated tax payments.',
        priority: 'medium',
        estimatedSavings: 0,
        implementationEffort: 'low',
        timeframe: 'next quarter',
        requirements: [
          'Calculate quarterly payment amount',
          'Set up payment schedule',
          'Monitor income throughout year'
        ],
        risks: ['Underpayment penalties if missed'],
        category: 'planning'
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Save optimization results to database
   */
  private async saveOptimizationResults(response: TaxOptimizationResponse): Promise<void> {
    const { error } = await this.supabase
      .from('tax_optimizations')
      .upsert({
        creator_id: response.creatorId,
        tax_year: response.taxYear,
        jurisdiction: response.jurisdiction,
        income_classification: response.incomeClassification,
        business_analysis: response.businessAnalysis,
        compliance_status: response.complianceStatus,
        estimated_tax_liability: response.estimatedTaxLiability,
        optimization_strategies: response.optimizationStrategies,
        deduction_opportunities: response.deductionOpportunities,
        filing_requirements: response.filingRequirements,
        recommendations: response.recommendations,
        last_updated: response.lastUpdated.toISOString(),
        valid_until: response.validUntil.toISOString()
      });

    if (error) {
      throw new TaxOptimizationError(
        'Failed to save optimization results',
        'SAVE_FAILED',
        { creatorId: response.creatorId }
      );
    }
  }

  /**
   * Map database record to CreatorTaxProfile
   */
  private mapTaxProfileFromDB(data: any): CreatorTaxProfile {
    return {
      creatorId: data.creator_id,
      taxJurisdiction: data.tax_jurisdiction,
      businessStructure: data.business_structure,
      incomeStreams: data.income_streams || [],
      estimatedAnnualIncome: data.estimated_annual_income || 0,
      selfEmploymentIncome: data.self_employment_income || 0,
      businessExpenses: data.business_expenses || [],
      equipment: data.equipment || [],
      homeOfficeUsage: data.home_office_usage || 0,
      estimatedTaxOwed: data.estimated_tax_owed || 0,
      filingStatus: data.filing_status,
      dependents: data.dependents || 0,
      retirementContributions: data.retirement_contributions || 0,
      healthInsurancePremiums: data.health_insurance_premiums || 0,
      lastUpdated: new Date(data.updated_at),
      createdAt: new Date(data.created_at)
    };
  }
}

// Export singleton instance
export const creatorTaxOptimizationService = new CreatorTaxOptimizationService();

// Export types for external use
export * from './types';
export { TaxEngine } from './tax-engine';
export { JurisdictionResolver } from './jurisdiction-resolver';
export { ComplianceChecker } from './compliance-checker';
export { RecommendationGenerator } from './recommendation-generator';
export { BusinessStructureAnalyzer } from './business