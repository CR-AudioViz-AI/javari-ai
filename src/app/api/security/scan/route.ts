import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Validation schemas
const ScanConfigSchema = z.object({
  scanType: z.enum(['full', 'dependencies', 'vulnerabilities', 'compliance']),
  target: z.object({
    type: z.enum(['repository', 'package', 'container', 'application']),
    path: z.string().min(1),
    branch: z.string().optional(),
    excludePatterns: z.array(z.string()).optional()
  }),
  options: z.object({
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    includeDevDependencies: z.boolean().optional(),
    enableAutoRemediation: z.boolean().optional(),
    complianceStandards: z.array(z.enum(['OWASP', 'SOC2', 'PCI-DSS', 'GDPR'])).optional()
  }).optional()
});

const ScanFilterSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  scanType: z.enum(['full', 'dependencies', 'vulnerabilities', 'compliance']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).optional()
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Security scanning interfaces
interface VulnerabilityData {
  cve: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedVersions: string[];
  fixedVersion?: string;
  references: string[];
  publishedDate: string;
  lastModified: string;
}

interface DependencyData {
  name: string;
  version: string;
  type: 'direct' | 'transitive';
  vulnerabilities: VulnerabilityData[];
  outdated: boolean;
  latestVersion?: string;
  license: string;
}

interface ScanResult {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scanType: string;
  target: any;
  vulnerabilities: VulnerabilityData[];
  dependencies: DependencyData[];
  complianceScore: number;
  remediationSuggestions: RemediationSuggestion[];
  summary: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    highVulnerabilities: number;
    mediumVulnerabilities: number;
    lowVulnerabilities: number;
    totalDependencies: number;
    outdatedDependencies: number;
  };
  createdAt: string;
  completedAt?: string;
  error?: string;
}

interface RemediationSuggestion {
  type: 'update' | 'patch' | 'configuration' | 'policy';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  commands?: string[];
  automated: boolean;
  estimatedEffort: 'low' | 'medium' | 'high';
}

class SecurityScanner {
  private static readonly CVE_API_URL = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
  private static readonly NPM_AUDIT_API = 'https://registry.npmjs.org/-/npm/v1/security/audits';
  
  static async scanDependencies(targetPath: string, includeDevDeps = false): Promise<DependencyData[]> {
    try {
      // Check if package.json exists
      const packageJsonPath = path.join(targetPath, 'package.json');
      await fs.access(packageJsonPath);

      // Run npm audit
      const auditCommand = `cd "${targetPath}" && npm audit --json ${includeDevDeps ? '--audit-level=info' : '--only=prod'}`;
      const { stdout } = await execAsync(auditCommand).catch(() => ({ stdout: '{}' }));
      
      const auditResult = JSON.parse(stdout || '{}');
      
      // Run npm ls to get dependency tree
      const lsCommand = `cd "${targetPath}" && npm ls --json --all ${!includeDevDeps ? '--only=prod' : ''}`;
      const { stdout: lsOutput } = await execAsync(lsCommand).catch(() => ({ stdout: '{}' }));
      const dependencyTree = JSON.parse(lsOutput || '{}');

      return this.processDependencyData(auditResult, dependencyTree);
    } catch (error) {
      console.error('Dependency scan failed:', error);
      return [];
    }
  }

  private static processDependencyData(auditResult: any, dependencyTree: any): DependencyData[] {
    const dependencies: DependencyData[] = [];
    
    if (dependencyTree.dependencies) {
      this.traverseDependencies(dependencyTree.dependencies, dependencies, 'direct', auditResult);
    }

    return dependencies;
  }

  private static traverseDependencies(
    deps: any, 
    result: DependencyData[], 
    type: 'direct' | 'transitive',
    auditResult: any
  ): void {
    Object.entries(deps).forEach(([name, info]: [string, any]) => {
      const vulnerabilities = this.getVulnerabilitiesForPackage(name, info.version, auditResult);
      
      result.push({
        name,
        version: info.version || 'unknown',
        type,
        vulnerabilities,
        outdated: info.outdated || false,
        latestVersion: info.wanted,
        license: info.license || 'unknown'
      });

      if (info.dependencies) {
        this.traverseDependencies(info.dependencies, result, 'transitive', auditResult);
      }
    });
  }

