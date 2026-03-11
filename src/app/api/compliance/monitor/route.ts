import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';

// Types and Interfaces
interface ComplianceRule {
  id: string;
  standard: 'SOC2' | 'GDPR' | 'HIPAA';
  category: string;
  rule_name: string;
  description: string;
  check_type: 'automated' | 'manual' | 'hybrid';
  severity: 'low' | 'medium' | 'high' | 'critical';
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  validator_config: Record<string, any>;
  is_active: boolean;
}

interface ComplianceReport {
  id: string;
  standard: string;
  report_type: 'scheduled' | 'on_demand' | 'incident';
  status: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
  score: number;
  findings: ComplianceFinding[];
  recommendations: string[];
  generated_at: string;
  generated_by: string;
}

interface ComplianceFinding {
  rule_id: string;
  status: 'pass' | 'fail' | 'warning' | 'not_applicable';
  evidence: Record<string, any>;
  risk_level: string;
  remediation_steps: string[];
}

interface ComplianceAlert {
  id: string;
  rule_id: string;
  severity: string;
  message: string;
  details: Record<string, any>;
  status: 'open' | 'acknowledged' | 'resolved';
  created_at: string;
  resolved_at?: string;
}

// Validation Schemas
const monitorRequestSchema = z.object({
  action: z.enum(['start_monitoring', 'stop_monitoring', 'check_compliance', 'generate_report', 'get_status']),
  standards: z.array(z.enum(['SOC2', 'GDPR', 'HIPAA'])).optional(),
  rule_ids: z.array(z.string()).optional(),
  report_type: z.enum(['scheduled', 'on_demand', 'incident']).optional(),
  notification_settings: z.object({
    email: z.boolean().optional(),
    slack: z.boolean().optional(),
    webhook_url: z.string().url().optional()
  }).optional()
});

