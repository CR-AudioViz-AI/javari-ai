```typescript
import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import {
  ComplianceMonitoringService,
  GDPRComplianceChecker,
  HIPAAComplianceValidator,
  SOXComplianceAuditor,
  IndustrySpecificValidator,
  ComplianceReportGenerator,
  ViolationAlertSystem,
  AuditTrailManager,
  DataRetentionPolicyEnforcer,
  ConsentManagementTracker
} from '../../services/compliance-monitoring';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../utils/logger');
jest.mock('../../utils/encryption');
jest.mock('../../integrations/siem-connector');
jest.mock('../../integrations/regulatory-api');

// Custom matchers for compliance testing
expect.extend({
  toBeCompliantWith(received: any, regulation: string) {
    const pass = received.isCompliant === true && received.regulation === regulation;
    return {
      message: () => `expected compliance check to ${pass ? 'not ' : ''}be compliant with ${regulation}`,
      pass
    };
  },
  toHaveViolationType(received: any, violationType: string) {
    const pass = received.violations?.some((v: any) => v.type === violationType);
    return {
      message: () => `expected violations to ${pass ? 'not ' : ''}include type ${violationType}`,
      pass
    };
  },
  toMeetRetentionPolicy(received: any, policyDays: number) {
    const pass = received.retentionDays <= policyDays;
    return {
      message: () => `expected retention period ${received.retentionDays} to ${pass ? 'not ' : ''}meet policy of ${policyDays} days`,
      pass
    };
  }
});

describe('ComplianceMonitoringService', () => {
  let service: ComplianceMonitoringService;
  let mockSupabase: jest.Mocked<any>;
  let mockGDPRChecker: jest.Mocked<GDPRComplianceChecker>;
  let mockHIPAAValidator: jest.Mocked<HIPAAComplianceValidator>;
  let mockSOXAuditor: jest.Mocked<SOXComplianceAuditor>;
  let mockIndustryValidator: jest.Mocked<IndustrySpecificValidator>;
  let mockReportGenerator: jest.Mocked<ComplianceReportGenerator>;
  let mockAlertSystem: jest.Mocked<ViolationAlertSystem>;
  let mockAuditTrailManager: jest.Mocked<AuditTrailManager>;
  let mockDataRetentionEnforcer: jest.Mocked<DataRetentionPolicyEnforcer>;
  let mockConsentTracker: jest.Mocked<ConsentManagementTracker>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    mockGDPRChecker = {
      validateDataProcessing: jest.fn(),
      checkConsentCompliance: jest.fn(),
      validateDataTransfer: jest.fn(),
      auditRightToBeForgotten: jest.fn(),
      checkDataMinimization: jest.fn()
    } as any;

    mockHIPAAValidator = {
      validatePHIAccess: jest.fn(),
      checkEncryptionCompliance: jest.fn(),
      auditAccessControls: jest.fn(),
      validateBusinessAssociateAgreements: jest.fn(),
      checkBreachNotificationRequirements: jest.fn()
    } as any;

    mockSOXAuditor = {
      validateFinancialDataAccess: jest.fn(),
      auditControlEnvironment: jest.fn(),
      checkDataIntegrity: jest.fn(),
      validateAuditTrails: jest.fn(),
      assessRiskControls: jest.fn()
    } as any;

    mockIndustryValidator = {
      validateIndustrySpecificRules: jest.fn(),
      checkSectorCompliance: jest.fn(),
      auditIndustryStandards: jest.fn()
    } as any;

    mockReportGenerator = {
      generateComplianceReport: jest.fn(),
      createViolationSummary: jest.fn(),
      buildAuditReport: jest.fn(),
      exportComplianceMetrics: jest.fn()
    } as any;

    mockAlertSystem = {
      sendViolationAlert: jest.fn(),
      escalateHighRiskViolation: jest.fn(),
      notifyStakeholders: jest.fn(),
      createIncidentTicket: jest.fn()
    } as any;

    mockAuditTrailManager = {
      createAuditEntry: jest.fn(),
      getAuditHistory: jest.fn(),
      validateAuditIntegrity: jest.fn(),
      archiveAuditLogs: jest.fn()
    } as any;

    mockDataRetentionEnforcer = {
      enforceRetentionPolicy: jest.fn(),
      scheduleDataDeletion: jest.fn(),
      validateRetentionCompliance: jest.fn(),
      auditDataLifecycle: jest.fn()
    } as any;

    mockConsentTracker = {
      trackConsentChanges: jest.fn(),
      validateConsentStatus: jest.fn(),
      auditConsentCompliance: jest.fn(),
      manageConsentWithdrawal: jest.fn()
    } as any;

    service = new ComplianceMonitoringService(
      mockSupabase,
      mockGDPRChecker,
      mockHIPAAValidator,
      mockSOXAuditor,
      mockIndustryValidator,
      mockReportGenerator,
      mockAlertSystem,
      mockAuditTrailManager,
      mockDataRetentionEnforcer,
      mockConsentTracker
    );
  });

  describe('Initialization', () => {
    it('should initialize service with all dependencies', () => {
      expect(service).toBeInstanceOf(ComplianceMonitoringService);
      expect(service.isInitialized()).toBe(true);
    });

    it('should throw error if required dependencies are missing', () => {
      expect(() => new ComplianceMonitoringService(null as any)).toThrow('Supabase client is required');
    });

    it('should configure compliance rules on initialization', async () => {
      const spy = jest.spyOn(service as any, 'loadComplianceRules');
      await service.initialize();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Real-time Compliance Monitoring', () => {
    const mockAIUsageEvent = {
      userId: 'user123',
      sessionId: 'session456',
      action: 'process_data',
      dataType: 'personal_information',
      timestamp: new Date(),
      metadata: {
        jurisdiction: 'EU',
        industry: 'healthcare',
        dataVolume: 1000
      }
    };

    it('should monitor AI usage events in real-time', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null })
      });

      const result = await service.monitorAIUsage(mockAIUsageEvent);

      expect(result.monitored).toBe(true);
      expect(mockAuditTrailManager.createAuditEntry).toHaveBeenCalledWith({
        event: 'ai_usage_monitored',
        userId: mockAIUsageEvent.userId,
        details: mockAIUsageEvent
      });
    });

    it('should detect compliance violations during monitoring', async () => {
      mockGDPRChecker.validateDataProcessing.mockResolvedValue({
        isCompliant: false,
        violations: [{ type: 'consent_missing', severity: 'high' }]
      });

      const result = await service.monitorAIUsage(mockAIUsageEvent);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toHaveViolationType('consent_missing');
      expect(mockAlertSystem.sendViolationAlert).toHaveBeenCalled();
    });

    it('should handle monitoring errors gracefully', async () => {
      mockGDPRChecker.validateDataProcessing.mockRejectedValue(new Error('Validation failed'));

      const result = await service.monitorAIUsage(mockAIUsageEvent);

      expect(result.error).toBeDefined();
      expect(result.monitored).toBe(false);
    });
  });

  describe('GDPR Compliance Validation', () => {
    const mockGDPRContext = {
      dataSubject: 'user123',
      dataController: 'company456',
      processingPurpose: 'ai_analytics',
      legalBasis: 'consent',
      dataTypes: ['personal_info', 'behavioral_data']
    };

    it('should validate GDPR consent compliance', async () => {
      mockGDPRChecker.checkConsentCompliance.mockResolvedValue({
        isCompliant: true,
        regulation: 'GDPR',
        consentStatus: 'valid',
        consentTimestamp: new Date()
      });

      const result = await service.validateGDPRCompliance(mockGDPRContext);

      expect(result).toBeCompliantWith('GDPR');
      expect(result.consentStatus).toBe('valid');
    });

    it('should detect GDPR data minimization violations', async () => {
      mockGDPRChecker.checkDataMinimization.mockResolvedValue({
        isCompliant: false,
        violations: [{ type: 'excessive_data_collection', field: 'location_data' }]
      });

      const result = await service.validateGDPRCompliance(mockGDPRContext);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveViolationType('excessive_data_collection');
    });

    it('should validate cross-border data transfers', async () => {
      const transferContext = {
        ...mockGDPRContext,
        transferTo: 'US',
        adequacyDecision: false,
        safeguards: ['standard_contractual_clauses']
      };

      mockGDPRChecker.validateDataTransfer.mockResolvedValue({
        isCompliant: true,
        adequateSafeguards: true,
        transferMechanism: 'SCCs'
      });

      const result = await service.validateGDPRCompliance(transferContext);

      expect(result.isCompliant).toBe(true);
      expect(result.transferMechanism).toBe('SCCs');
    });

    it('should process right to be forgotten requests', async () => {
      mockGDPRChecker.auditRightToBeForgotten.mockResolvedValue({
        dataRemoved: true,
        affectedSystems: ['database', 'analytics', 'backups'],
        completionTime: new Date()
      });

      const result = await service.processRightToBeForgotten('user123');

      expect(result.dataRemoved).toBe(true);
      expect(result.affectedSystems).toContain('database');
      expect(mockAuditTrailManager.createAuditEntry).toHaveBeenCalledWith({
        event: 'right_to_be_forgotten',
        userId: 'user123',
        details: expect.any(Object)
      });
    });
  });

  describe('HIPAA Compliance Validation', () => {
    const mockHIPAAContext = {
      coveredEntity: 'hospital123',
      phi: ['patient_id', 'medical_records', 'diagnosis'],
      accessPurpose: 'treatment',
      minimumNecessary: true,
      businessAssociate: 'ai_vendor456'
    };

    it('should validate PHI access controls', async () => {
      mockHIPAAValidator.validatePHIAccess.mockResolvedValue({
        isCompliant: true,
        regulation: 'HIPAA',
        accessGranted: true,
        accessLevel: 'minimum_necessary'
      });

      const result = await service.validateHIPAACompliance(mockHIPAAContext);

      expect(result).toBeCompliantWith('HIPAA');
      expect(result.accessLevel).toBe('minimum_necessary');
    });

    it('should check encryption compliance for PHI', async () => {
      mockHIPAAValidator.checkEncryptionCompliance.mockResolvedValue({
        isCompliant: true,
        encryptionAtRest: true,
        encryptionInTransit: true,
        keyManagement: 'compliant'
      });

      const result = await service.validateHIPAACompliance(mockHIPAAContext);

      expect(result.encryptionAtRest).toBe(true);
      expect(result.encryptionInTransit).toBe(true);
    });

    it('should validate business associate agreements', async () => {
      mockHIPAAValidator.validateBusinessAssociateAgreements.mockResolvedValue({
        isCompliant: false,
        violations: [{ type: 'missing_baa', entity: 'ai_vendor456' }]
      });

      const result = await service.validateHIPAACompliance(mockHIPAAContext);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveViolationType('missing_baa');
    });

    it('should check breach notification requirements', async () => {
      const breachContext = {
        ...mockHIPAAContext,
        breachOccurred: true,
        affectedRecords: 600,
        breachDate: new Date()
      };

      mockHIPAAValidator.checkBreachNotificationRequirements.mockResolvedValue({
        notificationRequired: true,
        notificationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        notificationRecipients: ['HHS', 'individuals', 'media']
      });

      const result = await service.validateHIPAACompliance(breachContext);

      expect(result.notificationRequired).toBe(true);
      expect(result.notificationRecipients).toContain('HHS');
    });
  });

  describe('SOX Compliance Auditing', () => {
    const mockSOXContext = {
      financialData: true,
      publicCompany: true,
      controlFramework: 'COSO',
      auditPeriod: '2024-Q1',
      materialWeaknesses: []
    };

    it('should validate financial data access controls', async () => {
      mockSOXAuditor.validateFinancialDataAccess.mockResolvedValue({
        isCompliant: true,
        regulation: 'SOX',
        accessControlsEffective: true,
        segregationOfDuties: true
      });

      const result = await service.validateSOXCompliance(mockSOXContext);

      expect(result).toBeCompliantWith('SOX');
      expect(result.segregationOfDuties).toBe(true);
    });

    it('should audit control environment effectiveness', async () => {
      mockSOXAuditor.auditControlEnvironment.mockResolvedValue({
        isCompliant: false,
        deficiencies: [{ type: 'insufficient_documentation', severity: 'significant' }],
        recommendedActions: ['improve_documentation', 'enhance_monitoring']
      });

      const result = await service.validateSOXCompliance(mockSOXContext);

      expect(result.isCompliant).toBe(false);
      expect(result.deficiencies[0].type).toBe('insufficient_documentation');
    });

    it('should validate data integrity controls', async () => {
      mockSOXAuditor.checkDataIntegrity.mockResolvedValue({
        isCompliant: true,
        integrityChecksEffective: true,
        changeManagementControlsOperating: true,
        dataValidationControlsTested: true
      });

      const result = await service.validateSOXCompliance(mockSOXContext);

      expect(result.integrityChecksEffective).toBe(true);
      expect(result.changeManagementControlsOperating).toBe(true);
    });

    it('should assess risk management controls', async () => {
      mockSOXAuditor.assessRiskControls.mockResolvedValue({
        riskAssessmentComplete: true,
        riskMitigationControlsIdentified: true,
        riskMonitoringEffective: false,
        riskLevel: 'medium'
      });

      const result = await service.validateSOXCompliance(mockSOXContext);

      expect(result.riskAssessmentComplete).toBe(true);
      expect(result.riskMonitoringEffective).toBe(false);
    });
  });

  describe('Industry-Specific Compliance', () => {
    it('should validate PCI DSS compliance for payment data', async () => {
      const pciContext = {
        industry: 'payment_processing',
        dataType: 'cardholder_data',
        pciLevel: 'Level 1',
        requirements: ['encryption', 'access_control', 'monitoring']
      };

      mockIndustryValidator.validateIndustrySpecificRules.mockResolvedValue({
        isCompliant: true,
        standard: 'PCI DSS',
        complianceLevel: 'Level 1',
        requirementsMet: ['encryption', 'access_control', 'monitoring']
      });

      const result = await service.validateIndustryCompliance(pciContext);

      expect(result.isCompliant).toBe(true);
      expect(result.standard).toBe('PCI DSS');
    });

    it('should validate FERPA compliance for educational records', async () => {
      const ferpaContext = {
        industry: 'education',
        dataType: 'student_records',
        educationalInstitution: true,
        directoryInformation: false
      };

      mockIndustryValidator.checkSectorCompliance.mockResolvedValue({
        isCompliant: false,
        violations: [{ type: 'unauthorized_disclosure', severity: 'high' }],
        correctiveActions: ['update_consent', 'restrict_access']
      });

      const result = await service.validateIndustryCompliance(ferpaContext);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toHaveViolationType('unauthorized_disclosure');
    });

    it('should validate financial services regulations', async () => {
      const finServContext = {
        industry: 'financial_services',
        regulations: ['GLBA', 'FFIEC', 'PCI DSS'],
        customerData: true,
        riskProfile: 'high'
      };

      mockIndustryValidator.auditIndustryStandards.mockResolvedValue({
        glbaCompliant: true,
        ffiecCompliant: true,
        pciCompliant: false,
        overallCompliance: false
      });

      const result = await service.validateIndustryCompliance(finServContext);

      expect(result.overallCompliance).toBe(false);
      expect(result.pciCompliant).toBe(false);
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate comprehensive compliance reports', async () => {
      const reportParams = {
        period: '2024-Q1',
        regulations: ['GDPR', 'HIPAA', 'SOX'],
        includeViolations: true,
        format: 'PDF'
      };

      mockReportGenerator.generateComplianceReport.mockResolvedValue({
        reportId: 'report123',
        generatedAt: new Date(),
        regulations: ['GDPR', 'HIPAA', 'SOX'],
        complianceScore: 85,
        violationsCount: 5,
        downloadUrl: 'https://reports.example.com/report123.pdf'
      });

      const result = await service.generateComplianceReport(reportParams);

      expect(result.reportId).toBe('report123');
      expect(result.complianceScore).toBe(85);
      expect(result.downloadUrl).toContain('report123.pdf');
    });

    it('should create violation summary reports', async () => {
      mockReportGenerator.createViolationSummary.mockResolvedValue({
        totalViolations: 12,
        highSeverity: 3,
        mediumSeverity: 6,
        lowSeverity: 3,
        byRegulation: {
          GDPR: 5,
          HIPAA: 4,
          SOX: 3
        },
        trends: 'increasing'
      });

      const result = await service.generateViolationSummary('2024-Q1');

      expect(result.totalViolations).toBe(12);
      expect(result.highSeverity).toBe(3);
      expect(result.byRegulation.GDPR).toBe(5);
    });

    it('should export compliance metrics for analytics', async () => {
      mockReportGenerator.exportComplianceMetrics.mockResolvedValue({
        format: 'JSON',
        data: {
          complianceRates: { GDPR: 0.95, HIPAA: 0.88, SOX: 0.92 },
          violationTrends: { increasing: ['HIPAA'], stable: ['SOX'], decreasing: ['GDPR'] },
          auditReadiness: 0.89
        },
        exportedAt: new Date()
      });

      const result = await service.exportComplianceMetrics('JSON');

      expect(result.data.complianceRates.GDPR).toBe(0.95);
      expect(result.data.violationTrends.increasing).toContain('HIPAA');
    });
  });

  describe('Violation Alert System', () => {
    const mockViolation = {
      id: 'violation123',
      type: 'data_breach',
      severity: 'critical',
      regulation: 'HIPAA',
      description: 'Unauthorized access to PHI',
      affectedRecords: 1000,
      detectedAt: new Date()
    };

    it('should send immediate alerts for critical violations', async () => {
      mockAlertSystem.sendViolationAlert.mockResolvedValue({
        alertId: 'alert123',
        sent: true,
        recipients: ['compliance@company.com', 'legal@company.com'],
        sentAt: new Date()
      });

      const result = await service.handleViolationAlert(mockViolation);

      expect(result.sent).toBe(true);
      expect(result.recipients).toContain('compliance@company.com');
      expect(mockAlertSystem.sendViolationAlert).toHaveBeenCalledWith(mockViolation);
    });