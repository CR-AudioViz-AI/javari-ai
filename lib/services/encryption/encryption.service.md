# Build End-to-End Encryption Service

# Encryption Service Documentation

## Purpose
The `EncryptionService` provides end-to-end encryption capabilities, supporting various encryption algorithms and key management strategies. It handles encryption, decryption, key generation, key rotation, and metadata management for secure data transfer and storage.

## Usage
To utilize the `EncryptionService`, instantiate the service and use its methods for encrypting and decrypting data, as well as for managing encryption keys.

```typescript
import { EncryptionService } from './lib/services/encryption/encryption.service';

const encryptionService = new EncryptionService(config);
```

## Parameters/Props

### `EncryptionAlgorithm`
Defines supported encryption algorithms.
- `AES-GCM`
- `ChaCha20-Poly1305`
- `RSA-OAEP`

### `KeyType`
Specifies the types of keys available for encryption:
- `symmetric`
- `asymmetric`
- `ephemeral`
- `master`

### `KeyRotationConfig`
Configuration for automatic key rotation:
- `rotationInterval`: number (milliseconds)
- `maxKeyAge`: number (milliseconds)
- `keyRetentionCount`: number
- `autoRotation`: boolean

### `EncryptionKey`
Metadata structure for an encryption key:
- `id`: string
- `algorithm`: EncryptionAlgorithm
- `type`: KeyType
- `keyData`: ArrayBuffer
- `createdAt`: Date
- `expiresAt`: Date (optional)
- `version`: number
- `isActive`: boolean
- `metadata`: Record<string, any>

### `EncryptionConfig`
Options for configuring the encryption service:
- `defaultAlgorithm`: EncryptionAlgorithm
- `keyRotation`: KeyRotationConfig
- `enableAuditLogging`: boolean
- `compressionEnabled`: boolean
- `integrityCheck`: boolean

### `EncryptedData`
Structure of the encrypted data:
- `data`: ArrayBuffer (encrypted payload)
- `iv`: ArrayBuffer (initialization vector/nonce)
- `authTag`: ArrayBuffer (authentication tag)
- `keyId`: string (key ID used for encryption)
- `algorithm`: EncryptionAlgorithm
- `timestamp`: number
- `hmac`: ArrayBuffer (HMAC for integrity verification)
- `metadata`: Record<string, any> (optional)

### `KeyDerivationParams`
Parameters for deriving encryption keys:
- `salt`: ArrayBuffer
- `iterations`: number
- `algorithm`: string
- `keyLength`: number

## Return Values
The service provides various return values including:
- Encrypted data as an instance of `EncryptedData`.
- Metadata for generated keys as an instance of `EncryptionKey`.
- Configuration acknowledgments when settings are adjusted.

## Examples

### Encrypt Data
```typescript
const encryptedData = await encryptionService.encrypt("Sensitive data", "key-id");
console.log(encryptedData);
```

### Decrypt Data
```typescript
const decryptedData = await encryptionService.decrypt(encryptedData);
console.log(decryptedData); // Outputs: "Sensitive data"
```

### Generate Encryption Key
```typescript
const encryptionKey = await encryptionService.generateKey();
console.log(encryptionKey);
```

This documentation serves as a guide to effectively use the `EncryptionService` for secure data management practices.