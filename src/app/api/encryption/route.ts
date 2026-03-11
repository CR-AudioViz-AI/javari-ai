import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { z } from 'zod';

// Types
interface EncryptionKey {
  id: string;
  keyType: 'symmetric' | 'asymmetric' | 'quantum-resistant';
  algorithm: string;
  keySize: number;
  serviceId: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'rotating' | 'expired' | 'revoked';
  hsmBacked: boolean;
  quantumSafe: boolean;
}

interface CertificateInfo {
  id: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  keyUsage: string[];
}

interface EncryptionOperation {
  operationType: 'encrypt' | 'decrypt' | 'sign' | 'verify';
  algorithm: string;
  keyId: string;
  data: string;
  metadata?: Record<string, any>;
}

// Validation schemas
const keyGenerationSchema = z.object({
  keyType: z.enum(['symmetric', 'asymmetric', 'quantum-resistant']),
  algorithm: z.string().min(1),
  keySize: z.number().min(128),
  serviceId: z.string().min(1),
  expiryDays: z.number().min(1).max(365).optional(),
  hsmBacked: z.boolean().optional(),
  quantumSafe: z.boolean().optional()
});

const encryptionOperationSchema = z.object({
  operationType: z.enum(['encrypt', 'decrypt', 'sign', 'verify']),
  keyId: z.string().min(1),
  data: z.string().min(1),
  algorithm: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const certificateRequestSchema = z.object({
  subject: z.string().min(1),
  keyId: z.string().min(1),
  validityDays: z.number().min(1).max(365),
  keyUsage: z.array(z.string()),
  sanEntries: z.array(z.string()).optional()
});

// Crypto utilities
class EncryptionManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async generateKey(params: z.infer<typeof keyGenerationSchema>): Promise<EncryptionKey> {
    const keyId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (params.expiryDays || 30));

    let keyMaterial: string;
    let publicKey: string | null = null;

    if (params.keyType === 'symmetric') {
      keyMaterial = crypto.randomBytes(params.keySize / 8).toString('base64');
    } else if (params.keyType === 'asymmetric') {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: params.keySize,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      keyMaterial = keyPair.privateKey;
      publicKey = keyPair.publicKey;
    } else if (params.keyType === 'quantum-resistant') {
      // Simulate quantum-resistant key generation (e.g., Dilithium, Kyber)
      keyMaterial = crypto.randomBytes(params.keySize / 8).toString('base64');
    } else {
      throw new Error('Unsupported key type');
    }

    // Store encrypted key material in Supabase
    const { error } = await this.supabase
      .from('encryption_keys')
      .insert({
        id: keyId,
        key_type: params.keyType,
        algorithm: params.algorithm,
        key_size: params.keySize,
        service_id: params.serviceId,
        key_material: this.encryptKeyMaterial(keyMaterial),
        public_key: publicKey,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        hsm_backed: params.hsmBacked || false,
        quantum_safe: params.quantumSafe || false,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store key: ${error.message}`);
    }

    return {
      id: keyId,
      keyType: params.keyType,
      algorithm: params.algorithm,
      keySize: params.keySize,
      serviceId: params.serviceId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
      hsmBacked: params.hsmBacked || false,
      quantumSafe: params.quantumSafe || false
    };
  }

  async rotateKey(keyId: string): Promise<EncryptionKey> {
    // Mark current key as rotating
    const { data: currentKey, error: fetchError } = await this.supabase
      .from('encryption_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (fetchError || !currentKey) {
      throw new Error('Key not found');
    }

    // Generate new key with same parameters
    const newKey = await this.generateKey({
      keyType: currentKey.key_type,
      algorithm: currentKey.algorithm,
      keySize: currentKey.key_size,
      serviceId: currentKey.service_id,
      hsmBacked: currentKey.hsm_backed,
      quantumSafe: currentKey.quantum_safe
    });

    // Update old key status
    await this.supabase
      .from('encryption_keys')
      .update({ status: 'rotating' })
      .eq('id', keyId);

    return newKey;
  }

  async performOperation(operation: z.infer<typeof encryptionOperationSchema>): Promise<string> {
    // Retrieve key material
    const { data: keyData, error } = await this.supabase
      .from('encryption_keys')
      .select('*')
      .eq('id', operation.keyId)
      .eq('status', 'active')
      .single();

    if (error || !keyData) {
      throw new Error('Key not found or inactive');
    }

    const keyMaterial = this.decryptKeyMaterial(keyData.key_material);

    switch (operation.operationType) {
      case 'encrypt':
        return this.encrypt(operation.data, keyMaterial, keyData.algorithm);
      case 'decrypt':
        return this.decrypt(operation.data, keyMaterial, keyData.algorithm);
      case 'sign':
        return this.sign(operation.data, keyMaterial, keyData.algorithm);
      case 'verify':
        return this.verify(operation.data, keyMaterial, keyData.algorithm);
      default:
        throw new Error('Unsupported operation');
    }
  }

  private encrypt(data: string, key: string, algorithm: string): string {
    if (algorithm.includes('AES')) {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', key);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
    }
    throw new Error('Unsupported encryption algorithm');
  }

  private decrypt(encryptedData: string, key: string, algorithm: string): string {
    if (algorithm.includes('AES')) {
      const buffer = Buffer.from(encryptedData, 'base64');
      const iv = buffer.subarray(0, 16);
      const authTag = buffer.subarray(16, 32);
      const encrypted = buffer.subarray(32);
      
      const decipher = crypto.createDecipher('aes-256-gcm', key);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }
    throw new Error('Unsupported decryption algorithm');
  }

  private sign(data: string, privateKey: string, algorithm: string): string {
    const signer = crypto.createSign(algorithm);
    signer.update(data);
    return signer.sign(privateKey, 'base64');
  }

  private verify(signature: string, publicKey: string, algorithm: string): string {
    // This would typically verify against original data
    const verifier = crypto.createVerify(algorithm);
    const isValid = verifier.verify(publicKey, signature, 'base64');
    return isValid.toString();
  }

  private encryptKeyMaterial(keyMaterial: string): string {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', masterKey);
    let encrypted = cipher.update(keyMaterial, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]).toString('base64');
  }

  private decryptKeyMaterial(encryptedKeyMaterial: string): string {
    const masterKey = process.env.ENCRYPTION_MASTER_KEY!;
    const buffer = Buffer.from(encryptedKeyMaterial, 'base64');
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    
    const decipher = crypto.createDecipher('aes-256-gcm', masterKey);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// Authentication middleware
async function validateServiceAuth(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  const serviceId = request.headers.get('x-service-id');
  
  if (!authHeader?.startsWith('Bearer ') || !serviceId) {
    throw new Error('Missing authentication credentials');
  }

  const token = authHeader.substring(7);
  
  // Validate service token (implement your auth logic)
  if (!token || token.length < 32) {
    throw new Error('Invalid service token');
  }

  return serviceId;
}

// Rate limiting and security
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(serviceId: string, maxRequests = 100): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  
  const current = rateLimitMap.get(serviceId);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(serviceId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

const encryptionManager = new EncryptionManager();

export async function POST(request: NextRequest) {
  try {
    const serviceId = await validateServiceAuth(request);
    
    if (!checkRateLimit(serviceId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const path = new URL(request.url).pathname;

    if (path.includes('/keys')) {
      // Key generation
      const validatedData = keyGenerationSchema.parse(body);
      const key = await encryptionManager.generateKey(validatedData);
      
      return NextResponse.json({
        success: true,
        data: key
      });
    } else if (path.includes('/operations')) {
      // Cryptographic operations
      const validatedData = encryptionOperationSchema.parse(body);
      const result = await encryptionManager.performOperation(validatedData);
      
      return NextResponse.json({
        success: true,
        data: { result }
      });
    } else if (path.includes('/rotate')) {
      // Key rotation
      const { keyId } = body;
      if (!keyId) {
        return NextResponse.json(
          { error: 'Key ID is required' },
          { status: 400 }
        );
      }
      
      const newKey = await encryptionManager.rotateKey(keyId);
      
      return NextResponse.json({
        success: true,
        data: newKey
      });
    }

    return NextResponse.json(
      { error: 'Invalid endpoint' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Encryption API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const serviceId = await validateServiceAuth(request);
    
    if (!checkRateLimit(serviceId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');
    const status = searchParams.get('status');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('encryption_keys')
      .select('id, key_type, algorithm, key_size, service_id, expires_at, status, hsm_backed, quantum_safe, created_at')
      .eq('service_id', serviceId);

    if (keyId) {
      query = query.eq('id', keyId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Encryption API GET error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const serviceId = await validateServiceAuth(request);
    
    if (!checkRateLimit(serviceId, 50)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json(
        { error: 'Key ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Mark key as revoked instead of deleting
    const { error } = await supabase
      .from('encryption_keys')
      .update({ 
        status: 'revoked',
        revoked_at: new Date().toISOString()
      })
      .eq('id', keyId)
      .eq('service_id', serviceId);

    if (error) {
      throw new Error(`Failed to revoke key: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Key revoked successfully'
    });

  } catch (error) {
    console.error('Encryption API DELETE error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}