// Compliance Monitor Class
class ComplianceMonitor {
  private supabase: any;
  private standardsChecker: StandardsChecker;
  private alertManager: AlertManager;
  private auditLogger: AuditLogger;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
    this.standardsChecker = new StandardsChecker();
    this.alertManager = new AlertManager(supabaseClient);
    this.auditLogger = new AuditLogger(supabaseClient);
  }

  async startMonitoring(standards: string[], userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get active rules for specified standards
      const { data: rules, error } = await this.supabase
        .from('compliance_rules')
        .select('*')
        .in('standard', standards)
        .eq('is_active', true);

      if (error) throw error;

      // Initialize monitoring sessions
      const monitoringSessions = rules.map(rule => ({
        rule_id: rule.id,
        status: 'active',
        started_at: new Date().toISOString(),
        started_by: userId,
        last_check: null,
        next_check: this.calculateNextCheck(rule.frequency)
      }));

      const { error: insertError } = await this.supabase
        .from('compliance_monitoring_sessions')
        .insert(monitoringSessions);

      if (insertError) throw insertError;

      await this.auditLogger.log('monitoring_started', {
        standards,
        rule_count: rules.length,
        user_id: userId
      });

      // Start background monitoring
      this.scheduleComplianceChecks(rules);

      return { success: true, message: `Started monitoring ${standards.join(', ')} compliance` };
    } catch (error) {
      throw new Error(`Failed to start monitoring: ${error}`);
    }
  }

  async checkCompliance(ruleIds?: string[]): Promise<ComplianceReport[]> {
    try {
      let query = this.supabase.from('compliance_rules').select('*').eq('is_active', true);
      
      if (ruleIds && ruleIds.length > 0) {
        query = query.in('id', ruleIds);
      }

      const { data: rules, error } = await query;
      if (error) throw error;

      const reports: ComplianceReport[] = [];

      // Group rules by standard
      const rulesByStandard = rules.reduce((acc, rule) => {
        if (!acc[rule.standard]) acc[rule.standard] = [];
        acc[rule.standard].push(rule);
        return acc;
      }, {} as Record<string, ComplianceRule[]>);

      // Check compliance for each standard
      for (const [standard, standardRules] of Object.entries(rulesByStandard)) {
        const findings: ComplianceFinding[] = [];
        
        for (const rule of standardRules) {
          const finding = await this.standardsChecker.validateRule(rule);
          findings.push(finding);

          // Generate alert if non-compliant
          if (finding.status === 'fail' && rule.severity !== 'low') {
            await this.alertManager.createAlert(rule, finding);
          }
        }

        const report = await this.generateComplianceReport(standard, findings);
        reports.push(report);

        // Store report
        await this.storeComplianceReport(report);
      }

      return reports;
    } catch (error) {
      throw new Error(`Compliance check failed: ${error}`);
    }
  }

  private async generateComplianceReport(standard: string, findings: ComplianceFinding[]): Promise<ComplianceReport> {
    const totalChecks = findings.length;
    const passedChecks = findings.filter(f => f.status === 'pass').length;
    const failedChecks = findings.filter(f => f.status === 'fail').length;
    
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    
    let status: 'compliant' | 'non_compliant' | 'partial' | 'unknown' = 'unknown';
    if (failedChecks === 0) status = 'compliant';
    else if (passedChecks === 0) status = 'non_compliant';
    else status = 'partial';

    const recommendations = this.generateRecommendations(findings);

    return {
      id: crypto.randomUUID(),
      standard,
      report_type: 'on_demand',
      status,
      score,
      findings,
      recommendations,
      generated_at: new Date().toISOString(),
      generated_by: 'system'
    };
  }

  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];
    const failedFindings = findings.filter(f => f.status === 'fail');
    
    failedFindings.forEach(finding => {
      recommendations.push(...finding.remediation_steps);
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    const { error } = await this.supabase
      .from('compliance_reports')
      .insert({
        id: report.id,
        standard: report.standard,
        report_type: report.report_type,
        status: report.status,
        score: report.score,
        findings: report.findings,
        recommendations: report.recommendations,
        generated_at: report.generated_at,
        generated_by: report.generated_by
      });

    if (error) throw error;
  }

  private calculateNextCheck(frequency: string): string {
    const now = new Date();
    switch (frequency) {
      case 'realtime':
        return new Date(now.getTime() + 60000).toISOString(); // 1 minute
      case 'hourly':
        return new Date(now.getTime() + 3600000).toISOString(); // 1 hour
      case 'daily':
        return new Date(now.getTime() + 86400000).toISOString(); // 1 day
      case 'weekly':
        return new Date(now.getTime() + 604800000).toISOString(); // 1 week
      default:
        return new Date(now.getTime() + 86400000).toISOString(); // Default to daily
    }
  }

  private scheduleComplianceChecks(rules: ComplianceRule[]): void {
    // This would integrate with a job scheduler like node-cron or external service
    console.log(`Scheduled compliance checks for ${rules.length} rules`);
  }
}

// Standards Checker Class
class StandardsChecker {
  async validateRule(rule: ComplianceRule): Promise<ComplianceFinding> {
    try {
      switch (rule.standard) {
        case 'SOC2':
          return await this.validateSOC2Rule(rule);
        case 'GDPR':
          return await this.validateGDPRRule(rule);
        case 'HIPAA':
          return await this.validateHIPAARule(rule);
        default:
          throw new Error(`Unsupported standard: ${rule.standard}`);
      }
    } catch (error) {
      return {
        rule_id: rule.id,
        status: 'fail',
        evidence: { error: error.message },
        risk_level: 'high',
        remediation_steps: ['Review rule configuration', 'Contact compliance team']
      };
    }
  }

  private async validateSOC2Rule(rule: ComplianceRule): Promise<ComplianceFinding> {
    // SOC2 specific validation logic
    const checks = {
      'access_control': () => this.checkAccessControls(),
      'data_encryption': () => this.checkEncryption(),
      'system_monitoring': () => this.checkMonitoring(),
      'incident_response': () => this.checkIncidentResponse()
    };

    const validator = checks[rule.category as keyof typeof checks];
    if (!validator) {
      return {
        rule_id: rule.id,
        status: 'not_applicable',
        evidence: { reason: 'No validator for category' },
        risk_level: 'low',
        remediation_steps: []
      };
    }

    const result = await validator();
    return {
      rule_id: rule.id,
      status: result.compliant ? 'pass' : 'fail',
      evidence: result.evidence,
      risk_level: result.compliant ? 'low' : rule.severity,
      remediation_steps: result.remediation_steps || []
    };
  }

