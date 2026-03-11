# Build End-to-End Encryption Service API

# End-to-End Encryption Service API

## Purpose
The End-to-End Encryption Service API provides a secure method for encrypting, decrypting, and managing cryptographic keys within your application. It aims to protect sensitive data by employing various encryption algorithms and supporting hardware security module (HSM) functionalities.

## Usage
This API is designed to be used in server-side applications that require encryption and decryption of data. It supports AES-256-GCM, ChaCha20-Poly1305, and AES-256-CBC algorithms.

## Parameters/Props

### Configuration
- **EncryptionConfig**:
  - `defaultAlgorithm` (string): The default encryption algorithm.
  - `keyRotationInterval` (number): Time interval for key rotation.
  - `hsm` (object): 
    - `enabled` (boolean): If true, use HSM for key management.
    - `provider` (string): The name of the HSM provider.
    - `keySlot` (number, optional): The key slot for HSM.
  - `compliance` (object):
    - `auditLevel` ('basic' | 'detailed' | 'full'): Level of auditing for compliance.
    - `retentionDays` (number): Duration for retaining encryption metrics.

### Request Schemas
- **`encryptRequestSchema`**:
  - `data` (string): The plaintext data to encrypt.
  - `algorithm` (optional, enum): The encryption algorithm to use.
  - `keyId` (optional, string): Identifier for the key.
  - `metadata` (optional, object): Additional information.

- **`decryptRequestSchema`**:
  - `encryptedData` (string): The encrypted data to decrypt.
  - `keyId` (string): Identifier for the key used for decryption.
  - `iv` (string): Initialization vector used in encryption.
  - `authTag` (optional, string): Authentication tag for encrypted data.
  - `metadata` (optional, object): Additional information.

- **`keyExchangeSchema`**:
  - `publicKey` (string): The public key for key exchange.
  - `algorithm` (enum): The algorithm for key exchange ('ECDH' or 'RSA').
  - `keySize` (optional, number): The size of the key.

## Return Values
The API methods return a Promise that resolves to a Buffer containing the encrypted or decrypted data, or an error object in case of failure.

## Examples

### Encrypting Data
```typescript
const request = {
  data: "Sensitive information",
  algorithm: "AES-256-GCM",
  keyId: "your-key-id",
  metadata: { userId: "12345" }
};

const encryptedData = await encryptionService.encrypt(request);
```

### Decrypting Data
```typescript
const decryptRequest = {
  encryptedData: "Base64-encoded-encrypted-data",
  keyId: "your-key-id",
  iv: "initialization-vector",
  authTag: "auth-tag"
};

const decryptedData = await encryptionService.decrypt(decryptRequest);
console.log(decryptedData.toString());
```

### Key Exchange
```typescript
const exchangeRequest = {
  publicKey: "peer-public-key",
  algorithm: "ECDH",
  keySize: 256
};

const sharedKey = await encryptionService.keyExchange(exchangeRequest);
```

This API provides a robust and secure method for end-to-end encryption tailored for modern applications requiring data privacy.