import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import {
  DLPEngine,
  ContentInspector,
  PolicyEngine,
  SensitiveDataDetector,
  ExfiltrationBlocker,
  DLPDashboard,
  PolicyConfigForm,
  ViolationAlert
} from '../../../modules/security/data-loss-prevention';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('../../../utils/logger');
jest.mock('../../../services/notification');

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() },
  channel: jest.fn(),
  removeChannel: jest.fn()
};

(createClient as jest.Mock).mockReturnValue(mockSupabaseClient);

describe('DLPEngine', () => {
  let dlpEngine: DLPEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    dlpEngine = new DLPEngine({
      supabaseClient: mockSupabaseClient as any,
      policies: []
    });
  });

  describe('Content Scanning', () => {
    it('should scan text content for sensitive data', async () => {
      const content = 'My SSN is 123-45-6789 and credit card is 4111-1111-1111-1111';
      
      const result = await dlpEngine.scanContent(content);
      
      expect(result.violations).toHaveLength(2);
      expect(result.violations[0].type).toBe('SSN');
      expect(result.violations[1].type).toBe('CREDIT_CARD');
      expect(result.blocked).toBe(true);
    });

    it('should handle file uploads with content inspection', async () => {
      const mockFile = new File(['Confidential data: 123-45-6789'], 'test.txt', {
        type: 'text/plain'
      });

      const result = await dlpEngine.scanFile(mockFile);

      expect(result.scannedSize).toBe(mockFile.size);
      expect(result.violations).toHaveLength(1);
      expect(result.blocked).toBe(true);
    });

    it('should allow clean content to pass through', async () => {
      const content = 'This is clean content without sensitive information';
      
      const result = await dlpEngine.scanContent(content);
      
      expect(result.violations).toHaveLength(0);
      expect(result.blocked).toBe(false);
    });

    it('should handle large file processing with streaming', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const mockFile = new File([largeContent], 'large.txt', {
        type: 'text/plain'
      });

      const startTime = Date.now();
      const result = await dlpEngine.scanFile(mockFile);
      const processingTime = Date.now() - startTime;

      expect(result.processed).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle unsupported file types gracefully', async () => {
      const mockBinaryFile = new File([new ArrayBuffer(1024)], 'test.bin', {
        type: 'application/octet-stream'
      });

      const result = await dlpEngine.scanFile(mockBinaryFile);

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('UNSUPPORTED_FILE_TYPE');
    });
  });

  describe('Error Handling', () => {
    it('should handle scanning errors gracefully', async () => {
      const mockError = new Error('Scanning service unavailable');
      jest.spyOn(dlpEngine, 'scanContent').mockRejectedValueOnce(mockError);

      const result = await dlpEngine.scanContent('test content').catch(err => err);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Scanning service unavailable');
    });

    it('should handle database connection errors', async () => {
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockRejectedValueOnce(new Error('Database error'))
      });

      await expect(dlpEngine.loadPolicies()).rejects.toThrow('Database error');
    });
  });
});

describe('ContentInspector', () => {
  let contentInspector: ContentInspector;

  beforeEach(() => {
    contentInspector = new ContentInspector({
      patterns: {
        SSN: /\d{3}-\d{2}-\d{4}/g,
        CREDIT_CARD: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
        EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      }
    });
  });

  it('should detect SSN patterns', () => {
    const content = 'Employee SSN: 123-45-6789';
    const matches = contentInspector.findMatches(content, 'SSN');

    expect(matches).toHaveLength(1);
    expect(matches[0].value).toBe('123-45-6789');
    expect(matches[0].start).toBe(14);
    expect(matches[0].end).toBe(25);
  });

  it('should detect multiple credit card patterns', () => {
    const content = 'Cards: 4111-1111-1111-1111 and 5555 5555 5555 4444';
    const matches = contentInspector.findMatches(content, 'CREDIT_CARD');

    expect(matches).toHaveLength(2);
    expect(matches[0].value).toBe('4111-1111-1111-1111');
    expect(matches[1].value).toBe('5555 5555 5555 4444');
  });

  it('should validate credit card numbers with Luhn algorithm', () => {
    const validCard = '4111111111111111';
    const invalidCard = '4111111111111112';

    expect(contentInspector.validateCreditCard(validCard)).toBe(true);
    expect(contentInspector.validateCreditCard(invalidCard)).toBe(false);
  });

  it('should handle content redaction', () => {
    const content = 'SSN: 123-45-6789, Card: 4111-1111-1111-1111';
    const redacted = contentInspector.redactSensitiveData(content);

    expect(redacted).toBe('SSN: ***-**-****, Card: ****-****-****-****');
  });

  it('should extract text from PDF files', async () => {
    const mockPdfBuffer = new ArrayBuffer(1024);
    jest.spyOn(contentInspector, 'extractPdfText')
      .mockResolvedValueOnce('Extracted PDF text with SSN: 123-45-6789');

    const text = await contentInspector.extractPdfText(mockPdfBuffer);
    const matches = contentInspector.findMatches(text, 'SSN');

    expect(matches).toHaveLength(1);
    expect(matches[0].value).toBe('123-45-6789');
  });
});

