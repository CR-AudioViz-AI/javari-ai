# Deploy End-to-End Encryption Microservice

# End-to-End Encryption Microservice

## Purpose
The End-to-End Encryption Microservice provides cryptographic operations, key management, data encryption at rest and in transit, and secure communication channels with hardware security module (HSM) integration. This service aims to enhance the security and confidentiality of sensitive data.

## Usage
To utilize the End-to-End Encryption Microservice, you need to initialize the service with appropriate configurations and then employ the provided methods for encryption, decryption, key management, and secure communication.

## Parameters/Props

### Interfaces

- **EncryptionOptions**
  - `algorithm` (optional): The encryption algorithm; options include 'AES-256-GCM', 'AES-256-CBC', 'ChaCha20-Poly1305'.
  - `keySize` (optional): Size of the encryption key; must be 256 or 512 bits.
  - `ivSize` (optional): Size of the initialization vector; options are 12 or 16 bytes.
  - `tagSize` (optional): Size of the authentication tag; default is 16 bytes.
  - `iterations` (optional): Number of iterations for key derivation function (KDF).

- **KeyMetadata**
  - `id`: Unique identifier for the key.
  - `algorithm`: Algorithm used for encryption.
  - `keySize`: Size of the key.
  - `purpose`: Specifies the key's purpose ('encryption', 'signing', or 'kdf').
  - `createdAt`: Date of key creation.
  - `expiresAt` (optional): Expiration date of the key.
  - `rotationSchedule` (optional): Schedule for key rotation.
  - `hsmManaged`: Indicates if the key is managed by HSM.

- **EncryptedData**
  - `data`: Base64 encoded encrypted data.
  - `iv`: Initialization vector used for encryption.
  - `tag` (optional): Authentication tag.
  - `algorithm`: The encryption algorithm used.
  - `keyId`: Identifier for the key used.
  - `timestamp`: Timestamp of the encryption operation.

- **SecureChannel**
  - `channelId`: Identifier for the secure communication channel.
  - `publicKey`: Public key for encryption.
  - `sharedSecret` (optional): Shared secret for the channel.
  - `established`: Indicates if the channel is established.
  - `expiresAt`: Expiration date of the secure channel.

- **HSMConfig**
  - `provider`: HSM provider ('aws-kms', 'azure-keyvault', 'hashicorp-vault', or 'local-hsm').
  - `endpoint`: Endpoint for the HSM.
  - `credentials`: Required credentials for accessing the HSM.
  - `keySpecs`: Keys specifications for master, signing, and encryption keys.

- **VaultConfig**
  - `supabaseUrl`: URL for Supabase instance.
  - `supabaseKey`: API key for Supabase.
  - `redisUrl`: URL for Redis instance.
  - `hsmConfig`: Configuration object for HSM.
  - `encryptionDefaults`: Default encryption options.

## Return Values
The microservice methods return objects defined by the above interfaces based on the operation performed (e.g., encryption result, key metadata, secure channel information).

## Examples

### Example: Encrypt Data
```typescript
const encryptionService = new EncryptionService(vaultConfig);
const encryptedData = await encryptionService.encrypt("Sensitive data", { algorithm: 'AES-256-GCM' });
console.log(encryptedData);
```

### Example: Decrypt Data
```typescript
const decryptedData = await encryptionService.decrypt(encryptedData);
console.log(decryptedData); // "Sensitive data"
```

### Example: Create Secure Channel
```typescript
const secureChannel = await encryptionService.createChannel();
console.log(secureChannel);
```

This documentation outlines the essential components and functionalities of the End-to-End Encryption Microservice, enabling users to implement cryptographic operations securely and efficiently.