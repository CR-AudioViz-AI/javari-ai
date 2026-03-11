# Build Key Management and Encryption Service

```markdown
# Key Management and Encryption Service

## Purpose
The Key Management and Encryption Service provides a secure API to manage cryptographic keys throughout their lifecycle. It handles certificate management, cryptographic operations, and integrates with hardware security modules (HSMs) while ensuring compliance-ready audit trails.

## Usage
To use this service, import the necessary functions and classes from the module and instantiate the desired operations for key and certificate management, encryption, and decryption.

```typescript
import {
  createClient,
  EncryptionRequest,
  EncryptionResult,
  DecryptionRequest,
  KeyMetadata,
  Certificate,
  HSMConfig
} from './lib/services/key-management';
```

## Parameters/Props

### KeyMetadata
- `id`: Unique identifier for the key.
- `name`: Human-readable name for the key.
- `type`: Type of key ('symmetric', 'asymmetric', or 'jwt').
- `algorithm`: Cryptographic algorithm used.
- `keySize`: Size of the key in bits.
- `usage`: Array of allowed usages for the key.
- `status`: Current state of the key ('active', 'inactive', 'revoked', 'expired').
- `createdAt`: Date the key was created.
- `expiresAt`: Optional expiration date for the key.
- `rotationSchedule`: Key rotation schedule.
- `complianceLevel`: Compliance level ('basic', 'enhanced', 'fips140', or 'cc_eal4').
- `hsmId`: Optional identifier for the associated HSM.
- `tags`: Key-value pairs for additional metadata.

### Certificate
- `id`: Unique identifier for the certificate.
- `commonName`: Common Name of the certificate.
- `subjectAltNames`: Array of subject alternative names.
- `issuer`: Issuer of the certificate.
- `serialNumber`: Serial number of the certificate.
- `certificate`: Base64 encoded certificate data.
- `privateKeyId`: Identifier for the associated private key.
- `status`: Status of the certificate ('active', 'expired', 'revoked').
- `validFrom`: Start date of the certificate validity.
- `validTo`: End date of the certificate validity.
- `keyUsage`: Array of allowed key usages.
- `extendedKeyUsage`: Optional array of extended key usages.
- `createdAt`: Date the certificate was created.

### EncryptionRequest
- `data`: Data to encrypt (string or Buffer).
- `keyId`: Identifier for the key used for encryption.
- `algorithm`: Optional encryption algorithm.
- `additionalData`: Optional data for additional authenticated data.

### EncryptionResult
- `encryptedData`: The encrypted output data.
- `iv`: Initialization vector used for encryption.
- `authTag`: Optional authentication tag.
- `keyId`: Identifier for the key used.
- `algorithm`: Algorithm used for the encryption.
- `timestamp`: Date and time of encryption.

### DecryptionRequest
- `encryptedData`: Encrypted data to decrypt.
- `keyId`: Identifier for the key used for decryption.
- `iv`: Initialization vector used for decryption.
- `authTag`: Optional authentication tag.
- `algorithm`: Optional decryption algorithm.
- `additionalData`: Optional data for additional authenticated data.

### HSMConfig
- `type`: Type of HSM ('aws-kms', 'azure-kv', 'hardware', 'software').
- `endpoint`: Optional endpoint for the HSM.
- `credentials`: Credentials required for HSM authentication.
- `region`: Optional region identifier.

## Return Values
- Encryption operations return an `EncryptionResult` object containing the encrypted data and metadata.
- Decryption operations return the decrypted data or throw an error if decryption fails.

## Examples

### Encrypting Data
```typescript
const encryptionRequest: EncryptionRequest = {
  data: "my secret data",
  keyId: "key-123",
  algorithm: "aes-256-gcm"
};
const encryptedResult: EncryptionResult = await encryptData(encryptionRequest);
```

### Decrypting Data
```typescript
const decryptionRequest: DecryptionRequest = {
  encryptedData: encryptedResult.encryptedData,
  keyId: "key-123",
  iv: encryptedResult.iv,
  authTag: encryptedResult.authTag
};
const decryptedData = await decryptData(decryptionRequest);
```
```