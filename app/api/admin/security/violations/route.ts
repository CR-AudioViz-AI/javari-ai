/**
 * JAVARI AI - SECURITY VIOLATIONS API
 * Roy-Only Access to Security Audit Logs
 * 
 * @version 1.0.0
 * @date November 21, 2025 - 11:18 PM EST
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { requireOwner } from '@/lib/security/javari-security';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Require owner access
    await requireOwner(user.id);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const blocked = searchParams.get('blocked');

    // Build query
    const supabase = createClient();
    let query = supabase
      .from('security_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (blocked !== null) {
      query = query.eq('blocked', blocked === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch violations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      violations: data || [],
      count: data?.length || 0
    });

  } catch (error: any) {
    console.error('Security violations API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes('UNAUTHORIZED') ? 403 : 500 }
    );
  }
}