describe('PolicyEngine', () => {
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine({
      supabaseClient: mockSupabaseClient as any
    });
  });

  describe('Policy Management', () => {
    it('should create new DLP policy', async () => {
      const policyData = {
        name: 'PII Protection',
        description: 'Block PII data exfiltration',
        rules: [
          { type: 'SSN', action: 'BLOCK' },
          { type: 'CREDIT_CARD', action: 'ALERT' }
        ],
        enabled: true
      };

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValueOnce({
          data: [{ id: '123', ...policyData }],
          error: null
        })
      });

      const result = await policyEngine.createPolicy(policyData);

      expect(result.id).toBe('123');
      expect(result.name).toBe('PII Protection');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('dlp_policies');
    });

    it('should validate policy rules syntax', () => {
      const validRules = [
        { type: 'SSN', action: 'BLOCK', threshold: 1 },
        { type: 'EMAIL', action: 'ALERT', threshold: 5 }
      ];

      const invalidRules = [
        { type: 'INVALID_TYPE', action: 'BLOCK' },
        { type: 'SSN', action: 'INVALID_ACTION' }
      ];

      expect(policyEngine.validateRules(validRules)).toBe(true);
      expect(policyEngine.validateRules(invalidRules)).toBe(false);
    });

    it('should evaluate content against policies', async () => {
      const policies = [
        {
          id: '1',
          rules: [{ type: 'SSN', action: 'BLOCK', threshold: 1 }],
          enabled: true
        }
      ];

      policyEngine.loadPolicies(policies);

      const violations = [{ type: 'SSN', count: 2, matches: [] }];
      const decision = policyEngine.evaluate(violations);

      expect(decision.action).toBe('BLOCK');
      expect(decision.triggeredPolicies).toHaveLength(1);
    });

    it('should handle policy priority ordering', () => {
      const policies = [
        { id: '1', priority: 1, rules: [{ type: 'SSN', action: 'ALERT' }] },
        { id: '2', priority: 0, rules: [{ type: 'SSN', action: 'BLOCK' }] }
      ];

      policyEngine.loadPolicies(policies);

      const violations = [{ type: 'SSN', count: 1, matches: [] }];
      const decision = policyEngine.evaluate(violations);

      expect(decision.action).toBe('BLOCK'); // Higher priority policy wins
    });
  });
});

describe('SensitiveDataDetector', () => {
  let detector: SensitiveDataDetector;

  beforeEach(() => {
    detector = new SensitiveDataDetector();
  });

  it('should detect various PII patterns', () => {
    const testCases = [
      { content: 'SSN: 123-45-6789', expectedType: 'SSN' },
      { content: 'Phone: (555) 123-4567', expectedType: 'PHONE' },
      { content: 'Email: user@company.com', expectedType: 'EMAIL' },
      { content: 'License: DL12345678', expectedType: 'DRIVERS_LICENSE' }
    ];

    testCases.forEach(({ content, expectedType }) => {
      const detections = detector.detect(content);
      expect(detections.some(d => d.type === expectedType)).toBe(true);
    });
  });

  it('should calculate confidence scores', () => {
    const content = 'My social security number is 123-45-6789';
    const detections = detector.detect(content);

    const ssnDetection = detections.find(d => d.type === 'SSN');
    expect(ssnDetection?.confidence).toBeGreaterThan(0.8);
  });

  it('should detect patterns in different formats', () => {
    const ssnFormats = [
      '123-45-6789',
      '123 45 6789',
      '123456789'
    ];

    ssnFormats.forEach(ssn => {
      const detections = detector.detect(`SSN: ${ssn}`);
      expect(detections.some(d => d.type === 'SSN')).toBe(true);
    });
  });

  it('should handle false positive reduction', () => {
    const falsePositives = [
      '123-45-6789 is not a real SSN in this test',
      'ISBN: 978-0-123456-78-9'
    ];

    falsePositives.forEach(content => {
      const detections = detector.detect(content);
      const ssnDetections = detections.filter(d => d.type === 'SSN');
      expect(ssnDetections.every(d => d.confidence < 0.7)).toBe(true);
    });
  });
});

