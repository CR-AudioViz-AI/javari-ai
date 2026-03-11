import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import { validateRequired, validateObject } from '../../utils/validation';

/**
 * Compliance regulation types
 */
export enum ComplianceRegulation {
  PCI_DSS = 'PCI_DSS',
  GDPR = 'GDPR',
  PSD2 = 'PSD2',
  CCPA = 'CCPA',
  SOX = 'SOX',
  PIPEDA = 'PIPEDA'
}

/**
 * Compliance status levels
 */
export enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REMEDIATION_REQUIRED = 'REMEDIATION_REQUIRED'
}

/**
 * Audit event types
 */
export enum AuditEventType {
  TRANSACTION_PROCESSED = 'TRANSACTION_PROCESSED',
  DATA_ACCESS = 'DATA_ACCESS',
  COMPLIANCE_CHECK = 'COMPLIANCE_CHECK',
  SECURITY_INCIDENT = 'SECURITY_INCIDENT',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE',
  REPORT_GENERATED = 'REPORT_GENERATED'
}

/**
 * Transaction validation result interface
 */
export interface TransactionValidationResult {
  isValid: boolean;
  violations: ComplianceViolation[];
  complianceScore: number;
  requiredActions: string[];
}

/**
 * Compliance violation interface
 */
export interface ComplianceViolation {
  id: string;
  regulation: ComplianceRegulation;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  remediation: string;
  timestamp: Date;
}

/**
 * Audit trail entry interface
 */
export interface AuditEntry {
  id: string;
  eventType: AuditEventType;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  complianceFlags: ComplianceRegulation[];
}

/**
 * Compliance report interface
 */
export interface ComplianceReport {
  id: string;
  type: 'PERIODIC' | 'ON_DEMAND' | 'INCIDENT';
  regulations: ComplianceRegulation[];
  period: {
    startDate: Date;
    endDate: Date;
  };
  status: ComplianceStatus;
  violations: ComplianceViolation[];
  recommendations: string[];
  generatedAt: Date;
  generatedBy?: string;
}

/**
 * Transaction data interface
 */
export interface TransactionData {
  id: string;
  amount: number;
  currency: string;
  merchantId: string;
  customerId?: string;
  paymentMethod: string;
  cardData?: {
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
  };
  metadata: Record<string, any>;
  timestamp: Date;
  region: string;
}

/**
 * PCI DSS compliance checker
 */
class PCIDSSCompliance {
  private static readonly REQUIRED_FIELDS = ['merchantId', 'paymentMethod'];
  private static readonly PROHIBITED_FIELDS = ['cardNumber', 'cvv', 'pin'];

  /**
   * Validate PCI DSS compliance for transaction
   */
  static validateTransaction(transaction: TransactionData): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for prohibited fields
    for (const field of this.PROHIBITED_FIELDS) {
      if (transaction.metadata[field] || (transaction as any)[field]) {
        violations.push({
          id: `pci-${Date.now()}-${field}`,
          regulation: ComplianceRegulation.PCI_DSS,
          rule: 'PCI DSS 3.4',
          severity: 'CRITICAL',
          description: `Prohibited field '${field}' found in transaction data`,
          remediation: 'Remove sensitive payment data and implement proper tokenization',
          timestamp: new Date()
        });
      }
    }

    // Check for required fields
    for (const field of this.REQUIRED_FIELDS) {
      if (!transaction[field as keyof TransactionData]) {
        violations.push({
          id: `pci-${Date.now()}-${field}`,
          regulation: ComplianceRegulation.PCI_DSS,
          rule: 'PCI DSS 2.1',
          severity: 'HIGH',
          description: `Required field '${field}' missing from transaction`,
          remediation: `Ensure all required fields are present in transaction data`,
          timestamp: new Date()
        });
      }
    }

    return violations;
  }
}

/**
 * GDPR compliance checker
 */
class GDPRCompliance {
  private static readonly PERSONAL_DATA_FIELDS = ['email', 'name', 'address', 'phone'];

  /**
   * Validate GDPR compliance for transaction
   */
  static validateTransaction(transaction: TransactionData): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for personal data without consent
    for (const field of this.PERSONAL_DATA_FIELDS) {
      if (transaction.metadata[field] && !transaction.metadata.gdprConsent) {
        violations.push({
          id: `gdpr-${Date.now()}-${field}`,
          regulation: ComplianceRegulation.GDPR,
          rule: 'GDPR Article 6',
          severity: 'HIGH',
          description: `Personal data field '${field}' processed without valid consent`,
          remediation: 'Obtain explicit GDPR consent before processing personal data',
          timestamp: new Date()
        });
      }
    }

