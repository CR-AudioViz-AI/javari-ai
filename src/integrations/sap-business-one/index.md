# Build SAP Business One Integration Module

```markdown
# SAP Business One Integration Module

## Purpose
The SAP Business One Integration Module provides comprehensive integration capabilities with SAP Business One. It enables real-time data synchronization, automated workflow management, and custom field mapping to enhance business processes.

## Usage
To utilize this module, configure your connection settings, handle errors appropriately, and use the provided types for creating and managing SAP entities.

### Installation
Ensure you have the required dependencies installed:
```bash
npm install @supabase/supabase-js ioredis zod
```

### Initialization
To initialize the integration, provide a configuration object that conforms to the `SAPConfig` schema.

### Example:
```typescript
import { SAPConfig } from './src/integrations/sap-business-one/index';

const config: SAPConfig = {
  serverUrl: 'https://example.com/api',
  companyDb: 'sampleDB',
  username: 'user',
  password: 'pass',
  version: '10.0',
  timeout: 30000,
  retryAttempts: 3,
  batchSize: 100,
  syncInterval: 300000,
  enableWebhooks: true,
  webhookSecret: 'your_secret_key',
  customFields: {
    additionalField1: 'value1',
    additionalField2: 'value2',
  },
};
```

## Parameters/Props
### SAPConfig
- **serverUrl** (string): The URL for the SAP Business One server.
- **companyDb** (string): The target company database.
- **username** (string): Username for authentication.
- **password** (string): Password for authentication.
- **version** (string, default: '10.0'): The version of SAP Business One to integrate with.
- **timeout** (number, default: 30000): Timeout for requests in milliseconds.
- **retryAttempts** (number, default: 3): Number of retry attempts for failed requests.
- **batchSize** (number, default: 100): Number of records to process in each batch.
- **syncInterval** (number, default: 300000): Frequency of synchronization in milliseconds.
- **enableWebhooks** (boolean, default: true): Enables/disables webhook functionality.
- **webhookSecret** (string, optional): Secret key for webhook validation.
- **customFields** (record): Additional fields that can be customized.

## Return Values
The module defines types that are used for managing entities in SAP:
- **SAPEntity**: Represents a general entity in SAP with optional properties.
- **SAPBusinessPartner**: Represents a business partner with specific fields.
- **SAPDocument**: Represents a document with properties unique to documents in SAP.

## Error Handling
This module includes custom error classes to handle various SAP-related errors:
- **SAPError**: Base error class.
- **SAPAuthError**: Error thrown during authentication issues.
- **SAPSyncError**: Error thrown during synchronization issues.

### Example Error Usage:
```typescript
try {
  // Logic that may throw errors
} catch (error) {
  if (error instanceof SAPAuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof SAPSyncError) {
    console.error('Synchronization failed:', error.message);
  }
}
```

This integration module ensures robust interaction with SAP Business One, enabling streamlined operations and data consistency across your business applications.
```