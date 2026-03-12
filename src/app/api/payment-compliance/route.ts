```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/utils/rate-limit';
import { z } from 'zod';
import { headers } from 'next/headers';

// Validation schemas
const complianceCheckSchema = z.object({
  transaction_id: z.string().min(1).max(100),
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3),
  source_country: z.string().length(2),
  destination_country: z.string().length(2),
  payment_method: z.enum(['card', 'bank_transfer', 'digital_wallet', 'crypto']),
  merchant_id: z.string().min(1).max(100),
  customer_data: z.object({
    id: z.string().optional(),
    type: z.enum(['individual', 'business']),
    risk_score: z.number().min(0).max(100).optional(),
    kyc_status: z.enum(['pending', 'verified', 'rejected']).optional()
  }),
  metadata: z.record(z.string(), z.any()).optional()
});

const ruleUpdateSchema = z.object({
  jurisdiction: z.string().min(2).max(10),
  rule_type: z.enum(['aml', 'kyc', 'sanctions', 'limits', 'reporting']),
  rule_data: z.object({
    id: z.string(),
    version: z.string(),
    effective_date: z.string().datetime(),
    conditions: z.array(z.record(z.string(), z.any())),
    actions: z.array(z.string()),
    priority: z.number().min(1).max(10)
  })
});

// Types
interface ComplianceResult {
  compliant: boolean;
  jurisdiction: string;
  applied_rules: string[];
  violations: Violation[];
  risk_score: number;
  recommended_actions: string[];
  next_review_date?: string;
}

interface Violation {
  rule_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  resolution_required: boolean;
  auto_block: boolean;
}

interface JurisdictionRule {
  id: string;
  jurisdiction: string;
  rule_type: string;
  conditions: Record<string, any>;
  actions: string[];
  priority: number;
  effective_date: string;
  expiry_date?: string;
  version: string;
}

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Compliance Engine
class ComplianceEngine {
  private static instance: ComplianceEngine;
  private ruleCache: Map<string, JurisdictionRule[]> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): ComplianceEngine {
    if (!ComplianceEngine.instance) {
      ComplianceEngine.instance = new ComplianceEngine();
    }
    return ComplianceEngine.instance;
  }

  async getRulesForJurisdiction(jurisdiction: string): Promise<JurisdictionRule[]> {
    const cacheKey = `rules:${jurisdiction}`;
    const now = Date.now();

    // Check cache validity
    if (this.ruleCache.has(cacheKey) && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.ruleCache.get(cacheKey)!;
    }

    try {
      const { data, error } = await supabase
        .from('compliance_rules')
        .select('*')
        .eq('jurisdiction', jurisdiction)
        .eq('active', true)
        .lte('effective_date', new Date().toISOString())
        .or(`expiry_date.is.null,expiry_date.gt.${new Date().toISOString()}`)
        .order('priority', { ascending: false });

      if (error) throw error;

      const rules = data as JurisdictionRule[];
      this.ruleCache.set(cacheKey, rules);
      this.lastCacheUpdate = now;

      return rules;
    } catch (error) {
      console.error('Error fetching compliance rules:', error);
      return this.ruleCache.get(cacheKey) || [];
    }
  }

  async validateTransaction(transactionData: z.infer<typeof complianceCheckSchema>): Promise<ComplianceResult> {
    const jurisdictions = this.determineJurisdictions(transactionData);
    const violations: Violation[] = [];
    const appliedRules: string[] = [];
    let riskScore = 0;
    const recommendedActions: string[] = [];

    for (const jurisdiction of jurisdictions) {
      const rules = await this.getRulesForJurisdiction(jurisdiction);

      for (const rule of rules) {
        if (this.evaluateRuleConditions(rule.conditions, transactionData)) {
          appliedRules.push(rule.id);
          
          const ruleViolations = this.checkRuleViolations(rule, transactionData);
          violations.push(...ruleViolations);
          
          riskScore += this.calculateRuleRiskScore(rule, transactionData);
          recommendedActions.push(...rule.actions);
        }
      }
    }

    const compliant = violations.length === 0 || !violations.some(v => v.resolution_required);

    return {
      compliant,
      jurisdiction: jurisdictions[0],
      applied_rules: appliedRules,
      violations,
      risk_score: Math.min(100, riskScore),
      recommended_actions: [...new Set(recommendedActions)],
      next_review_date: this.calculateNextReviewDate(riskScore, violations)
    };
  }

  private determineJurisdictions(data: z.infer<typeof complianceCheckSchema>): string[] {
    const jurisdictions = new Set<string>();
    
    // Add source and destination countries
    jurisdictions.add(data.source_country);
    jurisdictions.add(data.destination_country);
    
    // Add regional jurisdictions based on countries
    const regionalJurisdictions = this.getRegionalJurisdictions(data.source_country, data.destination_country);
    regionalJurisdictions.forEach(j => jurisdictions.add(j));
    
    return Array.from(jurisdictions);
  }

  private getRegionalJurisdictions(sourceCountry: string, destCountry: string): string[] {
    const regional: string[] = [];
    
    // EU jurisdiction
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    if (euCountries.includes(sourceCountry) || euCountries.includes(destCountry)) {
      regional.push('EU');
    }

    // FATF jurisdiction for high-risk scenarios
    if (this.isHighRiskJurisdiction(sourceCountry) || this.isHighRiskJurisdiction(destCountry)) {
      regional.push('FATF');
    }

    return regional;
  }

  private isHighRiskJurisdiction(country: string): boolean {
    const highRiskCountries = ['AF', 'BY', 'BA', 'BF', 'MM', 'NI', 'PK', 'UG', 'YE'];
    return highRiskCountries.includes(country);
  }

  private evaluateRuleConditions(conditions: Record<string, any>, data: z.infer<typeof complianceCheckSchema>): boolean {
    for (const [key, condition] of Object.entries(conditions)) {
      if (!this.evaluateCondition(key, condition, data)) {
        return false;
      }
    }
    return true;
  }

  private evaluateCondition(key: string, condition: any, data: z.infer<typeof complianceCheckSchema>): boolean {
    const getValue = (path: string): any => {
      const keys = path.split('.');
      let value: any = data;
      for (const k of keys) {
        value = value?.[k];
      }
      return value;
    };

    const dataValue = getValue(key);

    if (typeof condition === 'object' && condition !== null) {
      if (condition.$gt !== undefined) return dataValue > condition.$gt;
      if (condition.$gte !== undefined) return dataValue >= condition.$gte;
      if (condition.$lt !== undefined) return dataValue < condition.$lt;
      if (condition.$lte !== undefined) return dataValue <= condition.$lte;
      if (condition.$eq !== undefined) return dataValue === condition.$eq;
      if (condition.$ne !== undefined) return dataValue !== condition.$ne;
      if (condition.$in !== undefined) return Array.isArray(condition.$in) && condition.$in.includes(dataValue);
      if (condition.$nin !== undefined) return Array.isArray(condition.$nin) && !condition.$nin.includes(dataValue);
      if (condition.$regex !== undefined) return new RegExp(condition.$regex).test(String(dataValue));
    }

    return dataValue === condition;
  }

  private checkRuleViolations(rule: JurisdictionRule, data: z.infer<typeof complianceCheckSchema>): Violation[] {
    const violations: Violation[] = [];

    // AML checks
    if (rule.rule_type === 'aml') {
      if (data.amount > 10000 && data.customer_data.kyc_status !== 'verified') {
        violations.push({
          rule_id: rule.id,
          severity: 'high',
          message: 'Large transaction requires verified KYC status',
          resolution_required: true,
          auto_block: true
        });
      }
    }

    // Sanctions checks
    if (rule.rule_type === 'sanctions') {
      if (this.isHighRiskJurisdiction(data.source_country) || this.isHighRiskJurisdiction(data.destination_country)) {
        violations.push({
          rule_id: rule.id,
          severity: 'critical',
          message: 'Transaction involves sanctioned jurisdiction',
          resolution_required: true,
          auto_block: true
        });
      }
    }

    // Transaction limits
    if (rule.rule_type === 'limits') {
      const conditions = rule.conditions as { daily_limit?: number; monthly_limit?: number };
      if (conditions.daily_limit && data.amount > conditions.daily_limit) {
        violations.push({
          rule_id: rule.id,
          severity: 'medium',
          message: 'Transaction exceeds daily limit',
          resolution_required: true,
          auto_block: false
        });
      }
    }

    return violations;
  }

  private calculateRuleRiskScore(rule: JurisdictionRule, data: z.infer<typeof complianceCheckSchema>): number {
    let score = 0;

    // Base score from rule priority
    score += rule.priority * 2;

    // Amount-based risk
    if (data.amount > 50000) score += 10;
    else if (data.amount > 10000) score += 5;

    // Country risk
    if (this.isHighRiskJurisdiction(data.source_country) || this.isHighRiskJurisdiction(data.destination_country)) {
      score += 15;
    }

    // Customer risk
    if (data.customer_data.risk_score) {
      score += Math.floor(data.customer_data.risk_score / 10);
    }

    return score;
  }

  private calculateNextReviewDate(riskScore: number, violations: Violation[]): string | undefined {
    const hasCriticalViolations = violations.some(v => v.severity === 'critical');
    const hasHighViolations = violations.some(v => v.severity === 'high');

    let reviewDays = 30; // Default

    if (hasCriticalViolations) reviewDays = 1;
    else if (hasHighViolations || riskScore > 70) reviewDays = 7;
    else if (riskScore > 50) reviewDays = 14;

    const reviewDate = new Date();
    reviewDate.setDate(reviewDate.getDate() + reviewDays);
    return reviewDate.toISOString();
  }

  async logComplianceCheck(transactionId: string, result: ComplianceResult, userAgent?: string, ip?: string): Promise<void> {
    try {
      await supabase.from('compliance_audit_log').insert({
        transaction_id: transactionId,
        jurisdiction: result.jurisdiction,
        compliant: result.compliant,
        violations_count: result.violations.length,
        risk_score: result.risk_score,
        applied_rules: result.applied_rules,
        violations: result.violations,
        user_agent: userAgent,
        ip_address: ip,
        checked_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging compliance check:', error);
    }
  }
}

// API Route Handlers
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const identifier = headers().get('x-forwarded-for') ?? 'anonymous';
    const rateLimitResult = await rateLimit(identifier, 100, 60); // 100 requests per minute

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = complianceCheckSchema.parse(body);

    const complianceEngine = ComplianceEngine.getInstance();
    const result = await complianceEngine.validateTransaction(validatedData);

    // Log the compliance check
    const userAgent = headers().get('user-agent');
    const ip = headers().get('x-forwarded-for');
    await complianceEngine.logComplianceCheck(validatedData.transaction_id, result, userAgent || undefined, ip || undefined);

    // Send alerts for violations
    if (result.violations.length > 0) {
      await sendViolationAlerts(validatedData.transaction_id, result.violations);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Compliance check error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdiction = searchParams.get('jurisdiction');
    const ruleType = searchParams.get('rule_type');

    if (!jurisdiction) {
      return NextResponse.json(
        { error: 'Jurisdiction parameter is required' },
        { status: 400 }
      );
    }

    const complianceEngine = ComplianceEngine.getInstance();
    let rules = await complianceEngine.getRulesForJurisdiction(jurisdiction);

    if (ruleType) {
      rules = rules.filter(rule => rule.rule_type === ruleType);
    }

    return NextResponse.json({
      success: true,
      data: {
        jurisdiction,
        rules,
        count: rules.length,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching compliance rules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting for rule updates
    const identifier = headers().get('x-forwarded-for') ?? 'anonymous';
    const rateLimitResult = await rateLimit(`update:${identifier}`, 10, 60); // 10 updates per minute

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for rule updates' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validatedData = ruleUpdateSchema.parse(body);

    // Update rule in database
    const { error } = await supabase
      .from('compliance_rules')
      .upsert({
        id: validatedData.rule_data.id,
        jurisdiction: validatedData.jurisdiction,
        rule_type: validatedData.rule_type,
        conditions: validatedData.rule_data.conditions,
        actions: validatedData.rule_data.actions,
        priority: validatedData.rule_data.priority,
        effective_date: validatedData.rule_data.effective_date,
        version: validatedData.rule_data.version,
        active: true,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    // Invalidate cache
    const complianceEngine = ComplianceEngine.getInstance();
    (complianceEngine as any).ruleCache.clear();
    (complianceEngine as any).lastCacheUpdate = 0;

    return NextResponse.json({
      success: true,
      message: 'Compliance rule updated successfully',
      rule_id: validatedData.rule_data.id
    });

  } catch (error) {
    console.error('Error updating compliance rule:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to send violation alerts
async function sendViolationAlerts(transactionId: string, violations: Violation[]): Promise<void> {
  const criticalViolations = violations.filter(v => v.severity === 'critical' || v.auto_block);
  
  if (criticalViolations.length > 0) {
    try {
      // Send immediate alerts for critical violations
      await fetch(process.env.ALERT_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_type: 'compliance_violation',
          severity: 'critical',
          transaction_id: transactionId,
          violations: criticalViolations,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error sending violation alert:', error);
    }
  }
}
```