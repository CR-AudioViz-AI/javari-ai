import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Environment configuration
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const ScanRequestSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['deployment', 'repository', 'container', 'infrastructure']),
  scanTypes: z.array(z.enum(['vulnerability', 'compliance', 'configuration', 'secrets', 'dependencies'])),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  metadata: z.record(z.any()).optional()
});

const RemediationRequestSchema = z.object({
  vulnerabilityId: z.string().min(1),
  context: z.record(z.any()).optional()
});

// Types
interface SecurityScan {
  id: string;
  target_id: string;
  target_type: string;
  scan_types: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: string;
  started_at: string;
  completed_at?: string;
  metadata: Record<string, any>;
}

interface Vulnerability {
  id: string;
  scan_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  title: string;
  description: string;
  affected_component: string;
  cve_ids: string[];
  remediation_status: 'open' | 'in_progress' | 'resolved' | 'false_positive';
  evidence: Record<string, any>;
  detected_at: string;
}

interface ComplianceReport {
  id: string;
  scan_id: string;
  framework: string;
  overall_score: number;
  passed_controls: number;
  failed_controls: number;
  violations: Array<{
    control_id: string;
    severity: string;
    description: string;
    remediation: string;
  }>;
  generated_at: string;
}

// Security Scanning Framework
class SecurityScanEngine {
  async initiateScan(request: z.infer<typeof ScanRequestSchema>): Promise<SecurityScan> {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scan: SecurityScan = {
      id: scanId,
      target_id: request.targetId,
      target_type: request.targetType,
      scan_types: request.scanTypes,
      status: 'pending',
      priority: request.priority,
      started_at: new Date().toISOString(),
      metadata: request.metadata || {}
    };

    const { error } = await supabase
      .from('security_scans')
      .insert(scan);

    if (error) throw new Error(`Failed to create scan: ${error.message}`);

    // Start scan orchestration
    await this.orchestrateScan(scan);
    
    return scan;
  }