    // Check data retention period
    if (transaction.metadata.dataRetentionPeriod && 
        transaction.metadata.dataRetentionPeriod > 365) {
      violations.push({
        id: `gdpr-${Date.now()}-retention`,
        regulation: ComplianceRegulation.GDPR,
        rule: 'GDPR Article 5(1)(e)',
        severity: 'MEDIUM',
        description: 'Data retention period exceeds reasonable limits',
        remediation: 'Implement appropriate data retention policies',
        timestamp: new Date()
      });
    }

    return violations;
  }
}

/**
 * PSD2 compliance checker
 */
class PSD2Compliance {
  /**
   * Validate PSD2 compliance for transaction
   */
  static validateTransaction(transaction: TransactionData): ComplianceViolation[] {
    const violations: ComplianceViolation[] = [];

    // Check for Strong Customer Authentication (SCA)
    if (transaction.amount > 30 && !transaction.metadata.scaCompleted) {
      violations.push({
        id: `psd2-${Date.now()}-sca`,
        regulation: ComplianceRegulation.PSD2,
        rule: 'PSD2 Article 97',
        severity: 'HIGH',
        description: 'Strong Customer Authentication required for transaction above €30',
        remediation: 'Implement SCA for transactions above exemption limits',
        timestamp: new Date()
      });
    }

    // Check for transaction monitoring
    if (!transaction.metadata.fraudCheck) {
      violations.push({
        id: `psd2-${Date.now()}-monitoring`,
        regulation: ComplianceRegulation.PSD2,
        rule: 'PSD2 Article 95',
        severity: 'MEDIUM',
        description: 'Transaction monitoring not performed',
        remediation: 'Implement real-time transaction monitoring',
        timestamp: new Date()
      });
    }

    return violations;
  }
}

/**
 * Tokenization service for PCI compliance
 */
class TokenizationService {
  private static tokens = new Map<string, string>();

  /**
   * Tokenize sensitive payment data
   */
  static tokenize(sensitiveData: string): string {
    const token = `tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.tokens.set(token, this.encrypt(sensitiveData));
    return token;
  }

  /**
   * Detokenize payment data
   */
  static detokenize(token: string): string | null {
    const encryptedData = this.tokens.get(token);
    return encryptedData ? this.decrypt(encryptedData) : null;
  }

  /**
   * Encrypt sensitive data
   */
  private static encrypt(data: string): string {
    // In production, use proper encryption library
    return Buffer.from(data).toString('base64');
  }

  /**
   * Decrypt sensitive data
   */
  private static decrypt(encryptedData: string): string {
    // In production, use proper decryption library
    return Buffer.from(encryptedData, 'base64').toString();
  }
}

/**
 * Field-level encryption service
 */
class FieldLevelEncryption {
  private static readonly ENCRYPTED_FIELDS = ['cardNumber', 'cvv', 'accountNumber'];

  /**
   * Encrypt sensitive fields in object
   */
  static encryptFields(data: Record<string, any>): Record<string, any> {
    const encrypted = { ...data };
    
    for (const field of this.ENCRYPTED_FIELDS) {
      if (encrypted[field]) {
        encrypted[field] = this.encryptValue(encrypted[field]);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt sensitive fields in object
   */
  static decryptFields(data: Record<string, any>): Record<string, any> {
    const decrypted = { ...data };
    
    for (const field of this.ENCRYPTED_FIELDS) {
      if (decrypted[field] && this.isEncrypted(decrypted[field])) {
        decrypted[field] = this.decryptValue(decrypted[field]);
      }
    }

    return decrypted;
  }

  /**
   * Encrypt a single value
   */
  private static encryptValue(value: string): string {
    return `enc_${Buffer.from(value).toString('base64')}`;
  }

  /**
   * Decrypt a single value
   */
  private static decryptValue(encryptedValue: string): string {
    return Buffer.from(encryptedValue.replace('enc_', ''), 'base64').toString();
  }

  /**
   * Check if value is encrypted
   */
  private static isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith('enc_');
  }
}

/**
 * Audit trail manager
 */
class AuditTrail {
  private entries: AuditEntry[] = [];
  private logger: Logger;

  constructor() {
    this.logger = new Logger('AuditTrail');
  }

  /**
   * Add audit entry
   */
  addEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    try {
      const auditEntry: AuditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        ...entry
      };

      this.entries.push(auditEntry);
      this.logger.info('Audit entry added', { entryId: auditEntry.id });
    } catch (error) {
      this.logger.error('Failed to add audit entry', { error });
      throw error;
    }
  }

  /**
   * Get audit entries by criteria
   */
  getEntries(criteria: {
    eventType?: AuditEventType;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    regulation?: ComplianceRegulation;
  }): AuditEntry[] {
    return this.entries.filter(entry => {
      if (criteria.eventType && entry.eventType !== criteria.eventType) return false;
      if (criteria.userId && entry.userId !== criteria.userId) return false;
      if (criteria.startDate && entry.timestamp < criteria.startDate) return false;
      if (criteria.endDate && entry.timestamp > criteria.endDate) return false;
      if (criteria.regulation && !entry.complianceFlags.includes(criteria.regulation)) return false;
      return true;
    });
  }
}

/**
 * Transaction validator
 */
class TransactionValidator {
  private auditTrail: AuditTrail;

  constructor(auditTrail: AuditTrail) {
    this.auditTrail = auditTrail;
  }

  /**
   * Validate transaction for all applicable regulations
   */
  validateTransaction(transaction: TransactionData): TransactionValidationResult {
    const violations: ComplianceViolation[] = [];

    try {
      // Validate PCI DSS compliance
      violations.push(...PCIDSSCompliance.validateTransaction(transaction));

      // Validate GDPR compliance
      violations.push(...GDPRCompliance.validateTransaction(transaction));

      // Validate PSD2 compliance (for EU transactions)
      if (this.isEUTransaction(transaction)) {
        violations.push(...PSD2Compliance.validateTransaction(transaction));
      }

      // Calculate compliance score
      const complianceScore = this.calculateComplianceScore(violations);

      // Generate required actions
      const requiredActions = this.generateRequiredActions(violations);

      // Log audit entry
      this.auditTrail.addEntry({
        eventType: AuditEventType.COMPLIANCE_CHECK,
        details: {
          transactionId: transaction.id,
          violationCount: violations.length,
          complianceScore
        },
        complianceFlags: [ComplianceRegulation.PCI_DSS, ComplianceRegulation.GDPR]
      });

      return {
        isValid: violations.length === 0,
        violations,
        complianceScore,
        requiredActions
      };
    } catch (error) {
      throw new Error(`Transaction validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if transaction is from EU region
   */
  private isEUTransaction(transaction: TransactionData): boolean {
    const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'GR'];
    return euCountries.includes(transaction.region);
  }

