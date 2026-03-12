import { supabase } from '@/lib/supabase';
import { EventEmitter } from 'events';

/**
 * Data sensitivity levels for classification
 */
export enum DataSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  HIGHLY_RESTRICTED = 'highly_restricted'
}

/**
 * Compliance regulation types
 */
export enum ComplianceRegulation {
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  SOX = 'sox',
  PCI_DSS = 'pci_dss',
  CCPA = 'ccpa',
  SOC2 = 'soc2'
}

/**
 * Data classification result
 */
export interface DataClassificationResult {
  id: string;
  data: Record<string, unknown>;
  sensitivity: DataSensitivity;
  regulations: ComplianceRegulation[];
  classificationRules: string[];
  confidence: number;
  timestamp: Date;
}

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  id: string;
  name: string;
  dataType: string;
  retentionPeriod: number; // in days
  archiveAfter?: number; // in days
  deleteAfter: number; // in days
  regulations: ComplianceRegulation[];
  exceptions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  id: string;
  userId?: string;
  sessionId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  outcome: 'success' | 'failure' | 'warning';
  compliance: {
    regulations: ComplianceRegulation[];
    sensitive: boolean;
    classification: DataSensitivity;
  };
}

/**
 * Compliance violation
 */
export interface ComplianceViolation {
  id: string;
  type: 'data_breach' | 'unauthorized_access' | 'retention_violation' | 'consent_violation' | 'encryption_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  regulation: ComplianceRegulation;
  description: string;
  affectedData: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  remediation?: string;
}

/**
 * Consent record
 */
export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  dataTypes: string[];
  granted: boolean;
  grantedAt: Date;
  revokedAt?: Date;
  expiresAt?: Date;
  legalBasis: string;
  version: string;
}

/**
 * Data classification engine using pattern matching and ML
 */
export class DataClassifier {
  private classificationRules: Map<string, {
    pattern: RegExp;
    sensitivity: DataSensitivity;
    regulations: ComplianceRegulation[];
  }> = new Map();

  constructor() {
    this.initializeClassificationRules();
  }

