/**
 * JAVARI AI - CREDENTIALS API
 * Secure credential storage and management with AES-256 encryption
 * 
 * Endpoints:
 * - GET    /api/credentials - List credentials (encrypted values masked)
 * - POST   /api/credentials - Add new credential
 * - PATCH  /api/credentials/[id] - Update credential
 * - DELETE /api/credentials/[id] - Delete credential
 * - POST   /api/credentials/[id]/test - Test credential connection
 * 
 * @version 1.0.0
 * @date October 27, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export const dynamic = 'force-dynamic';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Encrypt a credential value using AES-256-GCM
 */
function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

/**
 * Decrypt a credential value
 */
function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Mask a credential value for display
 */
function maskValue(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return '•'.repeat(value.length);
  return value.substring(0, visibleChars) + '•'.repeat(Math.min(20, value.length - visibleChars));
}

/**
 * GET /api/credentials
 * List all credentials for a user/project (with masked values)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    const userId = searchParams.get('user_id');
    const projectId = searchParams.get('project_id');
    const subprojectId = searchParams.get('subproject_id');
    const type = searchParams.get('type');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('credentials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    if (subprojectId) {
      query = query.eq('subproject_id', subprojectId);
    }
    
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(error) },
        { status: 500 }
      );
    }

    // Mask credential values for security
    const maskedData = data.map(cred => ({
      ...cred,
      value: maskValue(cred.value_encrypted),
      value_encrypted: undefined,
      iv: undefined,
      auth_tag: undefined
    }));

    return NextResponse.json(
      { success: true, data: maskedData },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credentials
 * Add a new credential
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    
    const {
      user_id,
      project_id,
      subproject_id,
      name,
      type,
      value,
      description,
      expires_at
    } = body;

    // Validate required fields
    if (!user_id || !name || !type || !value) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: user_id, name, type, value' },
        { status: 400 }
      );
    }

    // Encrypt the credential value
    const { encrypted, iv, tag } = encrypt(value);

    // Insert into database
    const { data, error } = await supabase
      .from('credentials')
      .insert({
        user_id,
        project_id,
        subproject_id,
        name,
        type,
        value_encrypted: encrypted,
        iv,
        auth_tag: tag,
        description,
        expires_at,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(error) },
        { status: 500 }
      );
    }

    // Return masked value
    const response = {
      ...data,
      value: maskValue(value),
      value_encrypted: undefined,
      iv: undefined,
      auth_tag: undefined
    };

    return NextResponse.json(
      { success: true, data: response },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/credentials/[id]/decrypt
 * Get decrypted credential value (requires authentication)
 */
export async function getDecryptedValue(credentialId: string, userId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('credentials')
      .select('value_encrypted, iv, auth_tag')
      .eq('id', credentialId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Decrypt the value
    const decrypted = decrypt(data.value_encrypted, data.iv, data.auth_tag);
    
    // Update last_used_at
    await supabase
      .from('credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credentialId);

    return decrypted;
  } catch (error: unknown) {
    logError('Decryption error:', error);
    return null;
  }
}