  /**
   * Calculate compliance score based on violations
   */
  private calculateComplianceScore(violations: ComplianceViolation[]): number {
    if (violations.length === 0) return 100;

    const severityWeights = {
      LOW: 5,
      MEDIUM: 15,
      HIGH: 30,
      CRITICAL: 50
    };

    const totalDeduction = violations.reduce((sum, violation) => {
      return sum + severityWeights[violation.severity];
    }, 0);

    return Math.max(0, 100 - totalDeduction);
  }

  /**
   * Generate required actions based on violations
   */
  private generateRequiredActions(violations: ComplianceViolation[]): string[] {
    const actions = new Set<string>();

    violations.forEach(violation => {
      actions.add(violation.remediation);
    });

    return Array.from(actions);
  }
}

/**
 * Compliance reporter
 */
class ComplianceReporter {
  private auditTrail: AuditTrail;
  private logger: Logger;

  constructor(auditTrail: AuditTrail) {
    this.auditTrail = auditTrail;
    this.logger = new Logger('ComplianceReporter');
  }

  /**
   * Generate compliance report
   */
  generateReport(config: {
    type: 'PERIODIC' | 'ON_DEMAND' | 'INCIDENT';
    regulations: ComplianceRegulation[];
    startDate: Date;
    endDate: Date;
    generatedBy?: string;
  }): ComplianceReport {
    try {
      const violations = this.getViolationsForPeriod(config.startDate, config.endDate);
      const filteredViolations = violations.filter(v => 
        config.regulations.includes(v.regulation)
      );

      const report: ComplianceReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: config.type,
        regulations: config.regulations,
        period: {
          startDate: config.startDate,
          endDate: config.endDate
        },
        status: this.determineOverallStatus(filteredViolations),
        violations: filteredViolations,
        recommendations: this.generateRecommendations(filteredViolations),
        generatedAt: new Date(),
        generatedBy: config.generatedBy
      };

      // Log report generation
      this.auditTrail.addEntry({
        eventType: AuditEventType.REPORT_GENERATED,
        details: {
          reportId: report.id,
          reportType: report.type,
          violationCount: report.violations.length
        },
        complianceFlags: config.regulations,
        userId: config.generatedBy
      });

      this.logger.info('Compliance report generated', { reportId: report.id });
      return report;
    } catch (error) {
      this.logger.error('Failed to generate compliance report', { error });
      throw error;
    }
  }

  /**
   * Get violations for a specific period
   */
  private getViolationsForPeriod(startDate: Date, endDate: Date): ComplianceViolation[] {
    const auditEntries = this.auditTrail.getEntries({
      startDate,
      endDate,
      eventType: AuditEventType.COMPLIANCE_CHECK
    });

    const violations: ComplianceViolation[] = [];
    auditEntries.forEach(entry => {
      if (entry.details.violations) {
        violations.push(...entry.details.violations);
      }
    });

    return violations;
  }

  /**
   * Determine overall compliance status
   */
  private determineOverallStatus(violations: ComplianceViolation[]): ComplianceStatus {
    if (violations.length === 0) return ComplianceStatus.COMPLIANT;

    const hasCritical = violations.some(v => v.severity === 'CRITICAL');
    const hasHigh = violations.some(v => v.severity === 'HIGH');

    if (hasCritical) return ComplianceStatus.NON_COMPLIANT;
    if (hasHigh) return ComplianceStatus.REMEDIATION_REQUIRED;
    return ComplianceStatus.UNDER_REVIEW;
  }

  /**
   * Generate recommendations based on violations
   */
  private generateRecommendations(violations: ComplianceViolation[]): string[] {
    const recommendations = new Set<string>();

    // Add general recommendations based on violation patterns
    const regulationCounts = violations.reduce((acc, v) => {
      acc[v.regulation] = (acc[v.regulation] || 0) + 1;
      return acc;
    }, {} as Record<ComplianceRegulation, number>);

    Object.entries(regulationCounts).forEach(([regulation, count]) => {
      if (count > 5) {
        recommendations.add(`Consider comprehensive ${regulation} compliance review`);
      }
    });

    // Add specific recommendations from violations
    violations.forEach(violation => {
      recommendations.add(violation.remediation);
    });

    return Array.from(recommendations);
  }
}

