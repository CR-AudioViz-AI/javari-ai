/**
 * JAVARI AI - AUTHENTICATION HELPER
 * Supabase Auth integration utilities
 * 
 * @version 1.0.0
 * @date October 27, 2025
 */

import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { getErrorMessage, logError, formatApiError } from '@/lib/utils/error-utils';

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  is_authenticated: boolean;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username,
      full_name: user.user_metadata?.full_name,
      avatar_url: user.user_metadata?.avatar_url,
      is_authenticated: true
    };
  } catch (error: unknown) {
    logError('Failed to get current user:\', error);
    return null;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const supabase = createClient();
  return await supabase.auth.signInWithPassword({ email, password });
}

/**
 * Sign up new user
 */
export async function signUp(email: string, password: string, metadata?: any) {
  const supabase = createClient();
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata
    }
  });
}

/**
 * Sign out current user
 */
export async function signOut() {
  const supabase = createClient();
  return await supabase.auth.signOut();
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const supabase = createClient();
  return await supabase.auth.resetPasswordForEmail(email);
}

/**
 * Update user profile
 */
export async function updateProfile(updates: {
  email?: string;
  password?: string;
  data?: any;
}) {
  const supabase = createClient();
  return await supabase.auth.updateUser(updates);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null && user.is_authenticated;
}

/**
 * Get user session
 */
export async function getSession() {
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

/**
 * Refresh session
 */
export async function refreshSession() {
  const supabase = createClient();
  return await supabase.auth.refreshSession();
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const supabase = createClient();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
        username: session.user.user_metadata?.username,
        full_name: session.user.user_metadata?.full_name,
        avatar_url: session.user.user_metadata?.avatar_url,
        is_authenticated: true
      };
      callback(authUser);
    } else {
      callback(null);
    }
  });

  return subscription;
}

/**
 * Require authentication (for use in API routes)
 */
export async function requireAuth(request: Request): Promise<{ user: User; error: null } | { user: null; error: string }> {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user, error: null };
}
