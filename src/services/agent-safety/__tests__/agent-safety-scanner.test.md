# Build Agent Code Safety Scanner Service

# Agent Safety Scanner Service

## Purpose
The Agent Safety Scanner Service is designed to evaluate the safety of code agents by scanning for vulnerabilities, malicious patterns, and other security risks. It utilizes multiple components to analyze code and generate detailed security reports based on detected issues.

## Usage
To use the Agent Safety Scanner Service, instantiate the `AgentSafetyScanner` class and call its methods, which integrate various scanning techniques and return a security report.

## Parameters/Props

### AgentSafetyScanner
- **Constructor Params**: 
  - `supabaseClient`: An instance of a Supabase client to interact with the database.
  - `redisClient`: A Redis client for caching and state management.
  - `staticAnalyzer`: An instance of the `StaticAnalyzer` for static code analysis.
  - `sandboxExecutor`: An instance of the `SandboxExecutor` for safe code execution.
  - `vulnerabilityDetector`: An instance of the `VulnerabilityDetector` for finding known vulnerabilities.
  - `maliciousPatternMatcher`: An instance of the `MaliciousPatternMatcher` for identifying harmful code patterns.

### SecurityReport
- **Properties**:
  - `vulnerabilities`: Array of detected vulnerabilities, each having a `type`.
  - `riskLevel`: A defined risk level assessed based on vulnerabilities detected.

### Jest Custom Matchers
Custom matchers are added to validate the contents of `SecurityReport` objects:
- `toHaveVulnerability(vulnerabilityType: VulnerabilityType)`: Checks if the report contains a specific vulnerability type.
- `toHaveRiskLevel(riskLevel: RiskLevel)`: Checks if the report matches the expected risk level.

## Return Values
- **AgentSafetyScanner methods**: Typically return a `Promise<SecurityReport>`, which includes details on detected vulnerabilities and assigned risk levels.
- **Custom Matchers**: Return a result object indicating whether the test passed or failed, along with a message to provide context for the assertion.

## Examples

```typescript
import { AgentSafetyScanner } from '../agent-safety-scanner';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const supabaseClient = createClient('yourSupabaseUrl', 'yourSupabaseKey');
const redisClient = new Redis();

const safetyScanner = new AgentSafetyScanner(supabaseClient, redisClient);

// Run a safety scan
async function runSafetyScan(code: string) {
  const report = await safetyScanner.scan(code);
  console.log(report);
}

// Example assertion using custom matchers
it('should have a security report with a critical vulnerability', async () => {
  const report = await safetyScanner.scan(someMaliciousCode);
  expect(report).toHaveVulnerability('Critical');
  expect(report).toHaveRiskLevel('High');
});
```

In this example, the scanner is instantiated with necessary clients, a safety scan is performed, and assertions are made to check for specific vulnerabilities and risk levels in the returned security report.