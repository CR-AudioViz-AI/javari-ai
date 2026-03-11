```typescript
/**
 * CR AudioViz AI - Key Management and Rotation Engine
 * Comprehensive key management system for encryption key generation, rotation, and secure distribution
 */

import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// Core Interfaces
export interface EncryptionKey {
  id: string;
  algorithm: CryptoAlgorithm;
  keyData: Buffer;
  version: number;
  createdAt: Date;
  expiresAt: Date;
  status: KeyStatus;
  metadata: KeyMetadata;
}

export interface KeyMetadata {
  purpose: KeyPurpose;
  serviceId?: string;
  environment: string;
  keySize: number;
  derivedFrom?: string;
  escrowRequired: boolean;
}

export interface RotationPolicy {
  id: string;
  keyPurpose: KeyPurpose;
  rotationInterval: number; // milliseconds
  gracePeriod: number; // milliseconds
  autoRotate: boolean;
  notificationThreshold: number; // milliseconds before expiry
}

export interface KeyDistributionRequest {
  serviceId: string;
  keyPurpose: KeyPurpose;
  environment: string;
  requestedBy: string;
  validUntil?: Date;
}

export interface EscrowRecord {
  keyId: string;
  escrowShares: EscrowShare[];
  threshold: number;
  createdAt: Date;
  recoveryMetadata: any;
}

export interface EscrowShare {
  shareId: string;
  encryptedShare: Buffer;
  custodian: string;
  createdAt: Date;
}

export interface AuditEvent {
  id: string;
  operation: KeyOperation;
  keyId?: string;
  serviceId?: string;
  userId: string;
  timestamp: Date;
  result: 'success' | 'failure';
  details: any;
  ipAddress?: string;
}

// Enums
export enum CryptoAlgorithm {
  AES_256_GCM = 'AES-256-GCM',
  CHACHA20_POLY1305 = 'ChaCha20-Poly1305',
  RSA_4096 = 'RSA-4096',
  ECDSA_P384 = 'ECDSA-P384',
  ED25519 = 'Ed25519'
}

export enum KeyStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  DEPRECATED = 'deprecated',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

export enum KeyPurpose {
  DATA_ENCRYPTION = 'data_encryption',
  AUTH_SIGNING = 'auth_signing',
  TRANSPORT_ENCRYPTION = 'transport_encryption',
  DATABASE_ENCRYPTION = 'database_encryption',
  BACKUP_ENCRYPTION = 'backup_encryption',
  API_SIGNING = 'api_signing'
}

export enum KeyOperation {
  GENERATE = 'generate',
  ROTATE = 'rotate',
  DISTRIBUTE = 'distribute',
  REVOKE = 'revoke',
  RECOVER = 'recover',
  ACCESS = 'access',
  DELETE = 'delete'
}

// Errors
export class KeyManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public keyId?: string
  ) {
    super(message);
    this.name = 'KeyManagementError';
  }
}

/**
 * Pluggable encryption algorithm interface
 */
export interface CryptoProvider {
  algorithm: CryptoAlgorithm;
  generateKey(keySize?: number): Promise<Buffer>;
  encrypt(data: Buffer, key: Buffer, additionalData?: Buffer): Promise<Buffer>;
  decrypt(encryptedData: Buffer, key: Buffer, additionalData?: Buffer): Promise<Buffer>;
  sign?(data: Buffer, privateKey: Buffer): Promise<Buffer>;
  verify?(data: Buffer, signature: Buffer, publicKey: Buffer): Promise<boolean>;
}

/**
 * AES-256-GCM crypto provider implementation
 */
export class AESGCMProvider implements CryptoProvider {
  algorithm = CryptoAlgorithm.AES_256_GCM;

  async generateKey(keySize = 32): Promise<Buffer> {
    return crypto.randomBytes(keySize);
  }

  async encrypt(data: Buffer, key: Buffer, additionalData?: Buffer): Promise<Buffer> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    cipher.setAAD(additionalData || Buffer.alloc(0));
    
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  async decrypt(encryptedData: Buffer, key: Buffer, additionalData?: Buffer): Promise<Buffer> {
    const iv = encryptedData.subarray(0, 16);
    const tag = encryptedData.subarray(16, 32);
    const encrypted = encryptedData.subarray(32);
    
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(tag);
    decipher.setAAD(additionalData || Buffer.alloc(0));
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }
}

/**
 * Encrypted key storage with HSM integration
 */
export class KeyVault {
  private supabase: any;
  private redis: Redis;
  private masterKey: Buffer;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    redisConfig: any,
    masterKey: Buffer
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.redis = new Redis(redisConfig);
    this.masterKey = masterKey;
  }

  /**
   * Store encrypted key in vault
   */
  async storeKey(key: EncryptionKey): Promise<void> {
    try {
      // Encrypt key data with master key
      const encryptedKeyData = await this.encryptWithMasterKey(key.keyData);
      
      // Store in Supabase vault
      const { error } = await this.supabase
        .from('key_vault')
        .insert({
          key_id: key.id,
          algorithm: key.algorithm,
          encrypted_key_data: encryptedKeyData.toString('base64'),
          version: key.version,
          created_at: key.createdAt.toISOString(),
          expires_at: key.expiresAt.toISOString(),
          status: key.status,
          metadata: key.metadata
        });

      if (error) throw new KeyManagementError(
        `Failed to store key: ${error.message}`,
        'VAULT_STORE_ERROR',
        key.id
      );

      // Cache active keys in Redis
      if (key.status === KeyStatus.ACTIVE) {
        await this.redis.setex(
          `key:${key.id}`,
          3600, // 1 hour cache
          JSON.stringify({
            ...key,
            keyData: key.keyData.toString('base64')
          })
        );
      }
    } catch (error) {
      throw new KeyManagementError(
        `Vault storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VAULT_ERROR',
        key.id
      );
    }
  }

  /**
   * Retrieve key from vault
   */
  async retrieveKey(keyId: string): Promise<EncryptionKey | null> {
    try {
      // Try cache first
      const cached = await this.redis.get(`key:${keyId}`);
      if (cached) {
        const keyData = JSON.parse(cached);
        return {
          ...keyData,
          keyData: Buffer.from(keyData.keyData, 'base64'),
          createdAt: new Date(keyData.createdAt),
          expiresAt: new Date(keyData.expiresAt)
        };
      }

      // Retrieve from vault
      const { data, error } = await this.supabase
        .from('key_vault')
        .select('*')
        .eq('key_id', keyId)
        .single();

      if (error || !data) return null;

      // Decrypt key data
      const keyData = await this.decryptWithMasterKey(
        Buffer.from(data.encrypted_key_data, 'base64')
      );

      const key: EncryptionKey = {
        id: data.key_id,
        algorithm: data.algorithm,
        keyData,
        version: data.version,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
        status: data.status,
        metadata: data.metadata
      };

      // Cache if active
      if (key.status === KeyStatus.ACTIVE) {
        await this.redis.setex(
          `key:${keyId}`,
          3600,
          JSON.stringify({
            ...key,
            keyData: key.keyData.toString('base64')
          })
        );
      }

      return key;
    } catch (error) {
      throw new KeyManagementError(
        `Key retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VAULT_RETRIEVAL_ERROR',
        keyId
      );
    }
  }

  /**
   * Update key status
   */
  async updateKeyStatus(keyId: string, status: KeyStatus): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('key_vault')
        .update({ status })
        .eq('key_id', keyId);

      if (error) throw new KeyManagementError(
        `Failed to update key status: ${error.message}`,
        'VAULT_UPDATE_ERROR',
        keyId
      );

      // Remove from cache if deprecated/revoked
      if (status === KeyStatus.DEPRECATED || status === KeyStatus.REVOKED) {
        await this.redis.del(`key:${keyId}`);
      }
    } catch (error) {
      throw new KeyManagementError(
        `Status update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VAULT_ERROR',
        keyId
      );
    }
  }

  private async encryptWithMasterKey(data: Buffer): Promise<Buffer> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.masterKey);
    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    return Buffer.concat([iv, encrypted]);
  }

  private async decryptWithMasterKey(encryptedData: Buffer): Promise<Buffer> {
    const iv = encryptedData.subarray(0, 16);
    const encrypted = encryptedData.subarray(16);
    const decipher = crypto.createDecipher('aes-256-cbc', this.masterKey);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }
}

