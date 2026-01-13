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
import { getErrorMessage } from '@/lib/utils/error-utils';
import { encrypt, maskValue } from '@/lib/credentials-utils';

export const dynamic = 'force-dynamic';

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
