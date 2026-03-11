# Deploy Key Management Microservice

# Key Management Microservice Documentation

## Purpose
The Key Management Microservice provides a secure and efficient method to handle encryption keys and related operations within the CR AudioViz AI ecosystem. It supports encryption key generation, rotation, distribution, and integrates with Hardware Security Modules (HSM) for enhanced security.

## Usage
The microservice can be utilized as an express application. It is responsible for managing cryptographic keys with features including key generation, rotation scheduling, and audit logging. Additionally, the microservice handles caching and high-availability key distribution.

## Parameters/Props
```typescript
interface KeyManagementServiceConfig {
  supabase: {
    url: string;           // Supabase URL for database interactions
    serviceKey: string;   // Service authentication key for Supabase
  };
  redis: {
    url: string;          // Redis server URL for caching
    password?: string;    // Optional Redis password
    keyPrefix: string;    // Prefix for keys in Redis
  };
  hsm: HSMConfig;         // Configuration for HSM integration
  policies: SecurityPolicies; // Security policies for key management
}
```

### Key Operations
- **Key Generation** (`KeyGenerationRequest`): Generate new encryption keys.
- **Key Rotation** (`KeyRotationRequest`): Schedule and perform rotation of keys.
- **Key Escrow** (`KeyEscrowRequest`): Store keys securely for emergency access.
- **Key Distribution** (`KeyDistributionRequest`): Distribute keys to authorized services.
  
## Return Values
The service provides various response types based on operations, typically encompassing:
- **KeyOperationResult**: Indicates the result of key management operations (success or failure).
- **ServiceHealthStatus**: Current health status of the service.
- **AuditEvent**: Audit log entries for operations performed.

## Examples
### Basic Setup
```typescript
import express from 'express';
import { KeyManagementServiceConfig } from './types';

const app: express.Application = express();
const config: KeyManagementServiceConfig = {
  supabase: {
    url: 'https://your-supabase-url',
    serviceKey: 'your-service-key',
  },
  redis: {
    url: 'redis://your-redis-url',
    password: 'optional-password',
    keyPrefix: 'keyman:',
  },
  // Additional configuration...
};

const keyManagementService = new KeyManagementService(config);
app.use(keyManagementService.router); // Use the service's express router
```

### Generate Key Example
```typescript
const keyGenRequest: KeyGenerationRequest = {
  keyType: KeyType.AES,
  keySize: 256,
};

keyManagementService.generateKey(keyGenRequest)
  .then((result: KeyOperationResult) => {
    console.log('Key generated:', result);
  })
  .catch((error) => {
    console.error('Key generation failed:', error);
  });
```

### Rotate Key Example
```typescript
const rotateRequest: KeyRotationRequest = {
  keyId: 'your-key-id',
};

keyManagementService.rotateKey(rotateRequest)
  .then((result: KeyOperationResult) => {
    console.log('Key rotated:', result);
  })
  .catch((error) => {
    console.error('Key rotation failed:', error);
  });
```

This documentation provides a concise overview of the Key Management Microservice, its configuration, and usage scenarios. Adjust and extend examples as necessary to fit specific implementation needs.