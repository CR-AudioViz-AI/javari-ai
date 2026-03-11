```typescript
import { jest } from '@jest/globals';
import { AgentSafetyScanner } from '../agent-safety-scanner';
import { StaticAnalyzer } from '../static-analyzer';
import { SandboxExecutor } from '../sandbox-executor';
import { VulnerabilityDetector } from '../vulnerability-detector';
import { MaliciousPatternMatcher } from '../malicious-pattern-matcher';
import { SecurityReport, ScanResult, VulnerabilityType, RiskLevel } from '../types';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('ioredis');
jest.mock('../static-analyzer');
jest.mock('../sandbox-executor');
jest.mock('../vulnerability-detector');
jest.mock('../malicious-pattern-matcher');

// Custom Jest matchers for security assertions
expect.extend({
  toHaveVulnerability(received: SecurityReport, vulnerabilityType: VulnerabilityType) {
    const hasVulnerability = received.vulnerabilities.some(v => v.type === vulnerabilityType);
    return {
      message: () => 
        `expected security report ${hasVulnerability ? 'not ' : ''}to have vulnerability type ${vulnerabilityType}`,
      pass: hasVulnerability,
    };
  },
  toHaveRiskLevel(received: SecurityReport, riskLevel: RiskLevel) {
    return {
      message: () => 
        `expected security report to have risk level ${riskLevel}, but got ${received.riskLevel}`,
      pass: received.riskLevel === riskLevel,
    };
  },
});

describe('AgentSafetyScanner', () => {
  let scanner: AgentSafetyScanner;
  let mockSupabase: jest.Mocked<any>;
  let mockRedis: jest.Mocked<Redis>;
  let mockStaticAnalyzer: jest.Mocked<StaticAnalyzer>;
  let mockSandboxExecutor: jest.Mocked<SandboxExecutor>;
  let mockVulnerabilityDetector: jest.Mocked<VulnerabilityDetector>;
  let mockMaliciousPatternMatcher: jest.Mocked<MaliciousPatternMatcher>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Setup Redis mock
    mockRedis = {
      lpush: jest.fn().mockResolvedValue(1),
      brpop: jest.fn().mockResolvedValue(['queue', 'job']),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    } as any;
    (Redis as jest.Mock).mockReturnValue(mockRedis);

    // Setup component mocks
    mockStaticAnalyzer = new StaticAnalyzer() as jest.Mocked<StaticAnalyzer>;
    mockSandboxExecutor = new SandboxExecutor() as jest.Mocked<SandboxExecutor>;
    mockVulnerabilityDetector = new VulnerabilityDetector() as jest.Mocked<VulnerabilityDetector>;
    mockMaliciousPatternMatcher = new MaliciousPatternMatcher() as jest.Mocked<MaliciousPatternMatcher>;

    scanner = new AgentSafetyScanner({
      supabaseUrl: 'test-url',
      supabaseKey: 'test-key',
      redisUrl: 'redis://localhost:6379',
    });
  });

  afterEach(async () => {
    await scanner.cleanup();
  });

  describe('scanAgentCode', () => {
    const sampleAgentCode = `
      export class TestAgent {
        async execute(input: string): Promise<string> {
          return "Hello " + input;
        }
      }
    `;

    const mockScanJob = {
      agentId: 'agent-123',
      code: sampleAgentCode,
      metadata: {
        name: 'Test Agent',
        version: '1.0.0',
        author: 'test@example.com',
      },
    };

    it('should successfully scan safe agent code', async () => {
      // Mock component responses for safe code
      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['TestAgent'],
        functions: ['execute'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([]);
      
      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([]);

      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: true,
        output: 'Hello test',
        errors: [],
        metrics: {
          executionTime: 100,
          memoryUsage: 1024,
          cpuUsage: 0.1,
        },
      });

      const result = await scanner.scanAgentCode(mockScanJob);

      expect(result).toEqual({
        agentId: 'agent-123',
        scanId: expect.any(String),
        status: 'completed',
        riskLevel: RiskLevel.LOW,
        score: expect.any(Number),
        vulnerabilities: [],
        maliciousPatterns: [],
        staticAnalysis: expect.any(Object),
        sandboxResults: expect.any(Object),
        timestamp: expect.any(Date),
      });

      expect(result).toHaveRiskLevel(RiskLevel.LOW);
      expect(mockSupabase.from).toHaveBeenCalledWith('agent_scan_results');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should detect XSS vulnerabilities in agent code', async () => {
      const maliciousCode = `
        export class XSSAgent {
          execute(input: string) {
            document.innerHTML = input; // XSS vulnerability
            return input;
          }
        }
      `;

      const xssJob = { ...mockScanJob, code: maliciousCode };

      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['XSSAgent'],
        functions: ['execute'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([
        {
          type: VulnerabilityType.XSS,
          severity: 'high',
          line: 4,
          column: 13,
          message: 'Potential XSS vulnerability: Direct DOM manipulation with user input',
          code: 'document.innerHTML = input;',
        },
      ]);

      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([]);
      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: false,
        output: '',
        errors: ['ReferenceError: document is not defined'],
        metrics: { executionTime: 50, memoryUsage: 512, cpuUsage: 0.05 },
      });

      const result = await scanner.scanAgentCode(xssJob);

      expect(result).toHaveVulnerability(VulnerabilityType.XSS);
      expect(result).toHaveRiskLevel(RiskLevel.HIGH);
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].severity).toBe('high');
    });

    it('should detect SQL injection patterns', async () => {
      const sqlInjectionCode = `
        export class DatabaseAgent {
          async query(userInput: string) {
            const query = "SELECT * FROM users WHERE name = '" + userInput + "'";
            return database.execute(query);
          }
        }
      `;

      const sqlJob = { ...mockScanJob, code: sqlInjectionCode };

      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['DatabaseAgent'],
        functions: ['query'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([
        {
          type: VulnerabilityType.SQL_INJECTION,
          severity: 'critical',
          line: 4,
          column: 25,
          message: 'SQL injection vulnerability: String concatenation in query',
          code: `"SELECT * FROM users WHERE name = '" + userInput + "'"`,
        },
      ]);

      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([]);
      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: true,
        output: 'query executed',
        errors: [],
        metrics: { executionTime: 200, memoryUsage: 2048, cpuUsage: 0.2 },
      });

      const result = await scanner.scanAgentCode(sqlJob);

      expect(result).toHaveVulnerability(VulnerabilityType.SQL_INJECTION);
      expect(result).toHaveRiskLevel(RiskLevel.CRITICAL);
      expect(result.vulnerabilities[0].severity).toBe('critical');
    });

    it('should detect malicious import patterns', async () => {
      const maliciousImportCode = `
        import { exec } from 'child_process';
        import * as fs from 'fs';
        
        export class FileSystemAgent {
          async execute(command: string) {
            exec(command);
            fs.unlinkSync('/etc/passwd');
            return 'executed';
          }
        }
      `;

      const maliciousJob = { ...mockScanJob, code: maliciousImportCode };

      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: ['child_process', 'fs'],
        exports: ['FileSystemAgent'],
        functions: ['execute'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([]);

      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([
        {
          type: 'dangerous_import',
          pattern: 'child_process',
          severity: 'high',
          line: 2,
          message: 'Dangerous import: child_process can execute system commands',
        },
        {
          type: 'file_system_access',
          pattern: 'fs.unlinkSync',
          severity: 'critical',
          line: 7,
          message: 'File system manipulation detected',
        },
      ]);

      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: false,
        output: '',
        errors: ['SecurityError: child_process is not allowed'],
        metrics: { executionTime: 10, memoryUsage: 256, cpuUsage: 0.01 },
      });

      const result = await scanner.scanAgentCode(maliciousJob);

      expect(result).toHaveRiskLevel(RiskLevel.CRITICAL);
      expect(result.maliciousPatterns).toHaveLength(2);
      expect(result.maliciousPatterns[0].type).toBe('dangerous_import');
    });

    it('should detect obfuscated code patterns', async () => {
      const obfuscatedCode = `
        const _0x1234 = ['execute', 'return'];
        export class ObfuscatedAgent {
          [_0x1234[0]](input) {
            const _func = new Function(_0x1234[1] + ' "malicious code"');
            return _func();
          }
        }
      `;

      const obfuscatedJob = { ...mockScanJob, code: obfuscatedCode };

      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['ObfuscatedAgent'],
        functions: ['execute'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([
        {
          type: VulnerabilityType.CODE_INJECTION,
          severity: 'high',
          line: 5,
          column: 21,
          message: 'Dynamic code execution detected: Function constructor',
          code: 'new Function(_0x1234[1] + \' "malicious code"\')',
        },
      ]);

      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([
        {
          type: 'obfuscation',
          pattern: '_0x[a-f0-9]+',
          severity: 'medium',
          line: 2,
          message: 'Obfuscated variable names detected',
        },
      ]);

      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: false,
        output: '',
        errors: ['SecurityError: Function constructor is not allowed'],
        metrics: { executionTime: 25, memoryUsage: 512, cpuUsage: 0.02 },
      });

      const result = await scanner.scanAgentCode(obfuscatedJob);

      expect(result).toHaveVulnerability(VulnerabilityType.CODE_INJECTION);
      expect(result).toHaveRiskLevel(RiskLevel.HIGH);
      expect(result.maliciousPatterns).toHaveLength(1);
      expect(result.maliciousPatterns[0].type).toBe('obfuscation');
    });

    it('should handle static analysis failures gracefully', async () => {
      mockStaticAnalyzer.analyze.mockRejectedValue(new Error('AST parsing failed'));

      const result = await scanner.scanAgentCode(mockScanJob);

      expect(result.status).toBe('failed');
      expect(result.riskLevel).toBe(RiskLevel.UNKNOWN);
      expect(result.vulnerabilities).toEqual([]);
    });

    it('should handle sandbox execution timeouts', async () => {
      const infiniteLoopCode = `
        export class InfiniteAgent {
          execute() {
            while(true) { }
          }
        }
      `;

      const timeoutJob = { ...mockScanJob, code: infiniteLoopCode };

      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['InfiniteAgent'],
        functions: ['execute'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([]);
      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([]);
      
      mockSandboxExecutor.executeSafely.mockRejectedValue(new Error('Execution timeout'));

      const result = await scanner.scanAgentCode(timeoutJob);

      expect(result.status).toBe('completed');
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(result.sandboxResults).toEqual({
        success: false,
        error: 'Execution timeout',
      });
    });

    it('should calculate risk scores correctly', async () => {
      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['TestAgent'],
        functions: ['execute'],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([
        { type: VulnerabilityType.XSS, severity: 'medium', line: 1, column: 1, message: 'test', code: 'test' },
        { type: VulnerabilityType.CSRF, severity: 'low', line: 2, column: 1, message: 'test', code: 'test' },
      ]);

      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([
        { type: 'suspicious_pattern', pattern: 'test', severity: 'low', line: 1, message: 'test' },
      ]);

      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: true,
        output: 'test',
        errors: [],
        metrics: { executionTime: 100, memoryUsage: 1024, cpuUsage: 0.1 },
      });

      const result = await scanner.scanAgentCode(mockScanJob);

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });
  });

  describe('queueScanJob', () => {
    it('should queue scan job successfully', async () => {
      const scanJob = {
        agentId: 'agent-123',
        code: 'test code',
        metadata: { name: 'Test', version: '1.0.0', author: 'test@example.com' },
      };

      await scanner.queueScanJob(scanJob);

      expect(mockRedis.lpush).toHaveBeenCalledWith('scan_queue', JSON.stringify(scanJob));
    });

    it('should handle queue failures', async () => {
      const scanJob = {
        agentId: 'agent-123',
        code: 'test code',
        metadata: { name: 'Test', version: '1.0.0', author: 'test@example.com' },
      };

      mockRedis.lpush.mockRejectedValue(new Error('Redis connection failed'));

      await expect(scanner.queueScanJob(scanJob)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('processScanQueue', () => {
    it('should process queued scan jobs', async () => {
      const scanJob = {
        agentId: 'agent-123',
        code: 'export class Test {}',
        metadata: { name: 'Test', version: '1.0.0', author: 'test@example.com' },
      };

      mockRedis.brpop
        .mockResolvedValueOnce(['scan_queue', JSON.stringify(scanJob)])
        .mockResolvedValueOnce(null);

      mockStaticAnalyzer.analyze.mockResolvedValue({
        ast: { type: 'Program', body: [] },
        imports: [],
        exports: ['Test'],
        functions: [],
      });

      mockVulnerabilityDetector.detectVulnerabilities.mockResolvedValue([]);
      mockMaliciousPatternMatcher.findMaliciousPatterns.mockResolvedValue([]);
      mockSandboxExecutor.executeSafely.mockResolvedValue({
        success: true,
        output: '',
        errors: [],
        metrics: { executionTime: 50, memoryUsage: 512, cpuUsage: 0.05 },
      });

      const processPromise = scanner.processScanQueue();
      
      // Allow some time for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      scanner.stopProcessing();
      await processPromise;

      expect(mockRedis.brpop).toHaveBeenCalledWith('scan_queue', 10);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });
  });

  describe('getScanResult', () => {
    it('should retrieve scan result by ID', async () => {
      const mockResult = {
        scan_id: 'scan-123',
        agent_id: 'agent-123',
        status: 'completed',
        risk_level: 'low',
        score: 85,
        vulnerabilities: [],
        malicious_patterns: [],
        created_at: new Date().toISOString(),
      };

      mockSupabase.select.mockResolvedValue({ data: [mockResult], error: null });

      const result = await scanner.getScanResult('scan-123');

      expect(result).toEqual({
        scanId: 'scan-123',
        agentId: 'agent-123',
        status: 'completed',
        riskLevel: 'low',
        score: 85,
        vulnerabilities: [],
        maliciousPatterns: [],
        timestamp: expect.any(Date),
      });
    });

    it('should return null for non-existent scan', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await scanner.getScanResult('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockSupabase.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' } 
      });

      await expect(scanner.getScanResult('scan-123')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getAgentScanHistory', () => {
    it('should retrieve scan history for agent', async () => {
      const mockHistory = [
        {
          scan_id: 'scan-1',
          agent_id: 'agent-123',
          status: 'completed',
          risk_level: 'low',
          score: 85,
          created_at: new Date().toISOString(),
        },
        {
          scan_id: 'scan-2',
          agent_id: 'agent-123',
          status: 'completed',
          risk_level: 'medium',
          score: 65,
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.select.mockResolvedValue({ data: mockHistory, error: null });

      const history = await scanner.getAgentScanHistory('agent-123');

      expect(history).toHaveLength(2);
      expect(history[0].agentId).toBe('agent-123');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
    });
  });

  describe('performance tests', () => {
    it('should handle large codebases efficiently', async () => {
      const largeCode = 'export class LargeAgent {\n' + 
        'execute() {\n'.repeat(1000) + 
        'return "test";\n'.repeat(1000) + 
        '}\n'.repeat(1000) + 
        '}';

      const largeJob = {
        agentId: 'large-agent',
        code: largeCode,
        metadata: { name: 'Large Agent', version: '1.0.0', author: 'test@example.com' },
      };

      mockStaticAnalyzer.analyze.mock