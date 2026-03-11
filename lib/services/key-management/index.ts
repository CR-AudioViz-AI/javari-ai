```typescript
/**
 * @fileoverview Key Management and Encryption Service
 * Provides secure key lifecycle management, certificate handling, cryptographic operations,
 * hardware security module integration, and compliance-ready audit trails.
 * 
 * @author CR AudioViz AI
 * @version 1.0.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, createCipheriv, createDecipheriv, randomBytes, generateKeyPairSync, createSign, createVerify } from 'crypto';
import { SignJWT, jwtVerify, generateKeyPair as generateJWTKeyPair, importJWK, exportJWK } from 'jose';
import Redis from 'ioredis';

// Types
export interface KeyMetadata {
  id: string;
  name: string;
  type: 'symmetric' | 'asymmetric' | 'jwt';
  algorithm: string;
  keySize: number;
  usage: string[];
  status: 'active' | 'inactive' | 'revoked' | 'expired';
  createdAt: Date;
  expiresAt?: Date;
  rotationSchedule?: string;
  complianceLevel: 'basic' | 'enhanced' | 'fips140' | 'cc_eal4';
  hsmId?: string;
  tags: Record<string, string>;
}

export interface Certificate {
  id: string;
  commonName: string;
  subjectAltNames: string[];
  issuer: string;
  serialNumber: string;
  certificate: string;
  privateKeyId: string;
  status: 'active' | 'expired' | 'revoked';
  validFrom: Date;
  validTo: Date;
  keyUsage: string[];
  extendedKeyUsage?: string[];
  createdAt: Date;
}

export interface EncryptionRequest {
  data: string | Buffer;
  keyId: string;
  algorithm?: string;
  additionalData?: string;
}

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  authTag?: string;
  keyId: string;
  algorithm: string;
  timestamp: Date;
}

export interface DecryptionRequest {
  encryptedData: string;
  keyId: string;
  iv: string;
  authTag?: string;
  algorithm?: string;
  additionalData?: string;
}

export interface HSMConfig {
  type: 'aws-kms' | 'azure-kv' | 'hardware' | 'software';
  endpoint?: string;
  credentials: Record<string, unknown>;
  region?: string;
  keyNamespace?: string;
}

export interface AuditEvent {
  id: string;
  eventType: 'key_created' | 'key_used' | 'key_rotated' | 'key_revoked' | 'cert_issued' | 'cert_revoked';
  keyId?: string;
  certificateId?: string;
  userId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  timestamp: Date;
  complianceFlags: string[];
}

export interface ComplianceRule {
  id: string;
  name: string;
  standard: 'pci_dss' | 'hipaa' | 'gdpr' | 'sox' | 'fips140' | 'cc_eal4';
  requirements: {
    keyMinLength: number;
    keyRotationDays: number;
    encryptionAlgorithms: string[];
    requiredKeyUsage: string[];
    auditRetentionDays: number;
    hsmRequired: boolean;
  };
}

export interface KeyRotationPolicy {
  keyId: string;
  rotationIntervalDays: number;
  gracePeriodDays: number;
  autoRotate: boolean;
  notificationDays: number[];
  backupOldKeys: boolean;
}

// Errors
export class KeyManagementError extends Error {
  constructor(message: string, public code: string, public keyId?: string) {
    super(message);
    this.name = 'KeyManagementError';
  }
}

export class HSMError extends Error {
  constructor(message: string, public hsmType: string, public operation: string) {
    super(message);
    this.name = 'HSMError';
  }
}

export class ComplianceError extends Error {
  constructor(message: string, public standard: string, public requirement: string) {
    super(message);
    this.name = 'ComplianceError';
  }
}

/**
 * HSM Adapter Interface
 */
interface HSMAdapter {
  generateKey(keyId: string, algorithm: string, keySize: number): Promise<void>;
  encrypt(keyId: string, data: Buffer, algorithm: string): Promise<Buffer>;
  decrypt(keyId: string, encryptedData: Buffer, algorithm: string): Promise<Buffer>;
  sign(keyId: string, data: Buffer, algorithm: string): Promise<Buffer>;
  verify(keyId: string, data: Buffer, signature: Buffer, algorithm: string): Promise<boolean>;
  rotateKey(keyId: string): Promise<void>;
  deleteKey(keyId: string): Promise<void>;
  getKeyMetadata(keyId: string): Promise<Record<string, unknown>>;
}

/**
 * Software HSM Implementation
 */
class SoftwareHSM implements HSMAdapter {
  private keys = new Map<string, any>();

  async generateKey(keyId: string, algorithm: string, keySize: number): Promise<void> {
    let keyMaterial: any;

    switch (algorithm.toLowerCase()) {
      case 'aes':
        keyMaterial = randomBytes(keySize / 8);
        break;
      case 'rsa':
        keyMaterial = generateKeyPairSync('rsa', {
          modulusLength: keySize,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        break;
      case 'ecdsa':
        keyMaterial = generateKeyPairSync('ec', {
          namedCurve: keySize === 256 ? 'prime256v1' : 'secp384r1',
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        break;
      default:
        throw new HSMError(`Unsupported algorithm: ${algorithm}`, 'software', 'generateKey');
    }

    this.keys.set(keyId, {
      algorithm,
      keySize,
      keyMaterial,
      createdAt: new Date()
    });
  }

  async encrypt(keyId: string, data: Buffer, algorithm: string): Promise<Buffer> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new HSMError(`Key not found: ${keyId}`, 'software', 'encrypt');
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(algorithm, key.keyMaterial, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);

    return Buffer.concat([iv, encrypted]);
  }

  async decrypt(keyId: string, encryptedData: Buffer, algorithm: string): Promise<Buffer> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new HSMError(`Key not found: ${keyId}`, 'software', 'decrypt');
    }

    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);
    
    const decipher = createDecipheriv(algorithm, key.keyMaterial, iv);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }

  async sign(keyId: string, data: Buffer, algorithm: string): Promise<Buffer> {
    const key = this.keys.get(keyId);
    if (!key || !key.keyMaterial.privateKey) {
      throw new HSMError(`Private key not found: ${keyId}`, 'software', 'sign');
    }

    const signer = createSign(algorithm);
    signer.update(data);
    return signer.sign(key.keyMaterial.privateKey);
  }

  async verify(keyId: string, data: Buffer, signature: Buffer, algorithm: string): Promise<boolean> {
    const key = this.keys.get(keyId);
    if (!key || !key.keyMaterial.publicKey) {
      throw new HSMError(`Public key not found: ${keyId}`, 'software', 'verify');
    }

    const verifier = createVerify(algorithm);
    verifier.update(data);
    return verifier.verify(key.keyMaterial.publicKey, signature);
  }

  async rotateKey(keyId: string): Promise<void> {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new HSMError(`Key not found: ${keyId}`, 'software', 'rotateKey');
    }

    await this.generateKey(keyId, oldKey.algorithm, oldKey.keySize);
  }

  async deleteKey(keyId: string): Promise<void> {
    this.keys.delete(keyId);
  }

  async getKeyMetadata(keyId: string): Promise<Record<string, unknown>> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new HSMError(`Key not found: ${keyId}`, 'software', 'getKeyMetadata');
    }

    return {
      algorithm: key.algorithm,
      keySize: key.keySize,
      createdAt: key.createdAt
    };
  }
}

/**
 * Key Management and Encryption Service
 */
export class KeyManagementService {
  private supabase: SupabaseClient;
  private redis: Redis;
  private hsm: HSMAdapter;
  private complianceRules: Map<string, ComplianceRule> = new Map();

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    redisConfig: any,
    hsmConfig: HSMConfig
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisConfig);
    this.hsm = this.initializeHSM(hsmConfig);
    this.initializeComplianceRules();
  }

  /**
   * Initialize HSM adapter based on configuration
   */
  private initializeHSM(config: HSMConfig): HSMAdapter {
    switch (config.type) {
      case 'software':
        return new SoftwareHSM();
      // Add AWS KMS, Azure Key Vault adapters here
      default:
        return new SoftwareHSM();
    }
  }

  /**
   * Initialize default compliance rules
   */
  private initializeComplianceRules(): void {
    const pciDss: ComplianceRule = {
      id: 'pci_dss_v4',
      name: 'PCI DSS v4.0',
      standard: 'pci_dss',
      requirements: {
        keyMinLength: 256,
        keyRotationDays: 365,
        encryptionAlgorithms: ['AES-256-GCM', 'RSA-2048', 'ECDSA-P256'],
        requiredKeyUsage: ['encrypt', 'decrypt'],
        auditRetentionDays: 365,
        hsmRequired: true
      }
    };

    this.complianceRules.set('pci_dss', pciDss);
  }

  /**
   * Generate a new cryptographic key
   */
  async generateKey(
    name: string,
    type: 'symmetric' | 'asymmetric' | 'jwt',
    algorithm: string,
    keySize: number,
    usage: string[],
    options: {
      expiresInDays?: number;
      complianceLevel?: string;
      tags?: Record<string, string>;
      rotationDays?: number;
    } = {}
  ): Promise<KeyMetadata> {
    try {
      // Validate compliance requirements
      if (options.complianceLevel) {
        await this.validateCompliance(algorithm, keySize, usage, options.complianceLevel);
      }

      const keyId = `key_${Date.now()}_${randomBytes(8).toString('hex')}`;
      const now = new Date();
      const expiresAt = options.expiresInDays 
        ? new Date(now.getTime() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      // Generate key in HSM
      await this.hsm.generateKey(keyId, algorithm, keySize);

      // Create key metadata
      const keyMetadata: KeyMetadata = {
        id: keyId,
        name,
        type,
        algorithm,
        keySize,
        usage,
        status: 'active',
        createdAt: now,
        expiresAt,
        complianceLevel: options.complianceLevel as any || 'basic',
        tags: options.tags || {},
        rotationSchedule: options.rotationDays ? `every ${options.rotationDays} days` : undefined
      };

      // Store metadata in Supabase
      const { error } = await this.supabase
        .from('key_metadata')
        .insert(keyMetadata);

      if (error) {
        throw new KeyManagementError(
          `Failed to store key metadata: ${error.message}`,
          'STORAGE_ERROR',
          keyId
        );
      }

      // Set up rotation policy if specified
      if (options.rotationDays) {
        await this.createRotationPolicy(keyId, options.rotationDays);
      }

      // Audit log
      await this.auditLog('key_created', {
        keyId,
        keyType: type,
        algorithm,
        keySize,
        usage: usage.join(',')
      });

      return keyMetadata;
    } catch (error) {
      throw new KeyManagementError(
        `Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_ERROR'
      );
    }
  }

  /**
   * Encrypt data using specified key
   */
  async encrypt(request: EncryptionRequest): Promise<EncryptionResult> {
    try {
      // Get key metadata
      const keyMetadata = await this.getKeyMetadata(request.keyId);
      if (!keyMetadata) {
        throw new KeyManagementError(`Key not found: ${request.keyId}`, 'KEY_NOT_FOUND', request.keyId);
      }

      if (keyMetadata.status !== 'active') {
        throw new KeyManagementError(`Key is not active: ${request.keyId}`, 'KEY_INACTIVE', request.keyId);
      }

      // Check if key supports encryption
      if (!keyMetadata.usage.includes('encrypt')) {
        throw new KeyManagementError(`Key does not support encryption: ${request.keyId}`, 'INVALID_USAGE', request.keyId);
      }

      const algorithm = request.algorithm || keyMetadata.algorithm;
      const data = typeof request.data === 'string' ? Buffer.from(request.data, 'utf8') : request.data;

      // Perform encryption
      const encryptedBuffer = await this.hsm.encrypt(request.keyId, data, algorithm);
      const iv = encryptedBuffer.slice(0, 16);
      const encrypted = encryptedBuffer.slice(16);

      const result: EncryptionResult = {
        encryptedData: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        keyId: request.keyId,
        algorithm,
        timestamp: new Date()
      };

      // Audit log
      await this.auditLog('key_used', {
        keyId: request.keyId,
        operation: 'encrypt',
        algorithm,
        dataSize: data.length
      });

      return result;
    } catch (error) {
      throw new KeyManagementError(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ENCRYPTION_ERROR',
        request.keyId
      );
    }
  }

  /**
   * Decrypt data using specified key
   */
  async decrypt(request: DecryptionRequest): Promise<string> {
    try {
      // Get key metadata
      const keyMetadata = await this.getKeyMetadata(request.keyId);
      if (!keyMetadata) {
        throw new KeyManagementError(`Key not found: ${request.keyId}`, 'KEY_NOT_FOUND', request.keyId);
      }

      if (keyMetadata.status !== 'active') {
        throw new KeyManagementError(`Key is not active: ${request.keyId}`, 'KEY_INACTIVE', request.keyId);
      }

      // Check if key supports decryption
      if (!keyMetadata.usage.includes('decrypt')) {
        throw new KeyManagementError(`Key does not support decryption: ${request.keyId}`, 'INVALID_USAGE', request.keyId);
      }

      const algorithm = request.algorithm || keyMetadata.algorithm;
      const iv = Buffer.from(request.iv, 'base64');
      const encrypted = Buffer.from(request.encryptedData, 'base64');
      const encryptedBuffer = Buffer.concat([iv, encrypted]);

      // Perform decryption
      const decryptedBuffer = await this.hsm.decrypt(request.keyId, encryptedBuffer, algorithm);
      
      // Audit log
      await this.auditLog('key_used', {
        keyId: request.keyId,
        operation: 'decrypt',
        algorithm,
        dataSize: decryptedBuffer.length
      });

      return decryptedBuffer.toString('utf8');
    } catch (error) {
      throw new KeyManagementError(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DECRYPTION_ERROR',
        request.keyId
      );
    }
  }

  /**
   * Create digital signature
   */
  async sign(keyId: string, data: string | Buffer, algorithm?: string): Promise<string> {
    try {
      const keyMetadata = await this.getKeyMetadata(keyId);
      if (!keyMetadata) {
        throw new KeyManagementError(`Key not found: ${keyId}`, 'KEY_NOT_FOUND', keyId);
      }

      if (!keyMetadata.usage.includes('sign')) {
        throw new KeyManagementError(`Key does not support signing: ${keyId}`, 'INVALID_USAGE', keyId);
      }

      const signAlgorithm = algorithm || 'SHA256';
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      
      const signature = await this.hsm.sign(keyId, dataBuffer, signAlgorithm);
      
      await this.auditLog('key_used', {
        keyId,
        operation: 'sign',
        algorithm: signAlgorithm,
        dataSize: dataBuffer.length
      });

      return signature.toString('base64');
    } catch (error) {
      throw new KeyManagementError(
        `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SIGNING_ERROR',
        keyId
      );
    }
  }

  /**
   * Verify digital signature
   */
  async verify(keyId: string, data: string | Buffer, signature: string, algorithm?: string): Promise<boolean> {
    try {
      const keyMetadata = await this.getKeyMetadata(keyId);
      if (!keyMetadata) {
        throw new KeyManagementError(`Key not found: ${keyId}`, 'KEY_NOT_FOUND', keyId);
      }

      if (!keyMetadata.usage.includes('verify')) {
        throw new KeyManagementError(`Key does not support verification: ${keyId}`, 'INVALID_USAGE', keyId);
      }

      const verifyAlgorithm = algorithm || 'SHA256';
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      const isValid = await this.hsm.verify(keyId, dataBuffer, signatureBuffer, verifyAlgorithm);
      
      await this.auditLog('key_used', {
        keyId,
        operation: 'verify',
        algorithm: verifyAlgorithm,
        dataSize: dataBuffer.length,
        signatureValid: isValid
      });

      return isValid;
    } catch (error) {
      throw new KeyManagementError(
        `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VERIFICATION_ERROR',
        keyId
      );
    }
  }

  /**
   * Rotate a key
   */
  async rotateKey(keyId: string, gracePeriodDays = 30): Promise<KeyMetadata> {
    try {
      const oldKeyMetadata = await this.getKeyMetadata(keyId);
      if (!oldKeyMetadata) {
        throw new KeyManagementError(`Key not found: ${keyId}`, 'KEY_NOT_FOUND', keyId);
      }

      // Create backup of old key
      await this.backupKey(keyId);

      // Generate new key material
      await this.hsm.rotateKey(keyId);

      // Update metadata
      const updatedMetadata = {
        ...oldKeyMetadata,
        createdAt: new Date(),
        status: 'active' as const
      };

      const { error } = await this.supabase
        .from('key_metadata')
        .update(updatedMetadata)
        .eq('id', keyId);

      if (error) {
        throw new KeyManagementError(
          `Failed to update key metadata: ${error.message}`,
          'UPDATE_ERROR',
          keyId
        );
      }

      await this.auditLog('key_rotated', {
        keyId,
        gracePeriodDays,
        previousCreatedAt: oldKeyMetadata.createdAt
      });

      return updatedMetadata;
    } catch (error) {
      throw new KeyManagementError(
        `Key rotation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ROTATION_ERROR',
        keyId
      );
    }
  }

  /**
   * Revoke a key
   */
  async revokeKey(keyId: string, reason: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('key_metadata')
        .update({ status: 'revoked' })
        .eq('id', keyId);

      if (error) {
        throw new KeyManagementError(
          `Failed to revoke key: ${error.message}`,
          'REVOCATION_ERROR',
          keyId
        );
      }

      // Clear from cache
      await this.redis.del(`key:${keyId}`);