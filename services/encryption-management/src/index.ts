```typescript
/**
 * CR AudioViz AI - Advanced Encryption Management Service
 * 
 * Provides comprehensive encryption services including:
 * - End-to-end encryption for all platform data
 * - Key lifecycle management with automated rotation
 * - Encryption-at-rest and in-transit capabilities
 * - Hardware Security Module (HSM) integration
 * - High-performance encryption operations
 * 
 * @author CR AudioViz AI Team
 * @version 1.0.0
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import crypto from 'crypto';
import forge from 'node-forge';
import { CloudHSMV2 } from '@aws-sdk/client-cloudhsm-v2';
import { KMS } from '@aws-sdk/client-kms';
import winston from 'winston';
import { z } from 'zod';

// Type definitions
interface EncryptionKey {
  id: string;
  algorithm: string;
  keySize: number;
  keyData: Buffer;
  createdAt: Date;
  expiresAt?: Date;
  status: 'active' | 'rotating' | 'deprecated' | 'revoked';
  version: number;
  metadata: Record<string, any>;
}

interface KeyRotationPolicy {
  id: string;
  keyId: string;
  rotationIntervalDays: number;
  lastRotation: Date;
  nextRotation: Date;
  autoRotate: boolean;
  retentionDays: number;
}

interface EncryptionOptions {
  algorithm?: string;
  keyId?: string;
  additionalData?: Buffer;
  compressionEnabled?: boolean;
}

interface DecryptionOptions {
  keyId?: string;
  additionalData?: Buffer;
}

interface HSMOperationResult {
  success: boolean;
  data?: Buffer;
  keyId?: string;
  error?: string;
}

// Validation schemas
const encryptionRequestSchema = z.object({
  data: z.string().min(1),
  keyId: z.string().optional(),
  algorithm: z.enum(['AES-256-GCM', 'ChaCha20-Poly1305', 'AES-256-CBC']).optional(),
  compressionEnabled: z.boolean().optional()
});

const keyGenerationSchema = z.object({
  algorithm: z.enum(['AES-256', 'RSA-4096', 'ECDSA-P256']),
  purpose: z.enum(['data-encryption', 'key-encryption', 'signing']),
  expirationDays: z.number().min(1).max(3650).optional()
});

/**
 * Advanced Encryption Management Service
 * Handles all cryptographic operations for the CR AudioViz platform
 */
class EncryptionManagementService {
  private app: Application;
  private supabase: any;
  private redis: Redis;
  private hsmClient: CloudHSMV2;
  private kmsClient: KMS;
  private logger: winston.Logger;
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private rotationPolicies: Map<string, KeyRotationPolicy> = new Map();
  private masterKey: Buffer;
  private readonly PORT = process.env.PORT || 8080;
  private readonly SUPABASE_URL = process.env.SUPABASE_URL!;
  private readonly SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  private readonly REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  private readonly HSM_CLUSTER_ID = process.env.HSM_CLUSTER_ID;
  private readonly AWS_REGION = process.env.AWS_REGION || 'us-west-2';

  constructor() {
    this.app = express();
    this.initializeLogger();
    this.initializeClients();
    this.initializeMasterKey();
    this.setupMiddleware();
    this.setupRoutes();
    this.startKeyRotationScheduler();
  }

  /**
   * Initialize Winston logger with structured logging
   */
  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/encryption-service.log' })
      ]
    });
  }

  /**
   * Initialize external service clients
   */
  private async initializeClients(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabase = createClient(this.SUPABASE_URL, this.SUPABASE_SERVICE_ROLE_KEY);

      // Initialize Redis client
      this.redis = new Redis(this.REDIS_URL, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      // Initialize AWS HSM client
      this.hsmClient = new CloudHSMV2({
        region: this.AWS_REGION
      });

      // Initialize AWS KMS client
      this.kmsClient = new KMS({
        region: this.AWS_REGION
      });

      await this.redis.connect();
      this.logger.info('Successfully initialized all external clients');
    } catch (error) {
      this.logger.error('Failed to initialize clients:', error);
      throw error;
    }
  }

  /**
   * Initialize or retrieve master encryption key from HSM
   */
  private async initializeMasterKey(): Promise<void> {
    try {
      // Try to retrieve existing master key from HSM
      const cachedKey = await this.redis.get('master_key_id');
      
      if (cachedKey) {
        // Retrieve key from HSM using cached ID
        const keyData = await this.retrieveKeyFromHSM(cachedKey);
        if (keyData.success && keyData.data) {
          this.masterKey = keyData.data;
          this.logger.info('Master key retrieved from HSM');
          return;
        }
      }

      // Generate new master key in HSM
      const newMasterKey = await this.generateMasterKeyInHSM();
      if (newMasterKey.success && newMasterKey.keyId) {
        await this.redis.set('master_key_id', newMasterKey.keyId, 'EX', 86400);
        this.masterKey = newMasterKey.data!;
        this.logger.info('New master key generated in HSM');
      } else {
        throw new Error('Failed to generate master key in HSM');
      }
    } catch (error) {
      this.logger.error('Failed to initialize master key:', error);
      // Fallback to local key generation for development
      this.masterKey = crypto.randomBytes(32);
      this.logger.warn('Using fallback local master key - not for production');
    }
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later'
    });
    this.app.use(limiter);

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // API key authentication
    this.app.use('/api', this.authenticateApiKey.bind(this));
  }

  /**
   * API key authentication middleware
   */
  private async authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    try {
      // Verify API key against Supabase
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', crypto.createHash('sha256').update(apiKey).digest('hex'))
        .eq('active', true)
        .single();

      if (error || !data) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      // Attach API key info to request
      (req as any).apiKeyData = data;
      next();
    } catch (error) {
      this.logger.error('API key authentication error:', error);
      res.status(500).json({ error: 'Authentication service error' });
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Encryption endpoints
    this.app.post('/api/encrypt', this.encryptData.bind(this));
    this.app.post('/api/decrypt', this.decryptData.bind(this));
    this.app.post('/api/encrypt-file', this.encryptFile.bind(this));
    this.app.post('/api/decrypt-file', this.decryptFile.bind(this));

    // Key management endpoints
    this.app.post('/api/keys/generate', this.generateKey.bind(this));
    this.app.get('/api/keys', this.listKeys.bind(this));
    this.app.get('/api/keys/:keyId', this.getKey.bind(this));
    this.app.post('/api/keys/:keyId/rotate', this.rotateKey.bind(this));
    this.app.delete('/api/keys/:keyId', this.revokeKey.bind(this));

    // Key rotation policy endpoints
    this.app.post('/api/rotation-policies', this.createRotationPolicy.bind(this));
    this.app.get('/api/rotation-policies', this.listRotationPolicies.bind(this));
    this.app.put('/api/rotation-policies/:policyId', this.updateRotationPolicy.bind(this));

    // HSM operations
    this.app.post('/api/hsm/generate-key', this.generateHSMKey.bind(this));
    this.app.post('/api/hsm/sign', this.hsmSign.bind(this));
    this.app.post('/api/hsm/verify', this.hsmVerify.bind(this));

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  /**
   * Encrypt data using specified algorithm and key
   */
  private async encryptData(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = encryptionRequestSchema.parse(req.body);
      const { data, keyId, algorithm = 'AES-256-GCM', compressionEnabled = false } = validatedData;

      // Get or generate encryption key
      const encryptionKey = keyId ? 
        await this.getEncryptionKey(keyId) : 
        await this.getDefaultEncryptionKey();

      if (!encryptionKey) {
        res.status(404).json({ error: 'Encryption key not found' });
        return;
      }

      // Convert data to buffer
      let dataBuffer = Buffer.from(data, 'utf8');

      // Apply compression if enabled
      if (compressionEnabled) {
        const zlib = await import('zlib');
        dataBuffer = await new Promise((resolve, reject) => {
          zlib.gzip(dataBuffer, (err, compressed) => {
            if (err) reject(err);
            else resolve(compressed);
          });
        });
      }

      // Perform encryption based on algorithm
      let encryptedData: Buffer;
      let authTag: Buffer | null = null;
      let iv: Buffer;

      switch (algorithm) {
        case 'AES-256-GCM':
          iv = crypto.randomBytes(16);
          const gcmCipher = crypto.createCipherGCM('aes-256-gcm', encryptionKey.keyData);
          gcmCipher.setIV(iv);
          
          const gcmEncrypted = Buffer.concat([
            gcmCipher.update(dataBuffer),
            gcmCipher.final()
          ]);
          authTag = gcmCipher.getAuthTag();
          encryptedData = Buffer.concat([iv, authTag, gcmEncrypted]);
          break;

        case 'AES-256-CBC':
          iv = crypto.randomBytes(16);
          const cbcCipher = crypto.createCipher('aes-256-cbc', encryptionKey.keyData);
          encryptedData = Buffer.concat([
            iv,
            cbcCipher.update(dataBuffer),
            cbcCipher.final()
          ]);
          break;

        case 'ChaCha20-Poly1305':
          iv = crypto.randomBytes(12);
          const chachaCipher = crypto.createCipher('chacha20-poly1305', encryptionKey.keyData);
          chachaCipher.setIV(iv);
          
          const chachaEncrypted = Buffer.concat([
            chachaCipher.update(dataBuffer),
            chachaCipher.final()
          ]);
          authTag = (chachaCipher as any).getAuthTag();
          encryptedData = Buffer.concat([iv, authTag, chachaEncrypted]);
          break;

        default:
          res.status(400).json({ error: 'Unsupported encryption algorithm' });
          return;
      }

      // Cache encryption metadata
      const encryptionMetadata = {
        algorithm,
        keyId: encryptionKey.id,
        keyVersion: encryptionKey.version,
        compressed: compressionEnabled,
        timestamp: Date.now()
      };

      const encryptionId = crypto.randomUUID();
      await this.redis.setex(
        `encryption:${encryptionId}`,
        3600, // 1 hour TTL
        JSON.stringify(encryptionMetadata)
      );

      // Log encryption operation
      this.logger.info('Data encrypted successfully', {
        keyId: encryptionKey.id,
        algorithm,
        dataSize: dataBuffer.length,
        encryptedSize: encryptedData.length,
        compressed: compressionEnabled
      });

      res.json({
        success: true,
        encryptedData: encryptedData.toString('base64'),
        encryptionId,
        metadata: {
          algorithm,
          keyId: encryptionKey.id,
          compressed: compressionEnabled
        }
      });
    } catch (error) {
      this.logger.error('Encryption error:', error);
      res.status(500).json({ error: 'Encryption failed' });
    }
  }

  /**
   * Decrypt data using specified key
   */
  private async decryptData(req: Request, res: Response): Promise<void> {
    try {
      const { encryptedData, encryptionId, keyId } = req.body;

      if (!encryptedData) {
        res.status(400).json({ error: 'Encrypted data required' });
        return;
      }

      // Get encryption metadata
      let metadata: any = {};
      if (encryptionId) {
        const cachedMetadata = await this.redis.get(`encryption:${encryptionId}`);
        if (cachedMetadata) {
          metadata = JSON.parse(cachedMetadata);
        }
      }

      // Get decryption key
      const decryptionKeyId = keyId || metadata.keyId;
      const decryptionKey = await this.getEncryptionKey(decryptionKeyId);

      if (!decryptionKey) {
        res.status(404).json({ error: 'Decryption key not found' });
        return;
      }

      // Convert encrypted data from base64
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const algorithm = metadata.algorithm || 'AES-256-GCM';

      let decryptedData: Buffer;

      // Perform decryption based on algorithm
      switch (algorithm) {
        case 'AES-256-GCM':
          const iv = encryptedBuffer.subarray(0, 16);
          const authTag = encryptedBuffer.subarray(16, 32);
          const ciphertext = encryptedBuffer.subarray(32);
          
          const gcmDecipher = crypto.createDecipherGCM('aes-256-gcm', decryptionKey.keyData);
          gcmDecipher.setIV(iv);
          gcmDecipher.setAuthTag(authTag);
          
          decryptedData = Buffer.concat([
            gcmDecipher.update(ciphertext),
            gcmDecipher.final()
          ]);
          break;

        case 'AES-256-CBC':
          const cbcIv = encryptedBuffer.subarray(0, 16);
          const cbcCiphertext = encryptedBuffer.subarray(16);
          
          const cbcDecipher = crypto.createDecipher('aes-256-cbc', decryptionKey.keyData);
          decryptedData = Buffer.concat([
            cbcDecipher.update(cbcCiphertext),
            cbcDecipher.final()
          ]);
          break;

        case 'ChaCha20-Poly1305':
          const chachaIv = encryptedBuffer.subarray(0, 12);
          const chachaAuthTag = encryptedBuffer.subarray(12, 28);
          const chachaCiphertext = encryptedBuffer.subarray(28);
          
          const chachaDecipher = crypto.createDecipher('chacha20-poly1305', decryptionKey.keyData);
          chachaDecipher.setIV(chachaIv);
          (chachaDecipher as any).setAuthTag(chachaAuthTag);
          
          decryptedData = Buffer.concat([
            chachaDecipher.update(chachaCiphertext),
            chachaDecipher.final()
          ]);
          break;

        default:
          res.status(400).json({ error: 'Unsupported decryption algorithm' });
          return;
      }

      // Decompress if needed
      if (metadata.compressed) {
        const zlib = await import('zlib');
        decryptedData = await new Promise((resolve, reject) => {
          zlib.gunzip(decryptedData, (err, decompressed) => {
            if (err) reject(err);
            else resolve(decompressed);
          });
        });
      }

      // Log decryption operation
      this.logger.info('Data decrypted successfully', {
        keyId: decryptionKey.id,
        algorithm,
        decryptedSize: decryptedData.length
      });

      res.json({
        success: true,
        decryptedData: decryptedData.toString('utf8'),
        metadata: {
          algorithm,
          keyId: decryptionKey.id,
          compressed: metadata.compressed || false
        }
      });
    } catch (error) {
      this.logger.error('Decryption error:', error);
      res.status(500).json({ error: 'Decryption failed' });
    }
  }

  /**
   * Generate new encryption key
   */
  private async generateKey(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = keyGenerationSchema.parse(req.body);
      const { algorithm, purpose, expirationDays } = validatedData;

      let keySize: number;
      let keyData: Buffer;

      // Generate key based on algorithm
      switch (algorithm) {
        case 'AES-256':
          keySize = 256;
          keyData = crypto.randomBytes(32);
          break;
        case 'RSA-4096':
          keySize = 4096;
          const rsaKeyPair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
          keyData = Buffer.from(rsaKeyPair.privateKey);
          break;
        case 'ECDSA-P256':
          keySize = 256;
          const ecKeyPair = crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
          keyData = Buffer.from(ecKeyPair.privateKey);
          break;
        default:
          res.status(400).json({ error: 'Unsupported key algorithm' });
          return;
      }

      // Create encryption key record
      const encryptionKey: EncryptionKey = {
        id: crypto.randomUUID(),
        algorithm,
        keySize,
        keyData,
        createdAt: new Date(),
        expiresAt: expirationDays ? 
          new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) : 
          undefined,
        status: 'active',
        version: 1,
        metadata: { purpose, generatedBy: 'encryption-service' }
      };

      // Encrypt key data with master key before storage
      const encryptedKeyData = this.encryptWithMasterKey(