```typescript
import { webcrypto } from 'crypto';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Buffer } from 'buffer';

/**
 * Encryption algorithm types supported by the service
 */
export type EncryptionAlgorithm = 'AES-GCM' | 'ChaCha20-Poly1305' | 'RSA-OAEP';

/**
 * Key types for different encryption purposes
 */
export type KeyType = 'symmetric' | 'asymmetric' | 'ephemeral' | 'master';

/**
 * Key rotation configuration
 */
export interface KeyRotationConfig {
  /** Rotation interval in milliseconds */
  rotationInterval: number;
  /** Maximum key age before forced rotation */
  maxKeyAge: number;
  /** Number of old keys to retain */
  keyRetentionCount: number;
  /** Auto-rotation enabled */
  autoRotation: boolean;
}

/**
 * Encryption key metadata
 */
export interface EncryptionKey {
  id: string;
  algorithm: EncryptionAlgorithm;
  type: KeyType;
  keyData: ArrayBuffer;
  createdAt: Date;
  expiresAt?: Date;
  version: number;
  isActive: boolean;
  metadata: Record<string, any>;
}

/**
 * Encryption configuration options
 */
export interface EncryptionConfig {
  defaultAlgorithm: EncryptionAlgorithm;
  keyRotation: KeyRotationConfig;
  enableAuditLogging: boolean;
  compressionEnabled: boolean;
  integrityCheck: boolean;
}

/**
 * Encrypted data container
 */
export interface EncryptedData {
  /** Encrypted payload */
  data: ArrayBuffer;
  /** Initialization vector/nonce */
  iv: ArrayBuffer;
  /** Authentication tag */
  authTag: ArrayBuffer;
  /** Key ID used for encryption */
  keyId: string;
  /** Algorithm used */
  algorithm: EncryptionAlgorithm;
  /** Encryption timestamp */
  timestamp: number;
  /** HMAC for integrity verification */
  hmac: ArrayBuffer;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Key derivation parameters
 */
export interface KeyDerivationParams {
  salt: ArrayBuffer;
  iterations: number;
  algorithm: string;
  keyLength: number;
}

/**
 * Encryption operation result
 */
export interface EncryptionResult {
  encrypted: EncryptedData;
  keyId: string;
  success: boolean;
  error?: string;
}

/**
 * Decryption operation result
 */
export interface DecryptionResult {
  data: ArrayBuffer;
  keyId: string;
  success: boolean;
  error?: string;
  verified: boolean;
}

/**
 * Key generation options
 */
export interface KeyGenerationOptions {
  algorithm: EncryptionAlgorithm;
  type: KeyType;
  keySize?: number;
  expirationTime?: number;
  metadata?: Record<string, any>;
}

/**
 * Audit log entry for encryption operations
 */
export interface EncryptionAuditLog {
  id: string;
  operation: 'encrypt' | 'decrypt' | 'key_generate' | 'key_rotate' | 'key_access';
  keyId: string;
  algorithm: EncryptionAlgorithm;
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * End-to-End Encryption Service Error
 */
export class EncryptionServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EncryptionServiceError';
  }
}

/**
 * Comprehensive End-to-End Encryption Service
 * 
 * Provides secure encryption/decryption with multiple algorithms,
 * automatic key rotation, and secure key management.
 */
export class EncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private keyRotationTimers: Map<string, NodeJS.Timeout> = new Map();
  private auditLogs: EncryptionAuditLog[] = [];
  private masterKey?: ArrayBuffer;
  private isInitialized = false;

  constructor(
    private config: EncryptionConfig = {
      defaultAlgorithm: 'AES-GCM',
      keyRotation: {
        rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
        maxKeyAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        keyRetentionCount: 3,
        autoRotation: true
      },
      enableAuditLogging: true,
      compressionEnabled: false,
      integrityCheck: true
    }
  ) {}

  /**
   * Initialize the encryption service
   */
  public async initialize(masterKey?: ArrayBuffer): Promise<void> {
    try {
      if (this.isInitialized) {
        throw new EncryptionServiceError('Service already initialized', 'ALREADY_INITIALIZED');
      }

      // Generate or use provided master key
      this.masterKey = masterKey || await this.generateMasterKey();

      // Generate initial encryption keys
      await this.generateInitialKeys();

      // Start key rotation if enabled
      if (this.config.keyRotation.autoRotation) {
        await this.startKeyRotation();
      }

      this.isInitialized = true;
      await this.auditLog('key_generate', '', this.config.defaultAlgorithm, true);
    } catch (error) {
      throw new EncryptionServiceError(
        `Failed to initialize encryption service: ${error}`,
        'INITIALIZATION_FAILED',
        error
      );
    }
  }

  /**
   * Encrypt data using specified algorithm
   */
  public async encrypt(
    data: ArrayBuffer,
    algorithm?: EncryptionAlgorithm,
    keyId?: string
  ): Promise<EncryptionResult> {
    try {
      this.ensureInitialized();
      
      const alg = algorithm || this.config.defaultAlgorithm;
      const key = keyId ? this.getKey(keyId) : await this.getActiveKey(alg);
      
      if (!key) {
        throw new EncryptionServiceError('No active key found', 'NO_ACTIVE_KEY');
      }

      let encrypted: EncryptedData;

      switch (alg) {
        case 'AES-GCM':
          encrypted = await this.encryptAESGCM(data, key);
          break;
        case 'ChaCha20-Poly1305':
          encrypted = await this.encryptChaCha20Poly1305(data, key);
          break;
        case 'RSA-OAEP':
          encrypted = await this.encryptRSAOAEP(data, key);
          break;
        default:
          throw new EncryptionServiceError(`Unsupported algorithm: ${alg}`, 'UNSUPPORTED_ALGORITHM');
      }

      await this.auditLog('encrypt', key.id, alg, true);
      
      return {
        encrypted,
        keyId: key.id,
        success: true
      };
    } catch (error) {
      await this.auditLog('encrypt', keyId || '', algorithm || this.config.defaultAlgorithm, false, error);
      return {
        encrypted: {} as EncryptedData,
        keyId: keyId || '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Decrypt data
   */
  public async decrypt(encryptedData: EncryptedData): Promise<DecryptionResult> {
    try {
      this.ensureInitialized();
      
      const key = this.getKey(encryptedData.keyId);
      if (!key) {
        throw new EncryptionServiceError('Key not found', 'KEY_NOT_FOUND');
      }

      // Verify integrity
      if (this.config.integrityCheck && !await this.verifyIntegrity(encryptedData)) {
        throw new EncryptionServiceError('Integrity verification failed', 'INTEGRITY_FAILED');
      }

      let decrypted: ArrayBuffer;

      switch (encryptedData.algorithm) {
        case 'AES-GCM':
          decrypted = await this.decryptAESGCM(encryptedData, key);
          break;
        case 'ChaCha20-Poly1305':
          decrypted = await this.decryptChaCha20Poly1305(encryptedData, key);
          break;
        case 'RSA-OAEP':
          decrypted = await this.decryptRSAOAEP(encryptedData, key);
          break;
        default:
          throw new EncryptionServiceError(
            `Unsupported algorithm: ${encryptedData.algorithm}`,
            'UNSUPPORTED_ALGORITHM'
          );
      }

      await this.auditLog('decrypt', key.id, encryptedData.algorithm, true);
      
      return {
        data: decrypted,
        keyId: key.id,
        success: true,
        verified: true
      };
    } catch (error) {
      await this.auditLog('decrypt', encryptedData.keyId, encryptedData.algorithm, false, error);
      return {
        data: new ArrayBuffer(0),
        keyId: encryptedData.keyId,
        success: false,
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate new encryption key
   */
  public async generateKey(options: KeyGenerationOptions): Promise<EncryptionKey> {
    try {
      this.ensureInitialized();

      const keyId = this.generateKeyId();
      let keyData: ArrayBuffer;

      switch (options.algorithm) {
        case 'AES-GCM':
          keyData = await this.generateAESKey(options.keySize || 256);
          break;
        case 'ChaCha20-Poly1305':
          keyData = await this.generateChaCha20Key();
          break;
        case 'RSA-OAEP':
          keyData = await this.generateRSAKeyPair(options.keySize || 2048);
          break;
        default:
          throw new EncryptionServiceError(
            `Unsupported algorithm: ${options.algorithm}`,
            'UNSUPPORTED_ALGORITHM'
          );
      }

      const key: EncryptionKey = {
        id: keyId,
        algorithm: options.algorithm,
        type: options.type,
        keyData,
        createdAt: new Date(),
        expiresAt: options.expirationTime ? new Date(Date.now() + options.expirationTime) : undefined,
        version: 1,
        isActive: true,
        metadata: options.metadata || {}
      };

      this.keys.set(keyId, key);
      await this.auditLog('key_generate', keyId, options.algorithm, true);

      return key;
    } catch (error) {
      throw new EncryptionServiceError(
        `Failed to generate key: ${error}`,
        'KEY_GENERATION_FAILED',
        error
      );
    }
  }

  /**
   * Rotate encryption keys
   */
  public async rotateKeys(): Promise<void> {
    try {
      this.ensureInitialized();

      const activeKeys = Array.from(this.keys.values()).filter(key => key.isActive);
      
      for (const oldKey of activeKeys) {
        // Generate new key with same algorithm
        const newKey = await this.generateKey({
          algorithm: oldKey.algorithm,
          type: oldKey.type,
          metadata: { ...oldKey.metadata, rotatedFrom: oldKey.id }
        });

        // Deactivate old key
        oldKey.isActive = false;
        
        await this.auditLog('key_rotate', newKey.id, oldKey.algorithm, true);
      }

      // Clean up old keys based on retention policy
      await this.cleanupOldKeys();
    } catch (error) {
      throw new EncryptionServiceError(
        `Key rotation failed: ${error}`,
        'KEY_ROTATION_FAILED',
        error
      );
    }
  }

  /**
   * Derive key using PBKDF2
   */
  public async deriveKey(
    password: string,
    params: KeyDerivationParams
  ): Promise<ArrayBuffer> {
    try {
      const crypto = webcrypto || globalThis.crypto;
      
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: params.salt,
          iterations: params.iterations,
          hash: params.algorithm
        },
        passwordKey,
        params.keyLength * 8
      );

      return derivedBits;
    } catch (error) {
      throw new EncryptionServiceError(
        `Key derivation failed: ${error}`,
        'KEY_DERIVATION_FAILED',
        error
      );
    }
  }

  /**
   * Export key for secure storage
   */
  public async exportKey(keyId: string): Promise<ArrayBuffer> {
    try {
      const key = this.getKey(keyId);
      if (!key) {
        throw new EncryptionServiceError('Key not found', 'KEY_NOT_FOUND');
      }

      // Encrypt key data with master key
      const encrypted = await this.encryptWithMasterKey(key.keyData);
      await this.auditLog('key_access', keyId, key.algorithm, true);
      
      return encrypted;
    } catch (error) {
      throw new EncryptionServiceError(
        `Key export failed: ${error}`,
        'KEY_EXPORT_FAILED',
        error
      );
    }
  }

  /**
   * Import key from secure storage
   */
  public async importKey(
    keyData: ArrayBuffer,
    algorithm: EncryptionAlgorithm,
    type: KeyType
  ): Promise<string> {
    try {
      this.ensureInitialized();

      // Decrypt key data with master key
      const decryptedKeyData = await this.decryptWithMasterKey(keyData);
      
      const keyId = this.generateKeyId();
      const key: EncryptionKey = {
        id: keyId,
        algorithm,
        type,
        keyData: decryptedKeyData,
        createdAt: new Date(),
        version: 1,
        isActive: true,
        metadata: { imported: true }
      };

      this.keys.set(keyId, key);
      await this.auditLog('key_generate', keyId, algorithm, true);
      
      return keyId;
    } catch (error) {
      throw new EncryptionServiceError(
        `Key import failed: ${error}`,
        'KEY_IMPORT_FAILED',
        error
      );
    }
  }

  /**
   * Get encryption service status
   */
  public getStatus(): {
    initialized: boolean;
    keyCount: number;
    activeKeys: number;
    lastRotation?: Date;
    auditLogCount: number;
  } {
    const activeKeys = Array.from(this.keys.values()).filter(key => key.isActive);
    const lastRotation = this.auditLogs
      .filter(log => log.operation === 'key_rotate')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp;

    return {
      initialized: this.isInitialized,
      keyCount: this.keys.size,
      activeKeys: activeKeys.length,
      lastRotation,
      auditLogCount: this.auditLogs.length
    };
  }

  /**
   * Get audit logs
   */
  public getAuditLogs(limit = 100): EncryptionAuditLog[] {
    return this.auditLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Cleanup and shutdown service
   */
  public async shutdown(): Promise<void> {
    try {
      // Clear rotation timers
      for (const timer of this.keyRotationTimers.values()) {
        clearInterval(timer);
      }
      this.keyRotationTimers.clear();

      // Clear sensitive data
      this.keys.clear();
      this.masterKey = undefined;
      this.isInitialized = false;

      await this.auditLog('key_generate', '', this.config.defaultAlgorithm, true, 'Service shutdown');
    } catch (error) {
      throw new EncryptionServiceError(
        `Shutdown failed: ${error}`,
        'SHUTDOWN_FAILED',
        error
      );
    }
  }

  // Private methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new EncryptionServiceError('Service not initialized', 'NOT_INITIALIZED');
    }
  }

  private async generateMasterKey(): Promise<ArrayBuffer> {
    const crypto = webcrypto || globalThis.crypto;
    return crypto.getRandomValues(new Uint8Array(32)).buffer;
  }

  private async generateInitialKeys(): Promise<void> {
    // Generate default symmetric key
    await this.generateKey({
      algorithm: 'AES-GCM',
      type: 'symmetric'
    });

    // Generate RSA key pair for asymmetric operations
    await this.generateKey({
      algorithm: 'RSA-OAEP',
      type: 'asymmetric'
    });
  }

  private async startKeyRotation(): Promise<void> {
    const interval = setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        console.error('Automatic key rotation failed:', error);
      }
    }, this.config.keyRotation.rotationInterval);

    this.keyRotationTimers.set('auto-rotation', interval);
  }

  private getKey(keyId: string): EncryptionKey | undefined {
    return this.keys.get(keyId);
  }

  private async getActiveKey(algorithm: EncryptionAlgorithm): Promise<EncryptionKey | undefined> {
    const activeKeys = Array.from(this.keys.values())
      .filter(key => key.isActive && key.algorithm === algorithm);
    
    return activeKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private generateKeyId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `key_${timestamp}_${random}`;
  }

  private async encryptAESGCM(data: ArrayBuffer, key: EncryptionKey): Promise<EncryptedData> {
    const crypto = webcrypto || globalThis.crypto;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    const hmac = await this.generateHMAC(encrypted);

    return {
      data: encrypted,
      iv: iv.buffer,
      authTag: new ArrayBuffer(0), // GCM includes auth tag in encrypted data
      keyId: key.id,
      algorithm: 'AES-GCM',
      timestamp: Date.now(),
      hmac
    };
  }

  private async decryptAESGCM(encryptedData: EncryptedData, key: EncryptionKey): Promise<ArrayBuffer> {
    const crypto = webcrypto || globalThis.crypto;
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encryptedData.iv },
      cryptoKey,
      encryptedData.data
    );
  }

  private async encryptChaCha20Poly1305(data: ArrayBuffer, key: EncryptionKey): Promise<EncryptedData> {
    // ChaCha20-Poly1305 implementation would go here
    // For now, fallback to AES-GCM
    return this.encryptAESGCM(data, key);
  }

  private async decryptChaCha20Poly1305(encryptedData: EncryptedData, key: EncryptionKey): Promise<ArrayBuffer> {
    // ChaCha20-Poly1305 implementation would go here
    // For now, fallback to AES-GCM
    return this.decryptAESGCM(encryptedData, key);
  }

  private async encryptRSAOAEP(data: ArrayBuffer, key: EncryptionKey): Promise<EncryptedData> {
    const crypto = webcrypto || globalThis.crypto;
    
    // Import public key from key pair
    const keyPair = JSON.parse(new TextDecoder().decode(key.keyData));
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      keyPair.publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      data
    );

    const hmac = await this.generateHMAC(encrypted);

    return {
      data: encrypted,
      iv: new ArrayBuffer(0),
      authTag: new ArrayBuffer(0),
      keyId: key.id,
      algorithm: 'RSA-OAEP',
      timestamp: Date.now(),
      hmac
    };
  }

  private async decryptRSAOAEP(encryptedData: EncryptedData, key: EncryptionKey): Promise<ArrayBuffer> {
    const crypto = webcrypto || globalThis.crypto;
    
    // Import private key from key pair
    const keyPair = JSON.parse(new TextDecoder().decode(key.keyData));
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      keyPair.privateKey,
      { name: 'RSA-OAEP', hash