# Build Continuous Security Scanning API

```markdown
# Continuous Security Scanning API

## Purpose
The Continuous Security Scanning API provides functionalities to initiate and manage security scans on various target types, including repositories, packages, containers, and applications. It enables users to check for vulnerabilities, compliance with standards, and more. The API is designed to help developers maintain code security and adhere to compliance regulations efficiently.

## Usage
This API handles requests to initiate security scans and retrieve scan results based on different filters. It utilizes types from the `zod` library for schema validation and communicates with a Supabase backend for storage and retrieval of scan results.

## Endpoints

### Scan Initiation
- **POST** `/api/security/scan`
  - Initiates a new security scan based on the provided configuration.

### Scan Retrieval
- **GET** `/api/security/scan`
  - Retrieves results of scans based on filter options.

## Parameters/Props

### ScanConfigSchema
The following fields are expected in the request body for initiating a scan:

- `scanType`: **enum** - Type of scan. Allowed values are 'full', 'dependencies', 'vulnerabilities', 'compliance'.
- `target`: **object** - The target of the scan.
  - `type`: **enum** - Type of target. Allowed values are 'repository', 'package', 'container', 'application'.
  - `path`: **string** - Path to the target.
  - `branch`: **string** (optional) - The specific branch for repository scans.
  - `excludePatterns`: **array** (optional) - Patterns to exclude from the scan.
- `options`: **object** (optional) - Additional options for the scan.
  - `severity`: **enum** - Minimum severity level to include. Allowed values: 'low', 'medium', 'high', 'critical'.
  - `includeDevDependencies`: **boolean** (optional) - Flag to include dev dependencies.
  - `enableAutoRemediation`: **boolean** (optional) - Flag to enable automatic remediation of issues found.
  - `complianceStandards`: **array** (optional) - Standards to check against. Allowed values: 'OWASP', 'SOC2', 'PCI-DSS', 'GDPR'.

### ScanFilterSchema
The following fields are expected in the query parameters for retrieving scan results:

- `limit`: **number** (optional) - The maximum number of results to return. Default is 20.
- `offset`: **number** (optional) - The number of results to skip. Default is 0.
- `scanType`: **enum** (optional) - Type of scan to filter results for.
- `severity`: **enum** (optional) - Minimum severity level to filter results. 
- `status`: **enum** (optional) - Filter results by scan status. Allowed values: 'pending', 'running', 'completed', 'failed'.

## Return Values
- The API will return a JSON object with the results of the scan initiation or retrieval, including details such as scan IDs, status, vulnerabilities found, and compliance information.

## Examples
### Initiate a Security Scan
```typescript
const response = await fetch('/api/security/scan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    scanType: 'full',
    target: {
      type: 'repository',
      path: 'my-repo/path',
      branch: 'main',
      excludePatterns: ['node_modules/*'],
    },
    options: {
      severity: 'medium',
      includeDevDependencies: false,
      enableAutoRemediation: true,
      complianceStandards: ['OWASP', 'PCI-DSS'],
    },
  }),
});
```

### Retrieve Scan Results
```typescript
const response = await fetch('/api/security/scan?limit=10&status=completed', {
  method: 'GET',
});
const scanResults = await response.json();
```
```