```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes, createHash, pbkdf2, scrypt, timingSafeEqual } from 'crypto';
import { schedule, ScheduledTask } from 'node-cron';
import Redis from 'ioredis';

/**
 * Supported encryption algorithms
 */
export enum EncryptionAlgorithm {
  AES_256_GCM = 'AES-256-GCM',
  RSA_4096 = 'RSA-4096',
  ECDSA_P384 = 'ECDSA-P384'
}

/**
 * Key derivation algorithms
 */
export enum KeyDerivationAlgorithm {
  PBKDF2 = 'PBKDF2',
  ARGON2ID = 'ARGON2ID'
}

/**
 * Key status enumeration
 */
export enum KeyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  PENDING_ROTATION = 'pending_rotation'
}

/**
 * HSM provider types
 */
export enum HSMProvider {
  AWS_CLOUDHSM = 'aws_cloudhsm',
  AZURE_KEY_VAULT = 'azure_key_vault',
  SOFTWARE = 'software'
}

/**
 * Encryption key metadata interface
 */
export interface EncryptionKey {
  id: string;
  algorithm: EncryptionAlgorithm;
  status: KeyStatus;
  createdAt: Date;
  expiresAt: Date;
  rotatedAt?: Date;
  version: number;
  keyMaterial?: Buffer;
  publicKey?: string;
  metadata: Record<string, any>;
}

/**
 * Key rotation policy configuration
 */
export interface RotationPolicy {
  id: string;
  name: string;
  algorithm: EncryptionAlgorithm;
  rotationInterval: number; // in milliseconds
  maxKeyAge: number; // in milliseconds
  autoRotate: boolean;
  notifyBefore: number; // notify N milliseconds before expiry
  emergencyRevocation: boolean;
  hsm: {
    enabled: boolean;
    provider: HSMProvider;
    keySpecification?: string;
  };
}

/**
 * Key vault interface for secure storage
 */
export interface KeyVault {
  store(keyId: string, keyData: Buffer, metadata: Record<string, any>): Promise<void>;
  retrieve(keyId: string): Promise<{ keyData: Buffer; metadata: Record<string, any> } | null>;
  delete(keyId: string): Promise<void>;
  list(status?: KeyStatus): Promise<EncryptionKey[]>;
  updateStatus(keyId: string, status: KeyStatus): Promise<void>;
}

/**
 * HSM adapter interface
 */
export interface HSMAdapter {
  generateKey(algorithm: EncryptionAlgorithm, keySpec?: string): Promise<EncryptionKey>;
  sign(keyId: string, data: Buffer): Promise<Buffer>;
  verify(keyId: string, data: Buffer, signature: Buffer): Promise<boolean>;
  encrypt(keyId: string, plaintext: Buffer): Promise<Buffer>;
  decrypt(keyId: string, ciphertext: Buffer): Promise<Buffer>;
  deleteKey(keyId: string): Promise<void>;
  getKeyMetadata(keyId: string): Promise<Record<string, any>>;
}

/**
 * Algorithm provider interface
 */
export interface AlgorithmProvider {
  generateKey(algorithm: EncryptionAlgorithm): Promise<EncryptionKey>;
  deriveKey(password: string, salt: Buffer, algorithm: KeyDerivationAlgorithm): Promise<Buffer>;
  validateKey(key: EncryptionKey): Promise<boolean>;
}

/**
 * Audit event interface
 */
export interface AuditEvent {
  eventType: 'KEY_GENERATED' | 'KEY_ROTATED' | 'KEY_EXPIRED' | 'KEY_REVOKED' | 'ROTATION_FAILED';
  keyId: string;
  algorithm: EncryptionAlgorithm;
  timestamp: Date;
  metadata: Record<string, any>;
  error?: string;
}

/**
 * Key rotation service configuration
 */
export interface KeyRotationServiceConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  redisUrl?: string;
  hsmConfig?: {
    provider: HSMProvider;
    credentials: Record<string, any>;
  };
  defaultRotationInterval: number;
  enableAutomatedRotation: boolean;
}

/**
 * Supabase-based key vault implementation
 */
export class SupabaseKeyVault implements KeyVault {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, serviceKey: string) {
    this.supabase = createClient(supabaseUrl, serviceKey);
  }

  /**
   * Store encrypted key in Supabase vault
   */
  async store(keyId: string, keyData: Buffer, metadata: Record<string, any>): Promise<void> {
    const encryptedData = keyData.toString('base64');
    
    const { error } = await this.supabase
      .from('encryption_keys')
      .insert({
        id: keyId,
        key_data: encryptedData,
        metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store key: ${error.message}`);
    }
  }

  /**
   * Retrieve encrypted key from Supabase vault
   */
  async retrieve(keyId: string): Promise<{ keyData: Buffer; metadata: Record<string, any> } | null> {
    const { data, error } = await this.supabase
      .from('encryption_keys')
      .select('key_data, metadata')
      .eq('id', keyId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      keyData: Buffer.from(data.key_data, 'base64'),
      metadata: data.metadata || {}
    };
  }

  /**
   * Delete key from vault
   */
  async delete(keyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('encryption_keys')
      .delete()
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to delete key: ${error.message}`);
    }
  }

  /**
   * List keys by status
   */
  async list(status?: KeyStatus): Promise<EncryptionKey[]> {
    let query = this.supabase
      .from('encryption_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list keys: ${error.message}`);
    }

    return data?.map(row => ({
      id: row.id,
      algorithm: row.algorithm,
      status: row.status,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      rotatedAt: row.rotated_at ? new Date(row.rotated_at) : undefined,
      version: row.version || 1,
      metadata: row.metadata || {}
    })) || [];
  }

  /**
   * Update key status
   */
  async updateStatus(keyId: string, status: KeyStatus): Promise<void> {
    const { error } = await this.supabase
      .from('encryption_keys')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to update key status: ${error.message}`);
    }
  }
}

/**
 * Software-based algorithm provider implementation
 */
export class SoftwareAlgorithmProvider implements AlgorithmProvider {
  /**
   * Generate encryption key for specified algorithm
   */
  async generateKey(algorithm: EncryptionAlgorithm): Promise<EncryptionKey> {
    const keyId = this.generateKeyId();
    const createdAt = new Date();
    const expiresAt = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 year

    let keyMaterial: Buffer;
    let publicKey: string | undefined;

    switch (algorithm) {
      case EncryptionAlgorithm.AES_256_GCM:
        keyMaterial = randomBytes(32); // 256 bits
        break;

      case EncryptionAlgorithm.RSA_4096:
        // In production, use crypto.generateKeyPair
        keyMaterial = randomBytes(512); // Placeholder for RSA key
        publicKey = 'RSA_PUBLIC_KEY_PLACEHOLDER';
        break;

      case EncryptionAlgorithm.ECDSA_P384:
        keyMaterial = randomBytes(48); // P-384 curve
        publicKey = 'ECDSA_PUBLIC_KEY_PLACEHOLDER';
        break;

      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    return {
      id: keyId,
      algorithm,
      status: KeyStatus.ACTIVE,
      createdAt,
      expiresAt,
      version: 1,
      keyMaterial,
      publicKey,
      metadata: {
        generatedBy: 'SoftwareAlgorithmProvider',
        keySize: keyMaterial.length * 8
      }
    };
  }

  /**
   * Derive key using specified algorithm
   */
  async deriveKey(password: string, salt: Buffer, algorithm: KeyDerivationAlgorithm): Promise<Buffer> {
    switch (algorithm) {
      case KeyDerivationAlgorithm.PBKDF2:
        return new Promise((resolve, reject) => {
          pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
          });
        });

      case KeyDerivationAlgorithm.ARGON2ID:
        // Using scrypt as Argon2id alternative (Node.js built-in)
        return new Promise((resolve, reject) => {
          scrypt(password, salt, 32, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
          });
        });

      default:
        throw new Error(`Unsupported key derivation algorithm: ${algorithm}`);
    }
  }

  /**
   * Validate key integrity
   */
  async validateKey(key: EncryptionKey): Promise<boolean> {
    if (!key.keyMaterial || key.keyMaterial.length === 0) {
      return false;
    }

    // Check key size based on algorithm
    switch (key.algorithm) {
      case EncryptionAlgorithm.AES_256_GCM:
        return key.keyMaterial.length === 32;
      case EncryptionAlgorithm.RSA_4096:
        return key.keyMaterial.length >= 256;
      case EncryptionAlgorithm.ECDSA_P384:
        return key.keyMaterial.length === 48;
      default:
        return false;
    }
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }
}

/**
 * Audit logger for key rotation events
 */
export class AuditLogger {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, serviceKey: string) {
    this.supabase = createClient(supabaseUrl, serviceKey);
  }

  /**
   * Log audit event
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          event_type: event.eventType,
          key_id: event.keyId,
          algorithm: event.algorithm,
          timestamp: event.timestamp.toISOString(),
          metadata: event.metadata,
          error: event.error
        });

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (err) {
      console.error('Audit logging error:', err);
    }
  }
}

/**
 * Key validation service
 */
export class KeyValidationService {
  private algorithmProvider: AlgorithmProvider;

  constructor(algorithmProvider: AlgorithmProvider) {
    this.algorithmProvider = algorithmProvider;
  }

  /**
   * Validate key integrity and expiration
   */
  async validateKey(key: EncryptionKey): Promise<{ valid: boolean; reason?: string }> {
    // Check if key is expired
    if (key.expiresAt < new Date()) {
      return { valid: false, reason: 'Key has expired' };
    }

    // Check if key is revoked
    if (key.status === KeyStatus.REVOKED) {
      return { valid: false, reason: 'Key is revoked' };
    }

    // Validate key material
    const materialValid = await this.algorithmProvider.validateKey(key);
    if (!materialValid) {
      return { valid: false, reason: 'Invalid key material' };
    }

    return { valid: true };
  }

  /**
   * Check if key needs rotation
   */
  needsRotation(key: EncryptionKey, policy: RotationPolicy): boolean {
    const now = Date.now();
    const keyAge = now - key.createdAt.getTime();
    const timeToExpiry = key.expiresAt.getTime() - now;

    return (
      keyAge >= policy.rotationInterval ||
      timeToExpiry <= policy.notifyBefore ||
      key.status === KeyStatus.PENDING_ROTATION
    );
  }
}

/**
 * Emergency key revocation system
 */
export class EmergencyKeyRevocation {
  private keyVault: KeyVault;
  private auditLogger: AuditLogger;
  private redis?: Redis;

  constructor(keyVault: KeyVault, auditLogger: AuditLogger, redisUrl?: string) {
    this.keyVault = keyVault;
    this.auditLogger = auditLogger;
    
    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    }
  }

  /**
   * Immediately revoke a key
   */
  async revokeKey(keyId: string, reason: string): Promise<void> {
    try {
      // Update key status to revoked
      await this.keyVault.updateStatus(keyId, KeyStatus.REVOKED);

      // Clear from cache
      if (this.redis) {
        await this.redis.del(`key:${keyId}`);
      }

      // Log revocation event
      await this.auditLogger.logEvent({
        eventType: 'KEY_REVOKED',
        keyId,
        algorithm: EncryptionAlgorithm.AES_256_GCM, // Default, should be retrieved
        timestamp: new Date(),
        metadata: { reason, emergency: true }
      });

      console.log(`Emergency key revocation completed for key: ${keyId}`);
    } catch (error) {
      console.error('Emergency key revocation failed:', error);
      throw error;
    }
  }

  /**
   * Batch revoke multiple keys
   */
  async batchRevokeKeys(keyIds: string[], reason: string): Promise<void> {
    const promises = keyIds.map(keyId => this.revokeKey(keyId, reason));
    await Promise.all(promises);
  }
}

/**
 * Main key rotation service
 */
export class KeyRotationService {
  private config: KeyRotationServiceConfig;
  private keyVault: KeyVault;
  private algorithmProvider: AlgorithmProvider;
  private auditLogger: AuditLogger;
  private validationService: KeyValidationService;
  private emergencyRevocation: EmergencyKeyRevocation;
  private redis?: Redis;
  private rotationTasks: Map<string, ScheduledTask> = new Map();

  constructor(config: KeyRotationServiceConfig) {
    this.config = config;
    this.keyVault = new SupabaseKeyVault(config.supabaseUrl, config.supabaseServiceKey);
    this.algorithmProvider = new SoftwareAlgorithmProvider();
    this.auditLogger = new AuditLogger(config.supabaseUrl, config.supabaseServiceKey);
    this.validationService = new KeyValidationService(this.algorithmProvider);
    this.emergencyRevocation = new EmergencyKeyRevocation(
      this.keyVault,
      this.auditLogger,
      config.redisUrl
    );

    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl);
    }
  }

  /**
   * Initialize the key rotation service
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing Key Rotation Service...');

      // Start automated rotation if enabled
      if (this.config.enableAutomatedRotation) {
        await this.startAutomatedRotation();
      }

      console.log('Key Rotation Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Key Rotation Service:', error);
      throw error;
    }
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(algorithm: EncryptionAlgorithm, policy?: RotationPolicy): Promise<EncryptionKey> {
    try {
      const key = await this.algorithmProvider.generateKey(algorithm);

      // Store key in vault
      if (key.keyMaterial) {
        await this.keyVault.store(key.id, key.keyMaterial, key.metadata);
      }

      // Cache key metadata
      if (this.redis) {
        await this.redis.setex(
          `key:${key.id}`,
          3600, // 1 hour cache
          JSON.stringify({
            id: key.id,
            algorithm: key.algorithm,
            status: key.status,
            expiresAt: key.expiresAt
          })
        );
      }

      // Schedule rotation if policy provided
      if (policy && policy.autoRotate) {
        this.scheduleKeyRotation(key, policy);
      }

      // Log generation event
      await this.auditLogger.logEvent({
        eventType: 'KEY_GENERATED',
        keyId: key.id,
        algorithm: key.algorithm,
        timestamp: new Date(),
        metadata: { policy: policy?.name }
      });

      return key;
    } catch (error) {
      console.error('Key generation failed:', error);
      throw error;
    }
  }

  /**
   * Rotate an existing key
   */
  async rotateKey(keyId: string, policy: RotationPolicy): Promise<EncryptionKey> {
    try {
      // Get current key
      const keys = await this.keyVault.list();
      const currentKey = keys.find(k => k.id === keyId);

      if (!currentKey) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Generate new key
      const newKey = await this.algorithmProvider.generateKey(currentKey.algorithm);
      newKey.version = currentKey.version + 1;

      // Store new key
      if (newKey.keyMaterial) {
        await this.keyVault.store(newKey.id, newKey.keyMaterial, newKey.metadata);
      }

      // Mark old key as expired
      await this.keyVault.updateStatus(keyId, KeyStatus.EXPIRED);

      // Update cache
      if (this.redis) {
        await this.redis.del(`key:${keyId}`);
        await this.redis.setex(
          `key:${newKey.id}`,
          3600,
          JSON.stringify({
            id: newKey.id,
            algorithm: newKey.algorithm,
            status: newKey.status,
            expiresAt: newKey.expiresAt
          })
        );
      }

      // Schedule next rotation
      if (policy.autoRotate) {
        this.scheduleKeyRotation(newKey, policy);
      }

      // Log rotation event
      await this.auditLogger.logEvent({
        eventType: 'KEY_ROTATED',
        keyId: newKey.id,
        algorithm: newKey.algorithm,
        timestamp: new Date(),
        metadata: { 
          previousKeyId: keyId,
          policy: policy.name,
          version: newKey.version
        }
      });

      return newKey;
    } catch (error) {
      console.error('Key rotation failed:', error);
      
      await this.auditLogger.logEvent({
        eventType: 'ROTATION_FAILED',
        keyId,
        algorithm: EncryptionAlgorithm.AES_256_GCM, // Default
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Get active encryption key
   */
  async getActiveKey(algorithm: EncryptionAlgorithm): Promise<EncryptionKey | null> {
    const keys = await this.keyVault.list(KeyStatus.ACTIVE);
    return keys.find(k => k.algorithm === algorithm) || null;
  }

  /**
   * Schedule automated key rotation
   */
  private scheduleKeyRotation(key: EncryptionKey, policy: RotationPolicy): void {
    const cronExpression = this.calculateCronExpression(policy.rotationInterval);
    
    const task = schedule(cronExpression, async () => {
      try {
        await this.rotateKey(key.id, policy);
      } catch (error) {
        console.error(`Automated rotation failed for key ${key.id}:`, error);
      }
    });

    this.rotationTasks.set(key.id, task);
  }

  /**
   * Start automated rotation monitoring
   */
  private async startAutomatedRotation(): Promise<void> {
    // Check for keys needing rotation every hour
    const monitoringTask = schedule('0 * * * *', async () => {
      try {
        await this.checkKeysForRotation();
      } catch (error) {
        console.error('Automated rotation check failed:', error);
      }
    });

    console.log('Automated key rotation monitoring started');
  }

  /**
   * Check all keys for rotation needs
   */
  private async checkKeysForRotation(): Promise<void> {
    const activeKeys = await this.keyVault.list(KeyStatus.ACTIVE);
    
    for (const key of activeKeys) {
      // Create default policy for checking
      const defaultPolicy: RotationPolicy = {
        id: 'default',
        name: 'Default Policy