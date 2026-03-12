```typescript
/**
 * Dynamic Encryption Key Management Service
 * Provides enterprise-grade encryption key management with automatic rotation,
 * secure distribution, and HSM integration for CR AudioViz platform
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * Key metadata interface
 */
export interface KeyMetadata {
  keyId: string;
  version: number;
  algorithm: string;
  keyType: 'master' | 'data' | 'session' | 'transport';
  purpose: string[];
  createdAt: Date;
  expiresAt: Date;
  rotationInterval: number; // milliseconds
  status: 'active' | 'pending' | 'deprecated' | 'revoked';
  hsmKeyId?: string;
  permissions: string[];
  auditLog: KeyAuditEntry[];
}

/**
 * Key audit entry interface
 */
export interface KeyAuditEntry {
  timestamp: Date;
  action: 'created' | 'rotated' | 'accessed' | 'distributed' | 'revoked';
  actor: string;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Key distribution request interface
 */
export interface KeyDistributionRequest {
  keyId: string;
  requester: string;
  purpose: string;
  permissions: string[];
  expiresAt?: Date;
}

/**
 * Key rotation policy interface
 */
export interface KeyRotationPolicy {
  keyType: string;
  rotationInterval: number;
  preRotationNotice: number;
  maxKeyAge: number;
  minActiveKeys: number;
  autoRotate: boolean;
}

/**
 * HSM provider interface
 */
export interface HSMProvider {
  generateKey(keySpec: KeyGenerationSpec): Promise<string>;
  getKey(keyId: string): Promise<string>;
  deleteKey(keyId: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}

/**
 * Key generation specification
 */
export interface KeyGenerationSpec {
  algorithm: string;
  keySize: number;
  keyType: string;
  purpose: string[];
  metadata?: Record<string, any>;
}

/**
 * Service configuration interface
 */
export interface KeyManagementConfig {
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl: string;
  hsmConfig: {
    provider: 'aws-cloudhsm' | 'azure-keyvault' | 'local';
    endpoint: string;
    credentials: Record<string, string>;
  };
  rotationPolicies: KeyRotationPolicy[];
  auditingEnabled: boolean;
  distributionTimeout: number;
}

/**
 * Service error class
 */
export class KeyManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'KeyManagementError';
  }
}

/**
 * Dynamic Encryption Key Management Service
 * 
 * Provides comprehensive key lifecycle management including:
 * - Automatic key rotation with configurable policies
 * - Secure key distribution and access control
 * - HSM integration for hardware-backed security
 * - Compliance auditing and reporting
 * - High availability with Redis caching
 */
export class KeyManagementService {
  private supabase: SupabaseClient;
  private redis: Redis;
  private hsmProvider: HSMProvider | null = null;
  private rotationSchedulers: Map<string, NodeJS.Timeout> = new Map();
  private config: KeyManagementConfig;
  private isInitialized = false;

  constructor(config: KeyManagementConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.redis = new Redis(config.redisUrl);
    this.setupEventHandlers();
  }

  /**
   * Initialize the key management service
   */
  async initialize(): Promise<void> {
    try {
      // Initialize HSM provider
      await this.initializeHSM();

      // Setup database tables
      await this.setupDatabase();

      // Load existing keys and setup rotation schedules
      await this.loadExistingKeys();

      // Start rotation schedulers
      await this.startRotationSchedulers();

      this.isInitialized = true;
      await this.auditLog('service_initialized', 'system', 'KeyManagementService');
    } catch (error) {
      throw new KeyManagementError(
        'Failed to initialize key management service',
        'INITIALIZATION_ERROR',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(
    keyType: string,
    purpose: string[],
    algorithm = 'AES-256-GCM',
    rotationInterval = 30 * 24 * 60 * 60 * 1000 // 30 days
  ): Promise<string> {
    this.ensureInitialized();

    try {
      const keyId = this.generateKeyId();
      const keySpec: KeyGenerationSpec = {
        algorithm,
        keySize: this.getKeySizeForAlgorithm(algorithm),
        keyType,
        purpose,
        metadata: {
          generatedAt: new Date().toISOString(),
          service: 'CR AudioViz'
        }
      };

      // Generate key using HSM or local crypto
      let hsmKeyId: string | undefined;
      let keyMaterial: string;

      if (this.hsmProvider && keyType === 'master') {
        hsmKeyId = await this.hsmProvider.generateKey(keySpec);
        keyMaterial = await this.hsmProvider.getKey(hsmKeyId);
      } else {
        keyMaterial = this.generateLocalKey(keySpec);
      }

      // Create key metadata
      const keyMetadata: KeyMetadata = {
        keyId,
        version: 1,
        algorithm,
        keyType: keyType as any,
        purpose,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + rotationInterval),
        rotationInterval,
        status: 'active',
        hsmKeyId,
        permissions: ['encrypt', 'decrypt'],
        auditLog: [{
          timestamp: new Date(),
          action: 'created',
          actor: 'system',
          source: 'KeyManagementService'
        }]
      };

      // Store key metadata in database
      const { error: dbError } = await this.supabase
        .from('encryption_keys')
        .insert({
          key_id: keyId,
          version: keyMetadata.version,
          algorithm: keyMetadata.algorithm,
          key_type: keyMetadata.keyType,
          purpose: keyMetadata.purpose,
          created_at: keyMetadata.createdAt.toISOString(),
          expires_at: keyMetadata.expiresAt.toISOString(),
          rotation_interval: keyMetadata.rotationInterval,
          status: keyMetadata.status,
          hsm_key_id: keyMetadata.hsmKeyId,
          permissions: keyMetadata.permissions,
          audit_log: keyMetadata.auditLog
        });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Cache key material in Redis with expiration
      await this.redis.setex(
        `key:${keyId}`,
        Math.floor(rotationInterval / 1000),
        keyMaterial
      );

      // Schedule rotation if auto-rotation is enabled
      const policy = this.getRotationPolicy(keyType);
      if (policy?.autoRotate) {
        this.scheduleKeyRotation(keyId, rotationInterval);
      }

      await this.auditLog('key_generated', 'system', 'KeyManagementService', {
        keyId,
        keyType,
        algorithm
      });

      return keyId;
    } catch (error) {
      throw new KeyManagementError(
        'Failed to generate encryption key',
        'KEY_GENERATION_ERROR',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Retrieve encryption key material
   */
  async getKey(keyId: string, requester: string): Promise<string> {
    this.ensureInitialized();

    try {
      // Check Redis cache first
      const cachedKey = await this.redis.get(`key:${keyId}`);
      if (cachedKey) {
        await this.auditLog('key_accessed', requester, 'cache', { keyId });
        return cachedKey;
      }

      // Get key metadata from database
      const { data: keyData, error } = await this.supabase
        .from('encryption_keys')
        .select('*')
        .eq('key_id', keyId)
        .eq('status', 'active')
        .single();

      if (error || !keyData) {
        throw new Error('Key not found or inactive');
      }

      // Check if key has expired
      if (new Date(keyData.expires_at) < new Date()) {
        throw new Error('Key has expired');
      }

      // Retrieve key material
      let keyMaterial: string;
      if (keyData.hsm_key_id && this.hsmProvider) {
        keyMaterial = await this.hsmProvider.getKey(keyData.hsm_key_id);
      } else {
        // For demonstration - in production, keys should be stored securely
        keyMaterial = await this.retrieveStoredKey(keyId);
      }

      // Update cache
      const ttl = Math.max(
        Math.floor((new Date(keyData.expires_at).getTime() - Date.now()) / 1000),
        60
      );
      await this.redis.setex(`key:${keyId}`, ttl, keyMaterial);

      await this.auditLog('key_accessed', requester, 'database', { keyId });
      return keyMaterial;
    } catch (error) {
      throw new KeyManagementError(
        'Failed to retrieve encryption key',
        'KEY_RETRIEVAL_ERROR',
        { keyId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string, actor = 'system'): Promise<string> {
    this.ensureInitialized();

    try {
      // Get current key metadata
      const { data: currentKey, error } = await this.supabase
        .from('encryption_keys')
        .select('*')
        .eq('key_id', keyId)
        .single();

      if (error || !currentKey) {
        throw new Error('Key not found');
      }

      // Generate new key version
      const newKeyId = this.generateKeyId();
      const keySpec: KeyGenerationSpec = {
        algorithm: currentKey.algorithm,
        keySize: this.getKeySizeForAlgorithm(currentKey.algorithm),
        keyType: currentKey.key_type,
        purpose: currentKey.purpose,
        metadata: {
          rotatedFrom: keyId,
          rotatedAt: new Date().toISOString()
        }
      };

      // Generate new key material
      let newHsmKeyId: string | undefined;
      let newKeyMaterial: string;

      if (currentKey.hsm_key_id && this.hsmProvider) {
        newHsmKeyId = await this.hsmProvider.generateKey(keySpec);
        newKeyMaterial = await this.hsmProvider.getKey(newHsmKeyId);
      } else {
        newKeyMaterial = this.generateLocalKey(keySpec);
      }

      // Create new key metadata
      const newKeyMetadata: Partial<KeyMetadata> = {
        key_id: newKeyId,
        version: currentKey.version + 1,
        algorithm: currentKey.algorithm,
        key_type: currentKey.key_type,
        purpose: currentKey.purpose,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + currentKey.rotation_interval).toISOString(),
        rotation_interval: currentKey.rotation_interval,
        status: 'active',
        hsm_key_id: newHsmKeyId,
        permissions: currentKey.permissions,
        audit_log: [{
          timestamp: new Date(),
          action: 'rotated',
          actor,
          source: 'KeyManagementService',
          metadata: { previousKeyId: keyId }
        }]
      };

      // Use transaction to ensure atomicity
      const { error: transactionError } = await this.supabase.rpc('rotate_encryption_key', {
        old_key_id: keyId,
        new_key_data: newKeyMetadata
      });

      if (transactionError) {
        throw new Error(`Transaction failed: ${transactionError.message}`);
      }

      // Update Redis cache
      await Promise.all([
        this.redis.setex(
          `key:${newKeyId}`,
          Math.floor(currentKey.rotation_interval / 1000),
          newKeyMaterial
        ),
        this.redis.del(`key:${keyId}`)
      ]);

      // Schedule next rotation
      const policy = this.getRotationPolicy(currentKey.key_type);
      if (policy?.autoRotate) {
        this.scheduleKeyRotation(newKeyId, currentKey.rotation_interval);
      }

      // Clean up old HSM key if applicable
      if (currentKey.hsm_key_id && this.hsmProvider) {
        try {
          await this.hsmProvider.deleteKey(currentKey.hsm_key_id);
        } catch (error) {
          console.warn('Failed to delete old HSM key:', error);
        }
      }

      await this.auditLog('key_rotated', actor, 'KeyManagementService', {
        oldKeyId: keyId,
        newKeyId,
        algorithm: currentKey.algorithm
      });

      return newKeyId;
    } catch (error) {
      throw new KeyManagementError(
        'Failed to rotate encryption key',
        'KEY_ROTATION_ERROR',
        { keyId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Distribute key to authorized service
   */
  async distributeKey(request: KeyDistributionRequest): Promise<{
    keyId: string;
    keyMaterial: string;
    expiresAt: Date;
  }> {
    this.ensureInitialized();

    try {
      // Validate distribution request
      await this.validateDistributionRequest(request);

      // Get key material
      const keyMaterial = await this.getKey(request.keyId, request.requester);

      // Get key metadata for expiration
      const { data: keyData, error } = await this.supabase
        .from('encryption_keys')
        .select('expires_at')
        .eq('key_id', request.keyId)
        .single();

      if (error) {
        throw new Error(`Failed to get key metadata: ${error.message}`);
      }

      const expiresAt = request.expiresAt || new Date(keyData.expires_at);

      // Log distribution
      await this.auditLog('key_distributed', request.requester, 'KeyManagementService', {
        keyId: request.keyId,
        purpose: request.purpose,
        expiresAt: expiresAt.toISOString()
      });

      return {
        keyId: request.keyId,
        keyMaterial,
        expiresAt
      };
    } catch (error) {
      throw new KeyManagementError(
        'Failed to distribute encryption key',
        'KEY_DISTRIBUTION_ERROR',
        { request, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Revoke encryption key
   */
  async revokeKey(keyId: string, reason: string, actor: string): Promise<void> {
    this.ensureInitialized();

    try {
      // Update key status in database
      const { error } = await this.supabase
        .from('encryption_keys')
        .update({
          status: 'revoked',
          audit_log: this.supabase.sql`audit_log || ${JSON.stringify([{
            timestamp: new Date(),
            action: 'revoked',
            actor,
            source: 'KeyManagementService',
            metadata: { reason }
          }])}`
        })
        .eq('key_id', keyId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Remove from cache
      await this.redis.del(`key:${keyId}`);

      // Cancel any pending rotations
      if (this.rotationSchedulers.has(keyId)) {
        clearTimeout(this.rotationSchedulers.get(keyId)!);
        this.rotationSchedulers.delete(keyId);
      }

      await this.auditLog('key_revoked', actor, 'KeyManagementService', {
        keyId,
        reason
      });
    } catch (error) {
      throw new KeyManagementError(
        'Failed to revoke encryption key',
        'KEY_REVOCATION_ERROR',
        { keyId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get key metadata
   */
  async getKeyMetadata(keyId: string): Promise<KeyMetadata> {
    this.ensureInitialized();

    try {
      const { data, error } = await this.supabase
        .from('encryption_keys')
        .select('*')
        .eq('key_id', keyId)
        .single();

      if (error || !data) {
        throw new Error('Key not found');
      }

      return {
        keyId: data.key_id,
        version: data.version,
        algorithm: data.algorithm,
        keyType: data.key_type,
        purpose: data.purpose,
        createdAt: new Date(data.created_at),
        expiresAt: new Date(data.expires_at),
        rotationInterval: data.rotation_interval,
        status: data.status,
        hsmKeyId: data.hsm_key_id,
        permissions: data.permissions,
        auditLog: data.audit_log
      };
    } catch (error) {
      throw new KeyManagementError(
        'Failed to get key metadata',
        'KEY_METADATA_ERROR',
        { keyId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * List keys with filtering
   */
  async listKeys(filters: {
    keyType?: string;
    status?: string;
    purpose?: string;
    limit?: number;
  } = {}): Promise<KeyMetadata[]> {
    this.ensureInitialized();

    try {
      let query = this.supabase.from('encryption_keys').select('*');

      if (filters.keyType) {
        query = query.eq('key_type', filters.keyType);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.purpose) {
        query = query.contains('purpose', [filters.purpose]);
      }

      query = query.limit(filters.limit || 100);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Query error: ${error.message}`);
      }

      return (data || []).map(row => ({
        keyId: row.key_id,
        version: row.version,
        algorithm: row.algorithm,
        keyType: row.key_type,
        purpose: row.purpose,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        rotationInterval: row.rotation_interval,
        status: row.status,
        hsmKeyId: row.hsm_key_id,
        permissions: row.permissions,
        auditLog: row.audit_log
      }));
    } catch (error) {
      throw new KeyManagementError(
        'Failed to list keys',
        'KEY_LIST_ERROR',
        { filters, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: Record<string, boolean>;
    metrics: Record<string, number>;
  }> {
    const components: Record<string, boolean> = {
      database: false,
      redis: false,
      hsm: false
    };

    const metrics: Record<string, number> = {
      activeKeys: 0,
      pendingRotations: 0,
      cacheHitRate: 0
    };

    try {
      // Check database connection
      const { error: dbError } = await this.supabase
        .from('encryption_keys')
        .select('count')
        .limit(1);
      components.database = !dbError;

      // Check Redis connection
      try {
        await this.redis.ping();
        components.redis = true;
      } catch {
        components.redis = false;
      }

      // Check HSM if available
      if (this.hsmProvider) {
        components.hsm = await this.hsmProvider.isAvailable();
      } else {
        components.hsm = true; // Local crypto always available
      }

      // Get metrics
      const { data: keyCount } = await this.supabase
        .from('encryption_keys')
        .select('count')
        .eq('status', 'active');
      metrics.activeKeys = keyCount?.[0]?.count || 0;

      metrics.pendingRotations = this.rotationSchedulers.size;

      const healthyComponents = Object.values(components).filter(Boolean).length;
      const totalComponents = Object.keys(components).length;
      
      const status = healthyComponents === totalComponents 
        ? 'healthy' 
        : healthyComponents > totalComponents / 2 
        ? 'degraded' 
        : 'unhealthy';

      return { status, components, metrics };
    } catch (error) {
      return {
        status: 'unhealthy',
        components,
        metrics
      };
    }
  }

  /**
   * Cleanup expired keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    this.ensureInitialized();

    try {
      const { data: expiredKeys, error } = await this.supabase
        .from('encryption_keys')
        .select('key_id, hsm_key_id')
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'active');

      if (error) {
        throw new Error(`Query error: ${error.message}`);
      }

      if (!expiredKeys || expiredKeys.length === 0) {
        return 0;
      }

      // Update status to deprecated
      const { error: updateError }