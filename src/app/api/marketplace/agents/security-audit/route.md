# Implement Agent Security Audit API

# Agent Security Audit API Documentation

## Purpose
The Agent Security Audit API provides an interface to perform various types of security audits on agents within a system. It supports multiple audit types and allows users to retrieve audit results based on specified criteria. This API is essential for maintaining the security posture of agents and ensuring compliance with security standards.

## Usage
To leverage the Agent Security Audit API, send HTTP requests to the defined routes within a Next.js application. The API supports the creation of new audit requests and querying of existing audit results.

### HTTP Methods
- `POST /api/marketplace/agents/security-audit` - Create a new security audit.
- `GET /api/marketplace/agents/security-audit` - Query existing audits with specified parameters.

## Parameters/Props

### Create Security Audit Request (POST)
- `agentId` (string, required): The UUID of the agent to audit.
- `auditType` (enum, required): Type of audit to perform. Options include:
  - `full`
  - `quick`
  - `dependency`
  - `behavioral`
  - `compliance`
- `priority` (enum, optional): Priority level of the audit. Defaults to `medium`. Options:
  - `low`
  - `medium`
  - `high`
  - `critical`
- `includeStaticAnalysis` (boolean, optional): Include static analysis in the audit. Defaults to `true`.
- `includeDependencyCheck` (boolean, optional): Include dependency check. Defaults to `true`.
- `includeBehavioralAnalysis` (boolean, optional): Include behavioral analysis. Defaults to `true`.
- `includeComplianceCheck` (boolean, optional): Include compliance checks. Defaults to `false`.
- `scheduledAudit` (boolean, optional): Indicates if the audit should be scheduled. Defaults to `false`.

### Query Security Audits (GET)
- `agentId` (string, optional): Filter by agent UUID.
- `status` (enum, optional): Filter by audit status. Options:
  - `pending`
  - `running`
  - `completed`
  - `failed`
- `severity` (enum, optional): Filter by issue severity. Options:
  - `low`
  - `medium`
  - `high`
  - `critical`
- `auditType` (enum, optional): Filter by audit type (same as above).
- `page` (number, optional): Pagination, starts at 1. Defaults to `1`.
- `limit` (number, optional): Maximum items per page (1-100). Defaults to `20`.
- `startDate` (string, optional): Filter audits by start date.
- `endDate` (string, optional): Filter audits by end date.

## Return Values
- **Create Security Audit**: Returns the created audit details including the status and unique audit ID.
- **Query Security Audits**: Returns a paginated list of audits matching the query parameters, along with metadata such as total counts.

## Examples

### Create an Audit
```http
POST /api/marketplace/agents/security-audit
Content-Type: application/json

{
  "agentId": "123e4567-e89b-12d3-a456-426614174000",
  "auditType": "full",
  "priority": "high",
  "includeStaticAnalysis": true,
  "includeDependencyCheck": true
}
```

### Query Audits
```http
GET /api/marketplace/agents/security-audit?status=completed&page=1&limit=10
```

### Response Structure
```json
{
  "data": [
    {
      "auditId": "audit-01",
      "status": "completed",
      "severity": "medium",
      "type": "behavioral"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10
  }
}
``` 

Use this documentation to effectively implement and interact with the Agent Security Audit API in your applications. Ensure to comply with all validation schemas to maintain data integrity and security.