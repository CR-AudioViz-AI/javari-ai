import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { z } from 'zod';

// Configuration and Types
interface EncryptionConfig {
  defaultAlgorithm: string;
  keyRotationInterval: number;
  hsm: {
    enabled: boolean;
    provider: string;
    keySlot?: number;
  };
  compliance: {
    auditLevel: 'basic' | 'detailed' | 'full';
    retentionDays: number;
  };
}

interface CryptoMetrics {
  operationCount: number;
  lastRotation: Date;
  algorithmUsage: Record<string, number>;
  performanceMs: number[];
}

interface HSMProvider {
  generateKey(algorithm: string, keySize: number): Promise<Buffer>;
  sign(data: Buffer, keyId: string): Promise<Buffer>;
  encrypt(data: Buffer, keyId: string): Promise<Buffer>;
  decrypt(data: Buffer, keyId: string): Promise<Buffer>;
}

// Request/Response Schemas
const encryptRequestSchema = z.object({
  data: z.string(),
  algorithm: z.enum(['AES-256-GCM', 'ChaCha20-Poly1305', 'AES-256-CBC']).optional(),
  keyId: z.string().optional(),
  metadata: z.record(z.string()).optional()
});

const decryptRequestSchema = z.object({
  encryptedData: z.string(),
  keyId: z.string(),
  iv: z.string(),
  authTag: z.string().optional(),
  metadata: z.record(z.string()).optional()
});

const keyExchangeSchema = z.object({
  publicKey: z.string(),
  algorithm: z.enum(['ECDH', 'RSA']),
  keySize: z.number().optional()
});

// Mock HSM Provider (replace with actual HSM integration)
class MockHSMProvider implements HSMProvider {
  async generateKey(algorithm: string, keySize: number): Promise<Buffer> {
    return crypto.randomBytes(keySize / 8);
  }

  async sign(data: Buffer, keyId: string): Promise<Buffer> {
    const key = crypto.randomBytes(32);
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest();
  }

