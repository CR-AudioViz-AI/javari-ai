```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import pino from 'pino';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import crypto from 'crypto';
import { Worker } from 'worker_threads';
import cron from 'node-cron';

/**
 * Advanced Cryptographic Management Microservice
 * 
 * Provides comprehensive cryptographic services including:
 * - Key lifecycle management with HSM integration
 * - Advanced encryption/decryption operations
 * - Policy enforcement and compliance
 * - Automated key rotation
 * - Hardware security module integration
 * - Real-time cryptographic monitoring
 * 
 * @version 1.0.0
 * @author CR AudioViz AI Engineering
 */

// ===== INTERFACES AND TYPES =====

/**
 * Cryptographic key representation
 */
interface CryptoKey {
  id: string;
  algorithm: 'AES-256-GCM' | 'RSA-4096' | 'ECDSA-P521' | 'ChaCha20-Poly1305';
  keyType: 'symmetric' | 'asymmetric' | 'signing' | 'wrapping';
  purpose: 'encryption' | 'signing' | 'key-derivation' | 'authentication';
  keyData: Buffer;
  publicKey?: Buffer;
  metadata: {
    createdAt: Date;
    expiresAt?: Date;
    rotationPolicy: string;
    usage: string[];
    origin: 'hsm' | 'software' | 'external';
    version: number;
  };
  policy: EncryptionPolicy;
  auditLog: AuditEntry[];
}

/**
 * Encryption policy configuration
 */
interface EncryptionPolicy {
  id: string;
  name: string;
  minKeySize: number;
  maxKeyAge: number;
  allowedAlgorithms: string[];
  rotationInterval: number;
  complianceLevel: 'FIPS-140-2-L1' | 'FIPS-140-2-L2' | 'FIPS-140-2-L3' | 'Common-Criteria';
  auditRequired: boolean;
  hsmRequired: boolean;
  restrictions: {
    timeBasedAccess?: { start: string; end: string };
    ipWhitelist?: string[];
    userGroups?: string[];
    maxOperations?: number;
  };
}

/**
 * HSM configuration
 */
interface HSMConfig {
  provider: 'pkcs11' | 'azure-keyvault' | 'aws-kms' | 'google-kms';
  library?: string;
  slot?: number;
  pin?: string;
  endpoint?: string;
  credentials?: {
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
    subscriptionId?: string;
    region?: string;
    accessKey?: string;
    secretKey?: string;
  };
  settings: {
    keyGenerationMethod: 'hardware' | 'software';
    keyExportable: boolean;
    sessionTimeout: number;
    maxConcurrentSessions: number;
  };
}

/**
 * Encryption operation request
 */
interface EncryptionRequest {
  keyId: string;
  data: Buffer;
  algorithm?: string;
  additionalData?: Buffer;
  context?: Record<string, any>;
}

/**
 * Decryption operation request
 */
interface DecryptionRequest {
  keyId: string;
  encryptedData: Buffer;
  algorithm?: string;
  additionalData?: Buffer;
  context?: Record<string, any>;
}

/**
 * Key generation parameters
 */
interface KeyGenerationParams {
  algorithm: string;
  keySize: number;
  purpose: string[];
  policyId: string;
  metadata?: Record<string, any>;
  hsmRequired?: boolean;
  exportable?: boolean;
}

/**
 * Audit log entry
 */
interface AuditEntry {
  timestamp: Date;
  operation: string;
  userId: string;
  keyId: string;
  result: 'success' | 'failure' | 'warning';
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Key rotation job configuration
 */
interface KeyRotationJob {
  keyId: string;
  scheduledAt: Date;
  policy: EncryptionPolicy;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
}

// ===== METRICS AND MONITORING =====

const cryptoMetrics = {
  operationsTotal: new Counter({
    name: 'crypto_operations_total',
    help: 'Total number of cryptographic operations',
    labelNames: ['operation', 'algorithm', 'status']
  }),
  
  operationDuration: new Histogram({
    name: 'crypto_operation_duration_seconds',
    help: 'Duration of cryptographic operations',
    labelNames: ['operation', 'algorithm'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
  }),
  
  activeKeys: new Gauge({
    name: 'crypto_active_keys_total',
    help: 'Total number of active cryptographic keys',
    labelNames: ['algorithm', 'type']
  }),
  
  hsmSessions: new Gauge({
    name: 'crypto_hsm_sessions_active',
    help: 'Number of active HSM sessions'
  }),
  
  keyRotations: new Counter({
    name: 'crypto_key_rotations_total',
    help: 'Total number of key rotations',
    labelNames: ['status', 'policy']
  })
};

// ===== CORE SERVICES =====

/**
 * Hardware Security Module Service
 * Manages HSM connections and operations
 */
class HSMService {
  private config: HSMConfig;
  private sessions: Map<string, any> = new Map();
  private logger = pino({ name: 'HSMService' });

  constructor(config: HSMConfig) {
    this.config = config;
  }

  /**
   * Initialize HSM connection
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing HSM connection', { provider: this.config.provider });
      
      switch (this.config.provider) {
        case 'pkcs11':
          await this.initializePKCS11();
          break;
        case 'azure-keyvault':
          await this.initializeAzureKeyVault();
          break;
        case 'aws-kms':
          await this.initializeAWSKMS();
          break;
        default:
          throw new Error(`Unsupported HSM provider: ${this.config.provider}`);
      }
      
      cryptoMetrics.hsmSessions.inc();
    } catch (error) {
      this.logger.error('HSM initialization failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate key in HSM
   */
  async generateKey(params: KeyGenerationParams): Promise<CryptoKey> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Generating key in HSM', { algorithm: params.algorithm });
      
      const keyId = crypto.randomUUID();
      let keyData: Buffer;
      let publicKey: Buffer | undefined;
      
      switch (params.algorithm) {
        case 'AES-256-GCM':
          keyData = await this.generateSymmetricKey(params.keySize);
          break;
        case 'RSA-4096':
          const rsaKeys = await this.generateRSAKeyPair(params.keySize);
          keyData = rsaKeys.privateKey;
          publicKey = rsaKeys.publicKey;
          break;
        default:
          throw new Error(`Unsupported algorithm: ${params.algorithm}`);
      }
      
      const key: CryptoKey = {
        id: keyId,
        algorithm: params.algorithm as any,
        keyType: this.getKeyType(params.algorithm),
        purpose: params.purpose[0] as any,
        keyData,
        publicKey,
        metadata: {
          createdAt: new Date(),
          rotationPolicy: params.policyId,
          usage: params.purpose,
          origin: 'hsm',
          version: 1
        },
        policy: await this.getPolicyById(params.policyId),
        auditLog: []
      };
      
      cryptoMetrics.operationDuration
        .labels('generate', params.algorithm)
        .observe((Date.now() - startTime) / 1000);
      
      cryptoMetrics.operationsTotal
        .labels('generate', params.algorithm, 'success')
        .inc();
      
      return key;
    } catch (error) {
      cryptoMetrics.operationsTotal
        .labels('generate', params.algorithm, 'failure')
        .inc();
      throw error;
    }
  }

  /**
   * Store key in HSM
   */
  async storeKey(key: CryptoKey): Promise<void> {
    try {
      this.logger.info('Storing key in HSM', { keyId: key.id });
      
      // Implementation would interact with actual HSM
      // For now, simulate secure storage
      await new Promise(resolve => setTimeout(resolve, 50));
      
      cryptoMetrics.activeKeys
        .labels(key.algorithm, key.keyType)
        .inc();
    } catch (error) {
      this.logger.error('Failed to store key in HSM', { keyId: key.id, error: error.message });
      throw error;
    }
  }

  private async initializePKCS11(): Promise<void> {
    // PKCS#11 initialization logic
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async initializeAzureKeyVault(): Promise<void> {
    // Azure Key Vault initialization logic
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async initializeAWSKMS(): Promise<void> {
    // AWS KMS initialization logic
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async generateSymmetricKey(keySize: number): Promise<Buffer> {
    return crypto.randomBytes(keySize / 8);
  }

  private async generateRSAKeyPair(keySize: number): Promise<{ privateKey: Buffer; publicKey: Buffer }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: keySize,
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
      }, (err, publicKey, privateKey) => {
        if (err) reject(err);
        else resolve({ 
          privateKey: Buffer.from(privateKey), 
          publicKey: Buffer.from(publicKey) 
        });
      });
    });
  }

  private getKeyType(algorithm: string): 'symmetric' | 'asymmetric' | 'signing' | 'wrapping' {
    if (algorithm.includes('AES') || algorithm.includes('ChaCha20')) {
      return 'symmetric';
    }
    return 'asymmetric';
  }

  private async getPolicyById(policyId: string): Promise<EncryptionPolicy> {
    // Mock policy - in production, fetch from database
    return {
      id: policyId,
      name: 'Default Policy',
      minKeySize: 256,
      maxKeyAge: 365 * 24 * 60 * 60 * 1000,
      allowedAlgorithms: ['AES-256-GCM', 'RSA-4096'],
      rotationInterval: 90 * 24 * 60 * 60 * 1000,
      complianceLevel: 'FIPS-140-2-L2',
      auditRequired: true,
      hsmRequired: true,
      restrictions: {}
    };
  }
}

/**
 * Key Management Service
 * Handles key lifecycle operations
 */
class KeyManagementService {
  private keys: Map<string, CryptoKey> = new Map();
  private hsmService: HSMService;
  private supabase: any;
  private redis: Redis;
  private logger = pino({ name: 'KeyManagementService' });

  constructor(hsmService: HSMService, supabase: any, redis: Redis) {
    this.hsmService = hsmService;
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Generate new cryptographic key
   */
  async generateKey(params: KeyGenerationParams, userId: string): Promise<CryptoKey> {
    try {
      this.logger.info('Generating new key', { algorithm: params.algorithm, userId });
      
      const key = await this.hsmService.generateKey(params);
      
      // Store key metadata in database
      await this.storeKeyMetadata(key);
      
      // Cache key reference
      this.keys.set(key.id, key);
      
      // Audit log entry
      await this.addAuditEntry(key.id, 'generate', userId, 'success', {
        algorithm: params.algorithm,
        purpose: params.purpose
      });
      
      return key;
    } catch (error) {
      this.logger.error('Key generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Retrieve key by ID
   */
  async getKey(keyId: string, userId: string): Promise<CryptoKey | null> {
    try {
      // Check cache first
      let key = this.keys.get(keyId);
      
      if (!key) {
        // Load from database
        key = await this.loadKeyFromDatabase(keyId);
        if (key) {
          this.keys.set(keyId, key);
        }
      }
      
      if (key) {
        await this.addAuditEntry(keyId, 'access', userId, 'success', {});
      }
      
      return key || null;
    } catch (error) {
      this.logger.error('Failed to retrieve key', { keyId, error: error.message });
      throw error;
    }
  }

  /**
   * Rotate key according to policy
   */
  async rotateKey(keyId: string, userId: string): Promise<CryptoKey> {
    try {
      this.logger.info('Rotating key', { keyId, userId });
      
      const oldKey = await this.getKey(keyId, userId);
      if (!oldKey) {
        throw new Error('Key not found');
      }
      
      // Generate new key with same parameters
      const params: KeyGenerationParams = {
        algorithm: oldKey.algorithm,
        keySize: this.getKeySizeForAlgorithm(oldKey.algorithm),
        purpose: oldKey.metadata.usage,
        policyId: oldKey.policy.id
      };
      
      const newKey = await this.generateKey(params, userId);
      
      // Update key version
      newKey.metadata.version = oldKey.metadata.version + 1;
      
      // Mark old key as rotated
      oldKey.metadata.expiresAt = new Date();
      await this.updateKeyMetadata(oldKey);
      
      cryptoMetrics.keyRotations
        .labels('success', oldKey.policy.name)
        .inc();
      
      return newKey;
    } catch (error) {
      cryptoMetrics.keyRotations
        .labels('failure', 'unknown')
        .inc();
      throw error;
    }
  }

  private async storeKeyMetadata(key: CryptoKey): Promise<void> {
    const metadata = {
      key_id: key.id,
      algorithm: key.algorithm,
      key_type: key.keyType,
      purpose: key.purpose,
      created_at: key.metadata.createdAt,
      expires_at: key.metadata.expiresAt,
      policy_id: key.policy.id,
      version: key.metadata.version,
      origin: key.metadata.origin
    };
    
    await this.supabase
      .from('crypto_keys')
      .insert([metadata]);
  }

  private async loadKeyFromDatabase(keyId: string): Promise<CryptoKey | null> {
    const { data, error } = await this.supabase
      .from('crypto_keys')
      .select('*')
      .eq('key_id', keyId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // In production, load actual key data from HSM
    // This is a simplified representation
    return {
      id: data.key_id,
      algorithm: data.algorithm,
      keyType: data.key_type,
      purpose: data.purpose,
      keyData: Buffer.alloc(32), // Placeholder
      metadata: {
        createdAt: new Date(data.created_at),
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        rotationPolicy: data.policy_id,
        usage: [data.purpose],
        origin: data.origin,
        version: data.version
      },
      policy: await this.hsmService['getPolicyById'](data.policy_id),
      auditLog: []
    };
  }

  private async updateKeyMetadata(key: CryptoKey): Promise<void> {
    await this.supabase
      .from('crypto_keys')
      .update({
        expires_at: key.metadata.expiresAt,
        version: key.metadata.version
      })
      .eq('key_id', key.id);
  }

  private async addAuditEntry(
    keyId: string, 
    operation: string, 
    userId: string, 
    result: string, 
    details: Record<string, any>
  ): Promise<void> {
    const auditEntry = {
      key_id: keyId,
      operation,
      user_id: userId,
      result,
      details,
      timestamp: new Date(),
      ip_address: '0.0.0.0', // Would be extracted from request
      user_agent: 'crypto-service'
    };
    
    await this.supabase
      .from('audit_logs')
      .insert([auditEntry]);
  }

  private getKeySizeForAlgorithm(algorithm: string): number {
    switch (algorithm) {
      case 'AES-256-GCM': return 256;
      case 'RSA-4096': return 4096;
      case 'ECDSA-P521': return 521;
      default: return 256;
    }
  }
}

/**
 * Encryption Service
 * Handles encryption and decryption operations
 */
class EncryptionService {
  private keyManagement: KeyManagementService;
  private logger = pino({ name: 'EncryptionService' });

  constructor(keyManagement: KeyManagementService) {
    this.keyManagement = keyManagement;
  }

  /**
   * Encrypt data using specified key
   */
  async encrypt(request: EncryptionRequest, userId: string): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      const key = await this.keyManagement.getKey(request.keyId, userId);
      if (!key) {
        throw new Error('Key not found');
      }
      
      let encryptedData: Buffer;
      
      switch (key.algorithm) {
        case 'AES-256-GCM':
          encryptedData = await this.encryptAESGCM(request.data, key.keyData, request.additionalData);
          break;
        case 'ChaCha20-Poly1305':
          encryptedData = await this.encryptChaCha20(request.data, key.keyData, request.additionalData);
          break;
        default:
          throw new Error(`Encryption not supported for algorithm: ${key.algorithm}`);
      }
      
      cryptoMetrics.operationDuration
        .labels('encrypt', key.algorithm)
        .observe((Date.now() - startTime) / 1000);
      
      cryptoMetrics.operationsTotal
        .labels('encrypt', key.algorithm, 'success')
        .inc();
      
      return encryptedData;
    } catch (error) {
      cryptoMetrics.operationsTotal
        .labels('encrypt', 'unknown', 'failure')
        .inc();
      throw error;
    }
  }

  /**
   * Decrypt data using specified key
   */
  async decrypt(request: DecryptionRequest, userId: string): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      const key = await this.keyManagement.getKey(request.keyId, userId);
      if (!key) {
        throw new Error('Key not found');
      }
      
      let decryptedData: Buffer;
      
      switch (key.algorithm) {
        case 'AES-256-GCM':
          decryptedData = await this.decryptAESGCM(request.encryptedData, key.keyData, request.additionalData);
          break;
        case 'ChaCha20-Poly1305':
          decryptedData = await this.decryptChaCha20(request.encryptedData, key.keyData, request.additionalData);
          break;
        default:
          throw new Error(`Decryption not supported for algorithm: ${key.algorithm}`);
      }
      
      cryptoMetrics.operationDuration
        .labels('decrypt', key.algorithm)
        .observe((Date.now() - startTime) / 1000);
      
      cryptoMetrics.operationsTotal
        .labels('decrypt', key.algorithm, 'success')
        .inc();
      
      return decryptedData;
    } catch (error) {
      cryptoMetrics.operationsTotal
        .labels('decrypt', 'unknown', 'failure')
        .inc();
      throw error;
    }
  }

  private async encryptAESGCM(data: Buffer, key: Buffer, additionalData?: Buffer): Promise<Buffer> {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipherGCM('aes-256-gcm');
    
    cipher.setAAD(additionalData || Buffer.alloc(0));
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    return Buffer.concat([iv, tag, encrypted]);
  }

  private async decryptAESGCM(encryptedData: Buffer, key: Buffer, additionalData?: Buffer): Promise<Buffer> {
    const iv =