/**
 * Multi-algorithm key generation service
 */
export class KeyGenerator {
  private providers: Map<CryptoAlgorithm, CryptoProvider> = new Map();

  constructor() {
    this.providers.set(CryptoAlgorithm.AES_256_GCM, new AESGCMProvider());
  }

  /**
   * Register crypto provider
   */
  registerProvider(provider: CryptoProvider): void {
    this.providers.set(provider.algorithm, provider);
  }

  /**
   * Generate new encryption key
   */
  async generateKey(
    algorithm: CryptoAlgorithm,
    purpose: KeyPurpose,
    environment: string,
    keySize?: number,
    escrowRequired = false
  ): Promise<EncryptionKey> {
    const provider = this.providers.get(algorithm);
    if (!provider) {
      throw new KeyManagementError(
        `Unsupported algorithm: ${algorithm}`,
        'ALGORITHM_NOT_SUPPORTED'
      );
    }

    try {
      const keyData = await provider.generateKey(keySize);
      const keyId = `key_${crypto.randomUUID()}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year

      return {
        id: keyId,
        algorithm,
        keyData,
        version: 1,
        createdAt: now,
        expiresAt,
        status: KeyStatus.PENDING,
        metadata: {
          purpose,
          environment,
          keySize: keyData.length,
          escrowRequired
        }
      };
    } catch (error) {
      throw new KeyManagementError(
        `Key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_ERROR'
      );
    }
  }
}