  async encrypt(data: Buffer, keyId: string): Promise<Buffer> {
    const key = crypto.randomBytes(32);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  async decrypt(data: Buffer, keyId: string): Promise<Buffer> {
    const key = crypto.randomBytes(32);
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}

// Encryption Service Implementation
class EncryptionService {
  private config: EncryptionConfig;
  private hsm: HSMProvider;
  private metrics: CryptoMetrics;
  private supabase;

  constructor() {
    this.config = {
      defaultAlgorithm: 'AES-256-GCM',
      keyRotationInterval: 86400000, // 24 hours
      hsm: {
        enabled: process.env.HSM_ENABLED === 'true',
        provider: process.env.HSM_PROVIDER || 'mock'
      },
      compliance: {
        auditLevel: 'full',
        retentionDays: 2555 // 7 years
      }
    };

    this.hsm = new MockHSMProvider();
    this.metrics = {
      operationCount: 0,
      lastRotation: new Date(),
      algorithmUsage: {},
      performanceMs: []
    };

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async encrypt(data: string, algorithm?: string, keyId?: string): Promise<{
    encryptedData: string;
    keyId: string;
    iv: string;
    authTag?: string;
    algorithm: string;
  }> {
    const startTime = Date.now();
    const selectedAlgorithm = algorithm || this.config.defaultAlgorithm;
    const actualKeyId = keyId || await this.generateKeyId();

    try {
      let result;

      switch (selectedAlgorithm) {
        case 'AES-256-GCM':
          result = await this.encryptAESGCM(data, actualKeyId);
          break;
        case 'ChaCha20-Poly1305':
          result = await this.encryptChaCha20(data, actualKeyId);
          break;
        case 'AES-256-CBC':
          result = await this.encryptAESCBC(data, actualKeyId);
          break;
        default:
          throw new Error(`Unsupported algorithm: ${selectedAlgorithm}`);
      }

      // Update metrics
      this.updateMetrics(selectedAlgorithm, Date.now() - startTime);

      // Log operation for compliance
      await this.logOperation('encrypt', {
        keyId: actualKeyId,
        algorithm: selectedAlgorithm,
        dataSize: data.length,
        timestamp: new Date().toISOString()
      });

      return {
        ...result,
        keyId: actualKeyId,
        algorithm: selectedAlgorithm
      };
    } catch (error) {
      await this.logError('encrypt', error as Error, { keyId: actualKeyId, algorithm: selectedAlgorithm });
      throw error;
    }
  }

  async decrypt(encryptedData: string, keyId: string, iv: string, authTag?: string): Promise<string> {
    const startTime = Date.now();

    try {
      // Retrieve key metadata
      const keyMetadata = await this.getKeyMetadata(keyId);
      if (!keyMetadata) {
        throw new Error('Key not found or expired');
      }

      let decryptedData: string;

      switch (keyMetadata.algorithm) {
        case 'AES-256-GCM':
          decryptedData = await this.decryptAESGCM(encryptedData, keyId, iv, authTag!);
          break;
        case 'ChaCha20-Poly1305':
          decryptedData = await this.decryptChaCha20(encryptedData, keyId, iv, authTag!);
          break;
        case 'AES-256-CBC':
          decryptedData = await this.decryptAESCBC(encryptedData, keyId, iv);
          break;
        default:
          throw new Error(`Unsupported algorithm: ${keyMetadata.algorithm}`);
      }

      // Log operation for compliance
      await this.logOperation('decrypt', {
        keyId,
        algorithm: keyMetadata.algorithm,
        timestamp: new Date().toISOString()
      });

      this.updateMetrics(keyMetadata.algorithm, Date.now() - startTime);

      return decryptedData;
    } catch (error) {
      await this.logError('decrypt', error as Error, { keyId });
      throw error;
    }
  }

  private async encryptAESGCM(data: string, keyId: string): Promise<{
    encryptedData: string;
    iv: string;
    authTag: string;
  }> {
    const key = await this.getOrGenerateKey(keyId, 'AES-256-GCM');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipherGCM('aes-256-gcm', key);
    cipher.setAAD(Buffer.from(keyId));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  private async decryptAESGCM(encryptedData: string, keyId: string, iv: string, authTag: string): Promise<string> {
    const key = await this.getKey(keyId);
    const decipher = crypto.createDecipherGCM('aes-256-gcm', key);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    decipher.setAAD(Buffer.from(keyId));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async encryptChaCha20(data: string, keyId: string): Promise<{
    encryptedData: string;
    iv: string;
    authTag: string;
  }> {
    const key = await this.getOrGenerateKey(keyId, 'ChaCha20-Poly1305');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipher('chacha20-poly1305', key);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  private async decryptChaCha20(encryptedData: string, keyId: string, iv: string, authTag: string): Promise<string> {
    const key = await this.getKey(keyId);
    const decipher = crypto.createDecipher('chacha20-poly1305', key);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async encryptAESCBC(data: string, keyId: string): Promise<{
    encryptedData: string;
    iv: string;
  }> {
    const key = await this.getOrGenerateKey(keyId, 'AES-256-CBC');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex')
    };
  }

  private async decryptAESCBC(encryptedData: string, keyId: string, iv: string): Promise<string> {
    const key = await this.getKey(keyId);
    const decipher = crypto.createDecipher('aes-256-cbc', key);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async performKeyExchange(publicKey: string, algorithm: 'ECDH' | 'RSA'): Promise<{
    sharedSecret: string;
    publicKey: string;
  }> {
    try {
      if (algorithm === 'ECDH') {
        const ecdh = crypto.createECDH('secp256k1');
        const ourPublicKey = ecdh.generateKeys('hex');
        const sharedSecret = ecdh.computeSecret(publicKey, 'hex', 'hex');

        await this.logOperation('key_exchange', {
          algorithm,
          timestamp: new Date().toISOString()
        });

        return {
          sharedSecret,
          publicKey: ourPublicKey
        };
      } else {
        throw new Error('RSA key exchange not implemented in this example');
      }
    } catch (error) {
      await this.logError('key_exchange', error as Error, { algorithm });
      throw error;
    }
  }

  async rotateKeys(): Promise<{ rotatedKeys: string[] }> {
    try {
      const { data: activeKeys } = await this.supabase
        .from('encryption_keys')
        .select('key_id, created_at')
        .eq('status', 'active')
        .lt('created_at', new Date(Date.now() - this.config.keyRotationInterval).toISOString());

      const rotatedKeys: string[] = [];

      for (const keyData of activeKeys || []) {
        // Generate new key
        const newKeyId = await this.generateKeyId();
        await this.getOrGenerateKey(newKeyId, this.config.defaultAlgorithm);

        // Mark old key as deprecated
        await this.supabase
          .from('encryption_keys')
          .update({ status: 'deprecated' })
          .eq('key_id', keyData.key_id);

        rotatedKeys.push(keyData.key_id);
      }

      this.metrics.lastRotation = new Date();

      await this.logOperation('key_rotation', {
        rotatedCount: rotatedKeys.length,
        timestamp: new Date().toISOString()
      });

      return { rotatedKeys };
    } catch (error) {
      await this.logError('key_rotation', error as Error, {});
      throw error;
    }
  }

  private async getOrGenerateKey(keyId: string, algorithm: string): Promise<Buffer> {
    let key = await this.getKey(keyId);

    if (!key) {
      if (this.config.hsm.enabled) {
        key = await this.hsm.generateKey(algorithm, 256);
      } else {
        key = crypto.randomBytes(32);
      }

      // Store key metadata
      await this.supabase
        .from('encryption_keys')
        .insert({
          key_id: keyId,
          algorithm,
          status: 'active',
          created_at: new Date().toISOString(),
          key_hash: crypto.createHash('sha256').update(key).digest('hex')
        });

      // In production, store encrypted key in secure storage
      await this.storeKey(keyId, key);
    }

    return key;
  }

  private async getKey(keyId: string): Promise<Buffer | null> {
    // In production, retrieve from secure key storage
    try {
      const { data } = await this.supabase
        .from('encryption_keys')
        .select('*')
        .eq('key_id', keyId)
        .eq('status', 'active')
        .single();

      if (!data) return null;

      // Mock key retrieval - in production, decrypt from secure storage
      return crypto.randomBytes(32);
    } catch {
      return null;
    }
  }

  private async storeKey(keyId: string, key: Buffer): Promise<void> {
    // In production, encrypt and store in secure key vault
    // This is a mock implementation
  }

  private async getKeyMetadata(keyId: string): Promise<{ algorithm: string } | null> {
    try {
      const { data } = await this.supabase
        .from('encryption_keys')
        .select('algorithm')
        .eq('key_id', keyId)
        .eq('status', 'active')
        .single();

      return data;
    } catch {
      return null;
    }
  }

  private async generateKeyId(): Promise<string> {
    return `key_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private updateMetrics(algorithm: string, performanceMs: number): void {
    this.metrics.operationCount++;
    this.metrics.algorithmUsage[algorithm] = (this.metrics.algorithmUsage[algorithm] || 0) + 1;
    this.metrics.performanceMs.push(performanceMs);

    // Keep only last 1000 performance measurements
    if (this.metrics.performanceMs.length > 1000) {
      this.metrics.performanceMs = this.metrics.performanceMs.slice(-1000);
    }
  }

  private async logOperation(operation: string, details: any): Promise<void> {
    if (this.config.compliance.auditLevel === 'basic') return;

    await this.supabase
      .from('encryption_audit_log')
      .insert({
        operation,
        details,
        timestamp: new Date().toISOString(),
        user_id: 'system' // In production, get from auth context
      });
  }

  private async logError(operation: string, error: Error, context: any): Promise<void> {
    await this.supabase
      .from('encryption_error_log')
      .insert({
        operation,
        error_message: error.message,
        error_stack: error.stack,
        context,
        timestamp: new Date().toISOString()
      });
  }

  getMetrics(): CryptoMetrics {
    return { ...this.metrics };
  }

  async generateComplianceReport(): Promise<any> {
    const { data: auditLogs } = await this.supabase
      .from('encryption_audit_log')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: errorLogs } = await this.supabase
      .from('encryption_error_log')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return {
      reportDate: new Date().toISOString(),
      period: '30 days',
      metrics: this.getMetrics(),
      auditLogCount: auditLogs?.length || 0,
      errorLogCount: errorLogs?.length || 0,
      compliance: {
        auditLevel: this.config.compliance.auditLevel,
        retentionDays: this.config.compliance.retentionDays
      }
    };
  }
}

// API Route Handler
export async function POST(request: NextRequest) {
  const encryptionService = new EncryptionService();

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'encrypt': {
        const body = await request.json();
        const { data, algorithm, keyId, metadata } = encryptRequestSchema.parse(body);
        
        const result = await encryptionService.encrypt(data, algorithm, keyId);
        
        return NextResponse.json({
          success: true,
          data: result
        });
      }

      case 'decrypt': {
        const body = await request.json();
        const { encryptedData, keyId, iv, authTag, metadata } = decryptRequestSchema.parse(body);
        
        const result = await encryptionService.decrypt(encryptedData, keyId, iv, authTag);
        
        return NextResponse.json({
          success: true,
          data: { decryptedData: result }
        });
      }

      case 'key-exchange': {
        const body = await request.json();
        const { publicKey, algorithm, keySize } = keyExchangeSchema.parse(body);
        
        const result = await encryptionService.performKeyExchange(publicKey, algorithm);
        
        return NextResponse.json({
          success: true,
          data: result
        });
      }

      case 'rotate-keys': {
        const result = await encryptionService.rotateKeys();
        
        return NextResponse.json({
          success: true,
          data: result
        });
      }

      case 'metrics': {
        const metrics = encryptionService.getMetrics();
        
        return NextResponse.json({
          success: true,
          data: metrics
        });
      }

      case 'compliance-report': {
        const report = await encryptionService.generateComplianceReport();
        
        return NextResponse.json({
          success: true,
          data: report
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Encryption service error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const encryptionService = new EncryptionService();
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'metrics':
        return NextResponse.json({
          success: true,
          data: encryptionService.getMetrics()
        });

      case 'compliance-report':
        return NextResponse.json({
          success: true,
          data: await encryptionService.generateComplianceReport()
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Encryption service error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}