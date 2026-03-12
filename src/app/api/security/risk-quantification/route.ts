```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import rateLimit from '@/lib/rate-limit';

// Rate limiting
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

// Validation schemas
const CreateRiskAssessmentSchema = z.object({
  organization_id: z.string().uuid(),
  assessment_name: z.string().min(1).max(255),
  scope: z.object({
    assets: z.array(z.string()),
    systems: z.array(z.string()),
    processes: z.array(z.string()),
  }),
  business_context: z.object({
    annual_revenue: z.number().positive(),
    industry_sector: z.string(),
    regulatory_requirements: z.array(z.string()),
    risk_appetite: z.enum(['low', 'medium', 'high']),
  }),
});

const ThreatModelSchema = z.object({
  assessment_id: z.string().uuid(),
  threat_scenarios: z.array(z.object({
    threat_actor: z.string(),
    attack_vector: z.string(),
    likelihood: z.number().min(1).max(5),
    impact_category: z.enum(['confidentiality', 'integrity', 'availability', 'compliance']),
  })),
});

const CalculateRiskSchema = z.object({
  assessment_id: z.string().uuid(),
  time_horizon: z.enum(['quarterly', 'annual', '3-year']),
  confidence_level: z.number().min(0.5).max(0.99),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Risk quantification engine
class RiskQuantificationEngine {
  async calculateALE(probability: number, impact: number): Promise<number> {
    // Annual Loss Expectancy = Single Loss Expectancy × Annual Rate of Occurrence
    return probability * impact;
  }

  async calculateROSI(
    controlCost: number,
    riskReduction: number,
    ale: number
  ): Promise<number> {
    // Return on Security Investment = (Risk Reduction - Control Cost) / Control Cost
    const benefit = ale * riskReduction - controlCost;
    return controlCost > 0 ? benefit / controlCost : 0;
  }

  async calculateVaR(
    losses: number[],
    confidenceLevel: number
  ): Promise<number> {
    // Value at Risk calculation
    const sortedLosses = losses.sort((a, b) => b - a);
    const index = Math.ceil((1 - confidenceLevel) * losses.length) - 1;
    return sortedLosses[index] || 0;
  }
}

// Threat modeling service
class ThreatModelingService {
  async generateSTRIDEModel(assets: string[]): Promise<any> {
    const strideCategories = [
      'Spoofing',
      'Tampering',
      'Repudiation',
      'Information Disclosure',
      'Denial of Service',
      'Elevation of Privilege'
    ];

    return assets.map(asset => ({
      asset,
      threats: strideCategories.map(category => ({
        category,
        likelihood: this.assessThreatLikelihood(asset, category),
        impact: this.assessThreatImpact(asset, category),
      }))
    }));
  }

  private assessThreatLikelihood(asset: string, threat: string): number {
    // Simplified threat likelihood assessment
    const riskFactors = {
      'database': 4,
      'web_application': 3,
      'network': 3,
      'endpoint': 2,
      'cloud_service': 3,
    };

    const baseRisk = riskFactors[asset as keyof typeof riskFactors] || 2;
    return Math.min(5, baseRisk + Math.random());
  }

  private assessThreatImpact(asset: string, threat: string): number {
    // Simplified impact assessment
    const impactMap = {
      'Information Disclosure': 4,
      'Tampering': 4,
      'Denial of Service': 3,
      'Spoofing': 3,
      'Elevation of Privilege': 5,
      'Repudiation': 2,
    };

    return impactMap[threat as keyof typeof impactMap] || 2;
  }
}

// Vulnerability assessment service
class VulnerabilityAssessmentService {
  async assessVulnerabilities(systems: string[]): Promise<any> {
    // Simulate CVSS scoring integration
    return systems.map(system => ({
      system,
      vulnerabilities: this.generateMockVulnerabilities(system),
    }));
  }

  private generateMockVulnerabilities(system: string): any[] {
    const vulnTypes = ['SQL Injection', 'XSS', 'CSRF', 'Authentication Bypass', 'Buffer Overflow'];
    const count = Math.floor(Math.random() * 5) + 1;

    return Array.from({ length: count }, () => ({
      type: vulnTypes[Math.floor(Math.random() * vulnTypes.length)],
      cvss_score: (Math.random() * 10).toFixed(1),
      exploitability: Math.random(),
      remediation_cost: Math.floor(Math.random() * 50000) + 5000,
    }));
  }
}

// Business impact analyzer
class BusinessImpactAnalyzer {
  async calculateBusinessImpact(
    annualRevenue: number,
    industryMultipliers: Record<string, number>,
    impactCategories: string[]
  ): Promise<Record<string, number>> {
    const baseImpact = annualRevenue * 0.1; // 10% of annual revenue as baseline

    return {
      data_breach: baseImpact * 2.5,
      system_downtime: baseImpact * 0.5,
      regulatory_fine: baseImpact * 1.5,
      reputation_damage: baseImpact * 3.0,
      intellectual_property_theft: baseImpact * 4.0,
    };
  }

  async calculateDowntimeCost(
    annualRevenue: number,
    downtimeHours: number
  ): Promise<number> {
    const hourlyRevenue = annualRevenue / (365 * 24);
    const productivityMultiplier = 2.5; // Account for productivity loss
    return hourlyRevenue * downtimeHours * productivityMultiplier;
  }
}

// Security investment optimizer
class SecurityInvestmentOptimizer {
  async optimizeInvestment(
    securityBudget: number,
    riskScenarios: any[],
    controlOptions: any[]
  ): Promise<any> {
    // Simplified optimization using greedy algorithm
    const sortedControls = controlOptions.sort((a, b) => b.rosi - a.rosi);
    
    let remainingBudget = securityBudget;
    const selectedControls = [];

    for (const control of sortedControls) {
      if (control.cost <= remainingBudget) {
        selectedControls.push(control);
        remainingBudget -= control.cost;
      }
    }

    return {
      recommended_controls: selectedControls,
      total_cost: securityBudget - remainingBudget,
      expected_risk_reduction: selectedControls.reduce((sum, c) => sum + c.risk_reduction, 0),
      remaining_budget: remainingBudget,
    };
  }
}

// Compliance risk evaluator
class ComplianceRiskEvaluator {
  async evaluateComplianceRisk(
    regulations: string[],
    currentControls: string[]
  ): Promise<any> {
    const complianceFrameworks = {
      'SOX': { fine_range: [100000, 5000000], probability: 0.1 },
      'GDPR': { fine_range: [10000000, 20000000], probability: 0.05 },
      'HIPAA': { fine_range: [100000, 1500000], probability: 0.15 },
      'PCI-DSS': { fine_range: [50000, 500000], probability: 0.2 },
    };

    return regulations.map(regulation => {
      const framework = complianceFrameworks[regulation as keyof typeof complianceFrameworks];
      if (!framework) return null;

      const expectedFine = (framework.fine_range[0] + framework.fine_range[1]) / 2;
      const expectedLoss = expectedFine * framework.probability;

      return {
        regulation,
        expected_fine: expectedFine,
        probability: framework.probability,
        expected_annual_loss: expectedLoss,
        compliance_gap: this.assessComplianceGap(regulation, currentControls),
      };
    }).filter(Boolean);
  }

  private assessComplianceGap(regulation: string, controls: string[]): number {
    // Simplified compliance gap assessment
    const requiredControls = {
      'SOX': ['financial_controls', 'audit_logging', 'access_management'],
      'GDPR': ['data_encryption', 'privacy_controls', 'breach_notification'],
      'HIPAA': ['data_encryption', 'access_controls', 'audit_logging'],
      'PCI-DSS': ['network_security', 'encryption', 'access_controls'],
    };

    const required = requiredControls[regulation as keyof typeof requiredControls] || [];
    const implemented = controls.filter(control => required.includes(control));
    
    return 1 - (implemented.length / required.length);
  }
}

// Initialize services
const riskEngine = new RiskQuantificationEngine();
const threatModeling = new ThreatModelingService();
const vulnAssessment = new VulnerabilityAssessmentService();
const businessImpact = new BusinessImpactAnalyzer();
const investmentOptimizer = new SecurityInvestmentOptimizer();
const complianceEvaluator = new ComplianceRiskEvaluator();

export async function GET(request: NextRequest) {
  try {
    await limiter.check(10, 'CACHE_TOKEN');

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');
    const assessmentId = searchParams.get('assessment_id');

    if (assessmentId) {
      // Get specific risk assessment
      const { data: assessment, error } = await supabase
        .from('security_risks')
        .select(`
          *,
          threat_models(*),
          vulnerability_assessments(*),
          business_impact_metrics(*)
        `)
        .eq('id', assessmentId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Risk assessment not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ assessment });
    }

    // Get risk assessments with filters
    let query = supabase
      .from('security_risks')
      .select(`
        *,
        threat_models(*),
        business_impact_metrics(*)
      `)
      .order('created_at', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: assessments, error } = await query.limit(50);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch risk assessments' },
        { status: 500 }
      );
    }

    return NextResponse.json({ assessments });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await limiter.check(5, 'CACHE_TOKEN');

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'calculate') {
      // Calculate financial risk metrics
      const validatedData = CalculateRiskSchema.parse(body);
      
      const { data: assessment } = await supabase
        .from('security_risks')
        .select('*')
        .eq('id', validatedData.assessment_id)
        .single();

      if (!assessment) {
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }

      // Generate threat model
      const threatModel = await threatModeling.generateSTRIDEModel(
        assessment.scope?.assets || []
      );

      // Assess vulnerabilities
      const vulnerabilities = await vulnAssessment.assessVulnerabilities(
        assessment.scope?.systems || []
      );

      // Calculate business impact
      const businessImpacts = await businessImpact.calculateBusinessImpact(
        assessment.business_context?.annual_revenue || 1000000,
        { [assessment.business_context?.industry_sector]: 1.0 },
        ['data_breach', 'system_downtime', 'regulatory_fine']
      );

      // Calculate risk metrics
      const riskScenarios = threatModel.flatMap((asset: any) =>
        asset.threats.map((threat: any) => ({
          scenario: `${threat.category} on ${asset.asset}`,
          probability: threat.likelihood / 5, // Normalize to 0-1
          impact: businessImpacts[threat.category.toLowerCase().replace(' ', '_')] || 10000,
          ale: threat.likelihood / 5 * (businessImpacts[threat.category.toLowerCase().replace(' ', '_')] || 10000),
        }))
      );

      const totalALE = riskScenarios.reduce((sum: number, scenario: any) => sum + scenario.ale, 0);
      const losses = riskScenarios.map((s: any) => s.impact);
      const var95 = await riskEngine.calculateVaR(losses, validatedData.confidence_level);

      // Store results
      const { data: metrics, error: metricsError } = await supabase
        .from('business_impact_metrics')
        .insert({
          assessment_id: validatedData.assessment_id,
          total_ale: totalALE,
          value_at_risk: var95,
          risk_scenarios: riskScenarios,
          calculation_date: new Date().toISOString(),
          time_horizon: validatedData.time_horizon,
          confidence_level: validatedData.confidence_level,
        })
        .select()
        .single();

      if (metricsError) {
        console.error('Failed to store metrics:', metricsError);
        return NextResponse.json(
          { error: 'Failed to store risk metrics' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        metrics: {
          total_ale: totalALE,
          value_at_risk: var95,
          risk_scenarios: riskScenarios.length,
          high_risk_scenarios: riskScenarios.filter((s: any) => s.probability > 0.6).length,
        },
        threat_model: threatModel,
        vulnerabilities: vulnerabilities,
        business_impacts: businessImpacts,
      });
    }

    if (action === 'threat-model') {
      // Generate threat model
      const validatedData = ThreatModelSchema.parse(body);
      
      const threatModel = await threatModeling.generateSTRIDEModel(
        validatedData.threat_scenarios.map(s => s.attack_vector)
      );

      const { data: model, error: modelError } = await supabase
        .from('threat_models')
        .insert({
          assessment_id: validatedData.assessment_id,
          model_type: 'STRIDE',
          threat_scenarios: validatedData.threat_scenarios,
          generated_threats: threatModel,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (modelError) {
        console.error('Failed to store threat model:', modelError);
        return NextResponse.json(
          { error: 'Failed to store threat model' },
          { status: 500 }
        );
      }

      return NextResponse.json({ threat_model: model });
    }

    // Create new risk assessment
    const validatedData = CreateRiskAssessmentSchema.parse(body);

    const { data: assessment, error } = await supabase
      .from('security_risks')
      .insert({
        organization_id: validatedData.organization_id,
        assessment_name: validatedData.assessment_name,
        scope: validatedData.scope,
        business_context: validatedData.business_context,
        status: 'created',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create risk assessment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ assessment }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await limiter.check(5, 'CACHE_TOKEN');

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('id');

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'Assessment ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    const { data: assessment, error } = await supabase
      .from('security_risks')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update risk assessment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ assessment });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```