/**
 * Data retention manager
 */
class DataRetentionManager {
  private retentionPolicies: Map<string, number> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DataRetentionManager');
    this.setDefaultPolicies();
  }

  /**
   * Set default retention policies
   */
  private setDefaultPolicies(): void {
    this.retentionPolicies.set('transaction_data', 365); // 1 year
    this.retentionPolicies.set('audit_logs', 2555); // 7 years
    this.retentionPolicies.set('personal_data', 365); // 1 year
    this.retentionPolicies.set('compliance_reports', 2555); // 7 years
  }

  /**
   * Check if data should be retained
   */
  shouldRetainData(dataType: string, createdDate: Date): boolean {
    const retentionDays = this.retentionPolicies.get(dataType);
    if (!retentionDays) return true; // Default to retain if no policy

    const daysDiff = Math.floor(
      (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysDiff <= retentionDays;
  }

  /**
   * Get retention period for data type
   */
  getRetentionPeriod(dataType: string): number {
    return this.retentionPolicies.get(dataType) || 365;
  }

  /**
   * Set retention policy
   */
  setRetentionPolicy(dataType: string, days: number): void {
    this.retentionPolicies.set(dataType, days);
    this.logger.info('Retention policy updated', { dataType, days });
  }
}

/**
 * Main compliance engine
 */
export class ComplianceEngine extends EventEmitter {
  private auditTrail: AuditTrail;
  private transactionValidator: TransactionValidator;
  private complianceReporter: ComplianceReporter;
  private dataRetentionManager: DataRetentionManager;
  private tokenizationService: TokenizationService;
  private logger: Logger;

  constructor() {
    super();
    this.auditTrail = new AuditTrail();
    this.transactionValidator = new TransactionValidator(this.auditTrail);
    this.complianceReporter = new ComplianceReporter(this.auditTrail);
    this.dataRetentionManager = new DataRetentionManager();
    this.tokenizationService = new (TokenizationService as any)();
    this.logger = new Logger('ComplianceEngine');
  }

  /**
   * Initialize compliance engine
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing compliance engine');
      
      // Set up automated compliance checks
      this.schedulePeriodicReports();
      
      this.emit('initialized');
      this.logger.info('Compliance engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize compliance engine', { error });
      throw error;
    }
  }

  /**
   * Validate transaction compliance
   */
  async validateTransaction(transaction: TransactionData): Promise<TransactionValidationResult> {
    try {
      validateRequired(transaction, ['id', 'amount', 'currency', 'merchantId']);
      
      // Tokenize sensitive data if present
      const sanitizedTransaction = this.sanitizeTransaction(transaction);
      
      // Validate compliance
      const result = this.transactionValidator