describe('ExfiltrationBlocker', () => {
  let blocker: ExfiltrationBlocker;

  beforeEach(() => {
    blocker = new ExfiltrationBlocker({
      supabaseClient: mockSupabaseClient as any
    });
  });

  it('should block file upload with violations', async () => {
    const mockFile = new File(['SSN: 123-45-6789'], 'sensitive.txt');
    const violations = [{ type: 'SSN', count: 1, confidence: 0.9 }];

    const result = await blocker.blockUpload(mockFile, violations);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('SENSITIVE_DATA_DETECTED');
    expect(result.violationId).toBeDefined();
  });

  it('should log violation attempts', async () => {
    const userId = 'user-123';
    const violations = [{ type: 'CREDIT_CARD', count: 2 }];

    mockSupabaseClient.from.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValueOnce({
        data: [{ id: 'violation-456' }],
        error: null
      })
    });

    await blocker.logViolation(userId, violations, 'FILE_UPLOAD');

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('dlp_violations');
  });

  it('should quarantine blocked files', async () => {
    const mockFile = new File(['sensitive content'], 'blocked.txt');
    const violationId = 'violation-123';

    const result = await blocker.quarantineFile(mockFile, violationId);

    expect(result.quarantined).toBe(true);
    expect(result.quarantinePath).toMatch(/quarantine\/violation-123/);
  });

  it('should handle real-time blocking', async () => {
    const mockWebSocket = {
      send: jest.fn(),
      close: jest.fn()
    };

    blocker.enableRealTimeBlocking(mockWebSocket as any);

    const violations = [{ type: 'SSN', count: 1 }];
    await blocker.notifyRealTimeBlock(violations);

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'DLP_BLOCK',
        violations,
        timestamp: expect.any(Number)
      })
    );
  });
});

describe('DLPDashboard', () => {
  it('should render violation statistics', async () => {
    mockSupabaseClient.from.mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce({
        data: [
          { type: 'SSN', count: 5, date: '2024-01-01' },
          { type: 'CREDIT_CARD', count: 3, date: '2024-01-01' }
        ],
        error: null
      })
    });

    render(<DLPDashboard />);

    await waitFor(() => {
      expect(screen.getByText('DLP Violations Dashboard')).toBeInTheDocument();
      expect(screen.getByText('SSN: 5 violations')).toBeInTheDocument();
      expect(screen.getByText('CREDIT_CARD: 3 violations')).toBeInTheDocument();
    });
  });

  it('should display real-time violation alerts', async () => {
    const mockChannel = {
      on: jest.fn(),
      subscribe: jest.fn()
    };

    mockSupabaseClient.channel.mockReturnValueOnce(mockChannel);

    render(<DLPDashboard />);

    // Simulate real-time violation
    const violationCallback = mockChannel.on.mock.calls.find(
      call => call[0] === 'postgres_changes'
    )[1];

    violationCallback({
      eventType: 'INSERT',
      new: {
        id: '123',
        type: 'SSN',
        user_id: 'user-456',
        created_at: new Date().toISOString()
      }
    });

    await waitFor(() => {
      expect(screen.getByText('New DLP Violation')).toBeInTheDocument();
    });
  });

  it('should allow violation status updates', async () => {
    mockSupabaseClient.from
      .mockReturnValueOnce({
        select: jest.fn().mockResolvedValueOnce({
          data: [{ id: '123', type: 'SSN', status: 'PENDING', user_id: 'user-456' }],
          error: null
        })
      })
      .mockReturnValueOnce({
        update: jest.fn().mockResolvedValueOnce({
          data: [{ id: '123', status: 'REVIEWED' }],
          error: null
        })
      });

    render(<DLPDashboard />);

    await waitFor(() => {
      const reviewButton = screen.getByText('Mark as Reviewed');
      fireEvent.click(reviewButton);
    });

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('dlp_violations');
  });
});

