# Build Agent Compatibility Matrix API

```markdown
# Agent Compatibility Matrix API Documentation

## Purpose
The Agent Compatibility Matrix API provides a mechanism to evaluate the compatibility of various software agents with specified platforms. It assesses multiple compatibility dimensions and returns a detailed compatibility matrix, including scores and potential conflicts.

## Usage
To use the Compatibility Matrix API, send a request to the appropriate endpoint with a valid payload containing agent IDs and platform targets. The API will respond with a matrix of compatibility scores and relevant analysis.

## Parameters/Props
The input payload must comply with the following schema:

```json
{
  "agentIds": ["string_uuid_1", "string_uuid_2", ...],
  "targetPlatforms": ["platformName1", "platformName2", ...],
  "includePerformanceMetrics": true,
  "includeSecurityAnalysis": false
}
```

### Required Parameters
- `agentIds` (Array of Strings): A list of unique identifiers (UUIDs) representing the agents to analyze. Must contain between 1 and 10 entries.
- `targetPlatforms` (Array of Strings): A list of platform names against which the agents' compatibility will be assessed. Must contain between 1 and 5 entries.

### Optional Parameters
- `includePerformanceMetrics` (Boolean, default: true): If set to true, includes performance-related metrics in the analysis.
- `includeSecurityAnalysis` (Boolean, default: false): If set to true, includes security analysis in the results.

### Response Structure
The API responds with a JSON object containing:
- `matrix` (Array of CompatibilityScore): The compatibility scores for each agent-platform combination.
- `summary` (Object): Summary statistics including total agents, total platforms, average compatibility score, highest score, and lowest score.
- `conflicts` (Array): Detailed conflict information categorized by type and severity.

### CompatibilityScore Interface
```json
{
  "agentId": "string_uuid",
  "platform": "string",
  "overallScore": number,
  "runtimeCompatibility": number,
  "dependencyCompatibility": number,
  "performanceScore": number,
  "securityScore": number | null,
  "warnings": ["string"],
  "recommendations": ["string"]
}
```

### Conflict Object
```json
{
  "type": "string",
  "severity": "string",
  "description": "string",
  "affectedAgents": ["string_uuid"],
  "affectedPlatforms": ["string"]
}
```

## Return Values
The API returns a structured JSON response containing the compatibility matrix, summary, and any identified conflicts regarding the agents and platforms analyzed.

## Examples
### Sample Request
```http
POST /api/agents/compatibility
Content-Type: application/json

{
  "agentIds": ["7f5b02f9-abc7-4c90-ae3e-4b4cb5d3c153", "e1e0b600-87df-43e9-af69-ebf44e6b8c15"],
  "targetPlatforms": ["Windows", "Linux"],
  "includePerformanceMetrics": true,
  "includeSecurityAnalysis": false
}
```

### Sample Response
```json
{
  "matrix": [
    {
      "agentId": "7f5b02f9-abc7-4c90-ae3e-4b4cb5d3c153",
      "platform": "Windows",
      "overallScore": 89,
      "runtimeCompatibility": 90,
      "dependencyCompatibility": 85,
      "performanceScore": 92,
      "securityScore": null,
      "warnings": [],
      "recommendations": []
    }
  ],
  "summary": {
    "totalAgents": 2,
    "totalPlatforms": 2,
    "averageCompatibility": 87,
    "highestScore": 89,
    "lowestScore": 89
  },
  "conflicts": []
}
```
```