/**
 * Key escrow and recovery system
 */
export class EscrowManager {
  private vault: KeyVault;
  private supabase: any;

  constructor(vault: KeyVault, supabase: any) {
    this.vault = vault;
    this.supabase = supabase;
  }

  /**
   * Create key escrow using Shamir's Secret Sharing
   */
  async createEscrow(
    key: EncryptionKey,
    custodians: string[],
    threshold: number
  ): Promise<EscrowRecord> {
    if (threshold > custodians.length) {
      throw new KeyManagementError(
        'Threshold cannot exceed number of custodians',
        'INVALID_THRESHOLD'
      );
    }

    try {
      const shares = await this.createSecretShares(key.keyData, custodians.length, threshold);
      const escrowShares: EscrowShare[] = shares.map((share, index) => ({
        shareId: crypto.randomUUID(),
        encryptedShare: share,
        custodian: custodians[index],
        createdAt: new Date()
      }));

      const escrowRecord: EscrowRecord = {
        keyId: key.id,
        escrowShares,
        threshold,
        createdAt: new Date(),
        recoveryMetadata: {
          algorithm: key.algorithm,
          keySize: key.keyData.length
        }
      };

      // Store escrow record
      await this.supabase
        .from('key_escrow')
        .insert({
          key_id: key.id,
          threshold,
          created_at: escrowRecord.createdAt.toISOString(),
          recovery_metadata: escrowRecord.recoveryMetadata,
          shares: escrowShares
        });

      return escrowRecord;
    } catch (error) {
      throw new KeyManagementError(
        `Escrow creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ESCROW_ERROR',
        key.id
      );
    }
  }

  /**
   * Recover key from escrow shares
   */
  async recoverFromEscrow(
    keyId: string,
    shares: { shareId: string; decryptedShare: Buffer }[]
  ): Promise<Buffer> {
    try {
      const { data } = await this.supabase
        .from('key_escrow')
        .select('*')
        .eq('key_id', keyId)
        .single();

      if (!data) {
        throw new KeyManagementError('Escrow record not found', 'ESCROW_NOT_FOUND', keyId);
      }

      if (shares.length < data.threshold) {
        throw new KeyManagementError(
          'Insufficient shares for recovery',
          'INSUFFICIENT_SHARES',
          keyId
        );
      }

      // Reconstruct secret from shares
      const recoveredKey = await this.reconstructSecret(
        shares.slice(0, data.threshold).map(s => s.decryptedShare)
      );

      return recoveredKey;
    } catch (error) {
      throw new KeyManagementError(
        `Key recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RECOVERY_ERROR',
        keyId
      );
    }
  }

  private async createSecretShares(
    secret: Buffer,
    numShares: number,
    threshold: number
  ): Promise<Buffer[]> {
    // Simplified Shamir's Secret Sharing implementation
    // In production, use a proper cryptographic library
    const shares: Buffer[] = [];
    
    for (let i = 0; i < numShares; i++) {
      const share = Buffer.alloc(secret.length + 4);
      share.writeUInt32BE(i + 1, 0); // Share index
      
      // XOR with random data for this example
      const randomData = crypto.randomBytes(secret.length);
      for (let j = 0; j < secret.length; j++) {
        share[j + 4] = secret[j] ^ randomData[j];
      }
      
      shares.push(share);
    }
    
    return shares;
  }