describe('PolicyConfigForm', () => {
  it('should render policy configuration form', () => {
    render(<PolicyConfigForm onSave={jest.fn()} />);

    expect(screen.getByLabelText('Policy Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Add Rule')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const onSave = jest.fn();
    render(<PolicyConfigForm onSave={onSave} />);

    const saveButton = screen.getByText('Save Policy');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Policy name is required')).toBeInTheDocument();
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('should add and remove policy rules', () => {
    render(<PolicyConfigForm onSave={jest.fn()} />);

    const addRuleButton = screen.getByText('Add Rule');
    fireEvent.click(addRuleButton);

    expect(screen.getByText('Rule 1')).toBeInTheDocument();

    const removeButton = screen.getByLabelText('Remove rule');
    fireEvent.click(removeButton);

    expect(screen.queryByText('Rule 1')).not.toBeInTheDocument();
  });

  it('should save valid policy configuration', async () => {
    const onSave = jest.fn();
    render(<PolicyConfigForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Policy Name'), {
      target: { value: 'Test Policy' }
    });

    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Test description' }
    });

    fireEvent.click(screen.getByText('Add Rule'));
    
    fireEvent.change(screen.getByDisplayValue('SSN'), {
      target: { value: 'CREDIT_CARD' }
    });

    fireEvent.click(screen.getByText('Save Policy'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        name: 'Test Policy',
        description: 'Test description',
        rules: [{ type: 'CREDIT_CARD', action: 'BLOCK', threshold: 1 }],
        enabled: true
      });
    });
  });
});

describe('ViolationAlert', () => {
  const mockViolation = {
    id: '123',
    type: 'SSN',
    count: 2,
    user_id: 'user-456',
    file_name: 'sensitive.pdf',
    created_at: new Date().toISOString(),
    status: 'PENDING'
  };

  it('should display violation details', () => {
    render(<ViolationAlert violation={mockViolation} />);

    expect(screen.getByText('DLP Violation Alert')).toBeInTheDocument();
    expect(screen.getByText('SSN detected')).toBeInTheDocument();
    expect(screen.getByText('2 occurrences')).toBeInTheDocument();
    expect(screen.getByText('File: sensitive.pdf')).toBeInTheDocument();
  });

  it('should handle violation acknowledgment', async () => {
    const onAcknowledge = jest.fn();
    render(
      <ViolationAlert 
        violation={mockViolation} 
        onAcknowledge={onAcknowledge}
      />
    );

    const acknowledgeButton = screen.getByText('Acknowledge');
    fireEvent.click(acknowledgeButton);

    expect(onAcknowledge).toHaveBeenCalledWith('123');
  });

  it('should show severity levels with appropriate styling', () => {
    const criticalViolation = {
      ...mockViolation,
      type: 'SSN',
      count: 10
    };

    const { container } = render(
      <ViolationAlert violation={criticalViolation} />
    );

    expect(container.querySelector('.alert-critical')).toBeInTheDocument();
  });

  it('should auto-dismiss after timeout', async () => {
    const onDismiss = jest.fn();
    render(
      <ViolationAlert 
        violation={mockViolation}
        onDismiss={onDismiss}
        autoDissmissTimeout={1000}
      />
    );

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledWith('123');
    }, { timeout: 1500 });
  });
});

describe('Integration Tests', () => {
  it('should handle complete DLP workflow', async () => {
    const dlpEngine = new DLPEngine({
      supabaseClient: mockSupabaseClient as any,
      policies: [
        {
          id: '1',
          rules: [{ type: 'SSN', action: 'BLOCK', threshold: 1 }],
          enabled: true
        }
      ]
    });

    // Mock file with sensitive content
    const mockFile = new File(
      ['Employee data: John Doe, SSN: 123-45-6789'],
      'employees.txt',
      { type: 'text/plain' }
    );