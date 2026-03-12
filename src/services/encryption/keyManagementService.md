# Create Dynamic Encryption Key Management Service

# Dynamic Encryption Key Management Service

## Purpose
The Dynamic Encryption Key Management Service provides comprehensive encryption key management with features such as automatic rotation, secure distribution, and integration with Hardware Security Modules (HSM) for the CR AudioViz platform.

## Usage
To utilize the Key Management Service, first configure the service with the necessary parameters such as Supabase URL, Redis connection details, and HSM provider settings. Then, you can use the various interfaces to manage encryption keys, including generating, rotating, distributing, and auditing keys.

## Parameters/Props

### Interfaces

#### KeyMetadata
- **keyId**: `string` - Unique identifier for the key.
- **version**: `number` - Current version of the key.
- **algorithm**: `string` - Encryption algorithm used (e.g., AES).
- **keyType**: `'master' | 'data' | 'session' | 'transport'` - Type of key.
- **purpose**: `string[]` - List of purposes for which the key is intended.
- **createdAt**: `Date` - Creation date of the key.
- **expiresAt**: `Date` - Expiration date of the key.
- **rotationInterval**: `number` - Key rotation interval in milliseconds.
- **status**: `'active' | 'pending' | 'deprecated' | 'revoked'` - Current status of the key.
- **hsmKeyId?**: `string` (optional) - Identifier for HSM-managed key.
- **permissions**: `string[]` - Access permissions for this key.
- **auditLog**: `KeyAuditEntry[]` - Log of key actions.

#### KeyAuditEntry
- **timestamp**: `Date` - Time when the action occurred.
- **action**: `'created' | 'rotated' | 'accessed' | 'distributed' | 'revoked'` - Type of action performed.
- **actor**: `string` - Identity of the actor performing the action.
- **source**: `string` - Source from which the action originated.
- **metadata?**: `Record<string, any>` (optional) - Additional metadata related to the action.

#### KeyDistributionRequest
- **keyId**: `string` - Identifier of the key to be distributed.
- **requester**: `string` - Identity of the requester.
- **purpose**: `string` - Purpose for which the key is requested.
- **permissions**: `string[]` - Permissions associated with the key.
- **expiresAt?**: `Date` (optional) - Expiration date for the distributed key.

#### KeyRotationPolicy
- **keyType**: `string` - Type of keys governed by this policy.
- **rotationInterval**: `number` - Interval for automatic key rotation.
- **preRotationNotice**: `number` - Notice period before rotation.
- **maxKeyAge**: `number` - Maximum age of a key.
- **minActiveKeys**: `number` - Minimum number of active keys to retain.
- **autoRotate**: `boolean` - Indicates if auto-rotation is enabled.

#### HSMProvider
- **generateKey(keySpec: KeyGenerationSpec)**: Promises to return a generated key.
- **getKey(keyId: string)**: Promises to return the key associated with `keyId`.
- **deleteKey(keyId: string)**: Promises to delete the key with the specified `keyId`.
- **isAvailable()**: Checks if the HSM provider is available.

#### KeyGenerationSpec
- **algorithm**: `string` - Desired key algorithm (e.g., AES).
- **keySize**: `number` - Size of the key in bits.
- **keyType**: `string` - Type of key to generate.
- **purpose**: `string[]` - Intended purposes for this key.
- **metadata?**: `Record<string, any>` (optional) - Additional metadata for the key.

## Return Values
The service primarily returns promises for asynchronous operations, which upon resolution yield appropriate types specified in the interface definitions, such as `KeyMetadata`, `KeyDistributionRequest`, etc.

## Examples
```typescript
const keyMeta: KeyMetadata = {
  keyId: 'key-123',
  version: 1,
  algorithm: 'AES',
  keyType: 'data',
  purpose: ['encryption', 'decryption'],
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
  status: 'active