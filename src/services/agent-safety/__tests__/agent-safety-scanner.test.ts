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
// Custom Jest matchers for security assertions
    // Setup Supabase mock
    // Setup Redis mock
    // Setup component mocks
      // Mock component responses for safe code
        import { exec } from 'child_process';
        import * as fs from 'fs';
      // Allow some time for processing
export default {}