  /**
   * Initialize built-in classification rules
   */
  private initializeClassificationRules(): void {
    // PII patterns
    this.addRule('ssn', /\b\d{3}-?\d{2}-?\d{4}\b/, DataSensitivity.HIGHLY_RESTRICTED, [ComplianceRegulation.GDPR, ComplianceRegulation.HIPAA]);
    this.addRule('email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, DataSensitivity.CONFIDENTIAL, [ComplianceRegulation.GDPR, ComplianceRegulation.CCPA]);
    this.addRule('credit_card', /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, DataSensitivity.HIGHLY_RESTRICTED, [ComplianceRegulation.PCI_DSS]);
    this.addRule('phone', /\b\d{3}[-.]\d{3}[-.]\d{4}\b/, DataSensitivity.CONFIDENTIAL, [ComplianceRegulation.GDPR]);
    this.addRule('ip_address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/, DataSensitivity.INTERNAL, [ComplianceRegulation.GDPR]);
    
    // Health information
    this.addRule('medical_record', /\b(?:MRN|medical record|patient id)\b/i, DataSensitivity.HIGHLY_RESTRICTED, [ComplianceRegulation.HIPAA]);
    
    // Financial data
    this.addRule('financial_account', /\b(?:account|routing)\s*(?:number|#)\b/i, DataSensitivity.HIGHLY_RESTRICTED, [ComplianceRegulation.SOX, ComplianceRegulation.PCI_DSS]);
  }

  /**
   * Add custom classification rule
   */
  public addRule(name: string, pattern: RegExp, sensitivity: DataSensitivity, regulations: ComplianceRegulation[]): void {
    this.classificationRules.set(name, { pattern, sensitivity, regulations });
  }

  /**
   * Classify data based on content analysis
   */
  public async classifyData(data: Record<string, unknown>): Promise<DataClassificationResult> {
    const id = crypto.randomUUID();
    const dataString = JSON.stringify(data);
    const matchedRules: string[] = [];
    let highestSensitivity = DataSensitivity.PUBLIC;
    const applicableRegulations = new Set<ComplianceRegulation>();
    let totalConfidence = 0;

    for (const [ruleName, rule] of this.classificationRules) {
      if (rule.pattern.test(dataString)) {
        matchedRules.push(ruleName);
        
        // Use highest sensitivity level found
        if (this.getSensitivityLevel(rule.sensitivity) > this.getSensitivityLevel(highestSensitivity)) {
          highestSensitivity = rule.sensitivity;
        }
        
        // Add applicable regulations
        rule.regulations.forEach(reg => applicableRegulations.add(reg));
        totalConfidence += 0.8; // Base confidence per matched rule
      }
    }

    // Calculate confidence score
    const confidence = Math.min(totalConfidence / matchedRules.length || 0.1, 1.0);

    const result: DataClassificationResult = {
      id,
      data,
      sensitivity: highestSensitivity,
      regulations: Array.from(applicableRegulations),
      classificationRules: matchedRules,
      confidence,
      timestamp: new Date()
    };

    // Store classification result
    await this.storeClassificationResult(result);

    return result;
  }

  /**
   * Get numeric level for sensitivity comparison
   */
  private getSensitivityLevel(sensitivity: DataSensitivity): number {
    const levels = {
      [DataSensitivity.PUBLIC]: 0,
      [DataSensitivity.INTERNAL]: 1,
      [DataSensitivity.CONFIDENTIAL]: 2,
      [DataSensitivity.RESTRICTED]: 3,
      [DataSensitivity.HIGHLY_RESTRICTED]: 4
    };
    return levels[sensitivity];
  }

  /**
   * Store classification result in database
   */
  private async storeClassificationResult(result: DataClassificationResult): Promise<void> {
    try {
      await supabase.from('data_classifications').insert({
        id: result.id,
        data_hash: await this.hashData(result.data),
        sensitivity: result.sensitivity,
        regulations: result.regulations,
        classification_rules: result.classificationRules,
        confidence: result.confidence,
        timestamp: result.timestamp.toISOString()
      });
    } catch (error) {
      console.error('Failed to store classification result:', error);
      throw new Error('Classification storage failed');
    }
  }

  /**
   * Generate hash of data for storage
   */
  private async hashData(data: Record<string, unknown>): Promise<string> {
    const encoder = new TextEncoder();
    const dataString = JSON.stringify(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(dataString));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Retention policy management system
 */
export class RetentionPolicyManager {
  private policies: Map<string, RetentionPolicy> = new Map();

  /**
   * Create new retention policy
   */
  public async createPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<RetentionPolicy> {
    const newPolicy: RetentionPolicy = {
      ...policy,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      await supabase.from('retention_policies').insert({
        id: newPolicy.id,
        name: newPolicy.name,
        data_type: newPolicy.dataType,
        retention_period: newPolicy.retentionPeriod,
        archive_after: newPolicy.archiveAfter,
        delete_after: newPolicy.deleteAfter,
        regulations: newPolicy.regulations,
        exceptions: newPolicy.exceptions,
        created_at: newPolicy.createdAt.toISOString(),
        updated_at: newPolicy.updatedAt.toISOString()
      });

      this.policies.set(newPolicy.id, newPolicy);
      return newPolicy;
    } catch (error) {
      console.error('Failed to create retention policy:', error);
      throw new Error('Retention policy creation failed');
    }
  }

  /**
   * Get applicable retention policy for data type
   */
  public async getPolicyForDataType(dataType: string): Promise<RetentionPolicy | null> {
    // First check cache
    for (const policy of this.policies.values()) {
      if (policy.dataType === dataType) {
        return policy;
      }
    }

    // Query database
    try {
      const { data, error } = await supabase
        .from('retention_policies')
        .select('*')
        .eq('data_type', dataType)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }

      const policy: RetentionPolicy = {
        id: data.id,
        name: data.name,
        dataType: data.data_type,
        retentionPeriod: data.retention_period,
        archiveAfter: data.archive_after,
        deleteAfter: data.delete_after,
        regulations: data.regulations,
        exceptions: data.exceptions,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      this.policies.set(policy.id, policy);
      return policy;
    } catch (error) {
      console.error('Failed to retrieve retention policy:', error);
      return null;
    }
  }

  /**
   * Execute retention policy actions
   */
  public async executeRetentionActions(): Promise<void> {
    const now = new Date();

    for (const policy of this.policies.values()) {
      try {
        // Archive old data
        if (policy.archiveAfter) {
          const archiveDate = new Date(now.getTime() - policy.archiveAfter * 24 * 60 * 60 * 1000);
          await this.archiveData(policy.dataType, archiveDate);
        }

        // Delete expired data
        const deleteDate = new Date(now.getTime() - policy.deleteAfter * 24 * 60 * 60 * 1000);
        await this.deleteData(policy.dataType, deleteDate);
      } catch (error) {
        console.error(`Failed to execute retention policy ${policy.id}:`, error);
      }
    }
  }

  /**
   * Archive data based on retention policy
   */
  private async archiveData(dataType: string, archiveDate: Date): Promise<void> {
    await supabase.rpc('archive_data_by_type_and_date', {
      data_type: dataType,
      archive_before: archiveDate.toISOString()
    });
  }

  /**
   * Delete data based on retention policy
   */
  private async deleteData(dataType: string, deleteDate: Date): Promise<void> {
    await supabase.rpc('delete_data_by_type_and_date', {
      data_type: dataType,
      delete_before: deleteDate.toISOString()
    });
  }
}

/**
 * Comprehensive audit trail generation system
 */
export class AuditTrailGenerator {
  private classifier: DataClassifier;

  constructor(classifier: DataClassifier) {
    this.classifier = classifier;
  }

  /**
   * Log audit trail entry
   */
  public async logEntry(entry: Omit<AuditTrailEntry, 'id' | 'timestamp' | 'compliance'>): Promise<AuditTrailEntry> {
    const classification = await this.classifier.classifyData(entry.metadata);
    
    const auditEntry: AuditTrailEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      compliance: {
        regulations: classification.regulations,
        sensitive: classification.sensitivity !== DataSensitivity.PUBLIC,
        classification: classification.sensitivity
      }
    };

    try {
      await supabase.from('audit_trails').insert({
        id: auditEntry.id,
        user_id: auditEntry.userId,
        session_id: auditEntry.sessionId,
        action: auditEntry.action,
        resource: auditEntry.resource,
        resource_id: auditEntry.resourceId,
        metadata: auditEntry.metadata,
        ip_address: auditEntry.ipAddress,
        user_agent: auditEntry.userAgent,
        timestamp: auditEntry.timestamp.toISOString(),
        outcome: auditEntry.outcome,
        compliance_regulations: auditEntry.compliance.regulations,
        compliance_sensitive: auditEntry.compliance.sensitive,
        compliance_classification: auditEntry.compliance.classification
      });

      return auditEntry;
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      throw new Error('Audit logging failed');
    }
  }

  /**
   * Generate audit report for compliance
   */
  public async generateReport(
    startDate: Date,
    endDate: Date,
    regulation?: ComplianceRegulation
  ): Promise<AuditTrailEntry[]> {
    try {
      let query = supabase
        .from('audit_trails')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (regulation) {
        query = query.contains('compliance_regulations', [regulation]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map(row => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        metadata: row.metadata,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        timestamp: new Date(row.timestamp),
        outcome: row.outcome,
        compliance: {
          regulations: row.compliance_regulations,
          sensitive: row.compliance_sensitive,
          classification: row.compliance_classification
        }
      }));
    } catch (error) {
      console.error('Failed to generate audit report:', error);
      throw new Error('Audit report generation failed');
    }
  }
}

/**
 * Compliance scanner for detecting violations
 */
export class ComplianceScanner extends EventEmitter {
  private classifier: DataClassifier;
  private running: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;

  constructor(classifier: DataClassifier) {
    super();
    this.classifier = classifier;
  }

  /**
   * Start continuous compliance scanning
   */
  public startScanning(intervalMs: number = 60000): void {
    if (this.running) return;

    this.running = true;
    this.scanInterval = setInterval(() => {
      this.performScan().catch(error => {
        console.error('Compliance scan failed:', error);
        this.emit('scan_error', error);
      });
    }, intervalMs);

    this.emit('scan_started');
  }

  /**
   * Stop compliance scanning
   */
  public stopScanning(): void {
    if (!this.running) return;

    this.running = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    this.emit('scan_stopped');
  }

  /**
   * Perform compliance scan
   */
  private async performScan(): Promise<void> {
    const violations: ComplianceViolation[] = [];

    try {
      // Scan for unencrypted sensitive data
      const unencryptedViolations = await this.scanUnencryptedSensitiveData();
      violations.push(...unencryptedViolations);

      // Scan for retention policy violations
      const retentionViolations = await this.scanRetentionViolations();
      violations.push(...retentionViolations);

      // Scan for unauthorized access
      const accessViolations = await this.scanUnauthorizedAccess();
      violations.push(...accessViolations);

      // Store violations
      for (const violation of violations) {
        await this.storeViolation(violation);
        this.emit('violation_detected', violation);
      }

      this.emit('scan_completed', { violationCount: violations.length });
    } catch (error) {
      this.emit('scan_error', error);
    }
  }

  /**
   * Scan for unencrypted sensitive data
   */
  private async scanUnencryptedSensitiveData(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    try {
      const { data, error } = await supabase
        .from('data_classifications')
        .select('*')
        .in('sensitivity', [DataSensitivity.CONFIDENTIAL, DataSensitivity.RESTRICTED, DataSensitivity.HIGHLY_RESTRICTED]);

      if (error) throw error;

      // Check if sensitive data is properly encrypted
      for (const classification of data) {
        const isEncrypted = await this.checkDataEncryption(classification.id);
        if (!isEncrypted) {
          violations.push({
            id: crypto.randomUUID(),
            type: 'encryption_failure',
            severity: this.getSeverityForSensitivity(classification.sensitivity),
            regulation: classification.regulations[0] || ComplianceRegulation.GDPR,
            description: `Unencrypted sensitive data detected: ${classification.sensitivity}`,
            affectedData: [classification.id],
            detectedAt: new Date(),
            status: 'open'
          });
        }
      }
    } catch (error) {
      console.error('Failed to scan for unencrypted data:', error);
    }

    return violations;
  }

  /**
   * Scan for retention policy violations
   */
  private async scanRetentionViolations(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    try {
      const { data, error } = await supabase.rpc('check_retention_violations');

      if (error) throw error;

      for (const violation of data) {
        violations.push({
          id: crypto.randomUUID(),
          type: 'retention_violation',
          severity: 'medium',
          regulation: ComplianceRegulation.GDPR, // Default, could be determined from policy
          description: `Data retention period exceeded for ${violation.data_type}`,
          affectedData: [violation.record_id],
          detectedAt: new Date(),
          status: 'open'
        });
      }
    } catch (error) {
      console.error('Failed to scan retention violations:', error);
    }

    return violations;
  }

  /**
   * Scan for unauthorized access attempts
   */
  private async scanUnauthorizedAccess(): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    try {
      const { data, error } = await supabase
        .from('audit_trails')
        .select('*')
        .eq('outcome', 'failure')
        .eq('compliance_sensitive', true)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const failuresByIP = new Map<string, number>();
      
      for (const entry of data) {
        const count = failuresByIP.get(entry.ip_address) || 0;
        failuresByIP.set(entry.ip_address, count + 1);
      }

      for (const [ipAddress, count] of failuresByIP) {
        if (count >= 5) { // Threshold for suspicious activity
          violations.push({
            id: crypto.randomUUID(),
            type: 'unauthorized_access',
            severity: 'high',
            regulation: ComplianceRegulation.GDPR,
            description: `Multiple unauthorized access attempts from IP: ${ipAddress}`,
            affectedData: [],
            detectedAt: new Date(),
            status: 'open'
          });
        }
      }
    } catch (error) {
      console.error('Failed to scan unauthorized access:', error);
    }

    return violations;
  }

  /**
   * Check if data is properly encrypted
   */
  private async checkDataEncryption(dataId: string): Promise<boolean> {
    // Implement encryption check logic
    // This would typically check if the data is stored with proper encryption
    return Math.random() > 0.1; // Placeholder: 90% encrypted
  }

  /**
   * Get violation severity based on data sensitivity
   */
  private getSeverityForSensitivity(sensitivity: DataSensitivity): 'low' | 'medium' | 'high' | 'critical' {
    switch (sensitivity) {
      case DataSensitivity.HIGHLY_RESTRICTED: return 'critical';
      case DataSensitivity.RESTRICTED: return 'high';
      case DataSensitivity.CONFIDENTIAL: return 'medium';
      default: return 'low';
    }
  }

  /**
   * Store violation in database
   */
  private async storeViolation(violation: ComplianceViolation): Promise