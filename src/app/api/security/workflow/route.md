# Build Security Workflow Automation API

# Security Workflow Automation API Documentation

## Purpose
The Security Workflow Automation API is designed to facilitate the integration and automation of security incident management workflows. It provides endpoints for handling security incidents, adding evidence, and automating remediation actions, leveraging storage solutions such as Supabase, Redis, and Elasticsearch.

## Usage
This API is implemented as a Next.js route, handling requests via the HTTP methods like POST for creating incidents, adding evidence, and executing remediation actions.

### Importing the API
```typescript
import { securityWorkflowAPI } from 'src/app/api/security/workflow/route';
```

### Base URL
The base URL for accessing the API is defined in the environment variables.

## Parameters/Props

### Environment Variables (Required)
- `SUPABASE_URL`: URL of the Supabase backend for data storage.
- `SUPABASE_SERVICE_ROLE_KEY`: Key with service role permissions for Supabase.
- `REDIS_URL`: URL of the Redis instance for caching purposes.
- `ELASTICSEARCH_URL`: URL of the Elasticsearch server for logging and search capabilities.
- `SOAR_API_URL`: URL for the Security Orchestration Automation and Response (SOAR) provider.
- `SOAR_API_KEY`: API key for authentication with the SOAR provider.

### Incident Creation Parameters (Request Body)
```javascript
{
    title: string, // max length 200
    description: string, // max length 5000
    severity: 'low' | 'medium' | 'high' | 'critical',
    source: string, // max length 100
    sourceData?: object, // optional additional data
    assignee?: string, // UUID of the assignee, optional
    tags?: string[], // array of tags (max 10), optional
}
```

### Evidence Submission Parameters (Request Body)
```javascript
{
    incidentId: string, // UUID of the incident
    type: 'log' | 'network' | 'file' | 'memory' | 'registry' | 'process',
    source: string, // max length 100
    data: object, // the actual evidence data
    hash: string, // computed hash, max length 128
    timestamp: string, // ISO datetime string
    metadata?: object, // optional metadata
}
```

### Remediation Action Parameters (Request Body)
```javascript
{
    incidentId: string, // UUID of the incident
    actions: [
        {
            type: 'isolate' | 'block' | 'quarantine' | 'disable' | 'reset' | 'notify',
            target: string, // the target resource
            parameters: object, // additional parameters for the action
        }
    ],
}
```

## Return Values
Responses from the API will return JSON objects indicative of the success or failure of the operations, commonly including:
- Status code (e.g., 200 for success, 400 for bad request)
- Message describing the outcome
- Data relevant to the operation (e.g., created incident ID)

## Examples

### Creating an Incident
```http
POST /api/security/workflow/incidents
{
    "title": "Unauthorized Access",
    "description": "Detected unauthorized access attempt.",
    "severity": "high",
    "source": "Firewall",
    "tags": ["network", "security"]
}
```

### Adding Evidence
```http
POST /api/security/workflow/evidence
{
    "incidentId": "c648efaf-02b1-4971-9bb0-74bc7be8b889",
    "type": "log",
    "source": "Syslog",
    "data": { ... },
    "hash": "abc123...",
    "timestamp": "2023-10-01T12:00:00Z"
}
```

### Executing a Remediation Action
```http
POST /api/security/workflow/remediation
{
    "incidentId": "c648efaf-02b1-4971-9bb0-74bc7be8b889",
    "actions": [
        {
            "type": "block",
            "target": "192.168.1.10",
            "parameters": { "duration": "1h" }
        }
    ]
}
```

This concise documentation provides essential information on how to utilize the Security Workflow Automation API for security incident management.