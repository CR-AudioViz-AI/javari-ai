# Build Compliance Automation Framework

# Compliance Automation Framework

## Purpose
The Compliance Automation Framework provides a structured approach to classify data sensitivity, enforce compliance regulations, manage retention policies, and log audit trails. It streamlines the process of ensuring that data handling adheres to various compliance requirements.

## Usage
Import the Compliance Framework in your TypeScript project to classify data, manage retention policies, and log compliance actions. The framework contains enumerations and interfaces that provide the foundation for managing compliance-related data within an application.

```typescript
import { DataSensitivity, ComplianceRegulation, DataClassificationResult, RetentionPolicy, AuditTrailEntry, ComplianceViolation } from '@/lib/compliance/framework';
```

## Parameters/Props

### Enumerations

1. **DataSensitivity**
   - Specifies sensitivity levels for data classification:
     - `PUBLIC`
     - `INTERNAL`
     - `CONFIDENTIAL`
     - `RESTRICTED`
     - `HIGHLY_RESTRICTED`

2. **ComplianceRegulation**
   - Represents different compliance regulation types:
     - `GDPR`
     - `HIPAA`
     - `SOX`
     - `PCI_DSS`
     - `CCPA`
     - `SOC2`

### Interfaces

1. **DataClassificationResult**
   - Represents the result of data classification:
     - `id`: Unique identifier
     - `data`: Classified data
     - `sensitivity`: Sensitivity level (DataSensitivity)
     - `regulations`: List of compliance regulations (ComplianceRegulation[])
     - `classificationRules`: List of rules applied for classification
     - `confidence`: Confidence score (number)
     - `timestamp`: Classification time (Date)

2. **RetentionPolicy**
   - Configuration for data retention:
     - `id`: Unique identifier
     - `name`: Name of the policy
     - `dataType`: Type of data
     - `retentionPeriod`: Retention duration in days
     - `archiveAfter`: Optional days to archive after (number)
     - `deleteAfter`: Duration in days before deletion
     - `regulations`: Applicable regulations (ComplianceRegulation[])
     - `exceptions`: Optional exceptions (string[])
     - `createdAt`: Creation date (Date)
     - `updatedAt`: Last update date (Date)

3. **AuditTrailEntry**
   - Records actions for compliance:
     - `id`: Unique identifier
     - `userId`: Optional user identifier
     - `sessionId`: Identifier for the session
     - `action`: Action description (string)
     - `resource`: Resource name (string)
     - `resourceId`: Optional resource identifier
     - `metadata`: Additional metadata (Record<string, unknown>)
     - `ipAddress`: User's IP address (string)
     - `userAgent`: User's browser agent (string)
     - `timestamp`: Action timestamp (Date)
     - `outcome`: Action outcome ('success', 'failure', 'warning')
     - `compliance`: Compliance details

4. **ComplianceViolation**
   - Represents an incident of non-compliance:
     - `id`: Unique identifier
     - `type`: Type of violation
     - `severity`: Severity level ('low', 'medium', 'high', 'critical')
     - `regulation`: Applicable regulation (ComplianceRegulation)
     - `description`: Violation details
     - `affectedData`: Data affected (string[])
     - `detectedAt`: Detection time (Date)
     - `resolvedAt`: Optional resolution time (Date)
     - `status`: Current status ('open', 'investigating', 'resolved')

## Examples

### Classifying Data

```typescript
const classificationResult: DataClassificationResult = {
  id: '123',
  data: { name: 'John Doe', SSN: '123-45-6789' },
  sensitivity: DataSensitivity.CONFIDENTIAL,
  regulations: [ComplianceRegulation.GDPR, ComplianceRegulation.HIPAA],
  classificationRules: ['Rule 1', 'Rule 2'],
  confidence: 0.95,
  timestamp: new Date(),
};
```

### Defining a Retention Policy

```typescript
const retentionPolicy: RetentionPolicy = {
  id: 'policy_001',
  name: 'Customer Data Retention Policy',
  dataType: 'personal_information',
  retentionPeriod: 365,
  deleteAfter: 30,
  regulations: [ComplianceRegulation.GDPR],
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

This documentation should help developers to implement and utilize the Compliance Automation Framework.