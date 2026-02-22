/**
 * lib/command/checkAdmin.ts
 * Admin Access Validation for Command Center
 * Created: 2026-02-22 02:58 ET
 * 
 * Validates that the logged-in user has admin role
 * Required for all Command Center routes
 */

import { createClient } from '@supabase/supabase-js';
import { getSecret } from '@/lib/platform-secrets';

export interface AdminCheckResult {
  isAdmin: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Check if the current user has admin access
 * @param userId - The user's UUID from session
 * @returns AdminCheckResult with isAdmin boolean
 */
export async function checkAdminAccess(userId: string | null): Promise<AdminCheckResult> {
  if (!userId) {
    return {
      isAdmin: false,
      userId: null,
      error: 'No user session',
    };
  }

  try {
    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        isAdmin: false,
        userId,
        error: 'Configuration error',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query admin_roles table
    const { data, error } = await supabase
      .from('admin_roles')
      .select('role, granted_at')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (error || !data) {
      return {
        isAdmin: false,
        userId,
        error: error?.message || 'Not an admin',
      };
    }

    return {
      isAdmin: true,
      userId,
    };

  } catch (error) {
    return {
      isAdmin: false,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current user ID from Supabase session
 * This is a helper for server components
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabaseUrl = await getSecret('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseAnonKey = await getSecret('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    return session?.user?.id || null;

  } catch (error) {
    console.error('[checkAdmin] Error getting user ID:', error);
    return null;
  }
}
