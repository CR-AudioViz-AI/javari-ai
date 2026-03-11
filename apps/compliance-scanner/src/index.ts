```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Environment validation
const envSchema = z.object({
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  KUBERNETES_API_TOKEN: z.string().optional(),
});

const env = envSchema.parse(process.env);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

// Types
interface ComplianceViolation {
  id: string;
  type: 'SOC2' | 'ISO27001' | 'GDPR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  rule: string;
  description: string;
  file_path?: string;
  line_number?: number;
  resource_name?: string;
  remediation: string;
  created_at: Date;
}

interface ScanResult {
  scan_id: string;
  target_type: 'code' | 'config' | 'deployment';
  target_identifier: string;
  violations: ComplianceViolation[];
  scan_duration_ms: number;
  scanned_at: Date;
}

// Compliance Rules Engine
class ComplianceRulesEngine {
  private soc2Rules = [
    {
      id: 'SOC2-CC6.1',
      pattern: /password\s*=\s*['"][^'"]*['"]/gi,
      description: 'Hardcoded password detected in code',
      severity: 'CRITICAL' as const,
      remediation: 'Use environment variables or secure vault for passwords'
    },
    {
      id: 'SOC2-CC6.2',
      pattern: /api[_-]?key\s*=\s*['"][^'"]*['"]/gi,
      description: 'Hardcoded API key detected in code',
      severity: 'HIGH' as const,
      remediation: 'Store API keys in secure environment variables'
    },
    {
      id: 'SOC2-CC6.3',
      pattern: /console\.log\(/gi,
      description: 'Console logging may expose sensitive data',
      severity: 'MEDIUM' as const,
      remediation: 'Use structured logging with proper filtering'
    }
  ];

  private iso27001Rules = [
    {
      id: 'ISO27001-A.8.2.3',
      pattern: /SELECT \* FROM/gi,
      description: 'Unrestricted database query detected',
      severity: 'MEDIUM' as const,
      remediation: 'Use specific column selection and proper access controls'
    },
    {
      id: 'ISO27001-A.9.4.2',
      pattern: /cors:\s*{\s*origin:\s*['"]?\*['"]?/gi,
      description: 'Overly permissive CORS configuration',
      severity: 'HIGH' as const,
      remediation: 'Restrict CORS to specific trusted origins'
    }
  ];

  private gdprRules = [
    {
      id: 'GDPR-Art.32',
      pattern: /http:\/\/(?!localhost)/gi,
      description: 'Unencrypted HTTP connection detected',
      severity: 'HIGH' as const,
      remediation: 'Use HTTPS for all external communications'
    },
    {
      id: 'GDPR-Art.25',
      pattern: /email|phone|ssn|credit_card/gi,
      description: 'Potential PII handling without encryption',
      severity: 'HIGH' as const,
      remediation: 'Implement encryption for PII data processing'
    }
  ];

  scanCode(content: string, filePath: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];
    const allRules = [...this.soc2Rules, ...this.iso27001Rules, ...this.gdprRules];

    allRules.forEach(rule => {
      const matches = [...content.matchAll(rule.pattern)];
      matches.forEach(match => {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        violations.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: rule.id.startsWith('SOC2') ? 'SOC2' : 
                rule.id.startsWith('ISO27001') ? 'ISO27001' : 'GDPR',
          severity: rule.severity,
          rule: rule.id,
          description: rule.description,
          file_path: filePath,
          line_number: lineNumber,
          remediation: rule.remediation,
          created_at: new Date()
        });
      });
    });

    return violations;
  }

  scanConfiguration(config: Record<string, any>, configName: string): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for insecure configurations
    if (config.security?.allowInsecure || config.ssl === false) {
      violations.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ISO27001',
        severity: 'HIGH',
        rule: 'ISO27001-A.13.1.1',
        description: 'Insecure configuration detected',
        resource_name: configName,
        remediation: 'Enable SSL/TLS and secure configuration options',
        created_at: new Date()
      });
    }

    // Check for overly permissive access
    if (config.permissions?.includes('*') || config.allowAll === true) {
      violations.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'SOC2',
        severity: 'CRITICAL',
        rule: 'SOC2-CC6.1',
        description: 'Overly permissive access configuration',
        resource_name: configName,
        remediation: 'Implement principle of least privilege',
        created_at: new Date()
      });
    }

    return violations;
  }

  scanDeployment(deployment: any): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for security contexts
    if (!deployment.spec?.template?.spec?.securityContext) {
      violations.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ISO27001',
        severity: 'HIGH',
        rule: 'ISO27001-A.12.6.1',
        description: 'Missing security context in deployment',
        resource_name: deployment.metadata?.name || 'unknown',
        remediation: 'Add appropriate security context with non-root user',
        created_at: new Date()
      });
    }

    // Check for resource limits
    const containers = deployment.spec?.template?.spec?.containers || [];
    containers.forEach((container: any, index: number) => {
      if (!container.resources?.limits) {
        violations.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'SOC2',
          severity: 'MEDIUM',
          rule: 'SOC2-CC7.1',
          description: `Container ${index} missing resource limits`,
          resource_name: `${deployment.metadata?.name}/container-${index}`,
          remediation: 'Set CPU and memory limits for all containers',
          created_at: new Date()
        });
      }
    });

    return violations;
  }
}

// Violation Reporter
class ViolationReporter {
  async storeViolations(violations: ComplianceViolation[], scanResult: Omit<ScanResult, 'violations'>): Promise<void> {
    try {
      // Store scan result
      const { error: scanError } = await supabase
        .from('compliance_scans')
        .insert({
          scan_id: scanResult.scan_id,
          target_type: scanResult.target_type,
          target_identifier: scanResult.target_identifier,
          scan_duration_ms: scanResult.scan_duration_ms,
          violation_count: violations.length,
          scanned_at: scanResult.scanned_at.toISOString()
        });

      if (scanError) throw scanError;

      // Store violations
      if (violations.length > 0) {
        const { error: violationError } = await supabase
          .from('compliance_violations')
          .insert(violations.map(v => ({
            ...v,
            scan_id: scanResult.scan_id,
            created_at: v.created_at.toISOString()
          })));

        if (violationError) throw violationError;
      }
    } catch (error) {
      console.error('Failed to store violations:', error);
      throw new Error('Database storage failed');
    }
  }

  async sendAlert(violations: ComplianceViolation[]): Promise<void> {
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length === 0) return;

    const alertMessage = {
      text: `🚨 Critical Compliance Violations Detected`,
      attachments: [{
        color: 'danger',
        fields: criticalViolations.map(v => ({
          title: `${v.type} - ${v.rule}`,
          value: v.description,
          short: false
        }))
      }]
    };

    if (env.SLACK_WEBHOOK_URL) {
      try {
        await axios.post(env.SLACK_WEBHOOK_URL, alertMessage);
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }
  }
}

// Main Compliance Scanner
class ComplianceScanner {
  private rulesEngine = new ComplianceRulesEngine();
  private reporter = new ViolationReporter();

  async scanCode(code: string, filePath: string): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const violations = this.rulesEngine.scanCode(code, filePath);
    
    const result: ScanResult = {
      scan_id: scanId,
      target_type: 'code',
      target_identifier: filePath,
      violations,
      scan_duration_ms: Date.now() - startTime,
      scanned_at: new Date()
    };

    await this.reporter.storeViolations(violations, result);
    await this.reporter.sendAlert(violations);

    return result;
  }

  async scanConfiguration(config: Record<string, any>, configName: string): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = `config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const violations = this.rulesEngine.scanConfiguration(config, configName);
    
    const result: ScanResult = {
      scan_id: scanId,
      target_type: 'config',
      target_identifier: configName,
      violations,
      scan_duration_ms: Date.now() - startTime,
      scanned_at: new Date()
    };

    await this.reporter.storeViolations(violations, result);
    await this.reporter.sendAlert(violations);

    return result;
  }

  async scanDeployment(deployment: any): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const violations = this.rulesEngine.scanDeployment(deployment);
    
    const result: ScanResult = {
      scan_id: scanId,
      target_type: 'deployment',
      target_identifier: deployment.metadata?.name || 'unknown',
      violations,
      scan_duration_ms: Date.now() - startTime,
      scanned_at: new Date()
    };

    await this.reporter.storeViolations(violations, result);
    await this.reporter.sendAlert(violations);

    return result;
  }

  async getViolations(filters?: {
    type?: string;
    severity?: string;
    limit?: number;
  }): Promise<ComplianceViolation[]> {
    let query = supabase.from('compliance_violations').select('*');
    
    if (filters?.type) query = query.eq('type', filters.type);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    
    query = query.order('created_at', { ascending: false });
    
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch violations: ${error.message}`);
    
    return data || [];
  }
}

// Request/Response schemas
const scanCodeSchema = z.object({
  code: z.string(),
  filePath: z.string()
});

const scanConfigSchema = z.object({
  config: z.record(z.any()),
  configName: z.string()
});

const scanDeploymentSchema = z.object({
  deployment: z.record(z.any())
});

const getViolationsSchema = z.object({
  type: z.enum(['SOC2', 'ISO27001', 'GDPR']).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.number().min(1).max(1000).optional()
});

// API Route Handler
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    
    // Health check
    if (url.pathname.endsWith('/health')) {
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }

    // Get violations
    if (url.pathname.endsWith('/violations')) {
      const searchParams = Object.fromEntries(url.searchParams.entries());
      const filters = getViolationsSchema.parse(searchParams);
      
      const scanner = new ComplianceScanner();
      const violations = await scanner.getViolations(filters);
      
      return NextResponse.json({
        success: true,
        data: violations,
        count: violations.length
      });
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('GET request failed:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json();
    const scanner = new ComplianceScanner();

    // Scan code
    if (url.pathname.endsWith('/scan/code')) {
      const { code, filePath } = scanCodeSchema.parse(body);
      const result = await scanner.scanCode(code, filePath);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // Scan configuration
    if (url.pathname.endsWith('/scan/config')) {
      const { config, configName } = scanConfigSchema.parse(body);
      const result = await scanner.scanConfiguration(config, configName);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // Scan deployment
    if (url.pathname.endsWith('/scan/deployment')) {
      const { deployment } = scanDeploymentSchema.parse(body);
      const result = await scanner.scanDeployment(deployment);
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // GitHub webhook handler
    if (url.pathname.endsWith('/webhook/github')) {
      // Simplified webhook handling - in production, verify signature
      const { commits, repository } = body;
      
      if (!commits || !repository) {
        return NextResponse.json(
          { error: 'Invalid webhook payload' },
          { status: 400 }
        );
      }

      // Scan recent commits (simplified)
      const results = [];
      for (const commit of commits.slice(0, 5)) {
        // In a real implementation, fetch file contents from GitHub API
        const mockCode = `// Mock code for ${commit.id}`;
        const result = await scanner.scanCode(mockCode, commit.id);
        results.push(result);
      }
      
      return NextResponse.json({
        success: true,
        message: `Scanned ${results.length} commits`,
        data: results
      });
    }

    return NextResponse.json(
      { error: 'Endpoint not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('POST request failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```