  private static getVulnerabilitiesForPackage(
    name: string, 
    version: string, 
    auditResult: any
  ): VulnerabilityData[] {
    const vulnerabilities: VulnerabilityData[] = [];
    
    if (auditResult.advisories) {
      Object.values(auditResult.advisories).forEach((advisory: any) => {
        if (advisory.module_name === name) {
          vulnerabilities.push({
            cve: advisory.cves?.[0] || `NPM-${advisory.id}`,
            severity: advisory.severity as any,
            description: advisory.title,
            affectedVersions: advisory.vulnerable_versions ? [advisory.vulnerable_versions] : [],
            fixedVersion: advisory.patched_versions,
            references: advisory.references ? [advisory.references] : [],
            publishedDate: advisory.created,
            lastModified: advisory.updated
          });
        }
      });
    }

    return vulnerabilities;
  }

  static async scanVulnerabilities(targetPath: string): Promise<VulnerabilityData[]> {
    try {
      // Static code analysis using semgrep-like patterns
      const vulnerabilities: VulnerabilityData[] = [];
      
      // Scan for common vulnerability patterns
      const files = await this.getSourceFiles(targetPath);
      
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const fileVulns = await this.analyzeFileForVulnerabilities(file, content);
        vulnerabilities.push(...fileVulns);
      }

      return vulnerabilities;
    } catch (error) {
      console.error('Vulnerability scan failed:', error);
      return [];
    }
  }

  private static async getSourceFiles(targetPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.php'];
    
    async function traverse(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
    
    await traverse(targetPath);
    return files;
  }

  private static async analyzeFileForVulnerabilities(
    filePath: string, 
    content: string
  ): Promise<VulnerabilityData[]> {
    const vulnerabilities: VulnerabilityData[] = [];
    
    // SQL Injection patterns
    const sqlInjectionPattern = /(query|execute|exec)\s*\(\s*[`"'].*\$\{.*\}.*[`"']/gi;
    if (sqlInjectionPattern.test(content)) {
      vulnerabilities.push({
        cve: 'CWE-89',
        severity: 'high',
        description: `Potential SQL injection vulnerability in ${path.basename(filePath)}`,
        affectedVersions: ['current'],
        references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
        publishedDate: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
    }

    // XSS patterns
    const xssPattern = /innerHTML\s*=\s*.*\+|document\.write\s*\(.*\+/gi;
    if (xssPattern.test(content)) {
      vulnerabilities.push({
        cve: 'CWE-79',
        severity: 'medium',
        description: `Potential XSS vulnerability in ${path.basename(filePath)}`,
        affectedVersions: ['current'],
        references: ['https://owasp.org/www-community/attacks/xss/'],
        publishedDate: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
    }

    // Hardcoded secrets
    const secretPattern = /(password|secret|key|token)\s*[:=]\s*[`"'][^`"']{8,}[`"']/gi;
    if (secretPattern.test(content)) {
      vulnerabilities.push({
        cve: 'CWE-798',
        severity: 'critical',
        description: `Hardcoded credentials detected in ${path.basename(filePath)}`,
        affectedVersions: ['current'],
        references: ['https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password'],
        publishedDate: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
    }

    return vulnerabilities;
  }

  static async generateRemediationSuggestions(
    vulnerabilities: VulnerabilityData[],
    dependencies: DependencyData[]
  ): Promise<RemediationSuggestion[]> {
    const suggestions: RemediationSuggestion[] = [];

    // Dependency update suggestions
    const outdatedDeps = dependencies.filter(dep => dep.outdated);
    if (outdatedDeps.length > 0) {
      suggestions.push({
        type: 'update',
        priority: 'medium',
        title: 'Update outdated dependencies',
        description: `${outdatedDeps.length} dependencies are outdated and may contain security vulnerabilities`,
        commands: ['npm update', 'npm audit fix'],
        automated: true,
        estimatedEffort: 'low'
      });
    }

    // Critical vulnerability patches
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      suggestions.push({
        type: 'patch',
        priority: 'critical',
        title: 'Patch critical vulnerabilities',
        description: `${criticalVulns.length} critical vulnerabilities require immediate attention`,
        commands: ['npm audit fix --force'],
        automated: false,
        estimatedEffort: 'high'
      });
    }

    // Security policy suggestions
    if (vulnerabilities.some(v => v.cve === 'CWE-798')) {
      suggestions.push({
        type: 'configuration',
        priority: 'high',
        title: 'Implement secrets management',
        description: 'Hardcoded credentials detected. Use environment variables or secret management tools.',
        automated: false,
        estimatedEffort: 'medium'
      });
    }

    return suggestions;
  }

  static calculateComplianceScore(
    vulnerabilities: VulnerabilityData[],
    dependencies: DependencyData[]
  ): number {
    let score = 100;
    
    // Deduct points for vulnerabilities
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 8; break;
        case 'low': score -= 3; break;
      }
    });

    // Deduct points for outdated dependencies
    const outdatedCount = dependencies.filter(d => d.outdated).length;
    score -= Math.min(outdatedCount * 2, 30);

    return Math.max(score, 0);
  }
}

// POST - Initiate security scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = ScanConfigSchema.parse(body);

    // Generate scan ID
    const scanId = crypto.randomUUID();

    // Create scan record
    const { error: insertError } = await supabase
      .from('security_scans')
      .insert({
        id: scanId,
        status: 'pending',
        scan_type: config.scanType,
        target: config.target,
        options: config.options,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    // Start async scan process
    processScanAsync(scanId, config).catch(error => {
      console.error(`Scan ${scanId} failed:`, error);
      
      // Update scan status to failed
      supabase
        .from('security_scans')
        .update({ 
          status: 'failed', 
          error: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', scanId)
        .then();
    });

    return NextResponse.json({
      scanId,
      status: 'pending',
      message: 'Security scan initiated successfully'
    });

  } catch (error) {
    console.error('Security scan initiation failed:', error);
    
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

// GET - Retrieve scan results or scan history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('scanId');

    if (scanId) {
      // Get specific scan result
      const { data, error } = await supabase
        .from('security_scans')
        .select('*')
        .eq('id', scanId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Scan not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    } else {
      // Get scan history
      const filters = ScanFilterSchema.parse(Object.fromEntries(searchParams));
      
      let query = supabase
        .from('security_scans')
        .select('*')
        .range(filters.offset, filters.offset + filters.limit - 1)
        .order('created_at', { ascending: false });

      if (filters.scanType) {
        query = query.eq('scan_type', filters.scanType);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return NextResponse.json({
        scans: data || [],
        total: count || 0,
        limit: filters.limit,
        offset: filters.offset
      });
    }

  } catch (error) {
    console.error('Failed to retrieve scan data:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processScanAsync(scanId: string, config: any) {
  try {
    // Update status to running
    await supabase
      .from('security_scans')
      .update({ status: 'running' })
      .eq('id', scanId);

    const targetPath = config.target.path;
    let vulnerabilities: VulnerabilityData[] = [];
    let dependencies: DependencyData[] = [];

    // Perform scans based on type
    switch (config.scanType) {
      case 'full':
        [vulnerabilities, dependencies] = await Promise.all([
          SecurityScanner.scanVulnerabilities(targetPath),
          SecurityScanner.scanDependencies(targetPath, config.options?.includeDevDependencies)
        ]);
        break;
      case 'vulnerabilities':
        vulnerabilities = await SecurityScanner.scanVulnerabilities(targetPath);
        break;
      case 'dependencies':
        dependencies = await SecurityScanner.scanDependencies(targetPath, config.options?.includeDevDependencies);
        break;
      case 'compliance':
        [vulnerabilities, dependencies] = await Promise.all([
          SecurityScanner.scanVulnerabilities(targetPath),
          SecurityScanner.scanDependencies(targetPath)
        ]);
        break;
    }

    // Generate remediation suggestions
    const remediationSuggestions = await SecurityScanner.generateRemediationSuggestions(
      vulnerabilities,
      dependencies
    );

    // Calculate compliance score
    const complianceScore = SecurityScanner.calculateComplianceScore(
      vulnerabilities,
      dependencies
    );

    // Create summary
    const summary = {
      totalVulnerabilities: vulnerabilities.length,
      criticalVulnerabilities: vulnerabilities.filter(v => v.severity === 'critical').length,
      highVulnerabilities: vulnerabilities.filter(v => v.severity === 'high').length,
      mediumVulnerabilities: vulnerabilities.filter(v => v.severity === 'medium').length,
      lowVulnerabilities: vulnerabilities.filter(v => v.severity === 'low').length,
      totalDependencies: dependencies.length,
      outdatedDependencies: dependencies.filter(d => d.outdated).length
    };

    // Update scan with results
    await supabase
      .from('security_scans')
      .update({
        status: 'completed',
        vulnerabilities,
        dependencies,
        compliance_score: complianceScore,
        remediation_suggestions: remediationSuggestions,
        summary,
        completed_at: new Date().toISOString()
      })
      .eq('id', scanId);

  } catch (error) {
    console.error(`Scan processing failed for ${scanId}:`, error);
    throw error;
  }
}