  private async validateGDPRRule(rule: ComplianceRule): Promise<ComplianceFinding> {
    // GDPR specific validation logic
    const checks = {
      'data_processing': () => this.checkDataProcessing(),
      'consent_management': () => this.checkConsent(),
      'data_subject_rights': () => this.checkSubjectRights(),
      'privacy_by_design': () => this.checkPrivacyByDesign()
    };

    const validator = checks[rule.category as keyof typeof checks];
    if (!validator) {
      return {
        rule_id: rule.id,
        status: 'not_applicable',
        evidence: { reason: 'No validator for category' },
        risk_level: 'low',
        remediation_steps: []
      };
    }

    const result = await validator();
    return {
      rule_id: rule.id,
      status: result.compliant ? 'pass' : 'fail',
      evidence: result.evidence,
      risk_level: result.compliant ? 'low' : rule.severity,
      remediation_steps: result.remediation_steps || []
    };
  }

  private async validateHIPAARule(rule: ComplianceRule): Promise<ComplianceFinding> {
    // HIPAA specific validation logic
    const checks = {
      'phi_protection': () => this.checkPHIProtection(),
      'access_logs': () => this.checkAccessLogs(),
      'data_backup': () => this.checkDataBackup(),
      'workforce_training': () => this.checkTraining()
    };

    const validator = checks[rule.category as keyof typeof checks];
    if (!validator) {
      return {
        rule_id: rule.id,
        status: 'not_applicable',
        evidence: { reason: 'No validator for category' },
        risk_level: 'low',
        remediation_steps: []
      };
    }

    const result = await validator();
    return {
      rule_id: rule.id,
      status: result.compliant ? 'pass' : 'fail',
      evidence: result.evidence,
      risk_level: result.compliant ? 'low' : rule.severity,
      remediation_steps: result.remediation_steps || []
    };
  }

  // Mock validation methods (replace with actual implementations)
  private async checkAccessControls(): Promise<any> {
    return { compliant: true, evidence: { mfa_enabled: true }, remediation_steps: [] };
  }

  private async checkEncryption(): Promise<any> {
    return { compliant: true, evidence: { encryption_at_rest: true }, remediation_steps: [] };
  }

  private async checkMonitoring(): Promise<any> {
    return { compliant: true, evidence: { monitoring_active: true }, remediation_steps: [] };
  }

  private async checkIncidentResponse(): Promise<any> {
    return { compliant: true, evidence: { response_plan: true }, remediation_steps: [] };
  }

  private async checkDataProcessing(): Promise<any> {
    return { compliant: true, evidence: { lawful_basis: true }, remediation_steps: [] };
  }

  private async checkConsent(): Promise<any> {
    return { compliant: true, evidence: { consent_records: true }, remediation_steps: [] };
  }

  private async checkSubjectRights(): Promise<any> {
    return { compliant: true, evidence: { rights_mechanism: true }, remediation_steps: [] };
  }

  private async checkPrivacyByDesign(): Promise<any> {
    return { compliant: true, evidence: { privacy_controls: true }, remediation_steps: [] };
  }

  private async checkPHIProtection(): Promise<any> {
    return { compliant: true, evidence: { phi_encrypted: true }, remediation_steps: [] };
  }

  private async checkAccessLogs(): Promise<any> {
    return { compliant: true, evidence: { audit_logs: true }, remediation_steps: [] };
  }

  private async checkDataBackup(): Promise<any> {
    return { compliant: true, evidence: { backup_encrypted: true }, remediation_steps: [] };
  }

  private async checkTraining(): Promise<any> {
    return { compliant: true, evidence: { training_current: true }, remediation_steps: [] };
  }
}