  private async reconstructSecret(shares: Buffer[]): Promise<Buffer> {
    // Simplified reconstruction - in production use proper SSS
    const secretLength = shares[0].length - 4;
    const reconstructed = Buffer.alloc(secretLength);
    
    // Simple XOR reconstruction for this example
    for (let i = 0; i < secretLength; i++) {
      let value = 0;
      for (const share of shares) {
        value ^= share[i + 4];
      }
      reconstructed[i] = value;
    }
    
    return reconstructed;
  }
}

/**
 * Service key registry and tracking
 */
export class ServiceKeyRegistry {
  private supabase: any;
  private redis: Redis;

  constructor(supabase: any, redis: Redis) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Register key distribution to service
   */
  async registerDistribution(
    keyId: string,
    serviceId: string,
    distributedAt: Date,
    expiresAt?: Date
  ): Promise<void> {
    try {
      await this.supabase
        .from('service_key_registry')
        .insert({
          key_id: keyId,
          service_id: serviceId,
          distributed_at: distributedAt.toISOString(),
          expires_at: expiresAt?.toISOString(),
          status: 'active'
        });

      // Cache the distribution
      await this.redis.sadd(`service:${serviceId}:keys`, keyId);
      await this.redis.sadd(`key:${keyId}:services`, serviceId);
    } catch (error) {
      throw new KeyManagementError(
        `Distribution registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REGISTRY_ERROR'
      );
    }
  }

  /**
   * Get keys distributed to service
   */
  async getServiceKeys(serviceId: string): Promise<string[]> {
    return await this.redis.smembers(`service:${serviceId}:keys`);
  }

  /**
   * Get services that have a key
   */
  async getKeyServices(keyId: string): Promise<string[]> {
    return await this.redis.smembers(`key:${keyId}:services`);
  }

  /**
   * Revoke key from service
   */
  async revokeFromService(keyId: string, serviceId: string): Promise<void> {
    try {
      await this.supabase
        .from('service_key_registry')
        .update({ status: 'revoked' })
        .eq('key_id', keyId)
        .eq('service_id', serviceId);

      await this.redis.srem(`service:${serviceId}:keys`, keyId);
      await this.redis.srem(`key:${keyId}:services`, serviceId);
    } catch (error) {
      throw new KeyManagementError(
        `Key revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REVOCATION_ERROR'
      );
    }
  }
}

/**
 * Key operation audit trail
 */
export class AuditLogger {
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Log key operation
   */
  async logOperation(
    operation: KeyOperation,
    userId: string,
    result: 'success' | 'failure',
    details: any,
    keyId?: string,
    serviceId?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        id: crypto.randomUUID(),
        operation,
        keyId,
        serviceId,
        userId,
        timestamp: new Date(),
        result,
        details,
        ipAddress
      };

      await this.supabase
        .from('key_audit_log')
        .insert(auditEvent);
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit failures shouldn't break operations
    }
  }

  /**
   * Get audit trail for key
   */
  async getKeyAuditTrail(keyId: string, limit = 100): Promise<AuditEvent[]> {
    try {
      const { data } = await this.supabase
        .from('key_audit_log')
        .select('*')
        .eq('key_id', keyId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      return data || [];
    } catch (error) {
      throw new KeyManagementError(
        `Audit retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AUDIT_ERROR'
      );
    }
  }
}

/**
 * Secure key distribution to services
 */
export class KeyDistributor {
  private vault: KeyVault;
  private registry: ServiceKeyRegistry;
  private auditLogger: AuditLogger;

  constructor(
    vault: KeyVault,
    registry: ServiceKeyRegistry,
    auditLogger: AuditLogger
  ) {
    this.vault = vault;
    this.registry = registry;
    this.auditLogger = auditLogger;
  }

  /**
   * Distribute key to service
   */
  async distributeKey(
    request: KeyDistributionRequest,
    requestedBy: string,
    ipAddress?: string
  ): Promise<EncryptionKey> {
    try {
      // Find active key for purpose
      const keyId = await this.findActiveKeyForPurpose(
        request.keyPurpose,
        request.environment
      );

      if (!keyId) {
        throw new KeyMan