  private async orchestrateScan(scan: SecurityScan): Promise<void> {
    try {
      await supabase
        .from('security_scans')
        .update({ status: 'running' })
        .eq('id', scan.id);

      const results = await Promise.allSettled([
        this.runVulnerabilityScans(scan),
        this.runComplianceChecks(scan),
        this.runConfigurationAnalysis(scan)
      ]);

      const hasFailures = results.some(result => result.status === 'rejected');
      
      await supabase
        .from('security_scans')
        .update({ 
          status: hasFailures ? 'failed' : 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', scan.id);

      // Generate reports and alerts
      await this.generateSecurityReport(scan.id);
      await this.processAlerts(scan.id);

    } catch (error) {
      await supabase
        .from('security_scans')
        .update({ 
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', scan.id);
      throw error;
    }
  }

  private async runVulnerabilityScans(scan: SecurityScan): Promise<void> {
    const vulnerabilities: Omit<Vulnerability, 'id'>[] = [];

    if (scan.scan_types.includes('dependencies')) {
      const snykResults = await this.scanWithSnyk(scan.target_id);
      vulnerabilities.push(...snykResults);
    }

    if (scan.scan_types.includes('vulnerability') && scan.target_type === 'container') {
      const trivyResults = await this.scanWithTrivy(scan.target_id);
      vulnerabilities.push(...trivyResults);
    }

    if (scan.scan_types.includes('vulnerability')) {
      const semgrepResults = await this.scanWithSemgrep(scan.target_id);
      vulnerabilities.push(...semgrepResults);
    }

    if (scan.scan_types.includes('secrets')) {
      const secretResults = await this.scanForSecrets(scan.target_id);
      vulnerabilities.push(...secretResults);
    }

    // Store vulnerabilities
    if (vulnerabilities.length > 0) {
      const { error } = await supabase
        .from('vulnerabilities')
        .insert(vulnerabilities.map(vuln => ({
          ...vuln,
          id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })));

      if (error) throw new Error(`Failed to store vulnerabilities: ${error.message}`);
    }
  }

  private async scanWithSnyk(targetId: string): Promise<Omit<Vulnerability, 'id'>[]> {
    try {
      // Mock Snyk API integration
      const mockSnykResults = [
        {
          scan_id: '',
          severity: 'high' as const,
          type: 'dependency',
          title: 'Cross-site Scripting (XSS)',
          description: 'Vulnerable version of lodash package detected',
          affected_component: 'lodash@4.17.15',
          cve_ids: ['CVE-2021-23337'],
          remediation_status: 'open' as const,
          evidence: { package: 'lodash', version: '4.17.15' },
          detected_at: new Date().toISOString()
        }
      ];

      return mockSnykResults;
    } catch (error) {
      console.error('Snyk scan failed:', error);
      return [];
    }
  }

  private async scanWithTrivy(targetId: string): Promise<Omit<Vulnerability, 'id'>[]> {
    try {
      // Mock Trivy container scan
      const mockTrivyResults = [
        {
          scan_id: '',
          severity: 'critical' as const,
          type: 'container',
          title: 'Base image vulnerability',
          description: 'Critical vulnerability in base OS packages',
          affected_component: 'ubuntu:20.04',
          cve_ids: ['CVE-2023-1234'],
          remediation_status: 'open' as const,
          evidence: { layer: 'sha256:abc123', package: 'libc6' },
          detected_at: new Date().toISOString()
        }
      ];

      return mockTrivyResults;
    } catch (error) {
      console.error('Trivy scan failed:', error);
      return [];
    }
  }

  private async scanWithSemgrep(targetId: string): Promise<Omit<Vulnerability, 'id'>[]> {
    try {
      // Mock Semgrep SAST scan
      const mockSemgrepResults = [
        {
          scan_id: '',
          severity: 'medium' as const,
          type: 'code',
          title: 'SQL Injection Risk',
          description: 'Potential SQL injection vulnerability detected',
          affected_component: 'src/api/users.js:42',
          cve_ids: [],
          remediation_status: 'open' as const,
          evidence: { 
            rule: 'javascript.lang.security.audit.sqli',
            line: 42,
            code_snippet: 'query = `SELECT * FROM users WHERE id = ${userId}`'
          },
          detected_at: new Date().toISOString()
        }
      ];

      return mockSemgrepResults;
    } catch (error) {
      console.error('Semgrep scan failed:', error);
      return [];
    }
  }

  private async scanForSecrets(targetId: string): Promise<Omit<Vulnerability, 'id'>[]> {
    try {
      // Mock secret detection
      const mockSecretResults = [
        {
          scan_id: '',
          severity: 'high' as const,
          type: 'secret',
          title: 'Hardcoded API Key',
          description: 'API key found in source code',
          affected_component: 'config/database.js:15',
          cve_ids: [],
          remediation_status: 'open' as const,
          evidence: { 
            secret_type: 'api_key',
            file: 'config/database.js',
            line: 15,
            pattern: 'sk-[a-zA-Z0-9]{32}'
          },
          detected_at: new Date().toISOString()
        }
      ];

      return mockSecretResults;
    } catch (error) {
      console.error('Secret scan failed:', error);
      return [];
    }
  }

  private async runComplianceChecks(scan: SecurityScan): Promise<void> {
    if (!scan.scan_types.includes('compliance')) return;

    try {
      const complianceResults = await this.runCheckovScan(scan.target_id);
      
      const report: Omit<ComplianceReport, 'id'> = {
        scan_id: scan.id,
        framework: 'CIS',
        overall_score: complianceResults.score,
        passed_controls: complianceResults.passed,
        failed_controls: complianceResults.failed,
        violations: complianceResults.violations,
        generated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('compliance_reports')
        .insert({
          ...report,
          id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

      if (error) throw new Error(`Failed to store compliance report: ${error.message}`);
    } catch (error) {
      console.error('Compliance check failed:', error);
    }
  }

  private async runCheckovScan(targetId: string): Promise<{
    score: number;
    passed: number;
    failed: number;
    violations: Array<{
      control_id: string;
      severity: string;
      description: string;
      remediation: string;
    }>;
  }> {
    // Mock Checkov infrastructure scan
    return {
      score: 75,
      passed: 15,
      failed: 5,
      violations: [
        {
          control_id: 'CKV_AWS_20',
          severity: 'medium',
          description: 'S3 bucket should have public access restrictions',
          remediation: 'Enable block public access settings on S3 bucket'
        }
      ]
    };
  }

  private async runConfigurationAnalysis(scan: SecurityScan): Promise<void> {
    if (!scan.scan_types.includes('configuration')) return;

    try {
      // Mock configuration analysis
      const configIssues = [
        {
          type: 'security_group',
          severity: 'high',
          description: 'Security group allows unrestricted inbound traffic',
          resource: 'sg-123456789',
          remediation: 'Restrict inbound rules to specific IP ranges'
        }
      ];

      // Store configuration issues as vulnerabilities
      const vulnerabilities = configIssues.map(issue => ({
        id: `vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scan_id: scan.id,
        severity: issue.severity as 'low' | 'medium' | 'high' | 'critical',
        type: 'configuration',
        title: `Configuration Issue: ${issue.type}`,
        description: issue.description,
        affected_component: issue.resource,
        cve_ids: [],
        remediation_status: 'open' as const,
        evidence: { type: issue.type, remediation: issue.remediation },
        detected_at: new Date().toISOString()
      }));

      if (vulnerabilities.length > 0) {
        const { error } = await supabase
          .from('vulnerabilities')
          .insert(vulnerabilities);

        if (error) throw new Error(`Failed to store configuration issues: ${error.message}`);
      }
    } catch (error) {
      console.error('Configuration analysis failed:', error);
    }
  }

  private async generateSecurityReport(scanId: string): Promise<void> {
    const { data: vulnerabilities } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('scan_id', scanId);

    const { data: complianceReports } = await supabase
      .from('compliance_reports')
      .select('*')
      .eq('scan_id', scanId);

    const summary = {
      total_vulnerabilities: vulnerabilities?.length || 0,
      critical_count: vulnerabilities?.filter(v => v.severity === 'critical').length || 0,
      high_count: vulnerabilities?.filter(v => v.severity === 'high').length || 0,
      compliance_score: complianceReports?.[0]?.overall_score || 0,
      report_generated_at: new Date().toISOString()
    };

    // Store report summary in scan metadata
    await supabase
      .from('security_scans')
      .update({ 
        metadata: { 
          ...((await supabase.from('security_scans').select('metadata').eq('id', scanId).single()).data?.metadata || {}),
          report_summary: summary
        }
      })
      .eq('id', scanId);
  }

  private async processAlerts(scanId: string): Promise<void> {
    const { data: vulnerabilities } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('scan_id', scanId)
      .in('severity', ['critical', 'high']);

    if (vulnerabilities && vulnerabilities.length > 0) {
      // Mock alert processing
      const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
      const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

      console.log(`SECURITY ALERT: Scan ${scanId} found ${criticalCount} critical and ${highCount} high severity vulnerabilities`);
      
      // In a real implementation, this would integrate with notification services
    }
  }

  async getRemediationSuggestions(vulnerabilityId: string, context?: Record<string, any>): Promise<{
    suggestions: Array<{
      type: 'automated' | 'manual';
      priority: number;
      description: string;
      steps: string[];
      estimated_effort: string;
      risk_reduction: number;
    }>;
  }> {
    const { data: vulnerability } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('id', vulnerabilityId)
      .single();

    if (!vulnerability) {
      throw new Error('Vulnerability not found');
    }

    // Mock AI-powered remediation suggestions
    const suggestions = [
      {
        type: 'automated' as const,
        priority: 1,
        description: 'Update vulnerable dependency to latest secure version',
        steps: [
          'Run dependency update command',
          'Test application functionality',
          'Deploy updated version'
        ],
        estimated_effort: '30 minutes',
        risk_reduction: 95
      },
      {
        type: 'manual' as const,
        priority: 2,
        description: 'Implement input validation and parameterized queries',
        steps: [
          'Review affected code sections',
          'Implement proper input sanitization',
          'Replace string concatenation with parameterized queries',
          'Add security unit tests'
        ],
        estimated_effort: '2-4 hours',
        risk_reduction: 90
      }
    ];

    return { suggestions };
  }

  async getScanStatus(scanId: string): Promise<SecurityScan | null> {
    const { data } = await supabase
      .from('security_scans')
      .select('*')
      .eq('id', scanId)
      .single();

    return data || null;
  }

  async getVulnerabilities(scanId: string): Promise<Vulnerability[]> {
    const { data } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('scan_id', scanId)
      .order('severity', { ascending: false });

    return data || [];
  }

  async getComplianceReport(scanId: string): Promise<ComplianceReport | null> {
    const { data } = await supabase
      .from('compliance_reports')
      .select('*')
      .eq('scan_id', scanId)
      .single();

    return data || null;
  }
}

// Initialize service
const securityScanner = new SecurityScanEngine();

// API Routes
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Health check
    if (pathname.endsWith('/health')) {
      return NextResponse.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'security-scanner'
      });
    }

    // Get scan status
    if (pathname.includes('/scans/')) {
      const scanId = pathname.split('/scans/')[1].split('/')[0];
      
      if (pathname.endsWith('/status')) {
        const scan = await securityScanner.getScanStatus(scanId);
        if (!scan) {
          return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
        }
        return NextResponse.json(scan);
      }

      if (pathname.endsWith('/vulnerabilities')) {
        const vulnerabilities = await securityScanner.getVulnerabilities(scanId);
        return NextResponse.json({ vulnerabilities });
      }

      if (pathname.endsWith('/compliance')) {
        const report = await securityScanner.getComplianceReport(scanId);
        if (!report) {
          return NextResponse.json({ error: 'Compliance report not found' }, { status: 404 });
        }
        return NextResponse.json(report);
      }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  } catch (error) {
    console.error('Security scanner GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Initiate security scan
    if (pathname.endsWith('/scan')) {
      const body = await request.json();
      const validatedRequest = ScanRequestSchema.parse(body);
      
      const scan = await securityScanner.initiateScan(validatedRequest);
      return NextResponse.json(scan, { status: 201 });
    }

    // Get remediation suggestions
    if (pathname.endsWith('/remediation')) {
      const body = await request.json();
      const validatedRequest = RemediationRequestSchema.parse(body);
      
      const suggestions = await securityScanner.getRemediationSuggestions(
        validatedRequest.vulnerabilityId,
        validatedRequest.context
      );
      
      return NextResponse.json(suggestions);
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  } catch (error) {
    console.error('Security scanner POST error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}