// Alert Manager Class
class AlertManager {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async createAlert(rule: ComplianceRule, finding: ComplianceFinding): Promise<void> {
    const alert: ComplianceAlert = {
      id: crypto.randomUUID(),
      rule_id: rule.id,
      severity: rule.severity,
      message: `Compliance violation detected: ${rule.rule_name}`,
      details: {
        standard: rule.standard,
        category: rule.category,
        finding_status: finding.status,
        evidence: finding.evidence,
        remediation_steps: finding.remediation_steps
      },
      status: 'open',
      created_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('compliance_alerts')
      .insert(alert);

    if (error) throw error;

    // Send notifications
    await this.sendNotifications(alert);
  }

  private async sendNotifications(alert: ComplianceAlert): Promise<void> {
    // Email/Slack/Webhook notifications would be implemented here
    console.log(`Alert sent: ${alert.message}`);
  }
}

// Audit Logger Class
class AuditLogger {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async log(action: string, details: Record<string, any>): Promise<void> {
    const { error } = await this.supabase
      .from('compliance_audit_logs')
      .insert({
        id: crypto.randomUUID(),
        action,
        details,
        timestamp: new Date().toISOString(),
        user_id: details.user_id || 'system'
      });

    if (error) throw error;
  }
}

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'get_status';

    const monitor = new ComplianceMonitor(supabase);

    switch (action) {
      case 'get_status': {
        const { data: sessions, error } = await supabase
          .from('compliance_monitoring_sessions')
          .select(`
            *,
            compliance_rules (
              id,
              standard,
              rule_name,
              severity
            )
          `)
          .eq('status', 'active');

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: {
            active_sessions: sessions,
            total_rules: sessions.length
          }
        });
      }

      case 'get_reports': {
        const standard = searchParams.get('standard');
        const limit = parseInt(searchParams.get('limit') || '10');

        let query = supabase
          .from('compliance_reports')
          .select('*')
          .order('generated_at', { ascending: false })
          .limit(limit);

        if (standard) {
          query = query.eq('standard', standard);
        }

        const { data: reports, error } = await query;
        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: reports
        });
      }

      case 'get_alerts': {
        const status = searchParams.get('status') || 'open';
        const { data: alerts, error } = await supabase
          .from('compliance_alerts')
          .select('*')
          .eq('status', status)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: alerts
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GET /api/compliance/monitor error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = monitorRequestSchema.parse(body);

    // Extract user ID from authorization header (implement JWT validation)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = 'user123'; // Replace with actual JWT validation

    const monitor = new ComplianceMonitor(supabase);

    switch (validatedData.action) {
      case 'start_monitoring': {
        if (!validatedData.standards?.length) {
          return NextResponse.json(
            { success: false, error: 'Standards required for monitoring' },
            { status: 400 }
          );
        }

        const result = await monitor.startMonitoring(validatedData.standards, userId);
        return NextResponse.json(result);
      }

      case 'check_compliance': {
        const reports = await monitor.checkCompliance(validatedData.rule_ids);
        return NextResponse.json({
          success: true,
          data: reports
        });
      }

      case 'generate_report': {
        const reportType = validatedData.report_type || 'on_demand';
        const reports = await monitor.checkCompliance();
        
        // Store report generation request
        const { error } = await supabase
          .from('compliance_report_requests')
          .insert({
            id: crypto.randomUUID(),
            report_type: reportType,
            requested_by: userId,
            requested_at: new Date().toISOString(),
            status: 'completed'
          });

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: reports,
          message: 'Compliance report generated successfully'
        });
      }

      case 'stop_monitoring': {
        const { error } = await supabase
          .from('compliance_monitoring_sessions')
          .update({
            status: 'stopped',
            stopped_at: new Date().toISOString(),
            stopped_by: userId
          })
          .eq('status', 'active');

        if (error) throw error;

        return NextResponse.json({
          success: true,
          message: 'Compliance monitoring stopped'
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('POST /api/compliance/monitor error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alert_id, status } = body;

    if (!alert_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Alert ID and status required' },
        { status: 400 }
      );
    }

    const updateData: any = { status };
    if (status === '